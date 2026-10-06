# QA Interview Q&A — Day 8

## Question: Every contract test against your sports-data provider is green, but on the first live Saturday your app kept showing a goal for nine minutes after VAR had disallowed it, and some users got two "GOAL!" push notifications. The engineering manager asks: "So do we just need more contract tests?" What do you answer?

## Answer

### The short version (what I'd say in the first 30 seconds)

"Probably not. The contract tests did what they were built to do. They checked that each message from the provider had the shape we expected, and every message did. This failure wasn't about the shape of one message. It came from the order, timing and duplication of several valid messages, and from how our own state handling reacted to them. More checks of the same kind would pass just as well. We need a different kind of test aimed at sequences and state, plus a production check that catches the score drifting away from the provider's. I can show the timeline and propose something specific."

The interviewer wants to see whether you can tell **what a check can actually tell you** apart from **what the team assumes it tells you**.

### Step 1: Be precise about what the "contract tests" covered

First, find out what the team actually means by "contract tests." With a third-party data provider, the answer is usually not real consumer-driven contracts. The Pact documentation says Pact is a poor fit when the team on the other side of the integration won't use Pact too, and when you can't control the data behind the provider's responses. Both are true for an external sports feed. So these "contract tests" are most likely checks of our consumer code against **our own stubs or recorded fixtures**. They confirm that our code handles the payloads we *believe* the provider sends. They don't confirm that the belief is true, and the provider never verifies them.

Even real Pact contracts wouldn't have caught this. The Pact docs say directly that Pact is about "the contents and format of requests and responses," not the provider's functional behaviour. A contract describes one interaction at a time. Our bug only existed across three interactions arriving in a particular order.

That isn't an argument against contract tests. They're cheap and fast, and they're good at catching a renamed field or an enum value we've never seen. They just answer a narrower question than "does the integration work?"

### Step 2: Reconstruct the failure from evidence, not from guesses

Before proposing fixes, I'd pull the facts together. A plausible timeline after reading the logs:

| Time | What happened |
|---|---|
| 15:42:10 | Provider sends `goal` event `G-881`. Our webhook handler is slow under kickoff load and responds after the provider's timeout. The provider records the delivery as failed and schedules a retry. Our handler still finishes the work: score 1–0, push sent. |
| 15:43:30 | VAR disallows the goal. Provider sends `goal_cancelled` referencing `G-881`. Our handler **deletes** the goal record. Score 0–0. |
| 15:44:05 | The provider retries `G-881`. Our deduplication looks up the goal record, finds nothing because it was deleted, and treats the event as new. Score 1–0 again, second push sent. |
| 15:51:00 | Our 10-minute reconciliation poll fetches the provider's match snapshot and corrects the score to 0–0. |

Evidence I'd ask for:

- **Raw delivery logs** with the provider's event IDs, any per-match sequence or version numbers, the provider's event timestamps, and our received-at timestamps.
- **Our endpoint's latency and status codes** around kickoff. If we were slow or returning 5xx, the provider's retries are expected behaviour, not a provider bug.
- **The provider's documented delivery guarantees**: at-least-once or exactly-once? Is ordering guaranteed per match? What does a correction reference? What is the retry schedule? Does the sandbox retry the way production does?

That last question matters more than people expect. Compare how explicit a mature provider can be: Stripe's webhook docs say it doesn't guarantee events arrive in the order they were generated. They say endpoints "might occasionally receive the same event more than once." They warn against using the `created` timestamp to order events because it only has one-second resolution. And they note that live mode retries for up to three days, while sandbox retries only three times over a few hours. That's a documented case of a test environment whose retry behaviour **differs from production by design**. I'd ask our sports provider for the same facts in writing. If they can't give them, that gap is itself a finding to report, with risk attached.

### Step 3: Name the actual risk

Every individual message was valid. The risk lives in **time and state**:

- Duplicates (at-least-once delivery, retries)
- Reordering (a retry arriving after a correction)
- Corrections and reversals (VAR, a goal reassigned to another scorer, a match abandoned)
- Side effects that can't be undone (push notifications)

This lines up with James Bach's Heuristic Test Strategy Model. Its product factors treat **Time** (timing, sequencing, concurrency) and **Data** as dimensions in their own right, separate from **Interfaces**, and the latest version puts more weight on state-based testing. Our existing checks only covered the interface. Michael Bolton makes the same point in his series on exploratory testing of APIs: for "conversational" APIs where the sequence of interactions matters, vary the sequences, because people "get things out of order." The provider's retry did exactly that to us.

The bug in our code was subtle and worth naming in the meeting: **deduplication is not the same as order-independence.** Our handler deduplicated correctly as long as events arrived in order. A hard delete on cancellation wiped out the evidence it needed to recognise the retry.

### Step 4: What I'd change, roughly in order of value

1. **Write down the invariants before writing tests.** For example: "the displayed score equals the number of non-cancelled goals for each team"; "at most one goal notification per goal ID, ever"; "a cancellation for a goal we haven't seen yet is stored, not dropped." These become the oracles for everything below. Developers and the PO need to agree on them, because some are product decisions.

2. **Build a replay-and-perturb harness at the API level.** Take recorded real event streams from past matches, or the provider's replay feed if one exists. Push them through our handler with duplicates injected, adjacent events swapped, deliveries delayed and some dropped, then check the invariants after each run. A match produces a few hundred events, so permutation runs are fast. This is where automation clearly pays off: high volume, tedious, and precise.

3. **Do targeted exploratory sessions against a controllable fake provider.** Explore the scenarios nobody has written down yet: a correction arriving before the original event, two corrections to one goal, a scorer change, a penalty retake, an abandoned match, extra time. Each session will likely turn up an assumption the team didn't know it was making.

4. **Add production observability, because no test environment reproduces live retries on a Saturday afternoon.** Reconcile our score against the provider's snapshot endpoint every 30–60 seconds instead of every 10 minutes, and alert on any divergence. Track rates of duplicate and out-of-order events and the endpoint's p99 latency. When state looks inconsistent, re-fetch the authoritative snapshot instead of trusting the event payload.

5. **Remove the trigger.** Acknowledge webhooks immediately and process them from a queue so peak load doesn't cause timeouts and retries. Replace the hard delete with a soft "cancelled" state that remembers the goal ID. These are developer decisions. My job is to show why they matter, not to dictate the implementation.

### What I'd say in the meeting

> "The contract tests weren't wrong. They answered 'Is each message shaped the way we expect?', and the answer was yes. Saturday's question was 'What happens when valid messages arrive twice or out of order after a correction?', and we had nothing asking that. I'd propose three things: a replay harness that permutes real match streams against a few agreed invariants, which I estimate at about two days with one developer; faster reconciliation with an alert in production; and a written answer from the provider on delivery and retry guarantees. One decision isn't mine to make: whether goal pushes should wait a few seconds for a possible VAR check. That's a product tradeoff between speed and correctness. I can bring data on how often goals were overturned last season so the decision has numbers behind it."

That last part matters. QA supplies the evidence and makes the tradeoff visible. The product owner decides notification latency, and engineering decides architecture.

### Weak answers interviewers hear

- **"Yes, add more contract tests."** That's more of a check that already passed. Coverage of shape doesn't add up to coverage of behaviour.
- **"Add an end-to-end test against the provider's sandbox."** You can't schedule a VAR decision in a sandbox, and sandbox retry behaviour may not match live, as Stripe documents for its own platform.
- **"It's the provider's fault for sending a duplicate."** At-least-once delivery is normal, and our slow responses triggered the retry. Either way, users blame *our* app.
- **"It's an edge case."** Goals get overturned somewhere almost every match weekend. Count them before calling it rare.
- **"We need to test against production."** Partly true, but as a monitoring and reconciliation strategy, not a reason to skip cheap, deterministic sequence testing beforehand.

### Follow-up questions

**1. The provider has no replay feed, and its sandbox only plays canned matches with no corrections. How do you test this risk?**
Record our own production traffic (payloads plus delivery metadata) from the next few match days, scrub anything sensitive, and turn it into a fixture library. Meanwhile, hand-build short adversarial sequences from the invariants: goal, cancel, duplicate goal; cancel before goal; two scorer changes. Report clearly that confidence will stay limited until we have real correction traffic. Production reconciliation then becomes the main safety net, not a backup.

**2. The same pattern shows up outside sports. Where else would you look for it?**
Anywhere one event "undoes" another and side effects can't be reversed. Examples: a marketplace order cancellation racing a shipping-label webhook; an energy supplier receiving a corrected smart-meter reading after the bill was generated; an ad platform receiving a click-fraud reversal after a budget cap triggered. The questions carry over: what's the delivery guarantee, what's the source of truth, and which side effects can't be taken back?

## Sources

- [Pact Docs: When to use Pact](https://docs.pact.io/getting_started/what_is_pact_good_for). Says Pact is about "the contents and format of requests and responses," not provider functionality, and is a poor fit when the other side won't use Pact or you can't control provider data. Basis for Step 1's argument that green contract tests against a third-party feed promise less than teams assume.
- [Stripe Docs: Receive Stripe events in your webhook endpoint](https://docs.stripe.com/webhooks). Primary documentation stating that event order isn't guaranteed, duplicates happen, `created` timestamps shouldn't be used for ordering, sandbox and live retries differ (three times over a few hours vs. up to three days), and endpoints should return 2xx quickly and process asynchronously. Used as the benchmark for which delivery facts to demand from any event provider.
- [Michael Bolton, DevelopSense: Exploratory Testing on an API? (Part 1)](https://developsense.com/blog/2018/07/exploratory-testing-on-an-api-part-1). Explains the difference between checking (applying algorithmic decision rules) and testing (investigation and learning). This is the core distinction behind "the checks passed, but the integration wasn't tested."
- [Michael Bolton, DevelopSense: Exploratory Testing on an API? (Part 3)](https://developsense.com/blog/2018/07/exploratory-testing-on-an-api-part-3). Recommends varying call sequences for APIs where order matters and following exploration with targeted, varied automated checks. Supports the replay-and-perturb harness and the exploratory sessions in Step 4.
- [James Bach, Satisfice: Heuristic Test Strategy Model](https://www.satisfice.com/download/heuristic-test-strategy-model). Its product factors separate Time and Data from Interfaces, and the current version emphasises state-based testing. Used to frame the risk as one of time and state rather than message format.
