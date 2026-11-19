# QA Thinking — Day 59

## A Revenue Increase Can Still Be a Bad Product Change: Design the Experiment Before Celebrating

A hypothetical advertising platform changes its offer discovery screen. Revenue per eligible user rises by 10%. Product wants to roll it out. Finance sees higher variable costs. Advertisers report weaker acquired-user value. QA discovers that a retry event was counted twice in the experiment dashboard.

The question is no longer simply whether revenue rose. The team needs to know whether the measurement is trustworthy and whether the change creates sustainable value.

### 1. State the mechanism you believe will help

Write a falsifiable hypothesis:

> Clearer offer requirements will help eligible users choose suitable offers, increasing valid participation and platform revenue per eligible user without worsening advertiser outcomes, reward errors, or support burden.

This is an invented hypothesis, not a claim about an existing product. Check whether unclear requirements are a real problem before building the experiment.

Define the chain of expected observations: improved comprehension, suitable selection, valid completion, and a measurable commercial outcome. A change in the final number without the expected intermediate evidence deserves investigation.

### 2. Define the metric before assignment

Agree the accounting definition of platform revenue with the business owner. Separate advertiser spend, publisher earnings, player rewards, platform revenue, and contribution margin. Their relationship depends on contracts and accounting treatment.

For this example, define a seven-day revenue measure over a fixed cohort of eligible users. Keep assigned users in the analysis according to the agreed experimental design, including those who never engage. Conditioning only on people who clicked can select different populations after treatment.

| Measure | Purpose |
| --- | --- |
| Revenue per eligible user | Primary commercial outcome |
| Offer comprehension and valid participation | Check the proposed mechanism |
| Contribution per eligible user | Detect costs that offset the revenue gain |
| Advertiser cohort outcomes | Protect acquisition value over an appropriate window |
| Reward correctness, retention, fraud, and support contacts | Guardrails for harms or hidden costs |

If using ROAS for advertiser outcomes, define attributed revenue, spend, and the maturity window. ROAS compares revenue with advertising spend; it is not the platform's revenue measure. [AppsFlyer: ROAS](https://www.appsflyer.com/glossary/roas/)

### 3. Check the experiment as a system

Before interpreting results, verify assignment, persistent variant identity, eligibility, exposure events, and metric pipelines. Watch for missing events, retries, inconsistent currency conversion, and different data freshness between groups.

Decide whether randomization belongs at user, publisher, campaign, or another level with the experiment owner. Shared budgets or resources can create interference between groups. Choose a design appropriate to the product instead of assuming user-level assignment always works.

Set sample-size, duration, uncertainty reporting, and decision rules with an analyst before examining the outcome. A large percentage difference from a small or incomplete sample can be misleading.

### 4. Calculate the business tradeoff explicitly

Consider these fictional completed cohorts, each with 10,000 eligible users:

| Quantity | Control | Variant |
| --- | --- | --- |
| Platform revenue | €500 | €550 |
| Agreed included variable costs | €300 | €370 |
| Contribution under this definition | €200 | €180 |
| Revenue per eligible user | €0.050 | €0.055 |
| Contribution per eligible user | €0.020 | €0.018 |

Revenue increased 10%; contribution decreased 10%. These arithmetic results describe the example, not statistical certainty. The team may have reasons to accept a short-term cost, but that tradeoff should be explicit.

Business viability belongs beside user value, usability, and feasibility in product discovery. [SVPG: The Four Big Risks](https://www.svpg.com/four-big-risks/)

### 5. Give QA and product different, connected responsibilities

QA can investigate assignment correctness, metric integrity, adverse paths, and whether guardrail events are observable. Product can bring the customer problem, strategic tradeoffs, and decision criteria together with engineering, finance, and analytics.

Automated arithmetic checks support the decision; they do not decide whether the business tradeoff is acceptable. This applies Bolton's guidance on selecting useful automated observations within broader testing. [Automation guidance](https://developsense.com/blog/2018/06/which-test-cases-should-i-automate)

### Practical challenge

Using the table, write one metric-integrity check and a rollout recommendation of fewer than 120 words. Explain the revenue/contribution tradeoff, one unresolved advertiser-outcome question, and the evidence needed before deciding. Then describe how duplicated completion events could create an apparent win without any real improvement.
