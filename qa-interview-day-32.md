# QA Interview Q&A — Day 32

## Question: "Advertisers can change their daily budget at any time, effective immediately." The product owner says it's a two-pointer: "It's one field." The team wants to estimate in five minutes. What do you ask before anyone votes, and what do you write down?

*Scenario: a self-serve retail-media platform where advertisers run sponsored-product campaigns on a marketplace. The product details below are made up for this exercise. The only real platform rule quoted here is Google Ads' documented budget behaviour, and it appears only as a contrast.*

---

## Answer

### The short version

I wouldn't argue with the estimate. The estimate is a symptom. A daily budget isn't really a field. It's a rule about **money over time**, enforced by a distributed ad server and later shown in reports and invoices. Two phrases in the story decide most of the cost and most of the risk: **"at any time"** and **"effective immediately."** The story doesn't say what either one means yet. If we vote now, developers estimate whichever version they picture. Two weeks later we find out we built a different feature from the one the PO had in mind.

So in the next ten minutes, my job is to:

1. find the few decisions the product owner hasn't made yet,
2. turn the decisions that are made into concrete examples with numbers, and
3. offer a thinner slice in case the full version isn't ready.

The PO decides what the rule is and how much of it to build now. I'm not claiming any authority over that. I'm making sure the decision gets made on purpose and is written down.

### How I'd reason before speaking

Michael Bolton points out that requirements exist even when the documents are thin. Some are explicit, some are tacit, and all of them are "to some degree ambiguous or incomplete." A one-line story isn't missing requirements. It hides them. The advertiser expects *something* to happen when they lower a budget at 14:00, and finance expects *something* on the invoice. My job is to bring those expectations into the open while they're still cheap to change.

To avoid missing whole areas, I quickly run through the product-factor guidewords in James Bach's Heuristic Test Strategy Model (structure, function, data, interfaces, platform, operations, time). For this story, **Time**, **Data** and **Interfaces** stand out right away:

- **Time:** which "day" the budget applies to, and how long a change takes to reach the ad servers
- **Data:** what has already been spent, and the budget history
- **Interfaces:** the UI, the public API, bulk edits, and the ad server's cached budget

### The questions, in priority order

I don't fire off forty questions. I ask the ones that change the estimate or the risk, roughly in this order:

**1. "What does 'daily budget' mean on our platform: a hard cap, or an average we're allowed to overshoot?"**
This one decision shapes everything else. Platforms really do differ. Google Ads, for example, documents that on the day you edit a budget, the daily limit is based on the *highest* budget set that day, and a day can spend up to twice that. For the rest of the month, spend is capped at the amount already spent plus the new budget times the remaining days. That's a legitimate design, but it's a *chosen* rule. If our sales team tells advertisers "your budget is a hard cap," we've chosen a different rule, and it's far harder to enforce in a distributed system.

**2. "If I lower the budget below what I've already spent today, what happens?"**
A concrete case: the budget is €200, €150 is spent by 14:00, and the advertiser lowers it to €100.
- Does delivery stop?
- Is the €150 billed in full, or is the €50 over the new budget credited?
- What does the UI say, so the advertiser doesn't open a support ticket?

**3. "Up, then down, on the same day: which value counts?"**
Lowest, highest, latest, or time-weighted? Each answer leads to a different calculation and a different test oracle (the source we use to decide whether a result is correct).

**4. "What does 'immediately' mean in seconds, and how much overspend is acceptable while the change propagates?"**
Ad servers usually cache budget state and make bid decisions in milliseconds. I'd ask the developers, not the PO: "How long until every ad server sees the new value? Can auctions already in progress still bill?" If nobody knows, that's a red card and maybe a spike. Then I'd ask the PO to name a tolerance, for example "within 60 seconds; overspend after a decrease of no more than X% of the new budget." Without a number, "immediately" can't be tested. It just becomes something people argue about after release.

**5. "Whose day is it?"**
Is it the advertiser's account time zone or the platform's UTC day? What happens if someone changes the account time zone partway through a flight? Do we handle the 23- and 25-hour days around a DST change?

**6. "Who is allowed to change it, and through which channels?"**
- Can agency users with campaign-edit rights raise a budget, or only the account owner?
- Do increases above a threshold need approval?
- Do the UI, the API and bulk CSV upload all follow the same rules?
- Is every change recorded with who made it, when, the old value and the new value?

When an advertiser disputes an invoice, that audit trail is the evidence support will ask for.

**7. "What happens with concurrent edits?"**
Say the agency's API integration sets €500 at 10:00:01 and a brand manager sets €50 in the UI at 10:00:02. Is it last write wins, or does the later request get rejected because the value changed underneath it? If last write wins, the brand manager may believe their cap is in place when it isn't, or the other way round.

**8. "Which limit wins when several apply?"**
A daily budget sits next to the campaign's lifetime budget, the insertion-order cap, and the account's prepaid balance or credit limit. If an advertiser raises the daily budget past their remaining prepaid balance, which limit applies, and what message do they see?

**9. "Where does the advertiser see the consequences?"**
- Does the pacing chart show the change?
- Does the daily report show the budget that applied, or only today's value? A report that applies today's budget to last week makes old days look overspent.
- Does the invoice line match the rule from question 2?

**10. "What problem are we solving?"**
Is it support tickets like "I paused/lowered and still got charged"? Or advertisers who want to push spend into a flash sale? The answer changes which half of the story matters. If tickets are the driver, decreases need to be fast and visible. If flash sales are the driver, increases do. It also gives us an outcome to check after release, such as fewer budget-related tickets, rather than just "the field saves."

### What I'd say in the room

> "Before we vote: I think there are two or three decisions hiding in 'any time' and 'immediately,' and depending on how they go this is either a two or an eight. Can we spend fifteen minutes mapping it? If we hit questions nobody here can answer, we park them and either slice or bring it back next refinement."

If the PO pushes back with "just do what Google does," that's a perfectly good answer. My reply is:

> "Great, that's a decision. Let's write it down with numbers, including that an advertiser can spend up to 2× on a given day. Do sales and support describe our budget that way today? And can billing handle it?"

That way I'm not blocking anything. I'm making sure the consequences of the choice are visible before we commit to it.

### Running it as example mapping

I'd use Matt Wynne's example mapping, timeboxed to about 25 minutes:

- **Blue cards:** rules
- **Green cards:** concrete examples under each rule
- **Red cards:** questions nobody in the room can answer, recorded instead of debated

Wynne's own reading of the result is the readiness signal I'd use. Lots of red cards means the story isn't understood yet. Lots of blue cards means it's too big and should be sliced.

**A slice worth offering:** "Budget changes take effect from 00:00 tomorrow in the advertiser's time zone." That one decision removes questions 2, 3 and 4. It's simple to explain and to test, and it may solve the actual problem. The PO decides whether intraday changes are worth the extra cost now or later.

### The artifact: a decision table with numbers

These are **proposed examples for the PO to confirm, not verified system behaviour.** The "?" cells are open decisions, and each has an owner.

| # | Budget at 00:00 | Spent before change | Change (time) | Expected max spend today | Expected UI / report / invoice | Status |
|---|---|---|---|---|---|---|
| 1 | €200 | €40 | → €300 (11:00) | €300 (hard cap) *or* ? (overdelivery rule) | Pacing chart shows step at 11:00 | **PO to decide** cap model |
| 2 | €200 | €150 | → €100 (14:00) | €150; no further delivery after propagation window | "You've already spent €150 today; ads paused until tomorrow." Invoice: €150 or €100? | **PO + finance** |
| 3 | €200 | €60 | → €400 (10:00), → €80 (15:00) | ? (highest / latest / weighted) | Report shows both changes in budget history | **PO** |
| 4 | €200 | — | UI sets €50, API sets €500, 1 s apart | Second write rejected (409) and user told to reload, *or* last write wins + both logged | Audit log shows both actors | **Dev lead** to propose |
| 5 | €200, prepaid balance €120 | €0 | → €500 | €120 | Warning at save time | **PO** |
| 6 | — | — | Change at 23:59:30 advertiser time | Applies to which day? | — | **Dev** to confirm with time zone source |

Next to the table I'd note who owns each "?" and the propagation tolerance once someone names it. When the story comes back, the confirmed rows become automated checks at the API or service level. The unconfirmed areas (latency under load, concurrent edits, reporting history) become exploratory charters, for example: *"Explore budget decreases during peak auction traffic to discover how much spend leaks past the new cap and how the advertiser learns about it."*

### Common weak answers

- **"I'd write test cases once the dev is done."** By then the rule has been decided by whoever wrote the code.
- **"I'd ask every edge case I can think of."** Forty questions in refinement wear the team out and bury the three that matter. Rank them by how much they change cost and risk.
- **"QA should block the estimate until the story is complete."** QA doesn't own readiness. The team decides, and the PO owns scope. Offer a slice and a list of open questions, not a veto.
- **"Budget is just a number with min/max validation."** That treats a time-based, money-handling, distributed rule like a form field.
- **Treating another platform's rule as ours.** Google's documented behaviour is a useful reference point, not our requirement, until our PO adopts it.

---

### Follow-up questions

1. **The PO answers "hard cap, effective within one second." Developers say the ad servers only refresh budgets every 30 seconds. Nobody wants to own the gap. How do you frame the tradeoff (overspend risk, infrastructure cost, what we promise advertisers) so the PO can decide, without you deciding it for them?**
2. **Three sprints after release, support tickets about budgets haven't dropped. What evidence would you gather to tell apart "the feature doesn't work," "advertisers don't understand it," and "we solved the wrong problem," and who would you take each finding to?**

---

## Sources

- **Google Ads Help, ["About average daily budgets"](https://support.google.com/google-ads/answer/10487143?hl=en-GB)**: Official documentation of one real platform's mid-day budget rule: the daily limit is based on the highest budget set that day, up to 2× that per day, and the monthly cap is the amount spent plus the new budget times the remaining days. Used only to show that "daily budget" needs a chosen definition, not as our platform's behaviour.
- **Google Ads Help, ["Changes to Google Ads budget pacing for Ad Scheduling"](https://support.google.com/google-ads/answer/16913225)**: Confirms the same monthly-limit formula for a related pacing case. It shows how much behaviour a single budget field can carry.
- **Matt Wynne, Cucumber blog, ["Introducing Example Mapping"](https://cucumber.io/blog/bdd/example-mapping-introduction/)**: The source of the story/rule/example/question card structure, the roughly 25-minute timebox, and reading many red or blue cards as a sign that a story isn't understood or should be sliced.
- **Michael Bolton, DevelopSense, ["Missing Requirements"](https://developsense.com/blog/2024/05/missing-requirements)**: Supports the framing that requirements always exist, may be tacit or emergent, and that people and shared work products are sources of them. That's why the one-line story is treated as hiding requirements rather than lacking them.
- **Michael Bolton, DevelopSense, ["Very Short Blog Posts (31): Ambiguous or Incomplete Requirements"](https://developsense.com/blog/2016/12/very-short-blog-posts-31-ambiguous-or-incomplete-requirements)**: All requirements are partly ambiguous and incomplete, and testing helps refine them. This justifies questioning the story before code exists.
- **James Bach, Satisfice, ["Heuristic Test Strategy Model" (v6.3)](https://www.satisfice.com/download/heuristic-test-strategy-model)**: Its product-factor guidewords (especially Time, Data and Interfaces) are the quick check used to find the questions about time zones, propagation, budget history and API vs. UI parity.
