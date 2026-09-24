# QA Thinking — Day 14

## Ad-Tech Event Integrity: An Auction Win Is Not an Impression, and a 200 OK Is Not a Conversion

Imagine your company runs an advertising platform.

At the end of the day, the dashboard says:

    Auction wins          1,000,000
    Impressions             820,000
    Clicks                    9,300
    Conversions                 410
    Advertising spend       €24,600

Someone from Product asks:

> “Why did we win one million ads but show only 820,000 impressions? Are we losing 180,000 events?”

That question sounds reasonable.

But a tester who understands the domain should not immediately look for a missing-event bug.

An **auction win**, an **ad being rendered**, a **billable impression**, a **click**, and a **conversion** are different business events. They may occur in different systems, at different times, and some of them may legitimately never happen.

The OpenRTB specification explicitly warns that winning an auction does not mean that the ad was delivered, viewable, or billable. It even says that a win-notice event should not be used to count impressions because downstream auctions, playback failures, and other conditions can prevent a winning ad from becoming an actual impression. [IAB Tech Lab](https://iabtechlab.com/wp-content/uploads/2022/05/OpenRTB-2.6.pdf)

That gives us today's central lesson:

> **When testing event-driven business systems, don't verify that “an event happened.” Understand what each event means, what caused it, what business consequence it creates, and how the system prevents events from being lost, duplicated, misordered, or misinterpreted.**

Ad tech is an excellent domain for learning this because tiny data-integrity problems can turn directly into incorrect billing, campaign optimization, reporting, or customer trust.

------------------------------------------------------------------------

## First, understand the business flow

A simplified programmatic advertising flow might look like this:

    User opens page
          ↓
    Publisher has ad space
          ↓
    Ad request
          ↓
    Exchange / SSP
          ↓
    Bid requests sent to DSPs
          ↓
    Advertisers bid
          ↓
    Auction winner selected
          ↓
    WIN
          ↓
    Ad creative delivered
          ↓
    Ad rendered
          ↓
    IMPRESSION / BILLABLE EVENT
          ↓
    User clicks
          ↓
    CLICK
          ↓
    User buys/signs up
          ↓
    CONVERSION

Several businesses may participate.

The **publisher** owns the app or website containing the advertising space.

A **DSP**—demand-side platform—typically represents advertisers buying advertising inventory.

An exchange or SSP sits on the supply side and helps sell opportunities to show ads.

The important QA lesson is not memorizing those names. It is understanding that money and reporting can depend on different points in the chain.

For example:

    WIN

can mean:

> “Our bid won the auction.”

Whereas:

    IMPRESSION

can mean:

> “The ad actually reached the point that qualifies as an impression.”

And:

    BILLING EVENT

means something even stronger:

> “According to our business policy, this event now causes money to be booked.”

OpenRTB describes the billing notice as a financial event: the DSP can use it to increment spend and reduce the campaign's remaining budget. The specification recommends firing that billing notice close to the moment revenue is actually booked. [IAB Tech Lab](https://iabtechlab.com/wp-content/uploads/2022/05/OpenRTB-2.6.pdf)

So one of the first things I would ask when joining an ad-tech project is:

> **Which event does our company consider billable?**

That question sounds simple.

It may expose major differences between teams.

------------------------------------------------------------------------

## “Impression” itself may be more complicated than you think

Suppose an app downloads an advertisement.

Is that an impression?

Not necessarily.

Imagine:

    Ad markup downloaded
            ↓
    User closes app
            ↓
    Ad never displayed

If your tracking logic counts:

    markup downloaded = impression

you may bill for something the user never had an opportunity to see.

The OpenRTB implementation guidance specifically discusses this risk in mobile applications: ad markup may be fetched in advance for buffering, yet never displayed. It also notes that client-side tracking mechanisms are prone to discrepancies because network timing and connectivity can result in one party receiving a tracking signal while another does not. [IAB Tech Lab+1](https://iabtechlab.com/wp-content/uploads/2022/05/OpenRTB-2.6.pdf)

This gives you an excellent testing experiment.

Don't test only:

    Ad loads
    → tracking request appears

Try:

    Request ad
          ↓
    creative downloaded
          ↓
    close screen BEFORE rendering

Then investigate:

    Did we count impression?
    Did we bill advertiser?
    Did publisher revenue increase?
    Did campaign budget decrease?

A UI tester may never notice this.

A domain-aware quality engineer will.

------------------------------------------------------------------------

# Event names are not the oracle; business meaning is

Suppose your Kafka topic receives:

    {
      "type": "IMPRESSION",
      "campaignId": "C-501",
      "price": 0.004
    }

Your automated test checks:

    expect(event.type).toBe("IMPRESSION");
    expect(event.campaignId).toBeDefined();

Green.

But what made the system produce the event?

Perhaps the implementation emits `IMPRESSION` when:

    auction won

instead of when:

    ad displayed

The event's structure is perfectly valid.

Its **meaning is wrong**.

This is one reason James Bach's new September 22, 2026 article on responsible quality engineering is useful. He describes quality engineering as alignment between what people intend, what is specified, what is delivered, and what the receiver actually experiences. Testing helps assess that alignment. [Satisfice](https://www.satisfice.com/blog/archives/488069)

Ad measurement gives us a very concrete example:

    Specification:
    "Count displayed ads"

    Implementation:
    "Emit impression after auction win"

    Dashboard:
    "820,000 impressions"

    Advertiser experience:
    "Some ads were never rendered"

Every system may be technically functioning.

Yet the measurement is not representing the business reality it claims to represent.

That's a quality problem.

------------------------------------------------------------------------

# Duplicate events are not merely “data problems”

Imagine an exchange decides that an impression is billable and sends:

    POST /billing-notice

    eventId=IMP-78192
    price=0.01

Your server processes it.

Then the exchange loses the HTTP response.

From its perspective:

    Did the billing endpoint receive the event?

    UNKNOWN

So it retries.

    POST /billing-notice

    eventId=IMP-78192
    price=0.01

If your system performs:

    receive event
    → add €0.01 spend

each time, the advertiser is charged twice.

The OpenRTB specification explicitly recognizes this. Because billing notifications travel across an unreliable public network, it recommends retries when appropriate and recommends that the receiving endpoint be **idempotent to avoid double counting**. [IAB Tech Lab+1](https://iabtechlab.com/wp-content/uploads/2022/05/OpenRTB-2.6.pdf)

We've already encountered idempotency in our payment-testing lesson.

Now notice something important.

The same reasoning pattern transfers to a completely different industry.

    Payment:
    duplicate retry
    → duplicate charge

    Ad tech:
    duplicate retry
    → duplicate impression/spend

    Marketplace:
    duplicate refund event
    → duplicate financial adjustment

A strong tester accumulates these reusable mental models.

You stop memorizing “payment test cases” and “ad-tech test cases.”

You start recognizing:

> **This is a distributed side-effect problem.**

------------------------------------------------------------------------

# Event identity is therefore critical

Suppose you receive:

    IMPRESSION
    IMPRESSION

Are those duplicates?

You cannot know without identity.

Good event flows often contain correlation information such as:

    request_id
    auction_id
    bid_id
    impression_id
    click_id
    campaign_id
    order_id

Different platforms use different identifiers.

What matters is that you can answer:

> “Does this event represent a new business occurrence or another delivery of the same occurrence?”

This distinction is essential.

Imagine:

    Same advertisement shown twice

You may legitimately need:

    2 impressions

But:

    same impression message delivered twice

should probably remain:

    1 impression

Those situations look almost identical if your data doesn't preserve event identity.

------------------------------------------------------------------------

# Now follow the pipeline into conversion tracking

Suppose your advertiser is an online shop.

A user clicks an advertisement.

    Ad click
       ↓
    Store
       ↓
    Purchase
       ↓
    ORDER-9281

The store reports:

    Conversion:
    ORDER-9281
    Value: €120

A network timeout occurs.

The tracking service sends it again.

    Conversion:
    ORDER-9281
    Value: €120

Without deduplication, your dashboard may claim:

    Conversions: 2
    Revenue: €240

while the merchant has:

    Orders: 1
    Revenue: €120

Google Ads strongly recommends sending a unique transaction/order ID for purchases because duplicate conversions with the same transaction ID can then be recognized and not counted again. Its API documentation likewise recommends `order_id`, and duplicate order IDs can produce explicit duplicate errors. [Google Hilfe+1](https://support.google.com/google-ads/answer/6386790?hl=en&utm_source=chatgpt.com)

This gives you another business invariant:

    one merchant order
    should not become
    multiple purchase conversions
    for the same conversion action

Now test it.

Not merely:

    Send conversion
    → 200

but:

    Send ORDER-9281
    Send ORDER-9281 again
    Send ORDER-9281 again

Then inspect:

    API response
    internal tracking database
    advertising report
    revenue calculation
    optimization input

One duplicated event can affect far more than a dashboard.

------------------------------------------------------------------------

# A successful upload does not prove the conversion exists in reporting

This is a particularly useful integration-testing lesson.

Suppose your conversion uploader receives:

    HTTP 200

The test says:

    PASS

Google's current conversion troubleshooting documentation explicitly warns that a successful API import response does **not necessarily mean the conversion was ultimately attributed**. Processing and attribution happen beyond the initial API acknowledgement. [Google for Developers](https://developers.google.com/google-ads/api/docs/conversions/troubleshooting?utm_source=chatgpt.com)

We saw almost exactly the same pattern with payments:

    API accepted request
    ≠
    business transaction completed

Here:

    API accepted conversion
    ≠
    conversion successfully attributed/reported

So when testing asynchronous pipelines, learn to distinguish:

    ACCEPTED
    PROCESSED
    VALIDATED
    ATTRIBUTED
    REPORTED

Those states may be separated by seconds, minutes, or hours.

Testing only the first one produces false confidence.

------------------------------------------------------------------------

# Batch processing creates another trap: partial failure

Imagine your system uploads 100 conversions:

    Conversion 1
    Conversion 2
    ...
    Conversion 100

The API accepts 99.

One has an invalid click identifier.

What should your importer do?

Bad implementation:

    API call returned
    → mark batch SUCCESS

Conversion 57 is silently lost.

Another bad implementation:

    one failed
    → retry all 100

Now you risk 99 duplicates unless deduplication is perfect.

Google Ads conversion upload flows explicitly support partial failure, meaning individual operations within a batch can fail while others succeed. Clients are expected to inspect individual results/errors. [Google for Developers+1](https://developers.google.com/google-ads/api/docs/conversions/legacy_oci_guide?utm_source=chatgpt.com)

That's a fantastic testing scenario.

Create:

    99 valid events
    1 deliberately invalid event

Then ask:

    Were the 99 successful ones committed?

    Was the failed event identified?

    Can it be retried independently?

    Will the successful 99 be sent again?

    Can operations see which one failed?

This is much stronger than:

    batch upload test = successful batch

because production failures rarely arrive in neat all-or-nothing packages.

------------------------------------------------------------------------

# Event-driven architecture changes what “order” means

Ministry of Testing's current event-driven architecture guidance highlights several testing concerns that come with asynchronous systems: timing, ordering, retries, and events that appear late or out of sequence. [MoTaverse](https://www.ministryoftesting.com/software-testing-glossary/event-driven-architecture-eda?utm_source=chatgpt.com)

Consider this conversion pipeline:

    CLICK
       ↓
    PURCHASE

Looks obvious.

Now network timing produces:

    12:00:00 purchase processed

    12:00:02 conversion event published

    12:00:04 click event processing delayed

    12:00:05 conversion consumer sees purchase

    12:00:09 click finally appears

Your processing system may observe:

    CONVERSION
    then
    CLICK

even though real-world time was:

    CLICK
    then
    CONVERSION

What should happen?

A brittle implementation might say:

    No click exists
    → conversion invalid
    → discard forever

A more resilient architecture might:

    hold unmatched conversion
    retry attribution later

Which behavior is correct?

That is not a Kafka question.

It is a business requirement.

And it deserves explicit testing.

------------------------------------------------------------------------

# The five event mutations I use constantly

When I test an event-driven workflow, I keep one small heuristic nearby:

- **Missing** — expected event never arrives.

- **Duplicate** — the same logical event arrives more than once.

- **Late** — event arrives much later than expected.

- **Reordered** — events arrive in a different sequence.

- **Corrected** — something believed earlier must later be revised.

You can apply this almost everywhere.

For ad tech:

    Missing impression
    Duplicate billing notice
    Late conversion
    Conversion before click processing
    Conversion value later adjusted/refunded

For sports:

    Missing goal
    Duplicate goal
    Late goal
    Events reordered
    Goal overturned by VAR

For payments:

    Missing webhook
    Duplicate capture event
    Late settlement
    Refund before local capture event
    Capture later fails

This is why I like heuristics more than giant predefined checklists.

A useful heuristic keeps generating relevant experiments across domains.

------------------------------------------------------------------------

# Ad-tech discrepancies are normal; unexplained discrepancies are the problem

Imagine two companies are counting the same advertising activity.

Publisher says:

    Impressions: 1,000,000

DSP says:

    Impressions: 975,000

The immediate tester reaction might be:

> “We lost 25,000 events.”

Maybe.

But client-side measurement is inherently exposed to timing, connectivity, blocked requests, caching, browser behavior, and different measurement definitions. OpenRTB specifically notes that different tracking approaches can produce discrepancies and recommends business partners explicitly agree on what constitutes the billable event and the technical mechanism used to count it. [IAB Tech Lab+1](https://iabtechlab.com/wp-content/uploads/2022/05/OpenRTB-2.6.pdf)

The important QA question becomes:

> **Is this discrepancy expected, explainable, bounded, and monitored?**

Suppose historical difference is:

    0.5–1.0%

Today it suddenly becomes:

    12%

That's much more actionable.

Instead of asserting:

> “Numbers must match exactly,”

you may need an operational oracle such as:

    Partner discrepancy normally < 1.5%

    Today = 12%

    Investigate.

Testing data products often requires understanding **relationships and tolerances**, not only exact values.

------------------------------------------------------------------------

# Observability must let you reconcile the event chain

Imagine the advertiser contacts support:

> “You charged us for impression 883927, but we never saw it.”

Can your system reconstruct what happened?

Ideally, an engineer could trace something like:

    ad_request_id    = R-712
    auction_id       = A-991
    bid_id           = B-422
    impression_id    = I-883927
    campaign_id      = C-55
    billing_event_id = BILL-821
    timestamp        = ...

Then follow:

    request
    → auction
    → win
    → render signal
    → billable event
    → billing notice
    → spend ledger

If every service creates unrelated identifiers, investigating a discrepancy may require guesswork.

That is a **testability problem**.

Your test strategy should therefore include the question:

> “Can I trace one business transaction across the entire system?”

Not just in test environments.

In production too.

Because many event-pipeline defects only become obvious when real traffic produces unusual combinations.

------------------------------------------------------------------------

# Aggregate monitoring is not enough

Suppose your dashboards say:

    billing endpoint availability: 99.99%
    Kafka consumer healthy
    CPU 40%
    memory 55%

Excellent.

Meanwhile:

    billable impressions       1,000,000
    billing ledger entries     1,080,000

Your infrastructure is extremely healthy while your advertiser is being overcharged.

This is why domain-level observability matters.

For an ad-tech system, I would want to understand relationships such as:

    wins vs impressions
    impressions vs billing events
    billing events vs spend entries
    clicks vs conversions
    merchant purchases vs purchase conversions
    duplicate-event rate
    unmatched-conversion rate
    event-processing delay

You don't necessarily alert when two numbers differ.

You alert when the relationship stops making sense.

That's a much more powerful model of production quality.

------------------------------------------------------------------------

# Testing the dashboard alone is dangerously weak

Suppose your reporting UI displays:

    Conversions = 410

You check the database:

    SELECT COUNT(*)
    → 410

Test passes.

But perhaps the same conversion has been stored twice and two legitimate conversions are missing:

    Real:
    A
    B
    C
    D

    Stored:
    A
    A
    B
    C

Count:

    4

looks correct.

Data:

    wrong

This is an important testing principle:

> **Aggregates can hide individual data corruption.**

When possible, reconcile at the **identity level**, not only the count level.

Instead of only:

    orders = conversions = 410

sample or compare:

    ORDER-1001 → CONVERSION-1001
    ORDER-1002 → CONVERSION-1002
    ...

Now you're testing data integrity, not just totals.

------------------------------------------------------------------------

# Attribution introduces business rules that testers must understand

Suppose a customer:

    Monday:
    clicks Ad A

    Wednesday:
    clicks Ad B

    Friday:
    buys €100 product

Which advertisement gets the conversion?

That depends on the attribution model.

Maybe Ad B gets all the credit.

Maybe both get partial credit.

Maybe the conversion falls outside the configured lookback window and receives no advertising attribution.

That means:

    Merchant purchases = 100

    Ad-platform conversions = 83

does not automatically indicate missing data.

Google's conversion-management documentation explicitly frames conversions as user actions attributed after advertising interactions, and the platform has business rules around click identifiers, timestamps, attribution, consent, and lookback behavior. [Google for Developers+1](https://developers.google.com/google-ads/api/docs/conversions/overview?utm_source=chatgpt.com)

So before testing conversion counts, ask:

> **What is the attribution rule?**

Otherwise you don't have a meaningful oracle.

------------------------------------------------------------------------

# Refunds make conversion data mutable

Suppose:

    Day 1
    ORDER-9001
    Revenue = €100

    Conversion sent:
    €100

Three days later:

    Customer returns half the order.

    Actual retained revenue = €50

Should the advertising platform still optimize as though this customer generated €100?

Perhaps not.

Google Ads supports conversion adjustments so previously recorded conversion values can later be restated or retracted. It recommends identifying those conversions with a durable order ID. [Google for Developers](https://developers.google.com/google-ads/api/docs/conversions/upload-adjustments?utm_source=chatgpt.com)

Now the test is no longer:

    Did we send conversion?

It becomes:

    Did original conversion arrive?

    Did refund trigger adjustment?

    Did adjustment reference correct order?

    Did revenue become €50?

    Could the adjustment arrive twice?

    What if adjustment arrives before original processing finishes?

Domain knowledge keeps generating stronger tests.

------------------------------------------------------------------------

# Soft skill: when marketing says “tracking is broken”

Imagine Marketing sends you:

> “Google Ads shows 410 purchases but our database has 460. Tracking is broken. Can QA fix this urgently?”

Don't respond:

> “It's probably attribution.”

And don't respond:

> “Yes, bug.”

Start with evidence.

A useful response might be:

> “I can confirm the two totals differ by 50. Before treating those as missing tracking events, I want to compare the same purchase window and attribution rules, then reconcile order IDs where possible. I’ll also check duplicate/rejected conversion uploads and processing delays. That should tell us whether we're looking at event loss, attribution differences, or reporting scope.”

That communication does several things.

It acknowledges the concern.

It separates **observation** from **explanation**.

It proposes an investigation.

It avoids blaming Marketing, Google, or Engineering before you know what happened.

This is how QA influences without authority.

------------------------------------------------------------------------

# Ask better questions when metrics disagree

Suppose Product says:

> “Conversion is down 20% since Tuesday's release.”

A weaker tester immediately starts replaying checkout tests.

A stronger tester asks questions such as:

    Did actual orders also fall 20%?

    Is conversion measured by event time or processing time?

    Did attribution configuration change?

    Did traffic source mix change?

    Are purchase events arriving late?

    Did deduplication rate change?

    Are we comparing the same timezone/window?

    Was consent behavior changed?

    Did one campaign or country create most of the decline?

You don't need to ask all of those aloud.

Use them to structure the investigation.

Perhaps:

    Orders unchanged
    Conversions -20%

That directs you toward measurement.

But:

    Orders -20%
    Conversions -20%

could mean the tracking system is perfectly accurate and the product/business itself changed.

Testing means distinguishing hypotheses, not merely reproducing symptoms.

------------------------------------------------------------------------

# A practical ad-tech event test strategy

For an important measurement pipeline, I would build the model around the entire business chain rather than individual endpoints:

    REAL-WORLD OCCURRENCE

    Did the user/ad/business action actually happen?

            ↓

    EVENT GENERATION

    Was the correct event produced at the correct trigger?

            ↓

    IDENTITY

    Can duplicates of the same business event be recognized?

            ↓

    TRANSPORT

    What happens when events are lost, delayed, retried or reordered?

            ↓

    PROCESSING

    Were validation, enrichment and attribution correct?

            ↓

    FINANCIAL EFFECT

    Did billing/spend/revenue change exactly once?

            ↓

    REPORTING

    Did dashboards represent the resulting business state correctly?

            ↓

    RECONCILIATION

    Can we prove how a reported number relates back to real events?

Then use automation where it gives leverage.

Schema checks are useful.

Contract tests are useful.

Event-consumer tests are useful.

Synthetic end-to-end tracking events are useful.

Production reconciliation is useful.

But none replaces understanding the business meaning of the event.

------------------------------------------------------------------------

# Today's challenge

You are testing an ad platform.

One advertisement produces this timeline:

    10:00:00
    Auction won
    auctionId = A100

    10:00:01
    Creative downloaded

    10:00:02
    Impression rendered
    impressionId = I500

    10:00:02
    Billing notification sent
    eventId = B900

    10:00:03
    Billing endpoint processes B900
    Advertiser spend += €0.01

    10:00:04
    Network timeout prevents sender receiving response

    10:00:14
    Billing notification B900 retried

    10:00:15
    Advertiser spend += €0.01 again

    10:05:00
    User clicks advertisement

    10:10:00
    User purchases ORDER-700 for €80

    10:10:05
    Conversion ORDER-700 uploaded successfully

    10:10:07
    Uploader crashes before saving local success state

    10:11:00
    ORDER-700 uploaded again

The final dashboards show:

    Auction wins        1
    Impressions         1
    Billing events      2
    Spend             €0.02

    Clicks              1

    Conversions         2
    Revenue           €160

The real-world business state was:

    one impression
    one billable impression
    one purchase worth €80

Your challenge is to design only **three experiments**.

Choose the three that give you the most confidence against this class of financial/data-integrity failure.

For each experiment, answer four questions:

    What business invariant am I protecting?

    Where should I inject the failure?

    What evidence proves the result is correct?

    What telemetry would detect this problem in production?

For example, you might inject:

    lost HTTP response after billing processing

and verify:

    same billing event retried
    → only one ledger entry

But don't stop with duplicate events.

Consider whether one of your three experiments should investigate:

    partial conversion-upload failure

or:

    late/out-of-order attribution

or:

    conversion adjustment after refund

The point is not maximizing scenario count.

The point is selecting experiments that protect the most important **business invariants**.

And today's deepest lesson is this:

> **In event-driven systems, reliability does not mean that every message arrives exactly once and perfectly on time. Reliable systems are designed so that missing, repeated, delayed, and reordered messages do not silently corrupt the business.**

An inexperienced tester sees:

    POST /billing
    200 OK

and thinks:

> “Billing works.”

A stronger tester asks:

> “What if the sender never receives that 200?”

A quality engineer asks one step further:

> **“How do we prove that one real-world business event produces exactly the financial and reporting effect we intend—even when the distributed system behaves imperfectly?”**

That question applies to ad tech.

It also applies to payments, sports data, marketplaces, SaaS integrations, analytics pipelines, and almost every event-driven system you will test.

### Recommended reading

James Bach's **Responsible Quality Engineering**, published on September 22, 2026, is worth reading because it frames testing as assessing alignment between intended value, specification, delivered system, and actual experience—an especially useful model when a metric claims to represent something that happened in the real world. The OpenRTB 2.6 specification's section on billable events is unusually valuable QA reading because it shows how much business meaning hides behind superficially simple events like “win” and “impression.” Ministry of Testing's event-driven architecture guidance is a useful reminder to explicitly investigate timing, ordering and retry behavior. Google's current conversion-management documentation gives concrete examples of deduplication, transaction IDs, partial failures, delayed attribution, and conversion adjustment in a production advertising ecosystem. [Google for Developers+3Satisfice+3IAB Tech Lab+3](https://www.satisfice.com/blog/archives/488069)

[James Bach — Responsible Quality Engineering](https://www.satisfice.com/blog/archives/488069?utm_source=chatgpt.com)

[IAB Tech Lab — OpenRTB 2.6 specification](https://iabtechlab.com/wp-content/uploads/2022/05/OpenRTB-2.6.pdf?utm_source=chatgpt.com)

[IAB Tech Lab — Open Measurement SDK](https://iabtechlab.com/standards/open-measurement-sdk/?utm_source=chatgpt.com)

[Ministry of Testing — Event-Driven Architecture](https://www.ministryoftesting.com/software-testing-glossary/event-driven-architecture-eda?utm_source=chatgpt.com)

[Google Ads API — Conversion management](https://developers.google.com/google-ads/api/docs/conversions/overview?utm_source=chatgpt.com)

[Google Ads — Use a transaction ID to minimize duplicate conversions](https://support.google.com/google-ads/answer/6386790?utm_source=chatgpt.com)

[Google Ads API — Troubleshooting conversion imports](https://developers.google.com/google-ads/api/docs/conversions/troubleshooting?utm_source=chatgpt.com)
