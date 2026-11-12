# QA Interview Q&A — Day 28

## Question: "All 40 of our webhook tests are green. They fire events with `stripe trigger` at a local listener." The product owner asks, "So payment confirmation is tested?" What do you say?

**Context:** You test a SaaS e-commerce platform. Merchants sell through it, and each merchant is a Stripe Connect account. Until now, an order was marked paid when the shopper landed on the "thank you" page. The new release moves that job to Stripe webhooks. When `checkout.session.completed` or `checkout.session.async_payment_succeeded` arrives, the platform reserves stock, sends the confirmation email and pushes the order to the merchant's ERP. The landing page also calls the same fulfilment function, so customers see their order straight away. Release is planned for next Thursday. In sprint review, the product owner (PO) turns to you.

## Answer

### The short version I'd say in the room

"The tests show that our handler can take one correctly signed, well-formed event, delivered once to a process on a developer's machine, and do the right thing with it. That's useful. But the hard part of webhooks is how they're delivered: duplicates, ordering, retries, timing, the network path, and which Stripe account the event comes from. The tests don't touch any of that, because `stripe trigger` hands over a fresh event once, in order, straight to localhost. I can't say confirmation is tested in the sense you mean yet. I can name the five gaps and give you evidence on most of them by Tuesday. Whether Thursday holds is your call. My job is to make sure you're deciding with a clear picture."

That answer doesn't dismiss the 40 tests, doesn't say "no" as if QA owned the release, and doesn't hide behind "it depends." It says what the evidence covers, what it doesn't, and what would close the gap.

### How an experienced tester reasons through it

**1. Ask what the tests are actually observing.** A green test shows that something matched under some conditions. So the first question is which conditions. With `stripe trigger` plus `stripe listen --forward-to localhost`:

- **Each event is delivered once, in a calm, predictable order.** Stripe's docs say live delivery is different. Endpoints "might occasionally receive the same event more than once." Sometimes Stripe even sends "two separate Event objects" for the same change, and these must be matched by object ID plus event type, not by event ID alone. Stripe also "doesn't guarantee the delivery of events in the order that they're generated."
- **The timing isn't the same as production.** If you have a real endpoint registered for `checkout.session.completed`, Checkout waits up to 10 seconds for your server's response before it redirects the customer. When you test through the Stripe CLI, it redirects straight away. So the race we care most about, between the landing page and the webhook calling the same fulfilment function, plays out differently on a laptop than in production.
- **The real network path is skipped.** The CLI forwards straight to the app process. It never passes through our load balancer, WAF, API gateway, CSRF middleware or IP allowlist. Stripe signs the raw body, so any layer that re-serialises JSON breaks verification, and only for traffic that actually goes through that layer.
- **Events come from the wrong account.** Our merchants are connected accounts. Their checkout events reach a Connect-scoped destination (`--forward-connect-to` locally), not the platform-account listener. If all 40 tests used `--forward-to`, none of them received an event the way a merchant's checkout produces one.
- **Retries behave differently in the sandbox.** In live mode, Stripe retries failed deliveries for up to three days with exponential backoff. In a sandbox it retries three times over a few hours. A "we recovered from an outage" test in the sandbox doesn't model a weekend outage in production.
- **The test data is generic.** Default trigger fixtures create their own objects. Unless the team overrode fields, those events don't carry the `metadata.order_id` and merchant mapping that real sessions carry. The tests may well have exercised the "unknown order, ignore" branch and passed.

**2. Choose oracles before choosing tests.** Michael Bolton's FEW HICCUPPS list is useful here. The **Claims** oracle is Stripe's own documentation: duplicates, no ordering guarantee, a 5-minute default signature tolerance, and fulfilment that must be "safe to run multiple times, even concurrently." The **History** oracle is the old landing-page flow, where you know which orders were confirmed. The **Purpose** oracle is that every paid order gets fulfilled exactly once and no unpaid order does. A behaviour is wrong if it breaks any of these. Bolton also stresses that oracles are fallible heuristics, so a mismatch is a reason to investigate, not an automatic bug.

**3. Model this as a state problem, not a request/response problem.** James Bach's Heuristic Test Strategy Model asks you to think through product factors, including interfaces, time and operations. Version 6.3 put extra weight on state-based testing. An order has states (created, awaiting payment, paid, fulfilled, failed), and events are transitions that can arrive late, twice, or out of order. Checking one event type at a time is the wrong shape for this risk. Ask which transitions are legal from each state, and what happens when an illegal one arrives.

### What I'd test before Thursday

Run these in a deployed test environment, with a registered event destination that sits behind the real ingress, not on localhost:

| Risk | Test | Pass looks like |
|---|---|---|
| Duplicate delivery | Re-send the same event with `stripe events resend`. Also inject a second, separately created event for the same session | One stock reservation, one email, one ERP push. The duplicate is logged as a duplicate, not as an error |
| Landing page vs. webhook race | Fire the landing-page request and the webhook for the same session concurrently, about 50 times | Exactly one fulfilment each time. Ask how this is enforced: a DB unique constraint or a lock, not an "if not already fulfilled" check that two threads can both pass |
| Out of order / missing | Deliver `async_payment_succeeded` for a session whose `completed` event we never processed. Deliver a failure event after success | The handler fetches the current session from the API instead of trusting arrival order. No unpaid order gets fulfilled |
| Delivery failure | Make the endpoint return 500, then time out, then recover | Stripe's delivery log shows the retries. Fulfilment still happens exactly once. Someone gets alerted while it's failing |
| Signature via the real path | Tampered body; replay of a captured request older than 5 minutes; wrong-mode secret; a rotated secret with both secrets active | Rejected, rejected, rejected, accepted. No middleware alters the raw body |
| Connect scope | Run a real checkout on a test connected account | The event arrives at the right destination and maps to the right merchant's order |

I would not write 40 more trigger-based tests. They'd share the same blind spot.

### Evidence I'd ask the developers for (it costs nothing)

- Where processed event IDs (or object ID plus type) are stored, and what enforces uniqueness.
- Whether the handler returns 2xx before the slow work (ERP push, email) and puts that work on a queue. Stripe treats a timeout as a failure and retries.
- Which event types each destination subscribes to, and in which scope (platform or Connect).
- What happens when an event fails processing after we've already returned 200. Stripe won't retry it, so it's now on us.

### The one thing testing can't give us: a production oracle

Even after all of this, I'd tell the PO: "Testing reduces the risk. It can't remove it, because the delivery conditions we worry about only fully exist in production." So I'd ask for two things, framed as release conditions for the PO to accept or reject, not as QA demands:

1. **A reconciliation job.** Every hour, compare Checkout Sessions that Stripe reports as paid with orders we've marked paid, and alert on any difference in either direction.
2. **A dashboard.** Track signature failures, non-2xx responses, and the age of the oldest unprocessed queue item.

Without these, a silent failure looks like a quiet day.

### Common weak answers

- **"Yes, 40 green tests."** That reports how many tests ran, not which risks were covered.
- **"We need a test for every event type."** That adds breadth along the one axis that wasn't the problem.
- **"Just mock Stripe completely."** A mock built from our own assumptions can only confirm those assumptions. It throws away signatures, timing and Stripe's real behaviour.
- **"QA blocks the release until it's fixed."** QA doesn't own the release. Describe the risk and its likelihood, and let the PO decide.
- **"Stripe should deliver exactly once."** That isn't what Stripe promises. Asking for it shows the design premise wasn't understood.
- **Talking only about the handler.** This ignores the landing-page path, which calls the same fulfilment function at the same moment.

## Follow-up questions

1. **"The developer says fulfilment is idempotent, so testing duplicates is a waste of time. How do you respond?"** Look for: ask what "idempotent" means in this code (a uniqueness check, a lock, a constraint?), then test it concurrently, because idempotent one call at a time can still double-fulfil under parallel calls. Also check every side effect, not just the DB row. The email sender and the ERP client may not be idempotent even if the order table is.
2. **"Three weeks after launch, a merchant says two orders from Saturday night never reached their ERP, but Stripe shows them paid. Where do you look first, and in what order?"** Look for: Stripe's delivery log for that endpoint, then our 2xx-but-failed-later path (queue or dead-letter), then whether the reconciliation job ran and why it didn't alert. That last step is a failure of the oracle, not just a bug.

## Sources

- [Stripe Docs — Receive Stripe events in your webhook endpoint](https://docs.stripe.com/webhooks): the main source for the delivery facts used here. Duplicates (including separate Event objects for the same change), no ordering guarantee, live vs. sandbox retry schedules, raw-body signature verification, the 5-minute default tolerance and replay protection, returning 2xx quickly, Connect-scoped destinations, and `stripe events resend`.
- [Stripe Docs — Fulfill orders (Checkout)](https://docs.stripe.com/checkout/fulfillment): the source for the landing-page vs. webhook race. It says fulfilment may run "multiple times, possibly concurrently." It also covers delayed-notification events and the fact that Checkout waits up to 10 seconds for the webhook response with a real endpoint but redirects immediately with the CLI.
- [Michael Bolton, DevelopSense — FEW HICCUPPS](https://developsense.com/blog/2012/07/few-hiccupps): the oracle heuristics (Claims, History, Purpose) used to decide what "correct" means before choosing tests, and the reminder that oracles are fallible and need judgment.
- [James Bach, Satisfice — Heuristic Test Strategy Model (v6.3)](https://www.satisfice.com/download/heuristic-test-strategy-model): background for treating the integration as a state and timing problem across product factors. Version 6.3 added emphasis on state-based testing and boundaries.
