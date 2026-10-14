# QA Thinking — Day 27

## Testing Ad Budget Pacing: The Budget Is a Promise About a Curve, Not a Final Number

A typical budget check on an ad platform looks like this: create a campaign with a €100 daily budget, push traffic at it, and assert that spend at the end of the day is `<= 100`. The check passes and everyone moves on.

That check misses most of what matters. Advertisers aren't buying "about €100 spent by midnight." They're buying a **spend curve**: steady visibility through the day, the right share of the month, and no surprise charges. The worst pacing failures produce totals that look fine. All the money goes by 10:00. Spend stops for three days at the end of the month. Or the cap is hit exactly while the invoice still shows more than the cap because clicks kept arriving afterwards.

Today's lesson is about testing systems where **correctness is a shape over time** and where **the system always makes decisions with stale information**. Ad pacing is the example. The same thinking applies to energy-market position limits, rate limiters, credit exposure checks and inventory reservations.

---

### 1. Domain primer: the vocabulary you need before you can test anything

| Term | What it means | Why a tester cares |
|---|---|---|
| **Flight** | Start and end dates of a campaign or line item | Boundaries: first hour, last hour, time zone of "midnight" |
| **Daily vs. lifetime budget** | A cap per day, or a total for the whole flight that the system spreads out | Different oracles: the daily cap can be broken on purpose so the lifetime total comes out right |
| **Pacing** | The rate at which the system tries to spend or deliver | The thing you're actually testing. The total is just where it ends up |
| **Even / Frontloaded / ASAP** | Pacing modes: spread evenly, run ahead early, or spend as fast as possible | Each mode has its own documented tolerance |
| **Overdelivery / overspend** | Delivering or spending beyond the goal | In a guaranteed deal, the publisher gives inventory away. In self-serve, the advertiser may or may not be charged |
| **Underdelivery** | Not reaching the goal | On guaranteed deals this can trigger a **makegood**: free delivery later, credits, or other compensation |
| **Served cost vs. billed cost** | What the system delivered vs. what the customer is actually charged | The gap between them is a ledger you have to reconcile |
| **CPM / CPC / CPA** | Pricing per thousand impressions, per click, or per conversion | With CPC and CPA, the charge can arrive minutes or days after the serving decision |
| **Fast finish / catch-up** | Speeding up spend near the end of a period, or after falling behind | Where most overshoot happens |

A few documented behaviours turn this from theory into concrete oracles:

- **Google Ad Manager** says Evenly-paced line items may deliver up to about 5% ahead of goal as a safeguard against underdelivery. Frontloaded can briefly run up to 40% ahead, then settles toward 5% near the end. In the final hours, a line item that is behind behaves as if it were set to ASAP. Underdelivery triggers aggressive catch-up the next day by default. Google also says caps can be slightly exceeded because of delayed impression counting and simultaneous requests ([Delivery basics](https://support.google.com/admanager/answer/2669484); [Line items](https://support.google.com/admanager/answer/82244)).
- **Google Ads** lets a campaign spend up to 2× its average daily budget on a given day. Over a month it bills no more than 30.4× the average daily budget, and served cost above the limit is not billed ([About overdelivery](https://support.google.com/google-ads/answer/1704443?hl=en)).
- **Microsoft's Xandr docs** explain why exact budgeting is impossible. The platform sees millions of impressions per second, with a 200 ms auction timeout, so it is bidding on the next impressions before it knows whether it won the last one. Hundreds of bidders can work on one campaign. Small budgets are much more likely to overspend in percentage terms: about 45% of $1 budgets overspend, and 12% overspend by more than 30%. In-flight budget changes usually take effect within 5 minutes, but in isolated cases can take up to 4 hours ([Difficulties with Exact Budgeting](https://learn.microsoft.com/en-us/xandr/monetize/difficulties-with-exact-budgeting)).
- **Makegoods** for underdelivery on guaranteed buys come from the IAB/4A's standard terms. The details are usually negotiated when the shortfall happens, and they generally don't apply to non-guaranteed or CPC inventory ([Baker Botts summary of makegoods](https://www.bakerlaw.com/insights/revisiting-makegoods-in-media-buys)).

**Main takeaway:** in this domain, "the budget was exceeded" is not automatically a bug. Platforms document overspend tolerances on purpose. Your job is to find out whether the tolerance is **stated, measured correctly, enforced where it should be, and acceptable to the people who carry the cost**.

---

### 2. The core model: three clocks and one stale counter

Any pacing system involves at least three clocks:

1. **Decision time.** The bidder or ad server decides to serve or bid, based on the spend counter it can see right now.
2. **Event time.** The impression renders, the click happens, or the conversion fires. This can be milliseconds later (impressions) or days later (CPA lookback windows).
3. **Accounting time.** The event reaches the aggregator, the spend counter updates, and later the invoice is generated.

The spend counter is **always behind reality**. Every pacing bug is some version of "the system acted on a picture of the past that was too old for the speed at which things were changing."

The [DoorDash ads team's Smart Fast Finish paper](https://arxiv.org/html/2509.07929v1) (Garg, Xiao, Yang, Rahurkar, 2025) shows this in production. Ads were shown before the daily budget was used up, but the billable click or purchase arrived afterwards. Those charges came out of the **monthly** budget. Each day looked roughly right, while the month drifted. They report about 11.5% overspend for enterprise campaigns in the last week of May 2024 and nearly 25% in the first week of June. Overspending then caused **blackout periods**: several days at the end of the month with no ads served at all.

Their fix (dynamic fast-finish start times and gradual throttling) was evaluated with a budget-split A/B test. Overdelivery dropped from 7% to 4.7%, and campaigns stayed live about 45 minutes longer per day. They tracked both overspend and live hours because the two pull against each other. If you only report overspend, you can "fix" pacing by starving campaigns.

What this means for testing:
- A check of "daily spend ≤ daily cap" can pass every day while the monthly result is wrong.
- The customer-visible failure (no ads in the last days of the month) shows up **weeks after** the cause (small daily overshoots).
- Your oracle needs to cover the **trajectory**, not only the end state.

---

### 3. Applying the Heuristic Test Strategy Model's "Time" element

James Bach's [Heuristic Test Strategy Model (v6.3)](https://www.satisfice.com/download/heuristic-test-strategy-model) lists **Time** as a product element. It asks you to consider timing relationships between input and output, fast versus slow input, changing rates (spikes, bursts, hangs, interruptions) and concurrency. Most teams skim that section. For pacing, it is close to a full test plan. Here is how each sub-idea becomes a concrete test idea:

| HTSM Time idea | Pacing test idea | Oracle / what "problem" looks like |
|---|---|---|
| **Input/output timing** | Delay the event pipeline on purpose (hold click events 2, 10, 60 minutes) while the bidder keeps running | How many decisions were made after the true spend crossed the cap? Is the overshoot within the stated tolerance? |
| **Input/output timing** | CPC campaign with a click lookback that crosses midnight and the flight end | Which day's budget and which invoice does a late click count against? Does it match what the advertiser UI says? |
| **Fast / slow** | Tiny budget (€1–€5) on high-traffic inventory, and a huge budget on thin inventory | Small budgets: percentage overshoot. Thin inventory: does catch-up turn into frantic ASAP buying of poor-quality inventory? |
| **Changing rates** | Traffic spike at a predictable moment (match kickoff, a TV ad, Black Friday 00:00) | Does the hourly goal recalculation react to a stale counter and overshoot? Does it spend the rest of the day's budget in 20 minutes? |
| **Changing rates** | Pipeline stops for 30 minutes, then delivers the backlog at once | After the backlog lands, does pacing "see" a big overspend and pause the campaign too hard? (The over-correction failure.) |
| **Concurrency** | Same campaign served from two regions or data centres; budget change during active bidding | Does each region try to spend the full budget? Xandr explicitly warns about this for multi-geo campaigns |
| **Concurrency** | Advertiser lowers the budget from €1,000 to €200 after €400 has already been spent today | What *should* happen? This is a business-rule question. Ask it before you test it (see §5) |

**A timely case: the clock itself.** EU daylight saving time ends on **25 October 2026**, so that Sunday has 25 hours in Hamburg. US DST ends on **1 November 2026**, which leaves a week where the offset between EU and US time zones is different from usual. For a campaign whose "day" is defined in the advertiser's time zone:
- Is the daily budget spread over 25 hourly slots or 24? If hourly goal = remaining budget ÷ remaining hours, which "hours"?
- Does the 02:00–03:00 hour, which happens twice, get two hourly goals, one goal, or a key collision in the aggregation table?
- Does a report bucketed in UTC show a "day" that overspent, when it was really one correct local day split across two UTC dates?

This is a ten-minute test with a controllable clock. If it's left unasked, it becomes a two-day incident.

---

### 4. Automation strategy: put the checks where the risk actually is

Pacing code tends to collect strong unit tests for the arithmetic and almost nothing for the timing. Rebalance like this:

**Keep, and make them property-based:** the pacing math. Invariants such as "remaining hourly goals never sum to more than the remaining budget", "the throttle rate stays between 0 and 1", "a paused campaign gets zero goal" and "a budget change is reflected in the next recalculation" are cheap and catch real regressions.

**Add: a simulation harness with injectable time and lag.** This is where pacing risk actually lives. The harness needs:
- a **controllable clock**, so DST, midnight and flight end can be tested in seconds;
- **recorded or synthetic traffic curves**, including spikes and droughts;
- a **lag knob** on the event pipeline, so you can model a stale counter;
- outputs as **curves**: planned vs. actual spend per hour, and "decisions made after true cap crossed."

Your assertions then become statements about the shape. "With 60 s counter lag and a 10× traffic spike, overshoot stays below X% of the daily budget, and live hours don't drop below Y." X and Y are numbers you have to **negotiate** with the business, not invent yourself.

**Avoid:** end-to-end UI tests that create a campaign, wait, and assert on the dashboard total. They are slow and flaky. They also test the final number, which is the least informative thing about the system.

---

### 5. Observability: in production, ask for the curve, not just the counter

Rob Meaney's Ministry of Testing talk [Observability: Unlearn Guessing, Reduce Stressing and Learn to Embrace Reality](https://ministryoftesting.com/testbash-sessions/observability-unlearn-guessing-reduce-stressing-and-learn-to-embrace-reality-rob-meaney) argues that in complex distributed systems you can't predict all behaviour in advance, and that testing continues after deployment. Pacing is a strong example: no staging environment reproduces real auction density.

So use your tester influence to make the system **able to show you its own pacing problems**. Concrete asks for the developers:

1. **Counter staleness as a metric.** Age of the newest event included in the spend counter, per region. If that number jumps from 5 s to 4 minutes, overspend is coming.
2. **Planned vs. actual spend per campaign per hour**, stored, not only shown on a live dashboard. You can't investigate a curve you didn't keep.
3. **"Decisions after cap" counter.** Bids or serves made after the reconciled spend exceeded the cap. This is overshoot measured at its cause.
4. **Served vs. billed reconciliation per day and per month.** The gap is either deliberate (documented free overdelivery) or a leak.
5. **Live hours per campaign.** This catches the opposite failure: pacing that is "safe" because it starves campaigns.

Then ask the operational question: **who gets alerted, and can they act?** Xandr's safety-budget guidance recommends sending the 80% alert to people with the authority and knowledge to change the campaign. A metric that nobody owns doesn't help anyone.

---

### 6. Soft skills: handling "it's within tolerance"

Sooner or later you'll report an overspend and a developer will say: *"That's expected. Pacing is never exact. It's within tolerance."* They may well be right. Here is how to have the conversation without either giving up or turning it into an argument about who's right.

**Split the claim into three questions.** Ask them one at a time and calmly:

1. **"Where is the tolerance written down?"** If it lives only in the team's heads, the first deliverable isn't a fix. It's a decision, written down and owned by someone with business authority (product owner, ad ops lead, finance).
2. **"Measured how?"** Served or billed? Per day, per flight or per month? Before or after late events arrive? A 5% daily tolerance measured on yesterday's data at 09:00 can hide a 25% monthly drift, which is the DoorDash pattern.
3. **"Is it acceptable *for whom*?"** Xandr's own data shows overspend percentage is much worse for small budgets. A tolerance that is fine for a €50,000 enterprise campaign may mean a €20/day local advertiser regularly pays for, or receives, a third more than they asked for.

**Translate the finding for each audience.** The same issue, three ways:

- *Developer:* "With the counter lagging about 90 s during kickoff spikes, we served for about 40 s after the true cap. Can we get counter staleness as a metric so we can see how often this happens?"
- *Product owner:* "Small-budget campaigns overspend by 12–30% on spike days. We don't have a written tolerance per segment, so right now nobody has decided whether that's acceptable."
- *Account manager / ad ops:* "Advertisers on daily budgets under €30 may see invoices above their stated budget on match days, or, if billing caps it, the platform absorbs the cost. Do customers complain about either today?"

**Avoid:** "pacing is broken." **Use instead:** a curve, a number, the affected customer segment, and a question about who decides. You aren't trying to win the argument. You're trying to make sure a tolerance exists and that someone with the authority has signed off on it.

---

### 7. Practical challenge (≈45 minutes)

A sports-media publisher sells a **guaranteed sponsorship line item**: 600,000 impressions, Monday–Saturday, **Even** pacing, so the daily goal is about 100,000. The CPM is €12. The ad ops dashboard refreshes from an aggregation job.

| Day | Final delivered | What the dashboard showed | Notes |
|---|---|---|---|
| Mon | 101,800 | — | |
| Tue | 104,600 | — | |
| Wed | 71,000 | — | Ad server deploy 14:00–18:00; a targeting key was missing for 4 hours |
| Thu | 129,500 | — | "Catch-up day" |
| Fri | 98,000 | — | |
| Sat | 127,300 | 96,000 at 22:00 | Derby kickoff 20:30; final figures landed at 03:00 Sunday |

**Total: 632,200 (+5.4%)**

**Your tasks:**

1. **Oracles.** Name at least three sources of expectation, for example the platform's documented Even tolerance, the insertion-order terms, the sponsor's actual goal ("visible every day"), and the publisher's revenue. For each, decide whether it says this is a problem. Note where they disagree.
2. **Questions before filing.** Write the three questions you'd ask before calling anything a bug. Hint: is +5.4% over flight-level tolerance? Was Wednesday's shortfall makegood-relevant if Thursday caught up? What pacing decision was made around 22:00 Saturday, and on which number?
3. **The Saturday hypothesis.** Explain in 3–4 sentences how a stale counter (96,000 shown, reality much higher) plus a traffic spike plus end-of-flight ASAP behaviour could produce the overshoot. Then describe the simulation-harness experiment that would confirm or rule it out.
4. **Two risk statements.** One for the developer (mechanism plus the metric you want), one for the ad ops lead. For example: the extra ~32,000 impressions at €12 CPM are about €386 of inventory given away on the most valuable night of the week. Was that inventory sellable?
5. **Observability ask.** Name the one signal that would have warned someone at 21:00 on Saturday, and who should receive the alert.

**A strong answer** keeps "over flight goal" separate from "uneven daily presence." It doesn't assume +5.4% is a defect without a written tolerance. And it ends with a specific question for the person who owns the decision.

---

### Sources used today

- James Bach / Satisfice — [Heuristic Test Strategy Model v6.3](https://www.satisfice.com/download/heuristic-test-strategy-model) (Product Elements → Time)
- Rob Meaney / Ministry of Testing — [Observability: Unlearn Guessing, Reduce Stressing and Learn to Embrace Reality](https://ministryoftesting.com/testbash-sessions/observability-unlearn-guessing-reduce-stressing-and-learn-to-embrace-reality-rob-meaney)
- Garg, Xiao, Yang, Rahurkar (DoorDash) — [Smart Fast Finish: Preventing Overdelivery via Daily Budget Pacing at DoorDash](https://arxiv.org/html/2509.07929v1)
- Microsoft Learn (Xandr) — [Difficulties with Exact Budgeting](https://learn.microsoft.com/en-us/xandr/monetize/difficulties-with-exact-budgeting) and [Key Budgeting and Pacing Concepts](https://learn.microsoft.com/en-us/xandr/monetize/key-budgeting-and-pacing-concepts)
- Google Ad Manager Help — [Delivery basics](https://support.google.com/admanager/answer/2669484) and [Line items](https://support.google.com/admanager/answer/82244)
- Google Ads Help — [About overdelivery and your average daily budget](https://support.google.com/google-ads/answer/1704443?hl=en)
- Baker Botts — [Revisiting Makegoods in Media Buys](https://www.bakerlaw.com/insights/revisiting-makegoods-in-media-buys) (summary of IAB/4A's terms)
