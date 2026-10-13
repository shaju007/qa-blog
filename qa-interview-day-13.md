# QA Interview Q&A — Day 13

## Question: Your platform team plans to shut down shared staging on 1 November. Every pull request will get its own preview environment instead: a fresh database, 40 accounts loaded by a seed script, one shared Stripe sandbox, and automatic teardown on merge. "Staging is flaky and nobody owns its data. This fixes both." In planning, the engineering manager turns to you: "QA, any objections?" What do you say, and what would you need to see before staging is switched off?

*Context: a B2B SaaS product with seat-based subscriptions billed through Stripe Billing. Customers are in Germany, Austria and the Netherlands, and some accounts date back to 2019.*

## Answer

### The short version

Don't object, and don't simply agree either. The platform team is right about the problem. Staging is flaky because several teams share it, and that makes test results hard to trust. Preview environments really do fix that kind of contention.

My concern is something nobody has listed. Staging has been doing several jobs that no one designed it to do, and switching it off will quietly remove them. So my answer is: "Yes to preview environments. Before we switch staging off, let's write down what staging is doing for us today and decide where each of those jobs goes." That position is constructive. It also turns a gut feeling into a list the team can check.

### What staging is quietly doing

James Bach's [Heuristic Test Strategy Model](https://www.satisfice.com/download/heuristic-test-strategy-model) separates **Project Environment** (the resources and constraints that enable or limit testing, including the equipment and tools you test with) from **Product Elements** (what you test, including the product's *data*). Under Data, the model asks you to consider persistent data and how data changes over its lifecycle. Those two questions are exactly what a freshly seeded environment can't answer. Walking through the model's guidewords, I'd expect a list like this:

1. **Data written by older versions of the code.** A seed script run today can only produce the data shapes today's code writes. Production holds accounts created in 2019 with legacy plan IDs, grandfathered prices, columns that were backfilled during a migration, and VAT IDs stored before validation was added. Staging has slowly built up some of that history. The seed script has none of it, so a preview environment will never show a bug that only hits a 2019 account.
2. **Time.** A preview environment is two hours old. It has no trials that expire tomorrow, no invoices on their third dunning retry, and no annual renewals due next week. Before a subscription business gets rid of its only long-lived environment, someone has to say how time-dependent behaviour will be tested.
3. **Mixed service versions.** In a preview environment, the branch under test usually runs against everything else built from `main`. In production, during a rollout, the new billing service may run alongside an old notification service for twenty minutes. Staging sometimes catches problems with deploy order and backward compatibility by accident. Preview environments are consistent by design, so they won't.
4. **Real third-party integration, and a new kind of sharing.** One Stripe sandbox shared by thirty preview environments brings back the contention problem, this time outside the system. Stripe's [sandbox documentation](https://docs.stripe.com/sandboxes) and [testing-environment comparison](https://docs.stripe.com/testing-use-cases) say general sandboxes are fully isolated from each other. They recommend separate sandboxes for local development and CI, and they allow up to five general sandboxes per account in addition to the test-mode sandbox. Five sandboxes can't give thirty preview environments one each. So I'd ask:
   - Webhook events are sent to the endpoints registered on the sandbox, not to the environment that created the object. Which preview environment receives `invoice.payment_failed` for a customer that environment #17 created?
   - Will one environment's teardown or cleanup delete Stripe objects that another environment's test is using?
5. **Volume.** With 40 accounts, a migration takes milliseconds, every list fits on one page, and the monthly usage report returns instantly. Staging isn't production-sized either, but it is usually much bigger than 40 accounts.
6. **People and long-running work.** The product owner uses staging for acceptance demos. Support uses it to reproduce customer tickets. Testers use it for exploratory sessions that run over several days. If the environment is torn down at merge, any investigation still running at merge time is lost.

### Evidence I'd gather before arguing

Opinions won't settle this. Evidence will. Before the decision meeting I'd collect:

- **Six months of bugs, classified.** For each bug found in staging, and each bug that escaped to production, ask: "Would a freshly seeded preview environment have caught this?" Sort the answers into three buckets: *yes*, *no because of data age/history*, and *no because of time, volume, or an integration*. If 3 of 60 bugs fall into the "no" buckets, the risk is small and I should say so. If 18 do, that changes the conversation.
- **Who uses staging and what runs on it.** Pull the access logs for logins and look at the scheduled jobs: nightly invoicing, dunning, and data exports. Every regular user and every job is a dependency that needs a new home.
- **A review of the seed script.** Map the states it creates against the ones that matter: plan type × billing status × account age × payment method × tax country. Compare that map with *aggregate counts* from production. This means queries like "how many accounts are on a legacy plan?", not copies of customer records. Most seed scripts cover the middle of the matrix well and miss its edges.
- **How the seed data is built.** Raw SQL inserts skip validation and domain events. They can create states the app can't actually reach, and they can also be too clean. Data built through the app's own API or domain services follows real rules. You still need explicit "legacy-shaped" scenarios on top, because no current code path creates a 2019 account.

### What I'd propose

- **Keep the isolation for what it's good at.** Preview environments are a clear improvement for functional checks on each change and for stable automated suites. Google's [Hermetic Servers](https://testing.googleblog.com/2012/10/hermetic-servers.html) post explains why. Injecting dependencies and faking datastores removes network flakiness and nondeterminism. The trade-off is that each fake is a model, and a model only knows what you put into it.
- **Treat the seed data as a product with an owner.** Build a catalogue of named scenarios that any environment can load on request. For example: `legacy-2019-grandfathered-price`, `annual-renewal-due-in-24h`, `past-due-dunning-day-3`, `de-reverse-charge-b2b`, `seat-downgrade-mid-cycle`. A bug that slipped through because data was missing should lead to a new scenario, in the same way a regression should lead to a new check.
- **Use Stripe's time tools, but know their limits.** Stripe [test clocks](https://docs.stripe.com/billing/testing/test-clocks/api-advanced-usage) let you move subscriptions forward in time without waiting. The documentation is also clear about their limits:
  - Each simulation supports at most three customers and three subscriptions per customer.
  - Clocks can only move forward, and an active subscription can only be advanced two billing intervals at a time.
  - Simulations are deleted automatically after 30 days.
  - List endpoints leave out test-clock objects unless you filter for them.
  - Bank-debit payments (`us_bank_account` is the example in the docs) aren't collected while the clock advances.

  That last limit matters for our DACH customers. I'd want SEPA Direct Debit renewals checked separately, rather than assuming the clock covers them. Our own scheduled jobs also need a controllable clock. Advancing Stripe's clock does nothing to our dunning job.
- **Plan Stripe isolation on purpose.** Options include separate sandboxes for CI, for exploratory and acceptance work, and for long-lived soak testing, plus tagging every object with the preview environment's ID in its metadata. A small relay service can then forward each webhook to the right environment based on that ID.
- **Keep one slimmed-down, long-lived environment**, or at least a version of staging with an owner. It should hold aged and legacy-shaped data, run the real nightly jobs, and get the full deploy-order rehearsal. A shared environment *with an owner and a reset policy* is a different thing from the one we have now.
- **Run a pilot instead of a cutover.** One team uses preview environments for four to six weeks while staging stays up. At the end, compare escaped bugs and the bug-classification results, then decide.

In James Bach's [Heuristics of Software Testability](https://www.satisfice.com/download/heuristics), testability isn't only a property of the product. There is also *project-related* testability: whether you have the environments, tools and information you need. This decision changes our project-related testability in both directions. I'd like us to choose those changes on purpose rather than find them out after the switch-off.

### What I'd actually say in the meeting

> "I'm in favour of preview environments. Shared staging has cost us real time, and isolated per-PR checks are a big step up. I'm not asking to block this. It's your and the platform team's call. I'd ask for two things before staging goes away. First, an hour to list what staging does for us today: legacy-shaped data, time-based billing states, nightly jobs, support repros and PO demos. Then we agree where each one moves. Second, a decision on how 30 environments share one Stripe sandbox, especially webhook routing. I'll bring a classification of the last six months of bugs, so we can see how many of them a fresh 40-account environment would have missed. If the number is small, I'll say so, and we switch staging off with confidence."

That statement agrees with the goal, names specific risks, offers evidence instead of opinion, leaves the decision with the people who own it, and says what would change my mind.

### Weak answers interviewers hear

- **"We need staging, it's the only realistic environment."** This defends the status quo, flaws included, and ignores the real damage caused by contention.
- **"Ephemeral is best practice, great idea."** This treats a structural change as purely good news and misses data age, time and integrations.
- **"Just restore a production copy into every preview environment."** It adds privacy, compliance and cost problems, and it skips the actual question: which states matter, and how do we create them on purpose?
- **"Mock Stripe completely."** Mocks are useful for speed. They also remove the part of the system most likely to surprise you, such as asynchronous events, retries and how one object's state affects another.
- **Listing risks with no proposal and no evidence.** Experienced testers make risk discussable. They don't just make it louder.

### Follow-up questions

1. *The platform lead replies: "We'll just add more fixtures whenever a bug slips through." Why isn't that enough on its own, and what would you add?* (Hint: fixtures only capture failures you've already seen. Think about how you'd find the next legacy shape before a customer does. Aggregate profiling of production data shapes and a migration rehearsal against aged data are two starting points.)
2. *How would you test a schema migration on a 2019-era account table once staging no longer exists?*

## Sources

- [Heuristic Test Strategy Model — James Bach, Satisfice](https://www.satisfice.com/download/heuristic-test-strategy-model): The framework I used to list what staging provides. The Project Environment guidewords (equipment and tools, test items) and the Product Elements guidewords on Data (persistent data, lifecycle) and Time are where the "hidden jobs" list comes from. The same model is also hosted on [DevelopSense](https://developsense.com/htsm).
- [Heuristics of Software Testability — James Bach, Satisfice](https://www.satisfice.com/download/heuristics): Describes five kinds of testability, including project-related testability. That supports treating the environment decision as a change to testability, not only to infrastructure.
- [Stripe Docs — Sandboxes](https://docs.stripe.com/sandboxes) and [Testing use cases / sandbox comparison](https://docs.stripe.com/testing-use-cases): The primary source for sandbox isolation, the recommendation to use separate sandboxes for local development and CI, and the limit of five general sandboxes. These shaped the shared-sandbox and webhook-routing questions.
- [Stripe Docs — Test clocks: API and advanced usage](https://docs.stripe.com/billing/testing/test-clocks/api-advanced-usage): The primary source for test-clock limits: three customers per simulation, forward-only time, two-interval advances, 30-day automatic deletion, list filtering, and bank debits not being collected during advances. These limits are why I said test clocks help with time but don't solve it.
- [Google Testing Blog — Hermetic Servers (Narla & Salas, 2012)](https://testing.googleblog.com/2012/10/hermetic-servers.html): A practitioner explanation of why isolated, self-contained test setups reduce flakiness through injected dependencies and faked datastores. I used it to give fair credit to the platform team's idea while pointing out that fakes are models.
