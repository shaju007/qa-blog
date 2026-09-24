# QA Thinking — Day 7

## Payment Testing: The Most Dangerous State Is Not “Failed” — It Is “I Don’t Know Whether It Succeeded”

Imagine you are testing checkout.

A customer clicks:

**Pay €89.90**

Your backend sends a payment request to the payment provider.

Then this happens:

    Shop → Payment Provider
              ↓
          Payment succeeds
              ↓
    Provider sends response
              ↓
          NETWORK BREAKS
              ↓
    Shop receives timeout

Your application sees:

    Timeout

Did the payment fail?

**No.**

All you actually know is:

> **We did not receive the response.**

The provider may already have charged the customer.

Now imagine your application contains:

    try {
        await makePayment();
    } catch {
        await makePayment();
    }

The second request succeeds.

Customer receives:

    Charge 1: €89.90
    Charge 2: €89.90

Congratulations: the application's “reliability mechanism” has created a financial defect.

Today's lesson is therefore:

> **In distributed systems, a technical failure and a business failure are not the same thing.**

Payments are one of the best domains for learning this because mistakes have immediate financial consequences.

------------------------------------------------------------------------

# First understand the payment lifecycle

A beginner often models card payment as:

    Pay
     ↓
    Success / Failed

Real payment systems are more complicated.

A useful simplified model is:

    Payment requested
           ↓
    Authorization
           ↓
    Capture
           ↓
    Settlement

Let's understand the first two carefully.

### Authorization

The customer's bank essentially says:

> “This payment is allowed and these funds can be reserved.”

For example:

    Customer account: €1,000

    Merchant requests: €100

    Bank authorizes €100

The €100 may now be reserved.

But the merchant may not yet have actually collected the money.

### Capture

Capture tells the payment system:

> “Take the authorized amount.”

Adyen's current payment lifecycle documentation describes authorization as the point where payment details and risk checks are accepted and funds are reserved. Capture is the later step that moves the transaction toward funds being transferred to the merchant. [Adyen Docs+1](https://docs.adyen.com/account/payments-lifecycle?utm_source=chatgpt.com)

So:

    AUTHORIZED ≠ CAPTURED

That distinction immediately generates useful tests.

------------------------------------------------------------------------

# Why would authorization and capture be separate?

Imagine an online shop.

Customer orders:

    Laptop: €1,000

The shop wants to ensure the customer can pay.

So:

    Authorization → €1,000

But the warehouse discovers that the laptop will ship tomorrow.

The business may decide to capture only when shipment occurs.

Conceptually:

    Checkout
       ↓
    Authorize €1,000

    Warehouse
       ↓
    Ship item

    Payment system
       ↓
    Capture €1,000

Other domains use this even more heavily.

Hotels may authorize an estimated amount and adjust it later when guests add restaurant, minibar or other charges. Pre-orders and businesses with long fulfillment times can have similar requirements. Adyen documents these as real use cases for authorization adjustment. [Adyen Docs](https://docs.adyen.com/online-payments/adjust-authorisation?utm_source=chatgpt.com)

Now imagine testing only:

> “Payment page displays success.”

You could completely miss whether the business ever captured the payment.

------------------------------------------------------------------------

# Your first important payment oracle: business state

Consider this sequence:

    Order status: PAID
    Payment status: AUTHORIZED
    Capture status: FAILED

Something feels wrong.

Why?

Because the systems disagree about the business state.

The UI could look perfectly healthy:

    Thank you for your order!

The API could return:

    200 OK

The database could contain:

    order_created = true

And the merchant may still never receive the money.

This is where Michael Bolton's broader idea of testing oracles becomes useful: testers should look for things that suggest a **problem**, rather than limiting themselves to checking whether a documented expected value was returned. Internal inconsistencies are powerful clues. [DevelopSense](https://developsense.com/blog/2015/09/oracles-from-the-inside-out-part-5-oracles-as-references-as-media?utm_source=chatgpt.com)

So don't merely ask:

> “Did `/checkout` return 200?”

Ask:

> **“Are the order, payment, fulfillment and accounting states consistent?”**

------------------------------------------------------------------------

# Now return to our timeout problem

Suppose your backend sends:

    POST /payments

with:

    {
      "order": "ORDER-7421",
      "amount": 8990,
      "currency": "EUR"
    }

The provider processes it successfully.

But your connection times out before the response returns.

Your application sees:

    TIMEOUT

There are at least two explanations.

### Hypothesis A

    Request never reached provider
    → No payment happened

### Hypothesis B

    Request reached provider
    → Payment happened
    → Response was lost

From your application's perspective, both look like:

    TIMEOUT

This is what makes distributed systems interesting to test.

A timeout describes the **communication outcome**.

It doesn't necessarily describe the **business transaction outcome**.

AWS's Builders' Library explicitly warns about this: when a remote call times out, side effects may already have occurred. Blindly retrying operations with side effects can therefore duplicate them. [Amazon Web Services, Inc.](https://aws.amazon.com/de/builders-library/timeouts-retries-and-backoff-with-jitter/?utm_source=chatgpt.com)

Payments are perhaps the easiest example to understand:

    timeout ≠ payment failed

Remember that sentence.

------------------------------------------------------------------------

# Enter idempotency

Modern payment APIs often solve part of this problem with **idempotency**.

The idea is:

> Repeating the same logical operation should not create the side effect again.

You generate an identifier:

    payment_attempt_7421

Send:

    POST /payments
    Idempotency-Key: payment_attempt_7421

If the connection disappears, you retry:

    POST /payments
    Idempotency-Key: payment_attempt_7421

The provider recognizes:

> “I've already processed this logical request.”

Instead of creating another payment, it returns the existing result.

Adyen currently supports idempotency on POST requests and specifically recommends retrying a timed-out payment using the **same idempotency key**; if the original request was already processed, the previous result can be returned rather than creating the operation again. [Adyen Docs](https://docs.adyen.com/development-resources/api-idempotency?utm_source=chatgpt.com)

AWS describes essentially the same reliability pattern: clients send a unique request identifier so that retrying the same intent can produce a semantically equivalent result rather than repeating the side effect. [Amazon Web Services, Inc.](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/?utm_source=chatgpt.com)

------------------------------------------------------------------------

# But don't write one idempotency test and declare victory

A weak test might be:

    Send request
    Send same request again
    Expect one payment

    PASS

Useful—but insufficient.

Think like a tester.

What variables matter?

------------------------------------------------------------------------

## Experiment 1 — Same key, same request

    Key: ABC123
    Amount: €100

    send
    send
    send
    send

Expected business result:

    one payment

Good.

------------------------------------------------------------------------

## Experiment 2 — Same key, modified request

Now:

    Request 1
    Key: ABC123
    Amount: €100

then:

    Request 2
    Key: ABC123
    Amount: €1,000

What should happen?

This is not obviously the same intent anymore.

Your system should not silently say:

    Sure, €1,000.

A well-designed idempotency mechanism needs rules around **semantic equivalence**, not merely duplicate strings. AWS's Builders' Library explicitly discusses this distinction when describing safe retries. [Amazon Web Services, Inc.](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/?utm_source=chatgpt.com)

A tester should therefore investigate:

    Which request fields are compared?

    What happens if payload changes?

    What identifies "the same payment intent"?

------------------------------------------------------------------------

# Experiment 3 — Different key, same order

This one is even more interesting.

    POST /payments
    Order: 7421
    Idempotency-Key: A

Then:

    POST /payments
    Order: 7421
    Idempotency-Key: B

The payment provider may quite legitimately create:

    Payment 1
    Payment 2

because from its perspective those are two separate intents.

But your **business system** may know:

> Order 7421 should only be paid once.

This exposes an important difference:

    Payment-provider idempotency

    ≠

    Business-level duplicate prevention

The provider protects:

    same request being retried

Your application may also need to protect:

    same order accidentally being paid twice

Those are related but different problems.

That is precisely the kind of distinction strong API testers learn to look for.

------------------------------------------------------------------------

# Think about the customer double-clicking

Users create retry scenarios too.

Imagine this:

    Customer clicks PAY

Button remains enabled for 600 ms.

Customer becomes impatient.

    CLICK
    CLICK
    CLICK

Your frontend sends:

    Payment request A
    Payment request B
    Payment request C

You could fix the UI:

    disable button after click

Good UX improvement.

But is that sufficient protection?

No.

A user can still:

    call your API directly
    refresh
    use another tab
    experience browser retry
    experience proxy retry
    use two devices

So the correct question is not:

> “Did we disable the button?”

It is:

> **“What prevents the business transaction from happening twice?”**

UI prevention is helpful.

Server-side protection is essential.

This mirrors yesterday's authorization lesson:

    Hidden button ≠ security

    Disabled payment button ≠ duplicate-payment protection

------------------------------------------------------------------------

# Retry testing should deliberately create uncertainty

Most automated payment tests create clean states:

    Provider success

or:

    Provider failure

Production gives you much uglier states.

Try injecting faults at specific points.

For example:

    Shop
     |
     | POST payment
     v
    Provider receives payment
     |
     | payment created
     X ← connection cut here

This is a dramatically better test than simply mocking:

    500 Internal Server Error

because you're testing the difficult question:

> **The side effect occurred, but the caller doesn't know it. What happens next?**

Other useful fault points:

    connection lost before provider receives request

    connection lost after provider receives request

    provider processes request slowly

    provider returns 500 before processing

    provider returns 500 after partial processing

    client timeout occurs before provider timeout

    database update fails after successful payment

    order creation succeeds but payment-event persistence fails

Now your testing starts resembling production failure modes instead of idealized API examples.

------------------------------------------------------------------------

# Retry logic itself can create outages

Suppose the payment provider becomes slow.

You have:

    10,000 checkout requests

All requests timeout.

Your code immediately retries every one.

Now the provider receives:

    original 10,000 requests
    +
    10,000 retries

Some timeout again.

Another retry:

    +10,000

Your recovery mechanism is now attacking the struggling dependency.

AWS warns explicitly that retries consume additional backend capacity and can worsen overloaded systems. In layered systems, retries can multiply dramatically; AWS gives an example where three retries across a five-layer call chain can increase database load by **243 times**. [Amazon Web Services, Inc.](https://aws.amazon.com/de/builders-library/timeouts-retries-and-backoff-with-jitter/?utm_source=chatgpt.com)

That's why mature retry strategies often include:

    maximum attempts
    exponential backoff
    jitter
    retryable-error classification

AWS currently recommends exactly these protections and specifically advises teams to create and exercise retry test scenarios rather than simply assuming an SDK's defaults are appropriate. [AWS Dokumentation](https://docs.aws.amazon.com/de_de/wellarchitected/latest/framework/rel_mitigate_interaction_failure_limit_retries.html?utm_source=chatgpt.com)

So performance testing isn't separate from functional payment testing.

Retry behavior affects both.

------------------------------------------------------------------------

# What is exponential backoff?

Suppose a payment dependency is unavailable.

Bad retry:

    Attempt 1 → 0 ms
    Attempt 2 → 0 ms
    Attempt 3 → 0 ms
    Attempt 4 → 0 ms

Better:

    Attempt 1

    wait ~1 sec

    Attempt 2

    wait ~2 sec

    Attempt 3

    wait ~4 sec

    Attempt 4

That's the basic idea of exponential backoff.

But imagine one million clients all retrying exactly at:

    1 sec
    2 sec
    4 sec

You create traffic spikes.

So systems often add **jitter**—some randomness to spread those retries across time. AWS explains that backoff plus jitter helps prevent synchronized retry bursts from repeatedly overwhelming a recovering service. [Amazon Web Services, Inc.](https://aws.amazon.com/de/builders-library/timeouts-retries-and-backoff-with-jitter/?utm_source=chatgpt.com)

For a tester, that suggests experiments like:

    kill payment dependency

    generate 5,000 concurrent transactions

    restore dependency

    observe retry distribution

You're asking:

> Does the system recover gracefully?

not simply:

> Does retry work?

------------------------------------------------------------------------

# Payment testing should include webhooks

Now we add another layer.

Many payment flows are asynchronous.

You send a request.

The initial response may tell you:

    request received

but later a webhook tells you:

    payment authorized

    or

    capture succeeded

    or

    capture failed

Adyen's manual-capture flow is a concrete example. A capture API request returns a status indicating that the request was received, while the eventual outcome comes asynchronously through capture-related webhooks. [Adyen Docs](https://docs.adyen.com/online-payments/capture?utm_source=chatgpt.com)

That gives us another important tester rule:

> **API acknowledgement is not necessarily business completion.**

For example:

    POST /capture

    HTTP 200

doesn't automatically mean:

    merchant got money

You must understand what that response means in the domain.

------------------------------------------------------------------------

# It gets even more interesting: success can later change

Here is a payment behavior that many testers would initially find surprising.

Adyen documents that, in rare situations, a capture may later receive a `CAPTURE_FAILED` event **even after a previous capture webhook indicated success**, because the card scheme or issuing bank can reject the capture later. [Adyen Docs](https://docs.adyen.com/online-payments/capture?utm_source=chatgpt.com)

Think about what that means for your application.

Perhaps:

    10:00:00
    CAPTURE success

Your system changes:

    Order → PAID

Warehouse begins fulfillment.

Then:

    10:04:00
    CAPTURE_FAILED

What happens?

Possible systems involved:

    Order service
    Payment service
    Inventory
    Warehouse
    Email
    Invoice
    ERP
    Analytics
    Customer account

This isn't just:

> “Handle webhook.”

It is a **state reconciliation problem**.

------------------------------------------------------------------------

# Duplicate webhooks are a fantastic test

Suppose your payment system receives:

    CAPTURE_SUCCESS

and processes:

    Order → PAID
    Send invoice
    Add accounting record
    Send warehouse command
    Send confirmation email

Then the same webhook arrives again.

What happens?

Bad implementation:

    Invoice 1
    Invoice 2

    Warehouse order 1
    Warehouse order 2

    Email 1
    Email 2

Potentially much worse if financial side effects exist.

Your webhook consumer should usually tolerate duplicate delivery appropriately.

This is again idempotency—but on the **event consumer** side.

Today's useful pattern is therefore:

    API retries
            ↓
    idempotency needed

    Webhook retries
            ↓
    idempotency needed

The pattern keeps reappearing.

------------------------------------------------------------------------

# Now reuse our event-testing model

When we discussed sports and ad tech, we used:

    Missing
    Duplicate
    Late
    Reordered
    Corrected

Apply it to payment webhooks.

### Missing

    PAYMENT_CAPTURED never arrives

How does your system discover this?

------------------------------------------------------------------------

### Duplicate

    PAYMENT_CAPTURED
    PAYMENT_CAPTURED

Does anything happen twice?

------------------------------------------------------------------------

### Late

    payment succeeds

    webhook arrives 20 minutes later

What does the customer see during those 20 minutes?

------------------------------------------------------------------------

### Reordered

Perhaps you observe:

    CAPTURE event

before some internal event your application expected first.

Does the consumer crash?

Buffer?

Reconcile?

------------------------------------------------------------------------

### Corrected / later failure

    capture appears successful

    later:
    CAPTURE_FAILED

Can the system recover its business state?

Same testing model.

Different domain.

This transferability is something I want you to notice.

You're gradually building reusable **mental models**, not memorizing industry checklists.

------------------------------------------------------------------------

# The biggest payment bug might happen after checkout

Imagine your browser test says:

    Add product
    Checkout
    Enter card
    Success page appears

    PASS

Everything looks excellent.

But production data contains:

    10,000 successful checkout pages
    9,997 orders
    9,991 authorized payments
    9,950 captures

Where did the transactions disappear?

This is where **reconciliation** becomes one of your strongest quality tools.

A healthy payment system often needs ways to compare:

    Checkout attempts
            ↓
    Orders created
            ↓
    Payment intents
            ↓
    Authorizations
            ↓
    Captures
            ↓
    Refunds
            ↓
    Accounting / settlement

These numbers don't necessarily have to match exactly.

For example, some authorizations legitimately fail.

But unexplained divergence tells you where to investigate.

------------------------------------------------------------------------

# Build business invariants

Instead of thinking only in individual test cases, create rules that should generally remain true.

For example:

> A successfully captured payment should be associated with exactly one known merchant order.

Another:

> Total refunded amount should not exceed captured amount unless the payment method explicitly supports a different business rule.

Interestingly, Adyen's current idempotency documentation describes platform-level safeguards around modification operations—for example, refund totals are normally prevented from exceeding captured value, and capture amounts are constrained by authorization rules. [Adyen Docs](https://docs.adyen.com/development-resources/api-idempotency?utm_source=chatgpt.com)

Other possible invariants:

    Captured amount ≤ authorized amount

or for systems supporting partial capture:

    sum(captures) ≤ authorized amount

or:

    order marked PAID
    → must have valid payment evidence

or:

    refund success
    → corresponding capture must exist

You can automate these as API/integration/data-level checks.

That's often much more powerful than another browser scenario.

------------------------------------------------------------------------

# Don't mock away the thing you need to learn about

Suppose your payment tests do:

    paymentProvider.mockSuccess()

for every test.

That's useful for testing checkout logic.

But you're not testing:

    timeouts
    duplicates
    slow responses
    provider errors
    webhook retries
    out-of-order events
    idempotency
    capture failures

Ministry of Testing's recent discussion of “shift-down” testing makes a useful point: testing core business behavior directly—below the UI—can provide faster, more reliable feedback than trying to drive everything through browser automation. [Ministry of Testing](https://www.ministryoftesting.com/insights/testing-software-smarter-not-harder-the-shift-down-strategy?utm_source=chatgpt.com)

A good payment strategy might therefore contain several levels:

    UI
    ↓
    Does checkout behave correctly for the shopper?

    API / integration
    ↓
    Are payment requests and business rules correct?

    Component
    ↓
    Does our payment orchestration handle failures?

    Contract
    ↓
    Can we consume provider responses/webhooks?

    Resilience tests
    ↓
    What happens during timeout/retry/duplicate/delay?

    Production reconciliation
    ↓
    Do real business states remain consistent?

No single layer tells the whole story.

------------------------------------------------------------------------

# James Bach's requirement question becomes very important here

Suppose the requirement says:

> “Retry payment when the provider times out.”

If you implement that literally, you might create duplicate payments.

James Bach's classic point about requirements-based testing is relevant: knowing **what** the requirement says isn't enough. Testers need to understand **why the requirement exists**. [Satisfice](https://www.satisfice.com/download/risk-and-requirements-based-testing?utm_source=chatgpt.com)

Why does the PO want retries?

Probably not:

> “We love sending HTTP requests repeatedly.”

The underlying goal is more like:

> **Temporary infrastructure problems should not cause customers to lose legitimate purchases.**

Once you understand the goal, better questions appear:

    Which errors are safe to retry?

    How do we know whether the original operation happened?

    Do we reuse the same idempotency key?

    How many retries?

    Who performs the retry?

    What does the customer see?

    When do we stop?

    How do we reconcile uncertain outcomes?

Now you're testing the **business objective**, not merely the requirement sentence.

------------------------------------------------------------------------

# Soft skill: how to report an ambiguous payment problem

Imagine you discover this:

    Checkout request timed out.

    Payment provider shows:
    AUTHORIZED €99

    Our database shows:
    PAYMENT_FAILED

    Customer account shows:
    Order cancelled

Don't immediately write:

> **CRITICAL — PAYMENT BROKEN**

Nor:

> “Provider is buggy.”

A stronger report might say:

> During a simulated timeout after the provider processed the request, the provider recorded an €99 authorization while our payment record changed to FAILED and the order was cancelled. The customer could therefore believe the payment failed while funds are still reserved. I haven't yet confirmed whether our timeout handler retries with the same payment identifier. I think the main risk is inconsistent customer/payment state and possible duplicate authorization if the shopper retries.

Look at the structure:

    Observation

    ↓

    Evidence

    ↓

    What remains unknown

    ↓

    Customer/business consequence

    ↓

    Next useful investigation

Michael Bolton describes testing as socially challenging partly because testers challenge people's beliefs about how the product behaves. His recommendation is essentially to discover and communicate facts diligently rather than turning the situation into interpersonal conflict. [DevelopSense](https://developsense.com/blog/2023/03/testing-is-socially-challenging?utm_source=chatgpt.com)

That style makes developers want to investigate with you.

------------------------------------------------------------------------

# A developer says: “But this can happen only when the network drops at exactly the right moment”

Don't immediately argue.

Ask:

> **How often do payment requests happen?**

Imagine:

    1 payment per month

Then perhaps the risk is tiny.

But suppose:

    2 million payments per month

Even a rare timing window can matter.

Risk depends on things like:

    probability
    exposure
    impact
    detectability
    recoverability

A double charge may be rare.

Its consequences could still include:

    customer complaints
    refund processing
    chargebacks
    support cost
    lost trust
    payment-provider penalties
    accounting reconciliation

This is why James Bach's risk-focused material emphasizes telling a compelling **risk story** rather than pretending that risk is captured by a simplistic numeric severity label. [Satisfice](https://www.satisfice.com/rapid-software-testing-focused-risk?utm_source=chatgpt.com)

------------------------------------------------------------------------

# A practical payment testing model

When you work on a payment feature, don't begin with:

> “Which endpoint should I automate?”

Begin here:

### 1. Intent

What is the customer/business trying to accomplish?

    Pay for order 7421

### 2. Identity

How is that business intent uniquely represented?

    order ID
    payment ID
    idempotency key
    provider reference

### 3. State

What states can the payment enter?

    CREATED
    AUTHORIZED
    CAPTURED
    FAILED
    CANCELLED
    REFUNDED

### 4. Transitions

Which state changes are legal?

    AUTHORIZED → CAPTURED
    AUTHORIZED → CANCELLED

    CAPTURED → REFUNDED

### 5. Side effects

What else happens?

    order status
    inventory
    invoice
    email
    shipment
    accounting
    analytics

### 6. Failure points

Where can communication or processing fail?

    before provider
    inside provider
    after provider
    database
    event bus
    webhook
    downstream service

### 7. Retry behavior

Which operations can safely be repeated?

### 8. Reconciliation

How do we discover that two systems disagree?

That is already the skeleton of a serious payment test strategy.

------------------------------------------------------------------------

# What I would automate first

Suppose you join a team tomorrow and discover that payment tests currently contain only:

    Successful card
    Declined card

I would not immediately add 30 payment-method UI cases.

I would first investigate whether these business-critical scenarios are covered:

    timeout before known result

    same request retried with same idempotency key

    duplicate payment request with different key

    duplicate webhook

    delayed webhook

    provider success + local database failure

    authorization success + capture failure

    partial capture

    duplicate capture attempt

    refund after partial capture

Why?

Because these scenarios threaten **transaction integrity**.

If Visa works but the Mastercard logo is slightly misaligned, that's annoying.

If one customer can be charged twice, that's a different class of risk.

Testing effort should reflect that.

------------------------------------------------------------------------

# Today's challenge

Your shop receives an order:

    Order: #9501
    Amount: €120

Timeline:

    10:00:00
    Shop → POST /payments
    Idempotency-Key: K1

    10:00:02
    Payment provider authorizes €120.

    10:00:03
    Network connection breaks.

    10:00:05
    Shop records:
    PAYMENT_TIMEOUT

    10:00:06
    Backend retries:
    POST /payments
    Idempotency-Key: K2

    10:00:08
    Provider authorizes another €120.

    10:00:10
    First payment webhook arrives:
    AUTHORIZED €120

    10:00:11
    Second payment webhook arrives:
    AUTHORIZED €120

Customer now has:

    Authorization A: €120
    Authorization B: €120

Your task is **not** merely to say:

> “They should reuse K1.”

Think deeper.

Identify:

1.  **The technical defect.**

2.  **The business defect.**

3.  **Which system should prevent the duplicate.**

4.  **What data would let you correlate both authorizations to Order \#9501.**

5.  **What the customer should see while the first payment outcome is unknown.**

6.  **How monitoring could automatically detect that one order has multiple successful payment authorizations.**

Then design only **three experiments**.

Choose the three that would give you the most confidence that this entire class of defect cannot easily reach production.

That restriction is deliberate.

A good tester can generate 100 cases.

A strong tester can explain:

> **Why these three deserve to run first.**

And that is today's core lesson:

> **Payment testing is not primarily about entering credit-card numbers. It is about preserving transaction integrity when systems fail, retry, disagree, and recover.**

Once you begin thinking this way, you are no longer merely testing checkout.

You are testing a **distributed financial workflow**.

### Recommended reading

James Bach's short paper on risk and requirements is worth revisiting because payment requirements often describe the happy business rule while leaving failure semantics implicit. AWS's Builders' Library articles are excellent practitioner material for understanding why retries, timeouts, backoff and idempotency require deliberate design. Adyen's payment documentation is useful as a real-world payment domain reference rather than as something to memorize. [Adyen Docs+3Satisfice+3Amazon Web Services, Inc.+3](https://www.satisfice.com/download/risk-and-requirements-based-testing?utm_source=chatgpt.com)

[James Bach — Risk and Requirements-Based Testing](https://www.satisfice.com/download/risk-and-requirements-based-testing?utm_source=chatgpt.com)

[AWS Builders' Library — Timeouts, retries and backoff with jitter](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/?utm_source=chatgpt.com)

[AWS Builders' Library — Making retries safe with idempotent APIs](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/?utm_source=chatgpt.com)

[Adyen — API idempotency](https://docs.adyen.com/development-resources/api-idempotency?utm_source=chatgpt.com)

[Adyen — Payments lifecycle](https://docs.adyen.com/account/payments-lifecycle?utm_source=chatgpt.com)

[Adyen — Capturing payments](https://docs.adyen.com/online-payments/capture?utm_source=chatgpt.com)
