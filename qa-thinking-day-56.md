# QA Thinking — Day 56

## CPI, eCPM, ROAS, and ARPDAU: Test the Meaning Behind an Advertising Dashboard

A dashboard shows a lower cost per install and a higher eCPM. Someone declares the product healthier. Before agreeing, ask whose money each metric represents, which users it includes, and whether the reporting window has finished collecting data.

This lesson begins a practical series on connecting QA evidence to product decisions: metric correctness today, [reward investigations](qa-thinking-day-57.html), [competitor research](qa-thinking-day-58.html), [revenue experiments](qa-thinking-day-59.html), and [an API/UI testing workflow](qa-thinking-day-60.html). Every dataset below is hypothetical.

### 1. Separate the participants and their money

An advertiser pays to reach or acquire users. A publisher earns from making advertising opportunities available. A player may earn a reward under an offer's rules. The advertising platform has its own revenue and cost definitions.

Those amounts should not be assumed equal. Ask finance or the relevant business owner which amount a report represents, including fees, adjustments, and currency handling.

### 2. Calculate a tiny example independently

For this invented reporting period, assume 10,000 counted impressions, 200 clicks, 40 attributed installs, €80 advertiser spend, €50 publisher earnings, €120 revenue attributed to the advertiser's campaign, and 1,000 daily active users in the publisher's app.

| Metric | Calculation | Meaning here |
| --- | --- | --- |
| CPI: cost per install | €80 / 40 = **€2** | Advertiser spend per attributed install |
| Advertiser effective CPM | €80 / 10,000 × 1,000 = **€8** | Effective advertiser cost per thousand impressions |
| Publisher eCPM | €50 / 10,000 × 1,000 = **€5** | Publisher earnings per thousand impressions |
| CTR: click-through rate | 200 / 10,000 × 100 = **2%** | Share of counted impressions producing clicks |
| Click-to-install conversion | 40 / 200 × 100 = **20%** | Installs relative to clicks under this attribution definition |
| ROAS: return on ad spend | €120 / €80 × 100 = **150%** | Attributed advertiser revenue relative to campaign spend |
| Advertising ARPDAU | €50 / 1,000 = **€0.05** | This revenue stream divided by all daily active app users |

CPI also names a pricing model; a contracted install price and the observed average need not be the same. [AppsFlyer: CPI and effective CPI](https://www.appsflyer.com/glossary/cost-per-install)

Google's publisher eCPM definition uses earnings divided by impressions, multiplied by 1,000. ROAS uses campaign-attributed revenue relative to advertising spend; it does not by itself establish profit. [Google AdMob glossary](https://support.google.com/admob/table/16327896?hl=en), [AppsFlyer ROAS](https://www.appsflyer.com/glossary/roas/)

The €30 difference between advertiser spend and publisher earnings is not automatically platform profit. The dataset does not describe contracts, other participants, accounting treatment, or operating costs.

### 3. Test the denominator and the clock

For each metric, record its numerator, denominator, currency, filters, event definitions, and measurement window. Then ask:

- Do repeated event deliveries count twice?
- Are rejected or fraudulent events excluded consistently?
- Does a late install update the original cohort or today's totals?
- Does ARPDAU include all active users or only users who engaged with advertising?
- Does a zero denominator display an honest unavailable state?
- Are a completed seven-day cohort and a cohort acquired yesterday being compared?

An **attributed install** is an install assigned to a campaign by the agreed measurement rules. A **cohort** is a defined group, such as users acquired on one date. Neither term supplies a universal implementation rule.

### 4. Connect checking to product judgment

Automate the tiny dataset's calculations and filtering. Then investigate whether users interpret the numbers correctly. Bolton's automation guidance helps distinguish useful repeated observations from the wider testing work. [Which Test Cases Should I Automate?](https://developsense.com/blog/2018/06/which-test-cases-should-i-automate)

A lower CPI may accompany users who leave sooner. A higher eCPM may accompany fewer impressions and lower total earnings. Bring related outcomes into the decision before recommending a change.

### Practical challenge

Recalculate the table after ten attributed installs arrive late, with spend unchanged. Identify which metrics change and which do not. Then remove the date filter from only the revenue numerator: explain why a mathematically correct formula can now produce a misleading result. Write a metric definition and one API assertion that would detect the mismatch.
