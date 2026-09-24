# QA Thinking — Day 5

## Testing Ad Tech: A “Win” Is Not an Impression, and a `200 OK` Can Still Lose Money

Imagine you are testing a programmatic advertising platform.

Your bidder receives an auction request, evaluates it, submits a bid, and later receives a notification saying:

    Auction won
    Campaign: 741
    Creative: 92
    Bid price: €4.20 CPM

Your API returned `200`. The logs contain no exceptions. Grafana is green.

Would you say the ad transaction worked?

Not yet.

In ad tech, this distinction matters enormously:

    Bid
       ↓
    Win
       ↓
    Ad delivered
       ↓
    Impression
       ↓
    Billable impression
       ↓
    Click
       ↓
    Conversion

Those are **different business events**.

A platform can process every HTTP request successfully and still charge an advertiser incorrectly, spend a campaign budget too quickly, fail to pay a publisher, count an impression twice, or report conversions against the wrong campaign.

That makes ad tech an excellent domain for learning a broader QA skill:

> **Don't test only whether individual services work. Test whether the business event lifecycle remains internally consistent.**

The OpenRTB specification makes this distinction explicit. A win notice tells a bidder that it won an auction; it does **not** necessarily mean that the ad was delivered, viewed, or became billable. OpenRTB has a separate billing notice specifically for the point at which spend should actually be applied. [GitHub+1](https://github.com/InteractiveAdvertisingBureau/openrtb2.x/blob/main/2.6.md?utm_source=chatgpt.com)

That one domain rule can completely change your test strategy.

------------------------------------------------------------------------

## First understand what is actually being bought

A simplified programmatic advertising flow looks roughly like:

    User opens website
           ↓
    Publisher has an available ad slot
           ↓
    SSP / Exchange creates bid request
           ↓
    DSPs evaluate opportunity
           ↓
    Several advertisers bid
           ↓
    Auction selects winner
           ↓
    Winning creative may be delivered
           ↓
    Ad may actually become an impression
           ↓
    Billing / reporting / attribution follow

Some useful terminology:

**Publisher** owns the website/app inventory.

**SSP — Supply-Side Platform** helps publishers sell that inventory.

**DSP — Demand-Side Platform** buys inventory on behalf of advertisers.

**Bid request** describes the advertising opportunity.

**Bid response** says how much a bidder is willing to pay and usually references the impression opportunity.

**Win** means that bid won an auction.

**Impression** generally means the advertising content reached the defined impression condition.

**Billable event** is the event under the platform's commercial policy that actually causes spend to be recorded.

OpenRTB itself describes RTB as an auction in which an individual ad impression is offered for bidding in real time. [IAB Tech Lab](https://iabtechlab.com/standards/openrtb/)

Notice what happened already: we had to understand the business before discussing Cypress, Playwright, Postman, Kafka, or automated assertions.

That is why **domain knowledge is part of testing skill**.

------------------------------------------------------------------------

# The dangerous test: “We received the win callback, so everything is good”

Suppose your DSP submits:

    {
      "impid": "imp-8271",
      "price": 4.20,
      "nurl": "https://dsp.example/win/8271",
      "burl": "https://dsp.example/billing/8271"
    }

In OpenRTB, the bid `price` is expressed as **CPM**, even though the actual transaction represents an individual impression. `nurl` can be used for the win notice; `burl` can be called when the win becomes billable according to the exchange's policy. [GitHub](https://github.com/InteractiveAdvertisingBureau/openrtb2.x/blob/main/2.6.md?utm_source=chatgpt.com)

Now imagine your automated integration test does this:

    submit bid
    → receive nurl
    → assert campaign spend increased
    → PASS

That test may actually be validating the wrong business behaviour.

OpenRTB specifically warns that winning does not guarantee delivery. Its implementation guidance says a win notice should **not** be used to count impressions because a won auction can still fail to become an actual impression. [GitHub](https://github.com/InteractiveAdvertisingBureau/openrtb2.x/blob/main/implementation.md?utm_source=chatgpt.com)

Your automation is green.

Your business rule is wrong.

This is why I repeatedly tell you:

> **Automation does not compensate for a wrong model of the product.**

You can automate a misunderstanding perfectly.

------------------------------------------------------------------------

# Think in state transitions

James Bach's current Heuristic Test Strategy Model explicitly emphasizes state-based testing and boundaries. The model is intended as a collection of heuristics for thinking about test strategy rather than a prescribed list of cases. [Satisfice](https://www.satisfice.com/download/heuristic-test-strategy-model?utm_source=chatgpt.com)

Ad tech is a perfect place to use that thinking.

Instead of thinking:

    POST /bid → expect 200

model an advertising opportunity as state:

    AVAILABLE
       ↓
    BID_REQUESTED
       ↓
    BID_SUBMITTED
       ↓
    WON
       ↓
    DELIVERED
       ↓
    IMPRESSION_RECORDED
       ↓
    BILLABLE

But the happy path isn't enough.

Maybe:

    BID_SUBMITTED
       ↓
    LOST

or:

    WON
       ↓
    CREATIVE_FAILED
       ↓
    NOT_BILLABLE

or:

    WON
       ↓
    PAGE CLOSED
       ↓
    NO IMPRESSION

Now interesting testing questions emerge naturally.

What transitions are legal?

Which transitions are irreversible?

Can `BILLABLE` happen without `WON`?

Can a transaction become billable twice?

What happens if `BILLABLE` arrives before your internal `IMPRESSION_RECORDED` event because two pipelines have different latency?

What happens when a duplicate notification arrives?

Those questions are much more valuable than:

> “Does `/billing` return 200?”

------------------------------------------------------------------------

# The five event failures you learned from sports testing appear again

Yesterday's sports-data lesson used:

    Missing
    Duplicate
    Late
    Reordered
    Corrected

The same model applies beautifully to ad tech.

Imagine a billing event.

**Missing:** advertiser won and impression occurred, but billing event never arrives.

**Duplicate:** billing callback is processed twice.

**Late:** billing arrives twenty minutes after reporting already aggregated the campaign.

**Reordered:** billing arrives before another internal event that your system expects first.

**Corrected/reconciled:** partner later sends an adjustment because initial accounting was wrong.

Now you can see something important about learning domains.

You aren't learning isolated tricks.

You're building **testing models that transfer between industries**.

Sports:

    Goal event

Ad tech:

    Impression event

Payments:

    Payment captured

E-commerce:

    Order created

All can suffer from missing, duplicate, late and reordered events.

That's the beginning of systems thinking.

------------------------------------------------------------------------

# The most dangerous bug may not produce an error

Suppose this happens:

    Bid requests received: healthy
    Bid responses: healthy
    HTTP errors: zero
    CPU: normal
    Queue: normal
    Database: normal

Everything appears operational.

But there is a logic error causing:

    Win
    → counted as impression
    → campaign budget deducted

even when the ad never rendered.

Your technical monitoring may remain perfectly green.

Your advertiser can still be overcharged.

Ministry of Testing recently made exactly the broader quality-engineering point that monitoring, observability and alerting belong inside quality work rather than being something considered only after CI/CD. The article argues that teams should engineer systems so that quality problems become visible in production. [Ministry of Testing](https://www.ministryoftesting.com/insights/the-forgotten-part-of-quality-paying-attention-to-production?utm_source=chatgpt.com)

For an ad platform, I would therefore want to see a business funnel such as:

    Bid Requests
          ↓
    Bids
          ↓
    Wins
          ↓
    Delivered Ads
          ↓
    Impressions
          ↓
    Billable Impressions
          ↓
    Clicks
          ↓
    Conversions

Not because every percentage must remain fixed.

Traffic changes.

Campaigns change.

Inventory changes.

But unexpected movement between stages can reveal business failures that an uptime dashboard cannot.

------------------------------------------------------------------------

# Reconciliation is a QA superpower in transaction systems

Imagine your system says:

    10,000 billable impressions

while your exchange partner says:

    9,420 billable impressions

The weakest reaction is:

> “Our tests passed.”

A much stronger testing question is:

> **Where does the count begin to diverge?**

Compare:

    Requests
    Bids
    Wins
    Impressions
    Billable impressions

Maybe both platforms agree on:

    Requests ✓
    Bids ✓
    Wins ✓

but disagree at:

    Impressions ✗

You've just dramatically reduced the investigation space.

Maybe both agree on impressions but disagree on:

    Billable impressions ✗

Now investigate billing policy and billing-event processing rather than auction logic.

This type of reconciliation thinking is valuable far beyond ad tech.

In payments:

    orders
    vs
    payment authorizations
    vs
    captures
    vs
    refunds

In e-commerce:

    checkout success
    vs
    orders
    vs
    payment transactions
    vs
    invoices

In sports:

    provider events
    vs
    processed events
    vs
    displayed events

A strong QA engineer looks for **invariants across systems**.

------------------------------------------------------------------------

# An invariant is often more useful than a test case

Consider this possible invariant:

> Every billable impression must be traceable to one advertising opportunity and the corresponding transaction context.

That suggests tests around identifiers.

OpenRTB's `Bid` object includes identifiers such as the bidder-generated bid ID and `impid`, which ties the bid to a specific impression object in the original request. [GitHub](https://github.com/InteractiveAdvertisingBureau/openrtb2.x/blob/main/2.6.md?utm_source=chatgpt.com)

Now imagine:

    Request:
    impid = A782

    Response:
    impid = B991

Your JSON is perfectly valid.

HTTP is `200`.

But semantically the bid may no longer refer to the opportunity that was offered.

That is a **contract/business-integrity test**, not merely schema validation.

You should learn to distinguish:

    Syntax validation:
    "Is this JSON structurally legal?"

    Semantic validation:
    "Does this JSON make sense for this transaction?"

Senior-level API testing increasingly lives in the second category.

------------------------------------------------------------------------

# Be careful with strict contract tests

Here's another realistic integration risk.

OpenRTB 2.6's repository states that the specification can receive non-breaking improvements roughly monthly, including new fields, objects, and enumeration values; breaking changes would cause a version change. [GitHub](https://github.com/InteractiveAdvertisingBureau/openrtb2.x?utm_source=chatgpt.com)

Imagine your test says:

    expect(Object.keys(bidRequest)).toEqual([
      "id",
      "imp",
      "site",
      "device"
    ]);

Your partner legally introduces:

    {
      "newOptionalField": "..."
    }

Your application parser rejects the payload.

Your contract test also fails.

Did the partner break the contract?

Potentially not.

**You may have implemented the contract too strictly.**

A better integration strategy usually distinguishes between:

    unknown optional field

and:

    missing required field

Those are different risks.

This is another example where “more strict” does not automatically mean “better quality.”

Context decides.

------------------------------------------------------------------------

# Now add the ad-tech supply chain

Programmatic advertising can contain several intermediaries between a publisher and advertiser.

That creates questions such as:

> Who actually has permission to sell this inventory?

Industry mechanisms such as **ads.txt**, **sellers.json**, and OpenRTB's **SupplyChain object** exist partly to make these relationships more transparent. IAB Tech Lab says ads.txt lets publishers publicly declare authorized sellers, while sellers.json and the SupplyChain object help buyers identify entities participating in selling or reselling a bid request. [IAB Tech Lab+1](https://iabtechlab.com/ads-txt/?utm_source=chatgpt.com)

This gives a tester another useful lesson:

**Valid files do not automatically mean valid relationships.**

Imagine:

    publisher ads.txt
         ↓
    Seller X = authorized

but:

    Seller X sellers.json
         ↓
    publisher account relationship inconsistent

Each file might parse correctly.

Together they contradict each other.

Interestingly, IAB Tech Lab's own supply-chain validation product explicitly checks not only technical conformance but also inconsistencies between ads.txt and sellers.json. [IAB Tech Lab](https://iabtechlab.com/software/supply-chain-validation/?utm_source=chatgpt.com)

That is essentially an industry example of a testing principle:

> **Many important bugs live between individually valid components.**

This is why integration testing matters.

------------------------------------------------------------------------

# Soft skill: don't say “the tracking is broken”

Now imagine Ad Operations reports:

> “Campaign 912 spent too much yesterday.”

Developer says:

> “Our billing endpoint is fine.”

Data team says:

> “The dashboard query is fine.”

Partner says:

> “Our reports are correct.”

This is where QA communication becomes extremely important.

Saying:

> “Tracking is broken.”

helps almost nobody.

Instead, structure the conversation around evidence.

For example:

> For Campaign 912, our win count and the exchange's count remain close, but our billable-impression count begins diverging after 14:20. I sampled five transactions in the divergent window and found that two billing event IDs appear twice in our ledger. I haven't yet confirmed whether the duplicate originates from the partner or our retry handling. I think the next useful step is tracing those event IDs through ingestion and ledger processing.

Look carefully at that communication.

You didn't accuse the exchange.

You didn't accuse the developer.

You didn't pretend you knew the root cause.

You stated:

    what is known
    where divergence begins
    what evidence exists
    what remains unknown
    what investigation would reduce uncertainty

That's excellent QA communication.

The objective isn't winning an argument.

The objective is moving the investigation forward.

------------------------------------------------------------------------

# Ad-tech testing requires business questions, not just technical questions

Suppose a campaign has:

    Daily budget
    Target audience
    Country targeting
    Frequency cap
    Bid strategy
    Start/end time
    Creative restrictions

Now imagine a tester writes excellent API tests for:

    POST /campaign
    GET /campaign
    PUT /campaign
    DELETE /campaign

The endpoints all work.

But important questions remain.

What happens when the campaign reaches its daily budget while thousands of auctions are already concurrently being processed?

What happens around midnight when the budget resets?

Whose timezone defines midnight?

What happens if a user's frequency-cap event arrives late?

Can two bidder instances simultaneously believe there is sufficient campaign budget?

Does changing targeting affect already-issued bid requests?

What happens to reporting when a campaign is paused while events are still arriving?

Those questions come from understanding:

**campaign lifecycle + concurrency + distributed state + money.**

Not from knowing HTTP verbs.

------------------------------------------------------------------------

# A useful ad-tech test strategy model

When you encounter an ad-tech feature, I suggest thinking through this chain:

    Business rule
          ↓
    Business event
          ↓
    Identity
          ↓
    State transition
          ↓
    Money consequence
          ↓
    Reporting consequence
          ↓
    Failure/recovery behavior

Take:

> “Advertiser is charged for billable impressions.”

Ask:

**Business event:** what precisely makes an impression billable?

**Identity:** what uniquely identifies it?

**State:** what must happen before billing?

**Money:** how is cost calculated?

**Reporting:** when does reporting reflect it?

**Failure:** what if the notification fails?

**Retry:** can it arrive again?

**Reconciliation:** how do we detect disagreement with the partner?

That one model could generate dozens of valuable experiments.

More importantly, it generates them for a reason.

------------------------------------------------------------------------

# Today's exercise

You're testing a DSP.

You see this production-like test run:

    100,000 bid requests
    12,000 bids
    2,800 wins
    2,100 recorded impressions
    2,350 billable events

Don't immediately assume there is a bug.

The interesting observation is:

    billable events > recorded impressions

Your task is to produce **three plausible hypotheses** before looking at the code.

For example, perhaps your definition of “recorded impression” differs from the exchange's billable event policy. Perhaps duplicate billing events are being processed. Perhaps your own impression-tracking pipeline is losing events.

Then decide what evidence would distinguish those hypotheses.

Look at:

    transaction IDs
    timestamps
    partner logs
    retry attempts
    duplicate identifiers
    campaign IDs
    event ordering
    billing policy

The exercise is not:

> “Find the bug.”

The skill is:

> **Turn a suspicious business signal into competing explanations, then design tests that eliminate explanations one by one.**

That is scientific thinking.

And excellent testing is much closer to investigation than to checking boxes.

The deeper lesson today is therefore not just about advertising.

It is this:

> **Whenever software represents a real business process, learn the meaning of the events before testing the APIs that transport them.**

A `200 OK` tells you that a technical interaction succeeded.

It does **not** tell you that the business transaction was correct.

That distinction is one of the biggest steps from API automation toward quality engineering. [GitHub+1](https://github.com/InteractiveAdvertisingBureau/openrtb2.x/blob/main/2.6.md?utm_source=chatgpt.com)

For deeper reading:

[IAB Tech Lab — OpenRTB specification and resources](https://iabtechlab.com/standards/openrtb/?utm_source=chatgpt.com)

[OpenRTB 2.6 — transaction and notification semantics](https://github.com/InteractiveAdvertisingBureau/openrtb2.x/blob/main/2.6.md?utm_source=chatgpt.com)

[James Bach — Heuristic Test Strategy Model](https://www.satisfice.com/download/heuristic-test-strategy-model?utm_source=chatgpt.com)

[Ministry of Testing — Paying attention to production and observability](https://www.ministryoftesting.com/insights/the-forgotten-part-of-quality-paying-attention-to-production?utm_source=chatgpt.com)

[IAB Tech Lab — ads.txt and authorized sellers](https://iabtechlab.com/ads-txt/?utm_source=chatgpt.com)
