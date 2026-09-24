# QA Thinking — Day 13

## Contract Testing: A Green Schema Test Can Still Break the Consumer

Imagine an e-commerce platform with two services:

    Cart Service
         ↓
    Pricing Service

The cart asks:

    GET /prices/SKU-42

The pricing service responds:

    {
      "productId": "SKU-42",
      "unitPrice": 49.99,
      "currency": "EUR",
      "availability": "IN_STOCK"
    }

Everything works.

A developer improves the pricing API and deploys this:

    {
      "productId": "SKU-42",
      "price": 49.99,
      "currency": "EUR",
      "availability": "IN_STOCK"
    }

The API itself is healthy:

    HTTP 200 ✓
    JSON valid ✓
    Pricing tests green ✓
    Deployment successful ✓

Checkout immediately starts failing.

Why?

Because the Cart Service still expects:

    unitPrice

not:

    price

Nothing was “wrong” with either service when tested alone.

The problem existed **between them**.

James Bach's 2025 discussion of integration testing gives us a useful framing: integration testing is testing motivated specifically by risks created when parts are combined. Those parts may come from different teams, have different purposes, be built at different times, and depend on each other in ways that are not visible when each component is examined independently. [Satisfice](https://www.satisfice.com/blog/archives/1577?utm_source=chatgpt.com)

Today's central lesson is:

> **An API working correctly is not enough. Its consumers must still be able to use it correctly.**

That sounds simple, but it has important consequences for how you design API tests, contract tests, CI pipelines, and even conversations between teams.

------------------------------------------------------------------------

## First understand what a contract really is

Suppose your Pricing Service exposes this response:

    {
      "productId": "SKU-42",
      "unitPrice": 49.99,
      "currency": "EUR",
      "availability": "IN_STOCK",
      "taxRate": 0.19,
      "warehouse": "HAM-2",
      "lastUpdated": "2026-09-23T06:30:00Z"
    }

The Cart Service may only care about:

    unitPrice
    currency
    availability

Another consumer—the Analytics Service—may care about:

    productId
    warehouse

And a Promotions Service may care about:

    productId
    unitPrice
    currency

So there isn't necessarily one practical contract.

Each consumer depends on a subset of the provider's behavior.

Martin Fowler's microservice-testing guidance describes exactly this idea: different consumers form different contracts based on what each actually requires, and consumer contract tests can make those dependencies explicit. [martinfowler.com+1](https://martinfowler.com/articles/microservice-testing/fallback.html?utm_source=chatgpt.com)

Conceptually:

                    Pricing Service
                    /      |       \
                   /       |        \
               Cart    Promotions   Analytics

    Cart depends on:
    unitPrice
    currency
    availability

    Promotions depends on:
    unitPrice
    currency
    productId

    Analytics depends on:
    productId
    warehouse

Now imagine Pricing removes:

    warehouse

The Cart team does not care.

The Promotions team does not care.

Analytics breaks.

This is why a statement such as:

> “The API change is backward compatible.”

is incomplete unless you ask:

> **Compatible with which consumers?**

------------------------------------------------------------------------

# Contract testing is not the same as “testing the API”

This distinction is important.

Suppose you write API tests for the Pricing Service:

    GET existing product → 200
    GET missing product → 404
    negative price impossible
    currency valid
    database error handled
    promotion calculated correctly

Those tests investigate the Pricing Service itself.

A contract test asks a narrower question:

> **Does the provider still satisfy the assumptions that a particular consumer relies upon?**

Ministry of Testing's API material describes consumer-provider communication as a functional contract involving things such as endpoints, parameters, request bodies, HTTP methods, status codes and response representations. A provider change can leave the provider internally healthy while causing consumers to behave incorrectly. [Ministry of Testing](https://www.ministryoftesting.com/insights/restful-api-testing-with-chakram?utm_source=chatgpt.com)

So:

    API/component tests
    → Is Pricing behaving correctly?

    Contract tests
    → Can Cart still talk to Pricing as agreed?

    End-to-end tests
    → Can a shopper ultimately complete the business workflow?

These tests overlap, but they answer different questions.

That's why replacing all integration or end-to-end testing with contract testing would be a mistake.

------------------------------------------------------------------------

# The contract should represent what the consumer actually needs

Here's a common contract-testing mistake.

The current provider response is:

    {
      "productId": "42",
      "name": "Running Shoes",
      "unitPrice": 89.99,
      "currency": "EUR",
      "warehouse": "HAM-01"
    }

Someone creates this test:

    expect(response).toEqual({
      productId: "42",
      name: "Running Shoes",
      unitPrice: 89.99,
      currency: "EUR",
      warehouse: "HAM-01"
    });

Now the provider adds:

    {
      "discountEligible": true
    }

The real Cart application ignores that field perfectly.

But your exact-object assertion fails.

The test says:

    BREAKING CHANGE!

The real consumer says:

    I don't care.

You haven't protected the consumer.

You've coupled your test to the provider.

This is an important contract-testing principle:

> **Assert what the consumer depends on, not everything the provider happens to return.**

For the Cart Service, perhaps:

    expect(response.unitPrice).toEqual(expect.any(Number));
    expect(response.currency).toBe("EUR");
    expect(response.availability).toEqual(expect.any(String));

is much closer to its actual dependency.

Consumer-driven contract tools such as Pact are built around this idea: consumers express the interactions they require, and providers verify that they still satisfy those expectations. Pact describes itself as “contract by example” rather than maintaining giant static descriptions of every possible provider response. [Pact Docs](https://docs.pact.io/faq?utm_source=chatgpt.com)

------------------------------------------------------------------------

# But a contract can also be too weak

Now consider:

    {
      "unitPrice": -999999,
      "currency": "EUR",
      "availability": "BANANA"
    }

Your contract says:

    unitPrice is number ✓
    currency is string ✓
    availability is string ✓

Contract passes.

Checkout might now produce:

    Subtotal: -€999,999

The interface is structurally compatible.

The behavior is nonsense.

This gives us an important distinction:

    Structural compatibility
    ≠
    Semantic correctness

A schema can tell you:

    unitPrice must be numeric

but your business rule may actually be:

    unitPrice >= 0

A schema can tell you:

    currency is a 3-character string

but business behavior may require:

    currency of returned price
    must match
    currency requested by Cart

A contract test is therefore not an oracle for all quality.

Michael Bolton's work on testing oracles is useful here: an oracle is a fallible means of recognizing a potential problem. Passing one oracle doesn't prove that no problem exists; we need multiple ways of evaluating software. [DevelopSense+1](https://developsense.com/blog/2012/04/all-oracles-are-heuristic?utm_source=chatgpt.com)

A green schema test tells you something useful.

It does not tell you:

> “The integration is correct in every important way.”

------------------------------------------------------------------------

# Here's a subtle compatibility bug: adding something can break consumers too

Teams often learn this rule:

    Removing field = breaking

    Adding field = safe

Usually that's a useful default.

For example, GitHub's current REST API documentation classifies changes such as removing or renaming response fields, changing types, and making optional inputs required as breaking changes. Adding response fields or optional parameters is classified as additive/non-breaking. [GitHub-Dokumentation+1](https://docs.github.com/en/rest/about-the-rest-api/breaking-changes?utm_source=chatgpt.com)

But treat that as a compatibility policy—not a law of physics.

Suppose your consumer does this:

    const keys = Object.keys(response);

    if (keys.length !== 4) {
      throw new Error("Unexpected response");
    }

Provider adds:

    promotionId

Provider believes:

    non-breaking

Consumer crashes.

Whose fault is it?

You could argue the consumer was implemented too strictly.

Probably true.

But production is still broken.

Testing should care about the actual integration, not merely who deserves blame.

This is one reason consumer-driven contracts are valuable: they expose **real consumer assumptions**, including assumptions that perhaps should not exist.

------------------------------------------------------------------------

# New enum values are especially interesting

Suppose Order Service publishes:

    {
      "orderId": "9821",
      "status": "PAID"
    }

Consumer code:

    switch (order.status) {
      case "NEW":
        showPending();
        break;

      case "PAID":
        showPaid();
        break;

      case "CANCELLED":
        showCancelled();
        break;
    }

Now the business introduces partial refunds:

    {
      "orderId": "9821",
      "status": "PARTIALLY_REFUNDED"
    }

From the provider's perspective, adding another possible enum value may be considered an additive change. GitHub's API compatibility policy, for example, treats adding enum values as non-breaking. [GitHub-Dokumentation](https://docs.github.com/en/rest/about-the-rest-api/breaking-changes?utm_source=chatgpt.com)

But our consumer hasn't designed behavior for it.

Maybe the UI displays:

    Order status:

blank.

Or worse, it enters the wrong branch.

So when reviewing interface changes, don't ask only:

> “Did we remove anything?”

Ask:

> **“Does this expand the set of values consumers must understand?”**

That's a stronger testing question.

------------------------------------------------------------------------

# Now apply the same thinking to event-driven systems

Contract risk becomes even more interesting when APIs are asynchronous.

Imagine:

    Order Service
         ↓
    Kafka topic: order-events
         ↓
    Email Service
    Analytics
    Warehouse
    Billing

Order Service publishes:

    {
      "orderId": "O-8001",
      "status": "PAID",
      "amount": 129.90
    }

Warehouse expects:

    orderId
    status

Billing expects:

    orderId
    amount

Analytics expects all three.

Now a new event version adds:

    {
      "orderId": "O-8001",
      "status": "PAID",
      "amount": 129.90,
      "marketplaceSellerId": "S-42"
    }

Probably fine.

But suppose instead:

    amount

changes from:

    129.90

to:

    {
      "value": 12990,
      "currency": "EUR"
    }

A much richer representation.

And a potentially disastrous breaking change.

Schema evolution systems such as Confluent Schema Registry explicitly distinguish backward, forward and full compatibility because new producers and old consumers—or new consumers and historical events—may coexist. [Confluent Dokumentation+1](https://docs.confluent.io/platform/current/schema-registry/fundamentals/schema-evolution.html?utm_source=chatgpt.com)

That gives a tester another important question:

> **Which version is producing, and which versions might still be consuming?**

------------------------------------------------------------------------

# “Latest version works” is not enough in event-driven systems

Suppose today you deploy:

    Order Event Schema V3

Your latest consumer:

    Warehouse V7

handles it correctly.

Great.

But maybe another consumer hasn't deployed in six months:

    Finance V2

Or perhaps consumers replay old events from a Kafka topic.

Now both directions matter:

    NEW consumer
    reading
    OLD event

and:

    OLD consumer
    reading
    NEW event

Confluent's schema-evolution documentation gives explicit meanings to these cases: backward compatibility concerns newer consumers reading older data, while forward compatibility concerns older consumers reading newer data; full compatibility supports both directions. [Confluent Dokumentation](https://docs.confluent.io/platform/current/schema-registry/fundamentals/schema-evolution.html?utm_source=chatgpt.com)

This is not just architecture trivia.

It directly affects your release test strategy.

Before changing an event schema, ask:

    Which consumers exist?

    Which versions are deployed?

    Can consumers replay historical events?

    In which order will producers and consumers be upgraded?

That last question can determine whether a supposedly compatible deployment actually works.

------------------------------------------------------------------------

# Don't forget business semantics when schemas evolve

Imagine your sports-data platform publishes:

    {
      "matchId": 718,
      "event": "GOAL",
      "team": "HOME"
    }

Later you add VAR corrections:

    {
      "matchId": 718,
      "event": "GOAL_CANCELLED",
      "team": "HOME"
    }

Schema validation passes.

The new event is syntactically perfect.

But consider consumers:

    Live score
    Bet settlement
    Notifications
    Statistics
    Broadcast graphics

A notification consumer may already have sent:

> GOAL! Hamburg 1–0 Berlin

Now it receives:

    GOAL_CANCELLED

What should it do?

Delete notification?

Send correction?

Ignore it?

The integration problem isn't:

    Can consumer deserialize GOAL_CANCELLED?

It's:

> **Does the consumer have sensible business behavior for what this new event means?**

This is the boundary between **contract testing** and **domain testing**.

A contract might ensure:

    event field exists
    value is accepted

A domain test investigates:

    score corrected
    notifications corrected
    bet state reconciled
    stats updated

Both matter.

------------------------------------------------------------------------

# Contract testing should reduce—not duplicate—end-to-end testing

Imagine a microservice system:

    Browser
      ↓
    Checkout
      ↓
    Cart
      ↓
    Pricing
      ↓
    Inventory
      ↓
    Payment
      ↓
    Order
      ↓
    Email

A giant end-to-end test might validate everything through the browser.

When it fails:

    Checkout failed

Why?

Could be:

    Pricing
    Inventory
    Payment
    Order
    Email
    test data
    network
    environment
    browser
    authentication

Diagnosis is expensive.

Contract tests can move much of the interface compatibility checking closer to the individual services.

Fowler's practical test-pyramid guidance recommends using consumer-driven contract testing to catch breaking interface changes continuously in provider builds instead of depending entirely on large integrated tests. [martinfowler.com](https://martinfowler.com/articles/practical-test-pyramid.html?utm_source=chatgpt.com)

So instead of relying on:

    1 giant E2E test

for all confidence, you might have:

    Component tests
         +
    Contract tests
         +
    Focused integration tests
         +
    A smaller number of business-critical E2E tests

Each layer answers something different.

The goal isn't:

> “Replace E2E.”

It's:

> **Use the cheapest useful test at the layer where a particular risk can be detected clearly.**

------------------------------------------------------------------------

# Provider states are where contract tests become much more useful

Suppose Cart expects these cases:

    Product exists
    Product missing
    Product out of stock
    Promotion active

A contract shouldn't depend on whatever random state happens to exist in a shared staging database.

Consumer-driven contract approaches commonly use **provider states** to say:

    Given product SKU-42 exists
    When GET /prices/SKU-42
    Then ...

or:

    Given product SKU-42 is out of stock
    When GET /prices/SKU-42
    Then ...

Pact explicitly supports provider states so the same request can be verified against different meaningful provider conditions. [Go Packages+1](https://pkg.go.dev/github.1git.de/pact-foundation/pact-go?utm_source=chatgpt.com)

That lets contracts represent actual consumer assumptions rather than brittle shared-environment data.

This is also good testability.

A provider that can deliberately establish meaningful states is much easier to test than one where everyone says:

> “Try SKU-19281. I think that one is currently out of stock.”

------------------------------------------------------------------------

# Here's where contract tests go wrong organizationally

Imagine Pricing Team changes:

    unitPrice

to:

    price

CI turns red.

Cart Team says:

> “You broke us.”

Pricing Team says:

> “Your code depends on an old field.”

Cart Team says:

> “You changed the API without telling us.”

Now the contract test has discovered a technical issue and created a social one.

Michael Bolton points out that testing is socially challenging precisely because testers—and testing evidence—challenge people's beliefs about the product. Questions and failures can create friction if they are treated as accusations rather than information. [DevelopSense](https://developsense.com/blog/2023/03/testing-is-socially-challenging?utm_source=chatgpt.com)

A better conversation is:

> “Cart currently depends on `unitPrice`. The provider build shows that removing it would break the Cart contract. Do we want to preserve it temporarily, migrate Cart first, or version the interface?”

Notice the difference.

Not:

    YOU BROKE THE BUILD

but:

    We have discovered a dependency.
    What migration strategy should we use?

The contract test becomes a coordination mechanism.

------------------------------------------------------------------------

# Use “expand and contract” for real breaking changes

Sometimes you genuinely need to change:

    unitPrice

to:

    price

You can't preserve old interfaces forever.

A safer migration is:

    STEP 1

    Provider returns both:

    unitPrice
    price

Then:

    STEP 2

    Consumers migrate:

    unitPrice → price

Then:

    STEP 3

    Verify no active consumers depend on unitPrice

Finally:

    STEP 4

    Remove unitPrice

Pact's documentation explicitly describes this **expand-and-contract** approach for making breaking provider changes while keeping contracts satisfied during migration. [Pact Docs](https://docs.pact.io/faq?utm_source=chatgpt.com)

This pattern appears everywhere:

    database migrations
    API migrations
    event schemas
    configuration changes
    feature flags

The principle is:

> **Don't require every dependent system to switch atomically unless you genuinely control them all.**

Distributed systems rarely give you that luxury.

------------------------------------------------------------------------

# “Can I deploy?” is a better question than “Are my tests green?”

Suppose the provider tests are green.

The consumer tests are green.

But they were run against incompatible versions.

For example:

    Cart v17
    expects Pricing v8

    Production currently:
    Cart v16
    Pricing v7

    New deployment:
    Pricing v8

Before deploying Pricing v8, you really want to know:

> **Does Pricing v8 satisfy the contract of the Cart version currently running in production?**

Not merely:

> “Does Pricing v8 satisfy the newest Cart code in Git?”

That distinction is crucial.

Pact's tooling philosophy includes this deployment question explicitly: contract verification should help determine whether a particular consumer version and provider version are safe to deploy together. [Pact Docs](https://docs.pact.io/faq?utm_source=chatgpt.com)

This is where contract testing moves beyond ordinary CI checking into release-risk management.

------------------------------------------------------------------------

# Observability should reveal contract failures too

Imagine a supposedly safe API change reaches production.

Your technical dashboard says:

    Pricing Service:
    HTTP 200 = 99.99%
    CPU = 30%
    Memory = 44%
    p95 = 75 ms

Everything looks perfect.

Meanwhile Cart logs show:

    Cannot parse Pricing response:
    missing property unitPrice

The provider is healthy.

The integration is failing.

So observability shouldn't only be service-centered.

Useful signals might include:

    deserialization failures
    unexpected enum values
    schema validation failures
    consumer retries
    contract-version mismatches
    dead-letter queue growth

In event-driven systems, a dead-letter queue suddenly filling after a schema deployment can be much more informative than producer CPU.

Again:

> **Service health and system health are not the same thing.**

------------------------------------------------------------------------

# A contract test should fail for a meaningful reason

Suppose your provider changes:

    {
      "discount": null
    }

to:

    {
      "discount": 0
    }

Your consumer handles both identically.

Contract fails.

Ask:

> Is this test protecting a real dependency?

If not, loosen it.

Now suppose:

    currency

disappears.

The consumer uses it to decide how to format and charge checkout totals.

Contract fails.

Excellent.

The test has discovered something that matters.

This is a useful quality question for every automated check:

> **What real problem is this failure supposed to warn us about?**

If nobody can answer, the test may be creating noise rather than confidence.

------------------------------------------------------------------------

# The tester's role during API design

You don't have to wait until implementation.

Imagine the developer proposes:

    GET /orders/{id}

Response:

    {
      "status": "PAID"
    }

Ask:

> “What statuses can appear?”

Developer:

> “NEW, PAID, CANCELLED.”

Ask:

> “Are consumers expected to reject unknown future statuses or handle them generically?”

That's an excellent compatibility question.

Or suppose a new property is proposed:

    discount

Ask:

> “Can it be absent, null, or zero? Do those mean different things?”

Those three representations can mean very different business states:

    field missing
    → information not supplied

    null
    → explicitly unknown/no value

    0
    → known discount of zero

A schema discussion can therefore expose ambiguous business rules before code exists.

That is prospective testing.

------------------------------------------------------------------------

# Don't ask every possible API question in refinement

You could easily overwhelm people with:

    Can it be null?
    Can it be missing?
    Can it be empty?
    Maximum length?
    Encoding?
    Retries?
    Timeout?
    Version?
    Unknown fields?
    Unknown enums?

Good testing isn't performing a ritual.

Focus on the dependencies that carry risk.

For a payment API:

    idempotency
    money precision
    transaction state
    retry semantics

may matter enormously.

For a catalog lookup:

    unknown SKU
    locale
    cache freshness
    pagination

may matter more.

For sports data:

    ordering
    corrections
    timestamps
    event identity

may dominate.

Domain knowledge tells you where interface compatibility matters most.

------------------------------------------------------------------------

# A reusable integration-risk model

When one component communicates with another, think through:

    STRUCTURE
    Can they understand each other's messages?

    SEMANTICS
    Do they interpret those messages the same way?

    STATE
    Do both sides agree about relevant business state?

    TIMING
    What if messages are late, duplicated or reordered?

    VERSION
    Can old and new components coexist?

    FAILURE
    What happens when one side is unavailable?

    RECOVERY
    Can they reconcile after disagreement?

    OBSERVABILITY
    Can we tell which interface or version caused the problem?

A contract test is especially good at parts of:

    STRUCTURE
    VERSION

and sometimes:

    SEMANTICS

But don't assume it automatically handles:

    all state
    timing
    business correctness
    recovery

That's where integration tests, exploratory testing, resilience tests, production telemetry, and domain-specific testing continue to matter.

This matches James Bach's broader point: integration testing should be designed around **integration risk**, not around a tool category or test-level label. [Satisfice](https://www.satisfice.com/blog/archives/1577?utm_source=chatgpt.com)

------------------------------------------------------------------------

# Today's challenge

You own Checkout Service.

It consumes Pricing Service.

Current response:

    {
      "productId": "P-100",
      "unitPrice": 50,
      "currency": "EUR",
      "availability": "IN_STOCK"
    }

The Pricing team proposes version 2:

    {
      "productId": "P-100",
      "unitPrice": 50,
      "currency": "EUR",
      "availability": "LOW_STOCK",
      "promotion": {
        "discount": 5
      }
    }

They say:

> “Nothing was removed, so this is backward compatible.”

Your Checkout code currently contains:

    if (price.availability === 'IN_STOCK') {
      allowCheckout();
    } else {
      disableCheckout();
    }

Structurally, the new response looks harmless.

Business-wise, `LOW_STOCK` should still allow the customer to buy.

Your job is to design three things.

First, write the **consumer contract** you would want Checkout to express. Do not copy the entire provider response; capture only Checkout's real dependencies.

Second, identify which part of this proposed change a normal JSON-schema compatibility check could consider acceptable while Checkout still behaves incorrectly.

Third, decide where you would test the rule:

    LOW_STOCK → checkout allowed

Would you put it in:

    contract test
    Checkout component test
    Pricing component test
    end-to-end test

You may choose more than one, but explain what question each test answers.

Then answer one final question:

> **If the Pricing developer tells you, “Our API hasn't broken its schema, so this isn't our bug,” how would you explain the risk without turning it into an ownership argument?**

A strong response would sound something like:

> “The new value is structurally compatible, but Checkout currently interprets every value except `IN_STOCK` as unavailable. So the interface technically parses, while the business behavior changes. We need to decide whether Checkout should support unknown availability states more defensively, whether Pricing needs a compatibility migration, or both.”

That language matters.

You aren't trying to establish guilt.

You're establishing:

    dependency
    +
    evidence
    +
    business consequence
    +
    migration options

And that is today's deeper lesson:

> **Integration bugs often come from two components making individually reasonable assumptions that are incompatible when combined.**

Contract testing gives you a powerful way to expose those assumptions early.

But a strong quality engineer knows the limits of that tool.

A green contract can tell you:

> “The agreed interaction still fits.”

It cannot automatically tell you:

> “The business still works.”

You still need testing judgment to answer that.

### Recommended reading

James Bach's recent integration-testing series is particularly useful because it frames integration testing around the *risks created by combining parts*, instead of trying to define it only by architecture or test level. Fowler's microservice testing and practical test-pyramid material explains consumer-driven contracts well, Pact's current documentation is useful for real implementation concepts such as provider states and expand-and-contract migrations, and Confluent's schema-evolution documentation gives a concrete view of compatibility in asynchronous systems. [Confluent Dokumentation+3Satisfice+3martinfowler.com+3](https://www.satisfice.com/blog/archives/1577?utm_source=chatgpt.com)

[James Bach — Reinventing Testing: What Is Integration Testing?](https://www.satisfice.com/blog/archives/1577?utm_source=chatgpt.com)

[Martin Fowler — Testing Strategies in a Microservice Architecture](https://martinfowler.com/articles/microservice-testing/?utm_source=chatgpt.com)

[Martin Fowler — The Practical Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html?utm_source=chatgpt.com)

[Pact — FAQ and contract-testing guidance](https://docs.pact.io/faq?utm_source=chatgpt.com)

[Confluent — Schema Evolution and Compatibility](https://docs.confluent.io/platform/current/schema-registry/fundamentals/schema-evolution.html?utm_source=chatgpt.com)

[GitHub — REST API Breaking Changes](https://docs.github.com/en/rest/about-the-rest-api/breaking-changes?utm_source=chatgpt.com)
