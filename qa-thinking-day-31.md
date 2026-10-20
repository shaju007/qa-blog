# QA Thinking — Day 31

## Testing a Rule That Pays You Nothing: Negative-Price Feed-In and What Testers Actually Find

### The domain: why a solar operator can be paid zero for an hour of generation

In Germany, many solar owners are paid a guaranteed rate for the power they feed in, under the EEG (Renewable Energy Sources Act). For years that payment was independent of the market price. [Clean Energy Wire's factsheet on negative power prices](https://www.cleanenergywire.org/factsheets/causes-and-effects-negative-power-prices) explains how negative prices happen. Inflexible generation and low demand coincide, and the guaranteed payment is topped up through a levy on consumers. So an operator was paid even when the wholesale price was below zero, which gave them little reason to stop generating.

The **Solarspitzengesetz** ("solar peak act") changes this for new systems. [RatedPower's summary by Julian Scheer](https://ratedpower.com/blog/how-solarspitzengesetz-affects-solar/) describes these rules:

- The suspension applies to PV systems commissioned **after 25 February 2025**. Systems under 2 kW are exempt.
- In any **15-minute interval with a negative price**, the subsidy is suspended.
- Operators with a smart meter can recover the lost intervals later. The 20-year support period is extended by the unpaid blocks. This is the "catch-up" mechanism in §51a.
- New systems under 100 kWp **without** a smart meter and remote control must limit feed-in to **60% of installed capacity** until those are installed and tested.

Before you build test cases from this, check the details against the law itself or your own company's interpretation. RatedPower is a solar-software vendor, and a summary is not the statute. Use it to orient yourself, then get the real rule from your domain expert.

### Why this is a testing problem and not only a calculation

An hour of solar generation now has a different financial outcome depending on facts that live in different systems:

| Fact | Where it probably lives |
|---|---|
| Commissioning date (before or after the cutoff) | Asset registry or onboarding |
| Size of the plant (under 2 kW, under 100 kWp) | Asset registry |
| Smart meter present and remote control tested | Metering and grid-operator integration |
| Settlement interval price | Market data feed |
| Interval metered feed-in | Meter data pipeline |
| Marketing form (fixed tariff or direct marketing) | Contract |

The payout for one 15-minute block depends on all six, joined correctly. The failures are rarely arithmetic mistakes. They look like these:

- **A boundary date treated as a cutoff in the wrong time zone.** A plant commissioned on 25 February could be classified either way.
- **A price of exactly 0.00 €/MWh.** Is "negative" `< 0` or `<= 0`? Rounding of the price can also flip the outcome.
- **A price feed that is late or revised.** Did you pay for an interval and later learn the price was negative?
- **The catch-up ledger.** Unpaid intervals have to be added to the support period exactly once. A retried job could count them twice.
- **A state change mid-period.** A smart meter is installed on the 14th. The 60% cap should stop applying from that point, not from the start of the month.
- **Mixed fleets.** One customer has an old plant and a new one on the same meter.

### Applying James Bach's "What Testers Find"

Bach's post [What Testers Find](https://www.satisfice.com/blog/archives/572) says that testing produces more than bug reports. His categories are bugs, risks, issues, testability problems, artifacts, and curios. Most teams only report bugs, so a lot of valuable output gets lost. Here is how the categories look in this domain:

- **Bug.** A 2.5 kW plant commissioned in March is paid during a negative-price interval.
- **Risk.** Eligibility is derived from a free-text "commissioned" field that operators edit by hand. It works today. It could misclassify plants whenever someone changes the format.
- **Issue.** Nobody can say whether a plant that changes its direct-marketing provider mid-year keeps its catch-up balance. This threatens the project, not the code, because the requirement is missing.
- **Testability problem.** You cannot replay a past day's prices into the payout calculation. Without that, you cannot test the rule against real negative-price days.
- **Artifact.** A mismatch caused by your test data. For example, you used a 60-minute price series where the system expects 15-minute intervals.
- **Curio.** In your data, negative prices cluster around public holidays. That might shape which days you test, though it isn't a defect.

Bach's "artifact" category matters most when you work with time series data. Before you raise a bug, check whether your own fixture caused the discrepancy. That check protects your credibility with developers.

### Turning it into test ideas

1. **Boundary table for eligibility.** Test the cutoff date, the 2 kW and 100 kWp limits, and the combinations of smart meter and remote-control status.
2. **Price boundary.** Test −0.01, 0.00, and +0.01 €/MWh. Ask the domain expert what the market says about exactly zero.
3. **Interval alignment.** Test an interval that starts at 11:45 and straddles a price change. Test the daylight-saving days too, which have 92 or 100 quarter-hours. (Day 29 covered clock changes. Here the point is that the payout needs a consistent interval key.)
4. **Idempotency of catch-up.** Run the end-of-period job twice and check the extension is added once.
5. **Reconciliation invariant.** Over any period, `intervals generated = intervals paid + intervals suspended`. If the sum doesn't hold, you have found something without needing a perfect oracle.
6. **Late and revised price data.** Replay a price correction after payout and see whether the system detects it, ignores it, or silently disagrees.
7. **Customer-facing explanation.** Does the statement show *why* an hour paid nothing? If a customer can't tell, support will get the tickets.

### The soft-skill side: reporting what isn't a bug

Suppose you find the "no replay of historical prices" gap. If you file it as a bug, it gets closed with "works as designed." Frame it as a testability problem: *"I can't verify the suspension rule against real negative-price days. I can check synthetic cases only, so the risk of misclassification on real data stays unmeasured. A replay endpoint or fixture import would close that. It is probably two days of work."*

That framing names the gap, what it prevents you from learning, and a concrete ask. Bach's categories give you the vocabulary to say what kind of finding it is, and the kind decides who owns it. A bug goes to a developer, an issue to the product owner, and a testability problem to the whole team's planning.

### Challenge

Choose a rule in your current product that depends on a **date, a threshold, and a status** at once. Examples are a discount that applies to "new customers after a date", a rate limit by plan tier, or a fee waiver above a balance.

1. Write down every input fact and where it lives.
2. Make a boundary table with at least eight rows, including one row you expect to be ambiguous.
3. Run it, or review it with a developer.
4. Write up your results as **at least one finding from three different Bach categories**, not only bugs. Use one sentence each for the finding, its impact, and the person who should act.

If all your findings are bugs, check whether you left risks, issues, or testability problems unreported.

### Sources

- James Bach, [What Testers Find](https://www.satisfice.com/blog/archives/572), Satisfice
- Julian Scheer, [How the Solarspitzengesetz affects solar](https://ratedpower.com/blog/how-solarspitzengesetz-affects-solar/), RatedPower (vendor blog; verify the rules against the law)
- Clean Energy Wire, [Causes and effects of negative power prices](https://www.cleanenergywire.org/factsheets/causes-and-effects-negative-power-prices) (the figures it gives are from 2016–2017, so use it for the mechanism, not current numbers)
