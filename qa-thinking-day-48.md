# QA Thinking — Day 48

## Adtech Testing Across API, Events, and UI: Reconcile One Campaign Before Trusting the Dashboard

An advertiser sees 1,200 impressions and €3.00 spend. The auction service reports 1,500 wins. Support says the numbers disagree. Engineering says every endpoint is green. How do you decide whether there is a defect?

Start by asking what each number counts. A **DSP** buys ad opportunities for advertisers; an **SSP** helps publishers sell inventory; an exchange connects trading participants. A winning bid, a rendered ad, a viewable ad, and a billable event describe different things. OpenRTB distinguishes win notifications (`nurl`) from billing notifications (`burl`), with billability depending on exchange policy. [IAB Tech Lab OpenRTB 2.6, Bid object and notices](https://github.com/InteractiveAdvertisingBureau/openrtb2.x/blob/main/2.6.md#423---object-bid)

Earlier lessons covered [event integrity](qa-thinking-day-14.html) and [budget pacing](qa-thinking-day-27.html). Today we build a small reconciliation experiment across the whole product. Every number and policy below belongs to an invented test system.

### 1. Write the counting policy before creating traffic

Our example campaign uses EUR and CPM pricing: cost per thousand billable impressions. For this controlled fixture, every billable impression clears at €2.50 CPM, with no fees or currency conversion. Production clearing prices may vary per event.

The team agrees on these example rules:

- Wins appear only in the auction report.
- The advertiser's “Impressions” metric counts accepted billable impression events.
- Retries of the same billable event count once, keyed by partner and event ID.
- Events retain their event-time UTC day, including when they arrive later.
- The dashboard updates within 60 seconds of ingestion and shows its freshness time.

These agreements make a useful oracle. Without them, testers may reconcile incompatible definitions and file misleading bugs.

### 2. Create a tiny ledger with an answer you can calculate

| Fixture observation | Count | Expected treatment |
| --- | --- | --- |
| Auction wins | 1,500 | Auction report only |
| Distinct, valid billable impression events | 1,200 | Count and charge |
| Retries of 40 of those same billable events | 40 | Preserve ingestion evidence; add no charge |
| Invalid billable events with no required event ID | 10 | Reject or quarantine under the agreed policy |
| Additional valid events arriving after the first snapshot | 20 | Add to their original event-time day |

At the first reporting checkpoint:

```text
billable impressions = 1,200
spend = 1,200 / 1,000 * EUR 2.50 = EUR 3.00
```

After the 20 late events have been processed:

```text
billable impressions = 1,220
spend = 1,220 / 1,000 * EUR 2.50 = EUR 3.05
```

Use a documented monetary representation and rounding policy. With varying prices, sum each event's charge at the agreed precision before applying presentation rounding. Multiplying an average displayed CPM by a displayed count may introduce a different result.

### 3. Follow the same cohort through the system

Give this fixture a unique campaign ID and a correlation/run ID. Record the event IDs and timestamps. Inspect, in order:

1. The input dataset: which unique events did the test send?
2. The ingestion result: which were accepted, rejected, quarantined, or deduplicated?
3. The financial aggregate: which accepted events contributed to spend?
4. The reporting API: which filters, time zone, currency, and watermark produced the response?
5. The UI: does it display that response accurately and explain data freshness?

Use the same campaign, date range, and processing checkpoint at every step. A comparison taken while one service has processed the late events and another has not is inconclusive until the freshness promise expires.

An API response agreeing with the UI establishes presentation consistency. An independently calculated ledger agreeing with both gives stronger evidence about the amount. Querying the same aggregate through two endpoints does not create two independent oracles.

### 4. Put checks at the boundary that can answer the question

| Question | Suitable approach | Limit |
| --- | --- | --- |
| Are duplicate events charged twice? | Service integration test with controlled event delivery | Does not establish every partner's retry behavior |
| Does the reporting endpoint isolate tenants? | Authenticated API tests with two advertisers | Does not establish UI usability |
| Is the delayed-data state understandable? | Browser check plus human exploration | A screenshot alone does not prove accounting |
| What happens if the billing consumer restarts? | Replay experiment with controlled interruption | Requires observability of accepted and committed events |
| Are bidders meeting the auction deadline? | Protocol/load check using the negotiated timing policy | Browser timings cannot answer this |

For timing, OpenRTB's `tmax` includes network latency; test the actual partner contract rather than inventing a universal timeout. [OpenRTB BidRequest](https://github.com/InteractiveAdvertisingBureau/openrtb2.x/blob/main/2.6.md#321---object-bidrequest)

Bolton's advice on selecting automatable work applies directly: choose repeatable observations with useful oracles. Keep exploratory sessions for confusing reconciliation, missing explanations, and novel partner behavior. [Automation guidance](https://developsense.com/blog/2018/06/which-test-cases-should-i-automate)

### 5. Report a discrepancy with the missing decision exposed

Instead of “dashboard spend wrong,” write:

> For test campaign C-47, the accepted-event ledger contains 1,200 distinct billable events at €2.50 CPM. The reporting API returns €3.10 after the 60-second freshness deadline. The extra €0.10 equals 40 retried events. Attached: input IDs, ingestion outcomes, aggregate query, and API response. Risk: advertisers may be charged twice for event retries. Decision needed: confirm the partner/event deduplication key and whether historical totals require correction.

That is a hypothesis with evidence. The matching amount suggests a cause; it does not prove which component introduced it.

### Practical challenge: find the first divergence

Sketch the five checkpoints for the fixture above. Inject each fault separately: charge retries twice, assign late events to ingestion day, and omit the UI freshness timestamp. Predict which checks detect each fault and which stay green. Write one report that identifies the first observed divergence without claiming an unverified root cause.

Next: [take these unanswered policies into refinement](qa-thinking-day-49.html).
