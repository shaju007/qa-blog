# QA Thinking — Day 32

## Testing the Silence: Can Your Alerts See a Meter Data Pipeline Failing Quietly?

Most of the failures we've looked at so far announce themselves. A webhook returns a 500, a payment goes to "failed", a flaky check goes red. Today's failure is different. Nothing breaks, nothing alerts, and the dashboards stay green while the data underneath them goes stale or wrong.

Smart-meter ingestion is a good place to study this. If you work in energy, metering or billing, you'll recognise it. If you work in ad tech, sports data or marketplaces, the same pattern appears in every pipeline you own.

### The domain in 60 seconds

A utility's meter data management (MDM) system receives interval reads, often every 15 or 30 minutes, from millions of meters. Before billing can use them, a **VEE** step (Validation, Estimation, Editing) runs. Typical rules, as described in [this MDM overview](https://nites.eu/products/mdm/) and in the VEE patent literature, are:

- Flag **missing reads**.
- Flag **roll-over** (the current register read is lower than the previous one).
- Flag **consecutive zero intervals**.
- Run **sum checks** between interval and register data.
- **Estimate** gaps from interpolation, history or a replacement profile.
- Open a field service order after X consecutive days of missing data.

The point that matters for testing is that estimation hides gaps on purpose. An estimated read is a valid input to a bill. That is a business decision, but it also means a broken collector can look like healthy data for days.

### The testing idea: observability is how you ask the system questions you didn't plan for

[Parveen Khan's piece for Thoughtworks](https://www.thoughtworks.com/en-ca/insights/blog/observability/why-observability-matters-testers) argues that observability gives testers richer information during exploration and lets them chase "unknown unknowns". It also says testers should advocate for the telemetry. I'd go one step further. **Treat your alerts and dashboards as a product that needs testing, with its own oracles.**

[David Burns' Ministry of Testing talk summary](https://www.ministryoftesting.com/moments/stop-guessing-start-seeing-the-rise-of-observability-driven-testing) makes a related point. Expected results are often not fixed values, so real production journeys and telemetry can serve as the oracle. I'm applying that idea to the pipeline's own health, not only to features.

There are three practical consequences.

**1. Write the failure, then ask "who would notice, and when?"**

For each failure mode, name the signal that should reveal it and the delay before anyone sees it.

| Failure mode | Obvious signal? | What would actually reveal it |
|---|---|---|
| Collector for one region stops sending | No errors, since nothing arrives to fail | Expected-vs-received count per region per interval |
| Firmware change shifts timestamps by one hour (DST or time zone) | Reads arrive and pass schema checks | Distribution of read timestamps vs. expected slot boundaries |
| Estimation rate climbs from 2% to 18% | Bills still generate | Estimated-read ratio per segment, trended |
| Duplicate reads after a retry storm | Row count looks high, which is "good" | Unique (meter, interval) vs. total rows |
| VEE rule silently disabled by config | Nothing fails | A canary meter with a known roll-over that must be flagged daily |

The last row is the strongest idea here. A **canary input** is a known-bad record you inject regularly, and the pipeline must flag it. If it ever stops being flagged, you've learned the check itself is dead.

**2. Distinguish "the alert exists" from "the alert works"**

Alert tests worth running:

- **Fires?** Induce the condition in a test environment and see if the alert triggers.
- **Fires in time?** Compare detection delay to the business deadline. If billing runs at 02:00 and your alert has a 6-hour aggregation window, it is useless for that purpose.
- **Fires for the right people?** Check the routing. An alert that goes to a channel nobody reads is a decoration.
- **Doesn't fire falsely?** A legitimate outage (storm, planned maintenance) should not page the team hundreds of times. Alert fatigue is a quality defect.
- **Is actionable?** Does the alert say which region, which interval, and what to check first?

**3. Use telemetry to ask better questions in exploratory sessions**

Instead of "does ingestion work?", try questions like these:

- Which meters report late most often, and is that a device model, a network or a region?
- What does the estimated-read ratio look like by day of week? Where are the shape differences?
- When we replayed last Tuesday's traffic, did the dashboard totals match the raw files?

Each answer is evidence you can bring to a developer or product owner. "Region North's estimated reads went from 2% to 18% starting Thursday 03:00, and it coincides with the collector release" is a much stronger bug report than "billing seems off".

### A caution about oracles

Production telemetry is not truth. It's another claim made by the system, with its own bugs. A dashboard can be wrong because a metric counts retries as successes, or because a time zone is mishandled in an aggregation. Before trusting a dashboard as an oracle, cross-check it against an independent source such as raw files, a database count or a manual sample. Otherwise you test a system using its own opinion of itself.

The statistics in vendor articles about observability (for example "2.1× more likely to detect issues") are marketing-grade evidence. I wouldn't use them to argue for a budget. Your own incident timeline will persuade people far better.

### Applying it to other domains

- **Ad tech:** An impression counter that silently drops 5% for one SSP. Canary: synthetic bid requests with known outcomes.
- **Sports data:** A feed provider stops sending substitutions. Expected-vs-received event counts per match phase would catch it.
- **Marketplace payouts:** Payout batches that complete but skip one seller currency. Reconcile batch totals per currency.
- **SaaS metering:** Usage events that arrive late and fall into the wrong billing period. Watch event-time vs. ingest-time lag.

### Challenge (30 minutes)

Choose one data pipeline you work with: meter reads, ad events, a feed, or order events.

1. List five **quiet failures**, meaning cases where data is missing, late, duplicated, shifted or silently altered but nothing errors.
2. For each, fill in a row: *Which signal should reveal this? What's the detection delay? Who gets told? What's the deadline by which it must be noticed?*
3. Pick the two rows with the biggest gap between "must be noticed by" and "would actually be noticed by". Design a **canary input** or a **reconciliation check** for each.
4. Write a three-sentence message to the developer or ops owner asking for the one piece of telemetry you're missing. Frame it around a specific failure and its cost, not "we need more logging".

Bonus: Find one dashboard number your team trusts and verify it independently against raw data. Record any mismatch, however small.

### Takeaways

- A green dashboard shows only what someone chose to measure. Ask what a failure would look like on it.
- Alerts need tests for firing, timing, routing, noise and actionability.
- Canary inputs prove that your detection still works.
- Telemetry is evidence, not truth. Cross-check it.
- When you request observability, tie it to a concrete failure and a deadline.

**Sources**
- Parveen Khan, [Why observability matters for testers](https://www.thoughtworks.com/en-ca/insights/blog/observability/why-observability-matters-testers) (Thoughtworks)
- David Burns, [Stop guessing, start seeing: the rise of Observability-Driven Testing](https://www.ministryoftesting.com/moments/stop-guessing-start-seeing-the-rise-of-observability-driven-testing) (Ministry of Testing)
- [Meter Data Management (MDM) overview](https://nites.eu/products/mdm/), for background on VEE. This is a vendor page, so I used it for terminology only. Check rules against your own utility's specification.
