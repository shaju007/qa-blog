# QA Interview Q&A — Day 23

## Question: "The synthetic dataset is 99% statistically faithful to production. We're deleting the masked copy." Do you agree?

**Scenario:** You're the QA lead at a German energy supplier that has about 1.2 million household and small-business accounts. The QA environment currently runs on a masked subset of production: billing accounts, contracts, meter points, readings and payment history. The data-protection officer is uneasy about it, and refreshing it takes three weeks. The data platform team has trained a synthetic data generator on production and shows a dashboard: "99.1% statistical fidelity: distributions, correlations and cardinalities all match." Their proposal is to replace the masked subset with synthetic data from next quarter and delete the masked copy for good.

In the planning meeting, the engineering manager asks: "QA, can we sign off on this?"

## Answer

### The short version

I'd support the direction and object to the deletion date. Synthetic data is probably the right default for most of our testing. But "99% statistically faithful" answers a different question from the one testing asks. Fidelity metrics describe the **population**. Testing mostly needs **specific, awkward individuals**: the account with three meter swaps in one billing period, or the contract migrated from a 2012 acquisition with a null start date. A dashboard can score 99% while every one of those individuals is missing. That isn't a flaw in the generator. Removing rare individuals is part of how a privacy-preserving generator works.

So my answer is "yes, if we can show it covers the risks we care about." Until then it's "not yet." I'd also propose a cheap way to find out within a few weeks.

### How I'd reason about it

**1. What does "99% fidelity" measure?**
Usually it means marginal distributions (age of account, consumption bands, tariff mix), pairwise correlations and table sizes all match production. That's real and useful. A dataset can match all of that and still have no record where:

- a meter reading was corrected *after* the bill was issued, triggering a rebill
- a move-out and move-in at the same meter location overlap by one day
- a customer has an SEPA mandate, a payment plan and a dunning hold at the same time
- an address imported from the old system has `?` where an umlaut should be
- a contract violates a rule the current system enforces but the 2012 system didn't

Those are combinations, sequences and histories, not distributions. In the Heuristic Test Strategy Model, they fall under **Data** and **Time**: what the product does things to, and how it behaves over time. The data-related bugs I've seen in billing systems mostly live there.

**2. Privacy-preserving generators deliberately smooth out outliers.**
I'd raise this point gently because it isn't a criticism of the platform team. The UK ICO's guidance on synthetic data names the tradeoff directly. The closer synthetic data mimics real data, the more useful it is, but also the more likely it is to reveal personal information. One recommended protection is suppressing outliers, meaning records with uniquely identifying features. So the property that makes the dataset safe to hand around is the same one that removes the weird records. Testers should expect the long tail to be thinner, and should check, not hope, whether the cases we need survived.

**3. Generators learn the data as the current schema describes it.**
If the generator enforces today's constraints (foreign keys, enums, non-null columns), it can't produce records that break those constraints. Production can still contain them, from migrations, manual database fixes and old bugs. Those records are where support tickets come from. A synthetic dataset that's cleaner than production gives you false confidence: tests go green because the data is better behaved than reality.

**4. Do the relationships hold across systems?**
Our billing data doesn't live in one database. CRM, meter data management, billing and payments each hold part of a customer. If the generator synthesizes each system separately, the joins between them may be statistically plausible but logically impossible. For example, a meter location whose readings start before its contract does. Or the joins may be so tidy that the reconciliation jobs never meet a mismatch.

**5. "Synthetic" doesn't automatically mean "anonymous."**
The ICO guidance also says synthetic data can still be vulnerable to membership inference, model inversion and attribute disclosure. Whether this dataset counts as personal data is a decision for the DPO, not for QA. I'd mention it only so nobody assumes the privacy question is closed and starts copying the dataset to laptops and vendor sandboxes.

### Evidence I'd ask for before the masked copy is deleted

These are cheap and specific, and they turn opinions into data:

1. **Incident replay.** Take the last 18 months of production incidents where data was the trigger. In a billing system that's probably 20 to 30. For each one, ask: does the synthetic dataset contain a record that would trigger it? Does the masked subset? If the masked subset covers 22 of 25 and the synthetic set covers 9, that's the most persuasive single number we can bring back.
2. **Counting known anomalies.** Ask someone with authorized production access to run aggregate-only queries for known anomaly patterns: records violating current constraints, overlapping contracts, corrected readings, umlaut encoding errors, orphan payments. Counts only, no rows. Run the same queries on the synthetic set. Non-zero in production and zero in synthetic marks a gap we know about.
3. **Run both in parallel for one release.** Run the regression suite and a few data-focused exploratory sessions against both datasets for one release. Compare which problems each one surfaced.
4. **The generator's settings.** Ask whether outlier suppression or differential privacy is on, at what strength, and whether constraints are enforced. This isn't a gotcha. It tells us which of the gaps above to expect.

### What I'd actually recommend

Layer the test data instead of making a yes/no choice:

- **Synthetic data as the default layer.** Use it for CI, preview environments, demos, volume and performance work, and most automated regression. It's available on demand, nobody worries about sharing it, and it removes the three-week refresh. That fits DORA's guidance that test data should be available on demand, isolated per test, and created through the application's APIs wherever possible.
- **A small, deliberately built library of hard cases.** Every record traces back to an incident or a named risk, such as `INC-4471: rebill after corrected reading`. It's built by hand or from rules, owned by QA and the domain team, and reviewed when the domain changes. This layer replaces "realism" with intent.
- **A governed route for investigating production-only issues.** For example, read-only diagnostics by authorized engineers, or a narrowly scoped extract approved by the DPO. QA doesn't decide which. QA does need *some* route to exist before the only realistic dataset is deleted.

### What I'd say in the meeting

> "I think synthetic data should become our default, and I'd like to help make it work. I'm not comfortable signing off on deleting the masked copy yet. The fidelity number tells us the overall population looks right. Our worst bugs come from rare and historically messy records, and outlier suppression is designed to remove exactly those. I'm not saying the synthetic set is bad. I'm saying we don't yet know what it's missing.
>
> Here's a proposal: give me two weeks. We'll replay our last 18 months of data-driven incidents against both datasets and count known anomaly patterns in each. If the synthetic set covers them, or we can fill the gaps with a small curated set, I'll support the deletion date. If it doesn't, we'll have a concrete list of what to fix first. The DPO decides what happens to the masked data. I just want that decision made with this evidence in front of us."

This avoids claiming a veto I don't have, offers a time-boxed alternative, and makes the decision easy to revisit later.

### Weak answers interviewers hear

- **"Synthetic data isn't real, so it can't be trusted."** This is a reflex, not an analysis. It also ignores that the masked copy has its own problems: it's stale, slow to refresh and carries privacy risk.
- **"99% fidelity sounds great, approved."** This treats a statistical summary as test coverage.
- **"QA needs production data, full stop."** This claims an authority over data protection that QA doesn't have, and it loses the room.
- **"We'll add edge cases by hand."** That's correct, but meaningless unless you can say *which* edge cases and how you know they matter. The incident replay answers that.
- **Treating it as a tool question.** The real question is what test data is meant to reveal. Which generator to use is secondary.

### Follow-up questions

1. *Six months later, the hard-case library has 300 records and nobody trusts half of them. How do you keep it from going stale, and who owns it?*
2. *The performance team wants a synthetic dataset ten times production size for load testing next winter's peak. What changes about how you'd judge whether that data is "realistic enough"?*

## Sources

- [Heuristic Test Strategy Model, James Bach / Satisfice](https://www.satisfice.com/download/heuristic-test-strategy-model): its product elements (Structure, Function, **Data**, Interfaces, Platform, **Operations**, **Time**) frame why distribution-level fidelity misses the histories, sequences and combinations that billing bugs depend on. DevelopSense also hosts the model: [developsense.com/htsm](https://developsense.com/htsm).
- [ICO: Synthetic data (privacy-enhancing technologies guidance)](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-sharing/privacy-enhancing-technologies/what-pets-are-there/synthetic-data/): primary regulator guidance on the utility-versus-privacy tradeoff, suppressing outliers, and residual risks such as membership inference and attribute disclosure. I used it here as a technical explanation. For a German company, the data-protection decision belongs to the DPO under the EU GDPR.
- [DORA: Test data management](https://dora.dev/capabilities/test-data-management/): supports the "default layer" recommendation (test data available on demand, isolated per test, created through APIs) and warns against copying whole production databases and relying on stale data.
