# QA Thinking — Day 18

## The Risk Story: Why "28%, Not 30%" Is More Convincing Than "There's a Bug"

James Bach and Michael Bolton describe the output of good testing as a **risk story** — not a pass/fail count, but a narrative that lets a decision-maker understand what could go wrong, how likely it is, and how bad it would be if it did ([Rapid Software Testing Focused: Risk](https://www.satisfice.com/rapid-software-testing-focused-risk); [DevelopSense on risk](https://developsense.com/blog/category/risk)). Most testers report bugs. Fewer testers tell risk stories that survive contact with a skeptical product owner in a five-minute standup.

The difference is concrete: a bug report says "discount stacking is broken." A risk story says "when we stack a 20% promo with a 10% loyalty discount, the system reads it as 30% off but it's actually 28% — that's a $2 gap on a $100 cart, and it's silent, so finance won't catch it until they reconcile margin next week." One of these gets triaged as P3. The other gets a fix scheduled before launch.

### Why e-commerce discount stacking is a good test case for this skill

A practitioner writeup on discount-validation APIs lays out the math cleanly: percentage discounts compose **multiplicatively**, not additively. Two sequential discounts of 20% and 10% give `0.8 × 0.9 = 0.72` — a 28% total, not 30% ([Designing a Discount-Validation API](https://dev.to/lizely/designing-a-discount-validation-api-catching-stacked-coupon-math-errors-before-they-hit-production-1lc2)). This is exactly the kind of bug that's invisible in a demo, invisible in a happy-path test, and only shows up as a slow bleed in margin reports weeks later — which is precisely why it needs a risk story, not just a ticket.

The same source flags three failure modes worth testing deliberately, because each one produces a *different* business consequence you should be able to name out loud:

- **No clamping** — a $50 fixed coupon on a $30 item should floor at $0, not generate a negative price or a phantom refund. Consequence: money leaves the business with no purchase behind it.
- **Order-dependent stacking** — applying the fixed discount before vs. after the percentage discount changes the final total. If your engine isn't consistent about order, two customers with the same coupons in different sequences pay different prices. Consequence: pricing inconsistency that support and finance can't explain.
- **Rounding mid-calculation instead of at the end** — rounding after each discount step instead of once at the end can drift totals by a cent or more across three stacked discounts. Consequence: at scale, "off by a cent" becomes a five- or six-figure reconciliation headache, and it looks like fraud in an audit before anyone identifies it as a rounding bug.

### Applying this at work

1. **Find the multiplicative traps in your own domain.** Discount stacking is one instance of a general pattern: things that look additive to a product owner but are actually multiplicative, sequential, or order-dependent to the system. Ask "does the business assume this adds up, and does the code actually multiply, floor, or reorder it?" This pattern also shows up in tax-inclusive vs. tax-exclusive pricing, tiered API rate limits, and layered permission systems.

2. **Turn the bug into a risk sentence before you file it.** Use the shape: *"When [condition], the system does [behavior], which causes [business consequence], and it's [visible/invisible] to [which stakeholder]."* This is what makes a report land — it does the risk-assessment work for the reader instead of asking them to infer it. Ministry of Testing's Risky Business module frames this as the core skill of turning technical findings into decision-relevant language ([Risky Business: The Relationship Between Testing and Risk](https://club.ministryoftesting.com/t/new-module-release-module-6-risky-business-the-relationship-between-testing-and-risk/82290)).

3. **Test for silence, not just for wrongness.** The rounding-drift bug is dangerous specifically because nothing crashes and no error is logged — it just quietly disagrees with finance's spreadsheet. When you test pricing, ask not "does this produce a wrong number" but "if this produces a wrong number, who finds out, and how long does it take them?" That question is often more important than the test case itself.

### Challenge

Pick a calculation in your own product that involves more than one adjustment applied in sequence (discounts, taxes, fees, rate limits, permission overrides — anything layered). Write out:
- The order the system actually applies them in (check the code or ask an engineer — don't assume).
- One scenario where reordering the steps changes the final result.
- One risk story, in the sentence shape above, that you could say out loud in a standup and have a non-technical stakeholder immediately understand the stakes.

Sources:
- [Rapid Software Testing Focused: Risk — Satisfice, Inc.](https://www.satisfice.com/rapid-software-testing-focused-risk)
- [Risk category — DevelopSense (Michael Bolton)](https://developsense.com/blog/category/risk)
- [Risky Business: The Relationship Between Testing and Risk — Ministry of Testing](https://club.ministryoftesting.com/t/new-module-release-module-6-risky-business-the-relationship-between-testing-and-risk/82290)
- [Designing a Discount-Validation API: Catching Stacked-Coupon Math Errors Before They Hit Production — DEV Community](https://dev.to/lizely/designing-a-discount-validation-api-catching-stacked-coupon-math-errors-before-they-hit-production-1lc2)
