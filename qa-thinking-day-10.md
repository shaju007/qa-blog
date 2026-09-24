# QA Thinking — Day 10

## Performance Testing: Stop Asking “How Many Users Can It Handle?”

Imagine your e-commerce platform is preparing for a major promotion at 19:00.

Someone asks:

> “Can we test the website with 500 users?”

That sounds reasonable.

So you create a k6 test:

    export const options = {
      vus: 500,
      duration: '10m',
    };

It runs.

You get:

    Average response time: 620 ms
    Error rate: 0.4%

The team concludes:

> “Great. We support 500 users.”

But what did you actually learn?

Very little.

Were those 500 people searching? Browsing products? Refreshing the homepage? Adding items to carts? Checking out? Waiting 30 seconds between actions? Making requests continuously?

And is **500 concurrent users** even the business condition you expect?

A stronger performance tester does not begin with:

> “How many VUs should I run?”

The better starting question is:

> **What demand will the real business create, and what failures matter when that demand increases?**

James Bach's Heuristic Test Strategy Model is useful here because it treats test strategy as a reasoning problem involving product factors, quality criteria, project context and test techniques—not as selecting a tool and filling in a load number. [Satisfice+1](https://www.satisfice.com/download/heuristic-test-strategy-model?utm_source=chatgpt.com)

Today we'll build a realistic performance-testing model for an e-commerce system and, more importantly, learn how to reason about performance as a **quality engineer**, not merely a k6 script writer.

------------------------------------------------------------------------

## “500 users” is not a workload model

Imagine your analytics tell you that during a promotion you expect approximately:

    Product browsing       300 actions/sec
    Search                  80 actions/sec
    Add to cart             45 actions/sec
    Checkout start          15 actions/sec
    Order placement          6 actions/sec

That's useful.

Now compare that with:

    500 VUs

The second tells us almost nothing about what pressure the system experiences.

Two systems with 500 active users can generate completely different traffic.

Imagine one user behaves like:

    Open product
    wait 20 sec
    read description
    wait 30 sec
    add to cart

Another automated VU does:

    GET product
    GET product
    GET product
    GET product
    GET product

continuously.

Both count as:

    1 user

but their generated load is radically different.

This is why **traffic rate, concurrency and user count are related but not interchangeable concepts**.

------------------------------------------------------------------------

## A subtle trap: your load test can slow down when your system slows down

Suppose you write:

    export default function () {
        search();
        productDetails();
        addToCart();
        checkout();

        sleep(2);
    }

and run:

    100 VUs

Initially, one complete iteration takes five seconds.

So your test might produce roughly:

    20 journeys/sec

Then your application slows down.

The same journey now takes ten seconds.

Your 100 VUs may now produce only:

    10 journeys/sec

Notice the problem.

Your application became slower...

and your test reduced the pressure placed on it.

That can hide exactly the overload behavior you're trying to investigate.

For workloads where real demand arrives independently of system speed, k6 provides arrival-rate executors. With `constant-arrival-rate`, k6 tries to start a specified number of iterations per time unit, independent of how slowly previous iterations complete, adding VUs as needed up to the configured maximum. Grafana specifically describes this as useful when you want to represent request or iteration rates more accurately. [Grafana Labs](https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/constant-arrival-rate/?utm_source=chatgpt.com)

For example:

    export const options = {
      scenarios: {
        checkout: {
          executor: 'constant-arrival-rate',
          rate: 15,
          timeUnit: '1s',
          duration: '10m',
          preAllocatedVUs: 50,
          maxVUs: 200,
        },
      },
    };

Now the question is closer to:

> “What happens if approximately 15 checkout journeys begin every second for ten minutes?”

That is a much clearer performance experiment.

------------------------------------------------------------------------

# Closed workload vs open workload

This distinction is worth understanding properly.

With a VU-oriented model, users tend to behave like a **closed system**:

    user finishes action
            ↓
    user begins another action

If the system becomes slower, users naturally perform fewer actions.

With an arrival-rate model, you're closer to an **open system**:

    new demand arrives
    new demand arrives
    new demand arrives

whether the previous demand has finished or not.

Neither model is universally correct.

Consider a back-office SaaS application with 50 employees.

Maybe:

    50 concurrent VUs

is meaningful because you genuinely have approximately 50 people interacting with the product.

Now consider a flash sale where thousands of independent users arrive from an advertising campaign.

Demand does not politely wait because your database is slow.

An arrival-rate workload may better model that risk.

This is why performance-test design should begin with the **traffic model**, not the load-testing syntax.

------------------------------------------------------------------------

# Don't simulate every user identically

Suppose your online store has this approximate usage distribution:

    60% browsing
    20% searching
    12% cart activity
     6% checkout
     2% account management

Running every VU through:

    search
    product
    cart
    checkout
    logout

creates a neat script.

It may create a poor model of production.

Instead, think about workload composition.

You might create separate scenarios:

    export const options = {
      scenarios: {
        browsing: {
          executor: 'constant-arrival-rate',
          rate: 300,
          timeUnit: '1s',
          exec: 'browse',
          duration: '15m',
          preAllocatedVUs: 100,
        },

        search: {
          executor: 'constant-arrival-rate',
          rate: 80,
          timeUnit: '1s',
          exec: 'search',
          duration: '15m',
          preAllocatedVUs: 50,
        },

        checkout: {
          executor: 'constant-arrival-rate',
          rate: 15,
          timeUnit: '1s',
          exec: 'checkout',
          duration: '15m',
          preAllocatedVUs: 30,
        },
      },
    };

Those scenarios run concurrently.

Now your system experiences something closer to:

    Browsing + Search + Cart + Checkout

rather than:

    100 identical robots

This matters because the operations compete for shared resources:

    database
    connection pool
    CPU
    cache
    message queue
    payment service
    inventory service

Performance problems often emerge from those **interactions**.

------------------------------------------------------------------------

# Average latency can hide the customer you care about

Suppose the report says:

    Average checkout latency = 400 ms

Excellent?

Maybe.

Now look at the distribution:

    p50 = 220 ms
    p90 = 600 ms
    p95 = 1.2 s
    p99 = 8.7 s

The average has hidden a nasty tail.

Google's SRE guidance recommends looking at latency distributions and percentiles because averages can conceal tail behavior. A high percentile such as p99 or p99.9 helps expose the experiences of slower requests that a simple mean can mask. [Google SRE](https://sre.google/sre-book/service-level-objectives/?utm_source=chatgpt.com)

Grafana k6 likewise exposes percentile metrics such as p90, p95 and p99 and supports using them directly in performance thresholds. [Grafana Labs+1](https://grafana.com/docs/k6/latest/using-k6/thresholds/?utm_source=chatgpt.com)

So instead of:

    Average < 500 ms

you might have a meaningful criterion like:

    thresholds: {
      'http_req_duration{name:checkout}': [
        'p(95)<1000',
        'p(99)<2500'
      ]
    }

But even that is not enough.

You still need to ask:

> **Why are those acceptable numbers?**

A threshold should represent some performance expectation, SLO, business requirement or learned baseline—not a number copied from another blog.

------------------------------------------------------------------------

# Fast errors can make your latency dashboard look excellent

Imagine increasing load causes this:

    Successful requests: 2.5 sec
    Failed requests:      30 ms

Now calculate everything together.

The average might actually **improve** as the system fails more frequently.

Google's SRE monitoring guidance specifically warns about this problem and recommends distinguishing successful-request latency from failed-request latency. Its four widely used golden signals are:

    latency
    traffic
    errors
    saturation

because looking at latency alone cannot explain system health. [Google SRE](https://sre.google/sre-book/monitoring-distributed-systems/?utm_source=chatgpt.com)

Your load-test investigation should therefore correlate things like:

    p95 checkout latency
    error rate
    requests/sec
    CPU
    memory
    DB connections
    queue depth
    thread pools
    cache hit rate

A graph that says:

    response time ↑

tells you something happened.

A graph showing:

    checkout p95 ↑
    DB connection utilization → 100%
    payment timeouts ↑

begins telling you **where to investigate**.

------------------------------------------------------------------------

# Performance testing is also functional testing

This is where many load tests become dangerously shallow.

Imagine this k6 check:

    check(response, {
      'status is 200': r => r.status === 200
    });

At 1,000 requests/sec:

    100% HTTP 200

Fantastic.

Except the response contains:

    {
      "price": 0,
      "inventory": -4
    }

The service is extremely fast.

And completely wrong.

A performance test should usually retain enough correctness checks to detect corrupted behavior under load.

Grafana distinguishes **checks**, which verify individual response conditions, from **thresholds**, which define aggregated pass/fail performance criteria. Their current guidance recommends combining the two rather than treating fast responses as sufficient evidence of acceptable behavior. [Grafana Labs+1](https://grafana.com/docs/learning-hub/k6-performance-testing/03-establishing-a-baseline/18-checks-vs-thresholds/?utm_source=chatgpt.com)

This is particularly important because concurrency bugs often appear only under load.

Imagine:

    Inventory available: 1

    Customer A → buy
    Customer B → buy
    Customer C → buy

All requests return:

    200 OK

You may have just sold the same item three times.

From a response-time perspective:

    PERFECT

From an e-commerce perspective:

    DISASTER

------------------------------------------------------------------------

# Build performance invariants

Instead of checking only status codes, add business consistency rules.

For example:

    successful order
    → must have one valid order ID

or:

    accepted inventory reservations
    ≤ available inventory

or:

    successful payment
    → must correspond to exactly one order

Now your load test becomes much more interesting.

You're no longer asking only:

> “How quickly does the system respond?”

You're asking:

> **“Does the system remain correct when many things happen at once?”**

That is closer to quality engineering.

------------------------------------------------------------------------

# E-commerce performance has a dangerous trade-off: caching

Suppose your product page is slow because every request calculates:

    price
    inventory
    promotion
    recommendations
    shipping estimate

Someone proposes aggressive caching.

Performance improves dramatically.

But now consider:

    Cached inventory: 5
    Actual inventory: 0

or:

    Cached price: €59
    Current price: €79

You've improved one quality characteristic while damaging another.

A very recent real-world e-commerce example illustrates this tension. Nuvemshop reported in June 2026 that improvements including rendering optimization and edge caching helped raise the proportion of stores with good LCP substantially; the company also reported improved conversion metrics. But its engineers explicitly called out the need to avoid caching stale **price and inventory data**, because those errors directly affect buyer trust and revenue. [web.dev](https://web.dev/case-studies/nuvemshop?utm_source=chatgpt.com)

That's an excellent QA lesson.

A performance improvement should trigger questions such as:

    What became cached?

    How is it invalidated?

    How stale may it become?

    Which data must never be stale?

    What happens during cache failure?

A tester should not celebrate:

    300 ms → 80 ms

until asking:

> “Are we still serving the correct thing?”

------------------------------------------------------------------------

# Don't only test normal load

Suppose production usually handles:

    200 requests/sec

You verify that.

Good.

Now what happens at:

    300
    500
    800
    1,200

Eventually something must break.

The important question isn't:

> “Can we make it break?”

Of course you can.

The interesting questions are:

> **What breaks first?**

and:

> **How does the system fail?**

Google's SRE guidance on preventing cascading failures explicitly recommends testing capacity limits **and the system's failure mode under overload**, because without realistic load testing it can be difficult to predict what resource will exhaust and how the failure will manifest. [Google SRE](https://sre.google/sre-book/addressing-cascading-failures/?utm_source=chatgpt.com)

Consider two systems.

System A:

    400 req/s → healthy
    500 req/s → slower
    600 req/s → 429 / graceful rejection
    700 req/s → still operating

System B:

    400 req/s → healthy
    500 req/s → slower
    550 req/s → DB exhausted
    560 req/s → every endpoint failing
    570 req/s → restart
    580 req/s → retry storm

Both technically reached their capacity.

System A has a much better failure mode.

That's something worth testing.

------------------------------------------------------------------------

# Search and checkout should not necessarily have the same priority

Imagine excessive traffic arrives.

You may prefer:

    product recommendations → degraded
    search suggestions       → degraded
    checkout                 → protected
    payment                  → protected

because failure of recommendations is inconvenient.

Failure of checkout is lost revenue.

That is a **business-informed performance strategy**.

Rather than asking:

> “Can the whole website support 1,000 RPS?”

ask:

> “When resources become scarce, which workflows must continue working?”

This is also where QA can influence architecture.

Maybe recommendations need:

    timeouts
    fallbacks
    cached results
    load shedding

so that they cannot consume resources required for checkout.

Performance testing can reveal architectural risks before they become incidents.

------------------------------------------------------------------------

# A breakpoint test is not the same as a normal-load test

Grafana's k6 documentation describes several useful workload styles, including increasing load until performance thresholds fail. [Grafana Labs](https://grafana.com/docs/k6/latest/examples/get-started-with-k6/test-for-performance/?utm_source=chatgpt.com)

But keep the missions separate.

A normal-load test asks:

> **Can we meet expectations under expected traffic?**

A stress or breakpoint experiment asks:

> **Where does behavior become unacceptable?**

A spike experiment asks:

> **What happens when traffic increases suddenly?**

An endurance experiment asks:

> **Does behavior degrade over hours?**

Those are different questions.

If you run:

    2,000 users

and the system collapses, that finding is almost meaningless unless you know why you chose 2,000 and what you were trying to learn.

Performance testing needs a mission just like exploratory functional testing does.

------------------------------------------------------------------------

# Your workload should come from evidence

Where possible, use production or analytics data.

For example:

    Peak traffic last month
    Checkout starts/sec
    Searches/sec
    Orders/min
    Regional distribution
    Typical session duration
    Promotion spikes

Then ask the Product Owner, developers, operations team or business:

> “What are we preparing for?”

Perhaps normal peak is:

    100 orders/min

but marketing expects a campaign to generate:

    500 orders/min

Now you have a meaningful experiment.

If you have no production data because the product is new, document your assumptions.

For example:

> “We're modeling 20 checkout starts/sec because the business expects approximately 1,000 active campaign visitors per minute and estimates around 1–2% entering checkout.”

That is much better than pretending your number is authoritative.

Testing under uncertainty is normal.

Hidden assumptions are the real danger.

------------------------------------------------------------------------

# How to communicate performance findings

Weak report:

> “Performance bad with 300 VUs.”

Slightly better:

> “p95 is 2.7 seconds.”

Still not very actionable.

A stronger report might say:

> At our expected campaign load of approximately 15 checkout starts/sec, checkout p95 increased from 480 ms to 2.6 s after eight minutes. Payment-related HTTP errors rose from 0.1% to 3.4%, while catalog browsing remained below 600 ms. During the same period, database connection-pool usage stayed above 95%. I haven't confirmed that the pool is the root cause, but its saturation correlates closely with the checkout degradation. The main business risk is failed or uncertain order/payment creation during campaign peaks.

Notice what happened.

You communicated:

    workload
    observation
    time
    scope
    evidence
    uncertainty
    business consequence

You didn't say:

> “Database caused it.”

unless you've demonstrated that.

Michael Bolton's recent writing continues to emphasize accuracy, relevance and usefulness of technical information—qualities that matter just as much when testers communicate measurements as when evaluating software output. [DevelopSense](https://developsense.com/blog/2026/07/just-the-facts-please?utm_source=chatgpt.com)

The tester's credibility increases when the difference between **observation** and **explanation** remains clear.

------------------------------------------------------------------------

# A performance test strategy I would use for an e-commerce platform

I would first learn actual traffic and identify the commercially important flows.

Then I'd create a baseline with very light traffic so I understand what “healthy” looks like.

After that, I would exercise realistic mixed traffic—for example browsing, searching, carts and checkout simultaneously—rather than isolated endpoint benchmarking.

I'd inspect the four broad signals:

    Latency
    Traffic
    Errors
    Saturation

and correlate them with domain signals such as:

    orders completed
    payments accepted
    inventory inconsistencies
    cart errors
    checkout abandonment

Then I'd deliberately increase pressure until something deteriorates.

Finally, I'd investigate recovery:

    Load removed
          ↓
    Does latency recover?

    Do queues drain?

    Does database pressure fall?

    Do stuck orders remain?

    Are payments left uncertain?

The last part is easily forgotten.

A system that survives overload but remains degraded for 30 minutes afterward has a different risk profile from one that recovers in seconds.

------------------------------------------------------------------------

# Today's challenge

You receive these business expectations for a sale:

    Normal:
    Product views        80/sec
    Search               20/sec
    Add to cart           8/sec
    Checkout              3/sec

    Expected sale peak:
    Product views       500/sec
    Search              120/sec
    Add to cart          60/sec
    Checkout             18/sec

Current SLOs say:

    Product API p95 < 500 ms
    Checkout p95 < 1,000 ms
    Error rate < 1%

During your load test you observe:

    400 product views/sec
    100 searches/sec
    50 add-to-cart/sec
    15 checkout/sec

    Product p95:        430 ms
    Checkout p95:     2,400 ms
    HTTP errors:        0.7%
    CPU:                 55%
    Memory:              62%
    DB connections:      98%

Do **not** simply conclude:

> “Database bottleneck.”

Your challenge is to design only three next experiments:

1.  One experiment that tests whether database-connection saturation is actually related to checkout degradation.

2.  One experiment that checks whether checkout remains **business-correct** under this load, not merely responsive.

3.  One experiment that determines how the system behaves when traffic reaches or exceeds the expected 18 checkouts/sec.

For each experiment, state what evidence would make you change your current hypothesis.

That final sentence matters.

A tester is not supposed to prove their first theory correct.

A tester should design experiments capable of proving it **wrong**.

That is critical thinking.

And that is today's central lesson:

> **Performance testing is not generating lots of traffic. It is modeling realistic demand, observing how quality changes under pressure, finding where unacceptable behavior begins, and explaining the resulting risk with credible evidence.**

Knowing k6 is valuable.

Knowing **why to generate a particular load, what to observe, and what conclusions the evidence actually supports** is the skill that makes you a stronger quality engineer.

### Recommended reading

James Bach's current HTSM is useful for keeping performance inside a broader risk-based test strategy rather than reducing it to tooling. Google's SRE material is excellent for latency distributions, the four golden signals and overload behavior. Grafana's current k6 documentation explains how arrival-rate executors, checks and thresholds translate those ideas into executable experiments. The June 2026 Nuvemshop case study is particularly worth reading because it connects web performance with real e-commerce business metrics while also exposing the correctness risks of performance techniques such as caching. [web.dev+4Satisfice+4Google SRE+4](https://www.satisfice.com/download/heuristic-test-strategy-model?utm_source=chatgpt.com)

[James Bach — Heuristic Test Strategy Model](https://www.satisfice.com/download/heuristic-test-strategy-model?utm_source=chatgpt.com)

[Google SRE — Service Level Objectives and latency percentiles](https://sre.google/sre-book/service-level-objectives/?utm_source=chatgpt.com)

[Google SRE — Monitoring Distributed Systems and the four golden signals](https://sre.google/sre-book/monitoring-distributed-systems/?utm_source=chatgpt.com)

[Google SRE — Addressing Cascading Failures](https://sre.google/sre-book/addressing-cascading-failures/?utm_source=chatgpt.com)

[Grafana k6 — Constant arrival rate](https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/constant-arrival-rate/?utm_source=chatgpt.com)

[Grafana k6 — Thresholds](https://grafana.com/docs/k6/latest/using-k6/thresholds/?utm_source=chatgpt.com)

[Nuvemshop — 2026 e-commerce performance case study](https://web.dev/case-studies/nuvemshop?utm_source=chatgpt.com)
