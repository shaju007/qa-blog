# QA Interview Q&A — Day 10

## Question: Your energy supplier's dynamic-tariff feature has been live since November 2025. It bills households for each 15-minute interval, using day-ahead prices and smart-meter readings. On 25 October 2026 the clocks go back, and the feature has never been through that change. The developers say: "Everything's stored in UTC, so DST isn't an issue." You have 17 days. What do you do?

## Answer

The interviewer is checking three things. Do you know how this domain models time? Can you treat a confident claim as something to test, without picking a fight? And can you turn 17 days into evidence instead of worry? "I'd test the DST change" isn't an answer. The useful answer explains where the risk sits, how you'd find out, and what you'd say.

### 1. Why "everything is UTC" doesn't settle it

UTC storage solves one problem: every stored instant is unambiguous. But in this domain most of the business concepts are in local time:

- **The delivery day.** The day-ahead auction sells electricity for a local delivery day. Under EU summer-time rules, summer time ends at 01:00 UTC on the last Sunday of October. So on 25 October 2026, local time goes 02:59 CEST → 02:00 CET, and the hour from 02:00 to 03:00 happens twice. That day has 25 hours. Since the single day-ahead coupling moved to a 15-minute market time unit (delivery day 1 October 2025), that means **100 price intervals, not 96**.
- **The meter day, the invoice and the app.** Customers see "tonight's cheapest window" in local time. Meter data arrives per local day, and plausibility checks often run per local day. Daily and monthly totals are local.
- **The device schedule.** If the app tells a heat pump or EV charger to run from "02:00 to 04:00," that window is ambiguous on that one night.

So the risk isn't in the database. It sits in every place where we convert, group, join or check counts. PEP 495, which added the `fold` attribute to Python's datetime, describes this exactly: during a fall-back, a local clock reading "is insufficient to identify a particular moment in time."

The history matters too. The feature has been through one clock change: spring-forward on 29 March 2026. That was a 23-hour day with 92 intervals. **Spring and autumn fail differently.** A missing hour can drop data or leave a gap. A repeated hour can cause **collisions**. Here's the classic case: an upsert keyed on `(meter_id, local_timestamp)` quietly replaces the first 02:15 reading with the second one. Nothing errors, and one hour of consumption is just gone. "We survived March" is real evidence, but it only covers half of the problem.

### 2. Learn the pipeline before testing it (days 1–2)

I'd spend an hour each with someone from billing operations and someone who owns the meter-data integration. I'd ask them to walk me through the chain: **price ingest → meter-data ingest → validation → rating → invoice → app display → device control**. At each step I'd ask:

- What timestamp format comes in? UTC, local with offset, or local without offset? How does the price feed or the meter feed label the repeated hour?
- What defines "a day" here, and who decided that?
- Is anything a fixed size: an array of 96 slots, a chart with 24 bars, a check like "expect 96 readings per day", a cron job at 02:30 local time?
- What happens when a check fails? Do we reject the data, alert someone, or **substitute estimated values**? That last one matters most. If the plausibility check says "a day must have 96 readings," a perfectly valid 100-interval day might get replaced by estimates. The customer then gets billed on estimates for a day we actually measured.

This is where the Heuristic Test Strategy Model from James Bach (Satisfice) helps. **Time** and **Data** are separate product elements in it, and it puts **Project Environment** (who knows what, and where the information lives) alongside the product. In this domain, the knowledge you need is mostly in billing ops and in market-data documents, not in the code.

### 3. Collect cheap evidence first (days 2–4)

Before setting up anything new, I'd check production data from **29 March 2026**. For every dynamic-tariff meter: how many intervals were priced that local day? 92 is what we'd expect. If it's 96 with four zeros or duplicates, something is wrong. Then a reconciliation: does the sum of the 15-minute consumption match the change in the meter register reading? This uses two of the oracle heuristics in Michael Bolton's HICCUPPS (DevelopSense):

- **History**: what the system did last time.
- **Product consistency**: two parts of the product should agree with each other.

I'd also grep for `96`, `24`, `86400`, `* 24`, `timestamp without time zone`, and any scheduler config in local time. That isn't a code review. It's a quick way to find likely suspects.

### 4. Rehearse the night with data designed to expose bugs (days 4–10)

In an isolated environment with a controllable clock (not my laptop clock, and not shared staging), I'd replay a full fall-back day. Last year's 26 October 2025 results are real 100-interval data and a good starting point. Then I'd change the data **so mistakes become visible**:

- Give the first and second 02:00–03:00 hours **very different prices**, for example 5 ct vs 45 ct.
- Create one test customer who uses 11 kW (an EV charging) **only in the second 02:00 hour**, and nothing in the first.
- Calculate the expected bill **independently in a spreadsheet**, so I have an oracle that doesn't depend on our code.

With realistic data, a mis-join might move the bill by a few cents, and nobody would notice. With this data, a mis-join shows up immediately as a wrong amount or missing consumption. Then I'd check the app's chart and the "cheapest window" text, the device schedule sent for that night, and the push notification jobs. I'd do the same for **28 March 2027**: spring-forward, 92 intervals.

### 5. What to automate, and what not to

A unit or contract-level test with a **fixed clock and fixtures for 23-, 24- and 25-hour days** should go into the permanent suite. It's cheap, it's deterministic, and the dates come back twice a year forever. The full end-to-end rehearsal with real feeds is a one-off before this transition. I wouldn't turn it into a flaky nightly job.

### 6. Plan for the night itself (days 11–17)

Testing reduces uncertainty. It doesn't remove it. So I'd propose these to the product owner and engineering lead. They're suggestions; the decisions are theirs:

- An alert on the morning of 26 October if any meter-day has an interval count other than 100, or fails the register reconciliation.
- **Hold the invoice run for affected periods** until reconciliation passes.
- A short briefing for customer support: "Why does my chart show 02:00 twice?"
- A named on-call person for the pricing and meter pipelines.

### What I'd say in the meeting

> "I'm not saying it's broken, and the UTC storage is a genuinely good decision. My concern is the places where we turn UTC back into local days: the auction's delivery day, the meter feed's day, the invoice and the device schedule. That day has 100 intervals. March only tested the missing hour, not the repeated one. I'd like two days to check what March did in production and one isolated rehearsal of the 25 October data. If both look clean, I'll say so plainly. If not, we'll still have about ten days to choose between fixing it, adding a manual reconciliation step, or holding invoices."

That treats "everything is UTC" as a **claim**, another HICCUPPS oracle, and tests it without disrespecting the people who made it. It also gives decision-makers options instead of a veto I don't have.

### Weak answers interviewers hear

- **"Change my system clock and click around."** It only tests the UI on one machine. It misses ingest, joins, validation and scheduled jobs.
- **"It's one night a year, it's an edge case."** It hits *every* dynamic-tariff customer at once, it affects billing, and it repeats every spring and autumn.
- **"Ask the devs if they handled DST."** They'll honestly say yes, because in their model they did.
- **"Write more unit tests."** That's useful, but they only check the assumptions the team already has. The failure modes here come from the domain.
- **Treating it only as a technical bug.** In this domain it's a billing-accuracy and customer-trust problem. In Germany, offering dynamic tariffs is a legal obligation for suppliers (§ 41a EnWG), not an experiment. That raises the cost of getting the bill wrong.

### Follow-up questions

1. **Your rehearsal shows the second 02:00 hour is priced at the first hour's rates. The average error is €0.04 per customer. The product owner wants to "fix it after the clock change." What do you say?**
   Here's how I'd answer. The amount isn't the question. The questions are which way the error goes, whether customers can see it, and whether we can correct invoices before they go out. If the hold-and-reconcile step is in place, fixing afterwards may be completely fine. I'd write down the decision and who made it.
2. **Which other dates in this domain deserve the same treatment?**
   Spring-forward (92 intervals), a late or missing day-ahead result, month-end and year-end invoice boundaries, leap days, and any date when grid fees or tax rates change in the middle of a billing period.

## Sources

- [Michael Bolton, DevelopSense, "Oracles" (HICCUPPS consistency heuristics)](https://developsense.com/resource/Oracles.pdf). This is where History, Claims, Product consistency and Standards/Statutes come from. The answer uses them to question "everything is UTC" and to check March production data and register reconciliation.
- [James Bach, Satisfice, Heuristic Test Strategy Model](https://www.satisfice.com/download/heuristic-test-strategy-model) (also hosted at [DevelopSense](https://developsense.com/htsm)). Time and Data as product elements and Project Environment as a context factor. That framing drives the "learn the pipeline before testing it" step.
- [Ministry of Testing, glossary entry "Oracles"](https://www.ministryoftesting.com/software-testing-glossary/oracles). Practitioner definitions of oracles, including "derived" (check the math) and "statistical" oracles. These support the independent spreadsheet calculation and the interval-count alerting.
- [Directive 2000/84/EC on summer-time arrangements (EUR-Lex)](https://eur-lex.europa.eu/eli/dir/2000/84/oj/eng). The primary source that summer time ends at 01:00 GMT on the last Sunday in October, which produces the 25-hour local day.
- [OTE: Market Coupling Steering Committee confirms 15-minute MTU in SDAC for delivery day 1 October 2025](https://www.ote-cr.cz/en/about-ote/ote-news/market-coupling-steering-committee-confirms-go-live-of-15-minute-mtu-in-sdac-on-trading-day-30-september-2025-for-delivery-day-1-october-2025). Confirms day-ahead prices moved to 15-minute intervals, so the fall-back day has 100 price intervals.
- [§ 41a EnWG (gesetze-im-internet.de)](https://www.gesetze-im-internet.de/enwg_2005/__41a.html). The German obligation for suppliers to offer dynamic tariffs to smart-meter customers, which is why billing accuracy here goes beyond a product-quality concern.
- [PEP 495 — Local Time Disambiguation](https://peps.python.org/pep-0495/). Primary technical documentation on why local time is ambiguous during a fall-back and how the `fold` attribute addresses it. Background for the upsert-collision failure mode.
