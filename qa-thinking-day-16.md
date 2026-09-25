# QA Thinking — Day 16

## Testing Utility Billing: When There's No "Actual" to Compare Against, What's Your Oracle?

Most testing advice assumes you can eventually check your work against a known-correct answer. Utility billing routinely breaks that assumption, and it's worth sitting with why, because the discipline required there generalizes to a lot of harder testing problems.

### The domain: what a "read" actually is

A utility bill traces back to a meter reading, and that reading is one of two things: an **actual read** (measured — walked, self-reported, or transmitted by a smart meter) or an **estimated read** (a model's guess, usually built from the customer's prior 12 months of usage applied to the current billing period). Smart meters generate three kinds of data: **interval data** (consumption every 15/30/60 minutes — a 15-minute AMI meter produces 96 points a day), **daily read data** (one aggregated figure per day, still the norm for many water utilities), and **event data** (tamper, reverse flow, continuous low-flow leak signatures, outage/restore signals) ([Bynry](https://www.bynry.com/blog/utility-meter-data)).

Before any of that reaches billing, it passes through a **VEE pipeline** — Validation, Estimation, Editing. Validation flags reads that look implausible (negative consumption, physically impossible spikes, missing intervals). Estimation fills gaps when a read never arrives — comms outage, meter fault, access issue. Editing lets an operator override the automated result. When the real read finally shows up, the bill gets a **true-up**: a correction against the earlier estimate, credit if the utility overbilled, an additional charge if it underbilled ([HPU: Estimated vs Actual Reads](https://hpuc.com/2026/02/25/lets-talk-billing-estimated-vs-actual-reads/)). Estimated reads are the single biggest driver of billing disputes and a direct source of revenue leakage when the estimation model is wrong at scale, not just on individual accounts.

### Why this is an oracle problem, not just a data problem

Here's the part testers usually skip past. When you test whether an *estimated* bill is "correct," there is no ground truth to diff against — the actual consumption is, by definition, unknown until the next real read arrives, which could be a month or a quarter away. You cannot write `assert actual_bill == expected_bill`. So how do you decide something is a problem worth raising?

Michael Bolton's writing on oracles is exactly about this situation: an oracle is "a means by which we recognize a problem," and recognition is a *process*, not a lookup. It starts as a feeling — something looks off relative to a model, a comparable case, or a heuristic — and it only becomes a reportable problem once you and the team share an understanding of why it matters. Critically, the tester doesn't get to declare the estimate "wrong"; that's a decision for the business rules and the people accountable for them. The tester's job is to build a credible case ([DevelopSense, Oracles from the Inside Out](https://developsense.com/blog/2015/09/oracles-from-the-inside-out)).

Applied to metering, this reframes your testing questions:

- Instead of "is this estimate correct?" ask "which heuristic oracle am I actually using?" — history-based consistency (does it match the customer's seasonal pattern?), plausibility (is it within physically possible bounds for the meter class and connection size?), comparable-account consistency (do neighboring accounts on the same feeder show similar deviation?).
- Each of those oracles is fallible on its own. A customer who just installed solar panels, added an EV charger, or moved out mid-cycle will legitimately break the "matches history" heuristic — and that's not a bug, it's exactly why VEE has multiple layers instead of one rule.
- Your bug report on a bad estimate should read like Bolton's investigative-reporter framing: "here's the oracle I used, here's why it fired, here's the risk if it's wrong, and here's what I don't yet know" — not "the estimate is wrong."

### Concrete testing ideas for a metering/billing system

1. **VEE rule interaction, not just individual rules.** Test what happens when a read fails validation *and* triggers an event flag (e.g., reverse flow) in the same cycle — does editing get applied before or after estimation, and which oracle wins?
2. **True-up across billing-period boundaries.** Force a real read to arrive two cycles after an estimate. Verify the credit/charge lands on the correct statement, at the correct rate (tariffs can change between the estimate and the true-up).
3. **Meter swap mid-cycle.** New meter, new serial, reset counter or different interval granularity (daily → 15-minute AMI). Confirm the estimation model doesn't silently blend readings from two physically different meters as if they were continuous.
4. **Negative and impossible consumption.** Net metering (solar) can produce genuinely negative net consumption — make sure your validation layer doesn't reject a *legitimate* negative read as an error.
5. **Estimation drift at scale.** One wrong estimate is a customer complaint; a systematically biased estimation model across thousands of accounts is silent revenue leakage or overcharging that nobody notices until a regulator or an audit does. Ask: what's your oracle for "the model itself has drifted," not just "this one bill looks odd"?

### The soft-skill layer

When you flag an estimation anomaly, you're not reporting a defect with a clean repro — you're presenting evidence toward a decision that Billing, Product, and possibly Compliance need to weigh in on. State your oracle explicitly ("I compared against 12-month seasonal baseline and flaged >40% deviation with no event data explaining it") so the team can judge the heuristic, not just accept or reject your conclusion. That's the difference between bug advocacy that lands and a report that gets dismissed as "the tester's opinion."

### Exercise

Pick a system you test (billing, usage-based pricing, any place you estimate a value before confirming it later). Write down, explicitly, every oracle you currently use to decide "this estimate looks wrong" — not the assertions in your test code, but the actual heuristics in your head. For each one, name a legitimate scenario where that heuristic would misfire (like solar/EV breaking a seasonal-consistency check). If you can't name one, you probably haven't stress-tested your own oracle yet.

**Sources used:**
- [Michael Bolton, "Oracles from the Inside Out, Part 1: Introduction" — DevelopSense](https://developsense.com/blog/2015/09/oracles-from-the-inside-out)
- [Bynry, "Utility Meter Data Types: Interval, Daily Read, and Event Data"](https://www.bynry.com/blog/utility-meter-data)
- [Hibbing Public Utilities, "Let's Talk Billing – Estimated vs Actual Reads"](https://hpuc.com/2026/02/25/lets-talk-billing-estimated-vs-actual-reads/)
