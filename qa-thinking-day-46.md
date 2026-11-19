# QA Thinking — Day 46

## Testing Frequency Caps: The Contract Limits What a Person Sees, but the Ad Server Can Only Count IDs

**Rotation today:** ad tech domain knowledge, test oracles, and explaining risk to people outside engineering (ad ops, sales, the advertiser).

---

### The situation

You test the ad stack for a sports news publisher. It has a website, iOS and Android apps, and a connected-TV (CTV) app that streams highlights. Sales signed a sponsorship with a betting-free sportswear brand for the Champions League match weeks. The insertion order (IO) says:

> "Maximum 3 exposures per user per day."

Two weeks ago the team shipped a **publisher-provided ID (PPID)** integration. Logged-in users now send a hashed first-party ID to the ad server, so frequency caps no longer depend only on browser cookies.

Two complaints arrive in the same week:

1. **Ad ops:** "The sponsorship line item delivered 61% of its daily goal. Uncapped line items are fine. The frequency cap is broken."
2. **The advertiser's agency:** "Our measurement panel shows some people saw the ad 7–9 times a day. Your frequency cap is broken."

Both say the cap is broken, but they point in opposite directions: one says it caps too much, the other too little. **Both can be true at the same time.** Today's lesson is about why, and how to test so you find this before the advertiser does.

---

### Domain primer: what a frequency cap is and why it costs money

- **Frequency** is how many times one person sees an ad in a time window. **Reach** is how many distinct people saw it. Advertisers pay for reach at a controlled frequency. Too few exposures and the message doesn't land. Too many wastes money and annoys viewers.
- A **frequency cap** limits impressions per user per time window. In Google Ad Manager, a line item can carry up to 10 caps, and all of them are enforced. "1 per hour" and "3 per day" both apply.
- **Caps have a delivery cost.** Each capped impression is an impression the line item can't serve, so caps slow delivery. If a guaranteed line item underdelivers, the publisher owes a **makegood** (free impressions later) or a refund. A cap that is too strict loses the publisher money directly. A cap that is too loose loses advertiser trust and the renewal.
- **"User" means identifier.** The ad server never sees a person. It sees a cookie, a PPID, a mobile ad ID (IDFA/AdID), a CTV IFA, or nothing. A cap is a counter keyed by whatever ID is in the request.
- **Caps exist at more than one layer.** The publisher's ad server caps the line item. The advertiser's DSP may cap the campaign separately. Neither sees the other's counter.

Here are the important details from Google's own documentation. These are exactly the facts a tester should have read before the release:

| Documented behavior | Why a tester cares |
|---|---|
| Time-based caps need a USERID or PPID. **Without one, the line item is not eligible to serve.** | A missing ID doesn't break the cap. It **kills delivery** for that request. |
| Video **pod/stream** caps: without an ID, the line item can still serve but **ignores the cap**. | The same missing ID causes the opposite failure: **overexposure**. |
| By default, caps count **code served**, not rendered impressions. Delayed impression capping is opt-in. | Lazy-loaded or prefetched ads can use up the cap without anyone seeing them. |
| In a new session without cookies, a cap **can be exceeded by one**, because the first impression collects the cookie. | Cap 3 can legitimately show as 4. That isn't a bug, but someone has to explain it. |
| On mobile web with third-party cookies blocked, caps apply **within one domain**. In apps with a first-party ID fallback, they apply **within one app**. | One person on web + app + CTV can be three "users" by design. |
| Roadblocked line items count **page views**, not ad impressions. A cap of 6 with 3 creatives can mean 18 ad impressions per user. | "Exposures" in the IO may not mean what the ad server counts. |

Display & Video 360 (Google's buy-side DSP) adds more: when cookies or device IDs are missing, some line items use **modeled** caps built with machine learning and historical data, and Google warns delivery may fluctuate. Programmatic Guaranteed *campaign*-level caps are **best effort** and can be exceeded to meet contracted volume. "Lifetime" was treated as 3 months, and after 28 Feb 2025 the maximum cap period is 30 days. So a modeled or best-effort cap can't give you exact counts.

---

### The core idea: "max 3 per user per day" is three separate claims

When you read that IO line, split it:

1. **Counter claim:** for a given identifier, the ad server stops serving after 3 counted events in the window.
2. **Identity claim:** one person maps to one identifier. In practice it can be one person to many IDs (fragmentation) or many people to one ID (collapse).
3. **Contract claim:** what the ad server counts (code served, page views, per-domain) is what the advertiser means by "exposure" and "user."

Most teams only test claim 1, because it is the easiest to automate and the one a developer can own. The two complaints above almost certainly come from claims 2 and 3. **Fragmentation causes overexposure. Collapse causes underdelivery.** A PPID rollout can cause both at once.

---

### Applying Bolton's oracles: how do you know something is wrong when you can't see the truth?

The real truth here is "how many times did *this person* see the ad". Nobody in the system can observe that directly, so you can't compare against a single expected result. Michael Bolton's *Oracles from the Inside Out* series gives a better structure. You recognize problems by moving between four kinds of oracle:

- **Experience:** your own feelings and mental models. Surprise, confusion, "that's odd."
- **Inference:** consistency principles. Is the product consistent with its purpose, with comparable products, with its history, with claims made about it?
- **Reference:** documents, specs, standards, tools.
- **Conference:** talking to people, who can also be wrong or have blind spots.

His Part 9 argues that conference is both an oracle and the *destination*. The goal is a shared understanding with the person who decides. Disagreement between people is useful information about how significant a problem is. Here is how that plays out in this case.

**Experience.** "61% delivery after a release that was supposed to *improve* cap accuracy" should feel wrong. Note the feeling and don't ignore it, but a feeling is not yet a bug report.

**Inference.** Turn the feeling into consistency checks you can run:

- *Consistent with history:* did capped line items deliver at about 95% before the PPID release? Compare the 14 days before and after, split by platform.
- *Consistent with comparable items:* uncapped items are fine, so the problem tracks the cap. That points toward the identifier, not inventory.
- *Consistent with the product's purpose:* a PPID should *reduce* distinct IDs per person. If logged-in traffic now has *fewer* distinct IDs than logged-in accounts, something is merging people.

**Reference.** Check against Google's documented behavior (table above). Two references matter most:

- "No ID → time-based capped line item not eligible to serve." If the new integration sends an **empty or malformed PPID** for logged-out users, and that suppresses the cookie fallback on some path, capped items silently lose those requests.
- "Cap counts code served." If the new app build prefetches the sponsorship slot below the fold, the cap fills with impressions nobody saw. That also hurts delivery, because the user hits the cap early.

**Conference.** Now talk to people, with specific questions:

- *Ad ops:* "Which surfaces lost delivery: web, app, CTV, or all of them? Did it start on release day or later?"
- *The PPID developer:* "What do we send when the user is logged out? What do we hash when the account ID is null?"
- *Sales:* "When the IO says 'user,' did we tell the client it means per browser or app, or per person?"
- *The agency:* "Is the 7–9 count from a panel matching people across devices? Is it ads *served by us*, or impressions from all their buys, including DSP-bought inventory on other sites?"

The agency's answer may show that their "user" is a panel-matched person across web, app, and CTV. Your ad server's "user" is an identifier per domain or app. Neither side is lying. They count different things, and the IO never said which one counts.

---

### A failure-mode catalog with test ideas

This is the kind of list you build from the model above. Each row is a hypothesis and the test that would confirm or kill it.

| Failure mode | Direction | Test idea |
|---|---|---|
| **ID collapse from a hashed empty value.** Logged-out users get `sha256("")`, so every one of them shares the PPID `e3b0c442…` | Underdelivery: the first 3 impressions for "everyone" use up the cap | Query top PPIDs by impression count. One ID with millions of impressions is the giveaway. Unit-test the null/empty/whitespace account-ID paths in the PPID builder. |
| **Household collapse on CTV.** One IFA per TV, four people watching | Under-reach per person, but correct per device | Confirm the IO language covers device-level capping for CTV. This is a contract question, not a code fix. |
| **Fragmentation across surfaces.** Logged-out on mobile web (first-party cookie per domain), logged-in in the app (PPID), CTV (IFA) | Overexposure per person | Exploratory session: one tester, one account, three surfaces, one day. Count what you see against what the ad server logs per ID. |
| **Fragmentation on log-in.** Cookie-ID counter before log-in, PPID counter after | One person gets 3 + 3 | Log in partway through a session. Does the counter carry over, start fresh, or double? |
| **Parallel requests on one page.** Several slots request at once before the counter updates | Cap exceeded on a single page view | Page with 3 sponsorship slots, fresh ID: count impressions on the first load. DV360 explicitly documents that several ads can serve on one page while the cap isn't yet reached. |
| **Code-served vs seen.** Prefetch or lazy-load counts impressions that never render | Cap consumed early, so lower real frequency and lower delivery | Compare cap-counted events with viewable impressions for capped items, before and after the app release. |
| **Roadblock semantics.** Cap counts page views | "3 exposures" becomes 9 ad impressions | Read the IO and line-item setup together. Raise the mismatch with sales, not as a defect. |
| **Seller cap + buyer cap stacking.** Your cap and the DSP's cap run independently | The person sees your sold impressions plus programmatic ones | Ask whether the agency's 7–9 figure includes their own DSP buys. |
| **Window definition.** "Per day" counted by the network time zone or a rolling 24 h | Bursts around the boundary | One targeted check around midnight in the network time zone. Don't build a matrix. |

Look at the first two rows of the documented-behavior table again. **The same root cause (no usable ID) fails in opposite directions** depending on cap type: display time-based caps stop serving, video pod caps ignore the cap. Never write a test oracle like "missing ID → cap still works." Write one test per cap type per ID state.

---

### What to automate, and what to observe in production

Automate the **counter claim**. It is deterministic. In a test network with fixed IDs: serve N times and assert that serving stops at the cap, that multiple caps are all enforced, and that the stricter of line-item and creative caps wins.

You can't fully check the **identity claim** before release. Watch it in production with a few signals:

- Share of ad requests with no ID, per platform. A jump after a release is an early warning for underdelivery.
- **Top-N identifiers by impressions per day.** Any single ID far above the cap × number of capped line items means collapse.
- Ratio of distinct PPIDs to distinct logged-in accounts. It should be close to 1. Far below 1 means merging; far above means churn.
- Delivery of capped vs uncapped line items, split by platform. A divergence localizes the problem fast.

You can't automate the **contract claim** at all. It needs a conversation, which is the next section.

---

### The soft-skill part: explaining risk to sales and the advertiser

The worst outcome here is a week of ping-pong between "the cap is broken" and "works as designed." Your job is to give the decision-maker a clear picture. You are not trying to win the argument. A message to the account manager might look like this:

> **Subject: Sponsorship frequency — two separate issues, one fix and one wording question**
>
> 1. **Defect (ours, fixable):** Since the 5 Nov release, logged-out app users all send the same ID, so the sponsorship hits its cap almost immediately for all of them. This explains most of the 61% delivery. Fix is in review; we'll confirm with the top-ID check once deployed.
> 2. **Definition gap (not a defect):** Our cap counts per browser or app ID, not per person. Someone using our site, our app and our CTV app can be counted as three users, by design. The agency's 7–9 figure probably counts people across devices, and maybe their own programmatic buys too. We can't see those.
> 3. **Suggestion:** For future IOs, write "max 3 impressions per identifier per day; one person on several devices may receive more." If the client needs per-person capping, we should discuss logged-in-only targeting, which costs reach.
>
> What I need from you: can you confirm with the agency what their panel counts, so we're comparing the same thing?

This message keeps your defect separate from their definition, so you don't defend a real bug with "works as designed." It turns a hidden assumption into contract language someone can actually agree to. And it ends with one specific question, which is conference used to reach a shared understanding.

---

### Your challenge (30 minutes)

Pick one capped feature in your own product. It doesn't have to be ads. It can be "one free trial per customer," "max 3 password-reset emails per hour," "one promo per household," or "max 5 API calls per second per client."

1. **Split the promise** into the counter claim, identity claim, and contract claim. Write each in one sentence.
2. **Name the identifier** the system actually counts, and list 3 ways one real person becomes several IDs and 2 ways several people become one ID.
3. **For each of those 5 cases, decide the failure direction:** too permissive (abuse, overexposure) or too strict (lost revenue, locked-out customers). Which one would your business notice first, and which one would it notice too late?
4. **Find one documented behavior** (vendor docs, RFC, internal ADR) about what happens when the ID is *missing*. Does your test suite contain a check for that case, for *every* code path that builds the ID?
5. **Write the three-sentence version** of the "defect vs definition gap" message for your product's most likely complaint.

**Stretch:** propose one production signal, like the "top-N identifiers" query above, that would detect identity collapse within a day of a release. Bring it to your next refinement or post-release review.

---

### Key takeaways

- A cap limits a counter keyed by an identifier. Whether that matches "a person" is a separate, testable risk.
- Fragmentation causes overexposure and collapse causes underdelivery. One release can cause both.
- The same missing ID can fail in opposite directions depending on cap type, so test each cap type with each ID state.
- When nobody can observe the truth, move deliberately between experience, inference, reference and conference. Treat conference as the place you're trying to end up, not as an escalation.
- Separate *your defect* from *their definition*, and offer contract language everyone can test against.

---

### Sources

- Michael Bolton, DevelopSense — [Oracles from the Inside Out, Part 9: Conference as Oracle and as Destination](https://developsense.com/?p=2211)
- Google Ad Manager Help — [Line items (frequency caps: identifier requirements, code-served counting, roadblocks, single-domain/app limits, +1 cookieless caveat)](https://support.google.com/admanager/answer/82242)
- Google Display & Video 360 Help — [Manage frequency with frequency caps (cap levels, modeled caps without identifiers, best-effort PG caps, 30-day maximum)](https://support.google.com/displayvideo/answer/2696786?hl=en)
- Luís Rijo, PPC Land (trade press; used for industry context, technical claims cross-checked against Google's docs above) — [Frequency capping](https://ppc.land/frequency-capping/)
