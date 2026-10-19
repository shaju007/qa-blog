# QA Thinking — Day 30

## Automate the Question, Not the Test Case: A Check Portfolio for SaaS Usage Metering

Someone in planning says, "Let's automate the billing regression suite." That sentence hides three decisions nobody has made. Which risks does the suite cover? What will anyone do when a check goes red? Who will own it in six months?

Today's lesson is about making those decisions on purpose, using a SaaS usage-based billing example.

### The domain: usage metering in SaaS

Many SaaS and API platforms charge for consumption, such as API calls, seats-per-day, GB stored or messages sent. The pipeline usually looks like this:

1. The product emits **usage events**, for example `api_call` with a tenant ID, timestamp and quantity.
2. An **ingestion** layer deduplicates and validates them.
3. An **aggregation** job rolls them up per tenant, per billing period and per meter.
4. **Rating** applies the plan: included allowance, tiers, overage price, discounts and currency.
5. An **invoice** is produced, and the customer sees a **usage dashboard** along the way.

Terms worth knowing:

- **Idempotency key**: the event ID that stops a retried event from being billed twice.
- **Late-arriving events**: events that reach the system after the period has closed.
- **Billing period cut-off**: the boundary that decides which invoice an event lands on, and in which time zone.
- **Proration**: partial-period charges after a mid-cycle plan change.
- **Credit and true-up**: corrections applied on a later invoice.

Failure modes in this domain are expensive and quiet:

- Retried events are double-counted, so customers are overbilled.
- Dropped events cause silent revenue leakage.
- Late events are assigned to the wrong period.
- The dashboard and the invoice disagree.
- A tier boundary is off by one, for example the 1,000,001st call.
- A tenant is billed under a plan they were downgraded from.

Nothing crashes in any of these cases. That matters for the automation decision below.

### What the sources give you

Michael Bolton's ["The Secret Life of Automation"](https://developsense.com/blog/2019/12/the-secret-life-of-automation) argues against the factory-floor story, in which tools replace "manual testing" and messy humans give way to reliable robots. He treats testing as investigative design work, where tools extend a tester's reach but don't do the testing. Behind it sits the testing-versus-checking distinction from [DevelopSense's testing and checking archive](https://developsense.com/blog/category/testing-and-checking). A check is a machine-decidable comparison of an observation against an expectation. Deciding which checks are worth having, noticing when they've stopped meaning anything, and interpreting a failure are all testing.

The Ministry of Testing community thread ["What maintenance do you have to carry out on automated checks?"](https://club.ministryoftesting.com/t/what-maintenance-do-you-have-to-carry-out-on-automated-checks/72169) supplies the cost side. Paul Grizzaffi splits maintenance into four buckets:

- **Bugs**: automation is software, so it has bugs of its own.
- **Parity**: the checks must follow changes in the product.
- **Infrastructure**: OS, device and tool upgrades.
- **Results audits**: someone has to look at the results. He asks whether automation is worth it if nobody does.

Stefan Papusoi's list includes refreshing test data and credentials, and deleting flows that can't be made deterministic enough.

Together these give you two lenses: what a check can and can't tell you, and what it costs to keep telling you.

### Apply it: a check portfolio, not a suite

Don't start from a list of test cases. Start from decisions the team must make, and for each one ask what evidence would change it. For metering:

| Risk / question | Cheapest honest evidence | Automate? |
|---|---|---|
| Does rating apply tiers correctly at boundaries (0, 1, N, N+1, huge)? | Table-driven checks on the rating function with known inputs | **Yes.** Deterministic, fast and cheap to maintain. The oracle is arithmetic you can write down. |
| Is a retried event counted once? | Check at the ingestion API: send the same idempotency key twice and assert the aggregate | **Yes.** Pin it at the lowest layer where it can fail. |
| Do late events land in the right period? | Checks with injected clocks and fixed time zones around the cut-off | **Yes, but** time handling is a classic source of flakiness. Control the clock and don't rely on the wall clock. |
| Does the invoice PDF look right to a finance person? | Human review of a few real-shaped invoices per release | **Mostly no.** A pixel diff tells you something changed, not whether it's wrong. |
| Does the dashboard match the invoice for real tenants? | **Reconciliation job in production** (see below) | Yes, as monitoring and not as a pre-release check. |
| Is the pricing model itself sensible for a tenant with spiky usage? | Exploratory session with weird tenants: downgrade mid-month, multiple currencies, zero usage, a backfill | **No.** This is investigation. A script only repeats what you already thought of. |

The last two rows show the point of the exercise. Some of the highest-value evidence is not a pre-release test at all. A nightly reconciliation of the events received against the events aggregated against the units invoiced catches a class of silent failures that no scripted scenario will anticipate. That job is automation, but it's closer to observability. Treating it that way keeps it from being forced into the regression suite.

### A decision card for every proposed check

Before writing a check, answer these five questions in a sentence each. Put the answers in the test's description or the PR.

1. **Decision**: what will we do differently if this goes red? If the answer is "investigate," say who and how fast.
2. **Risk**: which failure mode does it cover, and what is the blast radius? One tenant's invoice, or every tenant's?
3. **Oracle**: how does the check know the right answer, and how could that knowledge be wrong? A check that recomputes the price using the same code path as production can't fail meaningfully.
4. **Blind spot**: what can this check never see? Say it explicitly, for example that it never exercises the real clock or the payment provider.
5. **Upkeep**: who owns it, what will break it (data, credentials, schema), and when would we delete it?

If you can't answer the first one, you've found a check that will either be ignored or will block a release for no reason. Both outcomes cost the team trust.

### Talking to stakeholders

When a product owner asks, "What percentage of billing is automated?", don't answer with a number. Coverage percentages measure how much was written, not how much was learned. Try this instead:

> "Rating rules and idempotency are pinned by fast checks, so we'll hear about regressions in minutes. Late-event handling is checked with a fixed clock but not against real traffic, so we added a nightly reconciliation. Invoice layout and unusual plan changes are covered by human exploration each release. The gap I'd flag is currency rounding on multi-currency tenants, which nothing covers yet."

That answer is honest about gaps, ties each kind of evidence to a risk, and invites a decision about the gap.

### Challenge (30–40 minutes)

Pick a feature you own whose bugs would be quiet rather than loud, such as billing, notifications, reporting, entitlements or data sync.

1. List **six risks**, covering both loud failures and quiet ones.
2. For each, fill in the decision card above. Be strict on questions 1 and 3.
3. Sort the risks into four groups: *pre-release check*, *production monitor*, *exploratory charter* and *accept the risk*. At least one risk must go in each group.
4. Review your **existing** suite. Find one check whose decision you can't name. Propose to delete it, merge it or move it to a lower layer. Estimate its yearly upkeep using Grizzaffi's four buckets.
5. Write the three-sentence stakeholder summary, with one explicit gap.

**Stretch:** for your most expensive existing check, ask what real bug it has caught in the last year. If the answer is none, that's useful information about its value, not a reason to feel bad. It also shows you where the portfolio is lopsided.

### Takeaways

- Automation is a bet on future evidence, so write down the decision it supports.
- Prefer the lowest layer where the failure can be observed, and prefer monitoring where the failure only shows up in production.
- A check has a blind spot. Naming it is part of the job.
- Maintenance is a real cost, and results that nobody reads are worth nothing.
- Keep the exploratory work. In metering, the failures that cost the most are usually the ones nobody scripted.

*Sources: Michael Bolton, [The Secret Life of Automation](https://developsense.com/blog/2019/12/the-secret-life-of-automation) (DevelopSense, 2019); DevelopSense, [testing and checking](https://developsense.com/blog/category/testing-and-checking); Ministry of Testing Club, [What maintenance do you have to carry out on automated checks?](https://club.ministryoftesting.com/t/what-maintenance-do-you-have-to-carry-out-on-automated-checks/72169). The metering pipeline and the decision card are my own synthesis, not taken from these sources.*

---
*Note: the Postman MCP server needs authorization before its tools are available. It wasn't needed for this post. To enable it, authorize it through your claude.ai connector settings, or run `/mcp` in an interactive session.*
