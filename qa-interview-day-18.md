# QA Interview Q&A — Day 18

## Question: A payments partner emails: "Next Tuesday we're adding a new value, `REQUIRES_REVIEW`, to the `status` field on our payout API. It's a backward-compatible change, so no action is needed." Your marketplace pays out to sellers from that API. Do you agree it needs no action, and what do you do this week?

## Answer

**Short version:** I don't agree or disagree yet. "Backward-compatible" describes what the provider can promise about their side. Whether it's safe depends on what our code does with a status it has never seen. I'd spend the week finding that out, and I'd do it before Tuesday.

### Why the claim is only half-true

Providers define compatibility in different ways:

- Stripe's [API versioning page](https://docs.stripe.com/api-versions) lists the changes it treats as backward-compatible. These include new response properties, new resources, and new event types. It then tells integrators to ignore unknown fields and handle unfamiliar event types sensibly. That list doesn't mention new values for an existing field, so I wouldn't assume it covers enums.
- Google's [AIP-180](https://google.aip.dev/180) says new enum values are fine in request-only enums. For enums in responses, it warns that "user code does not handle new values gracefully" and recommends caution and documentation.

So a new enum value is a gray area. The partner's email shifts the risk to us without saying so. The compatibility duty falls on our consumer code, and that code is ours to test.

### What the new value could do in our system

I'd start by listing how we consume `status`. The scenario is a payout, so the bad outcomes are financial. Weak consumers tend to fail in one of these ways:

1. **Crash or deserialization error.** A strict enum parser throws, the payout job fails, and the batch stalls. This is the loud failure, so it's the easiest to catch.
2. **Silent default.** A `switch` falls through to `default`, or a mapper turns unknown values into `FAILED` or `PAID`. This is the dangerous one. Mapping to `FAILED` can trigger a retry or a second payout. Mapping to `PAID` tells a seller they've been paid when they haven't. Neither raises an alarm.
3. **Stuck state.** The code treats the value as "not terminal" and polls forever, or treats it as terminal and stops polling. Sellers see "processing" for weeks.
4. **Downstream leakage.** Reports, ledger reconciliation, the seller dashboard, notification templates, and analytics each hold their own copy of the status mapping. One service may handle the value while another doesn't.

Which of these happens matters more than how the partner labels the change.

### Evidence I'd gather

- **Read the code and the schema** to see where `status` is parsed, mapped, and stored. Check whether the database column is an enum type, because that can fail at write time.
- **Ask the partner questions.** What does `REQUIRES_REVIEW` mean? Is it terminal? Can it move on to `PAID` or `FAILED` later? Will we get a webhook when it does? Is the money held or already moved? Which accounts or amounts will trigger it first? Is there a sandbox or a way to trigger it before Tuesday? Does the OpenAPI spec or changelog list it?
- **Replay it in a controlled environment.** Using a stub or mock of the partner API, return the new value and watch what the whole system does, not just the first service. I'd also send a deliberately nonsense value such as `SOME_FUTURE_STATUS`. That checks the general "unknown value" behavior and not just this one case.
- **Check production data.** Find out how many payouts a day could plausibly reach this state. If the partner says it's rare and manual, then "few sellers, large amounts, no one watching" is a different risk from "5% of daily payouts."

I'd explore this rather than script it first. Ministry of Testing's [Exploratory Testing an API](https://www.ministryoftesting.com/dojo/lessons/exploratory-testing-an-api) describes mapping an API's inputs, outputs, exceptions, and dependencies, then looking for the "dials" you can turn. An unexpected enum value is one of those dials. The cheap first step is to turn it by hand and observe, before any suite exists.

### What I'd say in the meeting

> "Thanks for flagging this. I'm not saying it's unsafe. I'm saying I can't tell yet. I've listed where we read `status`, and I need two things from the partner: what the new state means, and whether a sandbox can return it before Tuesday. I'd also like thirty minutes with whoever owns the payout mapper to check what happens to an unknown value. If it fails safe, meaning the payout is held and an alert fires, we're fine and can ship a test for it. If it defaults to failed or paid, I'd want that fixed before Tuesday, because that's the kind of failure sellers and finance find before we do."

This claims no authority. It asks for information, states what I know and what I don't, and names a specific risk. It also leaves the decision with the people who own it.

### What a sensible outcome looks like

The fix is rarely "handle `REQUIRES_REVIEW` perfectly." More often it's a **safe default for any unknown status**: treat the payout as unresolved, don't retry money movement, don't tell the seller it's paid, log the raw value, and alert a human. Then we add explicit handling once the partner explains the state. I'd also ask the team to keep a check for "unknown status" in the suite after this week, because the partner will add another one eventually.

I'd also want monitoring in production for payouts that sit in an unrecognized or non-terminal state for longer than expected, since a pre-release test can't tell us what the partner really sends.

### Tradeoffs

- **Maximum caution.** Delaying our own releases or asking the partner to postpone is costly. I wouldn't ask for that unless I'd seen option 2 or 3 above happen in a test.
- **Strict parsing vs. tolerant parsing.** Strict parsing catches problems early but fails loudly in production. Tolerant parsing keeps things running but can hide a state that needs a human. For money movement I'd lean toward "tolerant to read, conservative to act."
- **Automating the check.** A test that feeds unknown values into the mapper is cheap and worth keeping. I wouldn't build a large partner simulation for one enum value.

### Weak answers and assumptions

- "The partner said it's compatible, so no testing is needed." This treats a vendor's statement as evidence about our code.
- "Our contract tests will catch it." A contract built from today's responses doesn't contain tomorrow's value. It would pass until Tuesday. Michael Bolton and James Bach's [On Testing and Checking Refined](https://developsense.com/?p=1435) is a useful reminder here. A check confirms expectations we already wrote down, and the point of this task is to find out what we haven't thought of yet.
- "Add `REQUIRES_REVIEW` to the enum and we're done." That fixes this value and leaves the same weakness for the next one.
- "Escalate and demand a freeze." This oversteps the evidence and your role. You can raise the risk and bring data, and the decision still belongs to others.

### Follow-up questions

1. The partner says the sandbox can't produce the new status. What other ways could you observe how your system behaves, and how would you describe the uncertainty that remains?
2. After Tuesday, a seller reports being stuck in "processing" for six days. What would you check first, and how would you tell whether this was a testing gap, a monitoring gap, or a communication gap?

## Sources

- [Stripe: How API versioning works](https://docs.stripe.com/api-versions): I used this to show what a major payments provider counts as backward-compatible. It also shows that the list doesn't mention enum values, and that the integrator is told to ignore unknown fields and handle unfamiliar event types.
- [Google AIP-180: Backwards compatibility](https://google.aip.dev/180): I used this for the point that adding values to response enums can break consumers that don't handle new values gracefully.
- [Ministry of Testing: Exploratory Testing an API](https://www.ministryoftesting.com/dojo/lessons/exploratory-testing-an-api): I used this for the approach of mapping an API's inputs, outputs, and dependencies and turning its "dials" by hand to discover behavior.
- [DevelopSense (Michael Bolton): On Testing and Checking Refined](https://developsense.com/?p=1435): I used this to explain why a contract check built on known responses can't answer the question of what happens with a value nobody anticipated.
