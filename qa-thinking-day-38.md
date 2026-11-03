# QA Thinking — Day 38

## Testing SCIM Deprovisioning: `active: false` Is a Request to Revoke Access, Not Proof That Access Is Gone

**Domain:** B2B SaaS / identity lifecycle · **Focus:** API and integration testing, business rules, facilitating a decision nobody has made yet

---

### The scenario

Your company sells a B2B SaaS analytics product. Enterprise customers connect their identity provider (IdP), usually Okta or Microsoft Entra ID, so their users can sign in with SSO and so accounts get created and removed automatically through **SCIM** (System for Cross-domain Identity Management).

A large customer's security team sends a short question during contract renewal:

> "When we offboard an employee in Okta, how quickly do they lose access to your product, and how do you prove it?"

The developers say: "We support SCIM. When Okta deactivates the user, we set `active = false`. Done." The ticket closes and the automated check passes. The check sends a `PATCH`, then `GET /Users/{id}`, then asserts `active == false`.

That check proves the database row changed. It doesn't show that the person lost access. Most of today's lesson is about the distance between those two things.

---

### Domain primer: what you need to know about SCIM and offboarding

- **SSO vs. SCIM.** SSO (SAML/OIDC) decides who can *start* a session. SCIM is a REST protocol that the IdP uses to *create, update and deactivate* accounts in your app. They are separate channels, and a customer can have one without the other.
- **Joiner / Mover / Leaver (JML).** IT teams think in these three events. Testers usually cover "joiner" well because the demo shows it. "Mover" (role or group changes) and "leaver" (offboarding) are where the risk sits.
- **Soft delete vs. hard delete.** IdPs mostly *don't delete* users in your app. Okta's SCIM docs say it doesn't send DELETE for user objects at all. It deactivates by setting `active` to `false`, using PATCH for new Okta Integration Network apps and PUT for older custom integrations. Microsoft Entra's provisioning service disables users with an update in several cases: unassigned from the app, out of scope, disabled or soft-deleted in the directory. It only sends DELETE when the user is hard-deleted, which happens 30 days after a soft delete in Entra.
- **Seats.** B2B SaaS is often billed per seat. Whether a deactivated user still uses a paid seat is a **billing rule**, not an identity rule. Finance cares about it as much as security does.
- **Tenant admin vs. end user.** The customer's IT admin is your real user here. They will never look at your UI during offboarding. They look at Okta or Entra and assume your app follows it.

---

### The key insight: the spec gave the decision to your team

[RFC 7643](https://www.rfc-editor.org/rfc/rfc7643) defines the `active` attribute as a boolean showing the user's administrative status and says that "the definitive meaning of this attribute is determined by the service provider." The service provider is your app.

So the standard doesn't define what deactivation means. Your team does, whether or not anyone wrote it down. If nobody decided, the answer is whatever the code happens to do. In practice that's usually "the login page rejects them." Everything they already hold keeps working.

The [WorkOS article on SCIM deprovisioning](https://workos.com/blog/scim-deprovisioning-promise-your-app-breaks) (Aug 2026, no named author, vendor blog) lists the usual gaps: existing sessions that are never re-checked, refresh tokens that keep issuing new access tokens, and API keys or personal access tokens that "usually aren't tied to the SCIM user at all." I'm using it as a list of hypotheses to test, not as evidence. The underlying fact, that `active` means whatever you implement, comes from the RFC itself.

This changes your role. You're no longer just checking a requirement. You're **finding a missing requirement and getting the right people to decide it**.

---

### Step 1: Map every place access lives (HTSM Structure, Time, Interfaces, Operations)

James Bach's [Heuristic Test Strategy Model](https://www.satisfice.com/download/heuristic-test-strategy-model) (v6.3, Satisfice) lists product factors to think through: Structure, Function, Data, Interfaces, Platform, Operations, Time. Don't recite them. Use them to find the forms of access that a "user row" model hides.

**Structure: what can still let this person in?**

| Credential / access path | Lifetime | Does `active=false` reach it? |
|---|---|---|
| Browser session cookie | until expiry or logout | Only if every request re-checks status |
| OAuth refresh token (web, mobile app) | days to months | Only if revoked explicitly |
| Access token / JWT already issued | minutes to hours | Usually *no*. Stateless tokens are valid until they expire |
| Personal API token / PAT | often "never expires" | Only if tied to the user |
| OAuth grants to third-party apps (e.g. "Connect to Slack") | long-lived | Rarely considered |
| Open WebSocket / live dashboard stream | as long as the tab is open | Almost never re-authorized |
| Mobile offline cache / exported data links | varies | Signed download URLs outlive everything |
| Scheduled jobs *owned* by the user (email reports, exports) | indefinite | Keep sending data to an inbox that may be forwarded |

**Time: how long after the IdP action until real access ends?** That's the number the customer's security team is asking for. It's several delays added together:

1. The IdP's own delay. Entra runs provisioning in periodic incremental cycles. Failed operations are retried in the next cycle with "gradually scaling back" frequency. If most calls fail, the job goes into **quarantine**, where cycles drop to once per day ([Microsoft Learn: How provisioning works](https://learn.microsoft.com/en-us/entra/identity/app-provisioning/how-provisioning-works)).
2. Your processing delay (queue, async worker).
3. Credential lifetime: how long already-issued tokens stay valid.

The Entra documentation implies something important: **if your deactivation endpoint returns a 500, the ex-employee keeps access until the IdP retries, and in quarantine that can be a day or longer.** Your error handling is part of your security boundary.

**Interfaces: what does the IdP actually send?** Microsoft's [SCIM compliance known-issues page](https://learn.microsoft.com/en-us/entra/identity/app-provisioning/application-provisioning-config-problem-scim-compatibility) shows that without the `aadOptscim062020` flag, Entra disables users with:

```json
{ "op": "Replace", "path": "active", "value": "False" }
```

With the flag, it sends `"op": "replace"` and the boolean `false`. Microsoft says the compliant behavior "will become the default over the next few months" but still lists the fix date as TBD. So the same customer action can reach your API as a **capitalized op with a string value** or as a lowercase op with a boolean, depending on how that tenant was configured. Add Okta's PUT for older custom apps and you have at least three request shapes that all mean "this person has left."

A parser that strictly accepts only the RFC example may reject a real deactivation with a 400. Or worse, it may accept the request, ignore an unrecognized op, and return 200 without changing anything.

**Operations: how do real admins actually offboard people?** Unassigning the app. Removing someone from a group that grants the app. Disabling them in the directory. Deleting them. Entra treats leaving a dynamic group as a deprovisioning event. It **doesn't read nested groups**, so a user assigned only through a nested group may never be provisioned or deprovisioned by SCIM. Also consider reactivation: Entra's docs note that when a soft-deleted user becomes active again, it reactivates the user but doesn't automatically restore their dynamic group memberships.

---

### Step 2: Find the business-rule conflict before it reaches production

Once you've mapped the credentials, the team will disagree, and they should. The questions are business decisions:

- **Personal API tokens.** Security wants them revoked immediately. Customer Success knows that in many customer accounts, a nightly data sync runs on the token of an engineer who left two years ago. Revoke on deactivation and you break that customer's production integration on the day an admin tidies up Okta. Neither side is wrong.
- **Owned objects.** Do the user's dashboards, scheduled reports and alert rules keep running, get transferred, or get paused? Who is notified?
- **Seats.** Does deactivation release the seat immediately, at the end of the billing period, or only at hard delete?
- **Reactivation.** If a contractor returns three months later, do they get their old roles back? What if their email address has since been given to a *different* person (common with `firstname@` addresses)?
- **Deletion.** When Entra sends DELETE after 30 days, is that a hard purge (privacy-friendly, audit-hostile) or another soft delete?

Your job isn't to pick the answers. It's to make sure **someone with authority picks them deliberately**, with the consequences visible.

---

### Step 3: Facilitate the "deactivation contract" (soft skills that do the work)

Don't take this to the team as a bug titled "Sessions not revoked on SCIM deactivate." That framing starts an argument about whether it's a bug. The developer will say, correctly, that the code does what the ticket said.

Take it as a **gap in the definition**, with evidence and options. A 30-minute session with the PO, a security engineer, a backend developer and someone from Customer Success or Support works well.

**Open with the evidence, not an opinion:**

> "I deactivated a test user through SCIM at 10:02. At 10:47 that user's browser tab was still loading dashboards, their PAT still pulled data via the API, and their scheduled report went out at 11:00. The RFC says the meaning of `active` is ours to define, and we haven't defined it. I'd like us to decide it today, because a customer's security team has asked us for a number."

**Lay out options with consequences**, not a recommendation disguised as a question:

| Credential | Option A: revoke immediately | Option B: revoke and notify the admin | Option C: keep, flag as orphaned |
|---|---|---|---|
| Sessions | Safe, small UX cost | n/a | Not defensible |
| PATs | Breaks unknown integrations | Breaks them, but the admin knows why | Fails the customer's security question |
| Scheduled reports | Silent loss of reports for others | Admin can reassign | Data keeps leaving the company |

**Handle disagreement by naming the trade-off, not taking a side.** If Security and Customer Success clash over PATs, a useful move is: *"It sounds like we agree a leaver's token must stop working. We disagree on whether a customer should find out from an outage or from a notification. Can we decide that part?"* That turns a fight about values into a decision about design, often something like "service accounts for integrations, plus a pre-deactivation warning listing tokens that will be revoked."

**Close by writing the contract down**, one row per credential type: what happens, within what time, what the admin sees, what is logged. That table becomes your test oracle. It's also the honest answer to the customer: a commitment you can test, instead of "we support SCIM."

---

### Step 4: Turn the contract into tests and checks

**Exploratory charter (60 min):**
> *Explore SCIM deactivation using each real IdP payload shape, with a test user holding every credential type in the Structure table, to discover which access paths survive deactivation and for how long.*

Setup matters more than technique here. Before deactivating, give the test user *everything*: two browser sessions, a mobile login, a PAT, an OAuth grant to a third-party app, an open live dashboard, a scheduled report and a dashboard shared with a colleague. Then deactivate and try every path again, with timestamps.

**Test ideas worth running:**

1. Send all three payload shapes (Entra legacy `Replace`/`"False"`, Entra compliant, Okta PUT). The oracle is that access actually ends, not that the response is 200.
2. Send a deactivation PATCH with an op your parser doesn't recognize. Does it return 400, or 200 with nothing changed? Silent success is the worst outcome.
3. Make deactivation fail (DB unavailable, timeout) and check the response code. Then ask how long the IdP takes to retry, and whether your operators would even know.
4. Deactivate, then reactivate within one minute. Do you get a race between async revocation and reactivation, so the user ends up active but with tokens revoked, or worse, inactive but with live tokens?
5. Remove the user from the granting group, not from the app. Then test with a nested group.
6. Deactivate a user who **owns** the only admin role in the tenant. Does the tenant now have no admin?
7. Reactivate a user whose email now belongs to someone else. Whose data does the account see?

**What to automate (and what not to):**
Automate the **post-deactivation probe**: a check that sets up a user with every credential type, deactivates them through each payload variant, then calls a protected endpoint with *each credential* and expects 401/403 within the agreed time. That check encodes the contract, which `GET /Users/{id}` → `active == false` never did. Keep the reactivation races and ownership scenarios exploratory until you understand them. Automate only the ones that turn into stable rules.

**Observability:**
Ask for one metric and one log query:
- **Metric:** time between "SCIM deactivation received" and "last successful authenticated request by that user ID." In production, this is your real revocation latency, measured on real customers.
- **Alert:** any authenticated request from a user whose `active` is false. Under a correct implementation that should be zero, so any occurrence is a real signal.
- **Log:** SCIM requests that returned non-2xx for deactivation operations. Each one may mean a leaver still has access.

---

### Why this is a tester's problem, not just security's

Security reviews usually ask whether a control *exists*. Testers ask whether the control *works under the conditions it will actually face*: real IdP payloads, retries, reactivation, ownership, long-lived tokens. The most valuable result here isn't a bug report. It's a sentence the company can honestly put into a security questionnaire, backed by a check that fails if it stops being true.

---

### Practical challenge (45–60 minutes)

Pick any product you work on that has users. If it has no SCIM, use your own admin "disable user" button. The same reasoning applies.

1. **Inventory:** List every credential or access path a user can hold (aim for at least 6; use the Structure table as a prompt). For each, write down its lifetime and whether you *know* what happens to it on deactivation, or are *assuming*.
2. **Measure one:** Pick the path you trust least. Deactivate a test user and measure how long that path keeps working. Record timestamps.
3. **Find the business conflict:** Identify one credential where revoking immediately would hurt a customer (an integration, a shared report, a seat). Write the two-sentence trade-off as you'd say it in a meeting, without picking a side.
4. **Draft the contract row:** For that credential, write: *what happens, within what time, what the admin sees, what gets logged.* Bring it to your next refinement as a question, not a bug.

**Stretch:** Write the oracle for an automated post-deactivation probe in plain language (inputs, the expected observation per credential, the time limit) and get a developer to agree it's the right assertion before anyone writes code.

---

### Sources

- James Bach, [Heuristic Test Strategy Model v6.3 (Satisfice)](https://www.satisfice.com/download/heuristic-test-strategy-model): product factors (Structure, Interfaces, Operations, Time) used to map access paths
- [RFC 7643: SCIM Core Schema](https://www.rfc-editor.org/rfc/rfc7643): definition of `active`; meaning determined by the service provider
- Microsoft Learn, [Known issues with SCIM 2.0 protocol compliance (Entra ID)](https://learn.microsoft.com/en-us/entra/identity/app-provisioning/application-provisioning-config-problem-scim-compatibility): legacy vs. compliant disable payloads, `aadOptscim062020` flag
- Microsoft Learn, [How application provisioning works in Microsoft Entra ID](https://learn.microsoft.com/en-us/entra/identity/app-provisioning/how-provisioning-works): deprovisioning triggers, 30-day hard delete, retries, quarantine, nested-group limitation, reactivation caveat
- Okta Developer, [SCIM 2.0 protocol guide](https://developer.okta.com/docs/api/openapi/okta-scim/guides/scim-20): PATCH for OIN apps, PUT for custom apps, no DELETE of user objects
- WorkOS, [SCIM Deprovisioning Is a Promise Your App Probably Breaks](https://workos.com/blog/scim-deprovisioning-promise-your-app-breaks): vendor practitioner article, used for failure hypotheses (sessions, refresh tokens, API keys) and checked against the primary sources above
