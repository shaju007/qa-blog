# QA Thinking — Day 8

## Marketplace Refunds: Follow the Money, Not the Status

Imagine you are testing a marketplace.

A customer buys a jacket for **€100** from a seller.

The marketplace keeps a 10% commission.

So conceptually:

    Customer pays                  €100
                                      ↓
    Marketplace commission          €10
    Seller receives                 €90

Everything works.

A week later, the customer returns the jacket.

Your refund API succeeds:

    POST /orders/8421/refund

    200 OK

The customer receives:

    €100 refunded

The UI shows:

    Order status: REFUNDED

Your automated test passes.

But somewhere else:

    Seller still has               €90
    Marketplace returned          €100

The marketplace has effectively lost **€90**.

The refund functionality worked perfectly from the customer's perspective.

The business transaction is completely wrong.

Today's lesson is:

> **In marketplace testing, don't test statuses in isolation. Model how money moves between all participants and check whether those movements remain consistent when things change.**

This is also a lesson in exploratory testing. Before writing dozens of refund test cases, we are going to build a model, identify risks, create a focused exploratory charter, investigate what the system actually does, and only then decide what deserves automation.

Rapid Software Testing emphasizes exactly this kind of product- and risk-focused approach: learn the product, focus deeper testing where potential risk matters, use lightweight heuristics, and be able to explain what your testing discovered. [DevelopSense+1](https://developsense.com/rst-approach?utm_source=chatgpt.com)

------------------------------------------------------------------------

## First understand what a marketplace actually is

In a normal online shop, the commercial relationship may be relatively simple:

    Customer
       ↓
    Shop

In a marketplace, you may have:

    Customer
       ↓
    Marketplace platform
       ↓
    Seller

Examples include platforms where independent merchants, restaurants, drivers, hosts, freelancers, or shops sell through one common platform.

The marketplace may handle:

    checkout
    payment processing
    commission
    seller balances
    refunds
    disputes
    payouts
    tax
    reporting

while the seller provides the actual product or service.

That creates a very different testing problem.

A transaction isn't simply:

    CUSTOMER_PAID = true

It has several financial relationships.

------------------------------------------------------------------------

# Learn these marketplace terms

A few terms matter a lot when testing marketplace systems.

| Term | Practical meaning |
|----|----|
| **Platform fee / commission** | Amount the marketplace keeps for facilitating the transaction |
| **Transfer** | Money moved from the platform/payment account to a seller's account |
| **Payout** | Money actually sent from a payment-provider balance to the seller's external bank account |
| **Refund** | Money returned to the customer |
| **Transfer reversal** | Money previously transferred to a seller is moved back toward the platform |
| **Dispute / chargeback** | Customer challenges a payment through their bank/payment provider |

The distinction between **transfer** and **payout** is especially important.

Stripe Connect, for example, defines a `Transfer` as movement of funds between Stripe accounts. A payout is a separate operation that moves funds toward an external bank account. [Stripe-Dokumentation+1](https://docs.stripe.com/api/transfers?lang=connect&utm_source=chatgpt.com)

So this:

    Marketplace
         ↓
    Seller Stripe balance

is not necessarily the same event as:

    Seller Stripe balance
         ↓
    Seller's bank account

That difference can become extremely important during refunds.

------------------------------------------------------------------------

# A refund is not necessarily the reverse of the original transaction

This is one of the most useful marketplace concepts for a tester to understand.

Suppose:

    Customer pays           €100
    Platform transfers       €90 → Seller
    Platform keeps           €10

Then:

    Customer refund         €100

It is tempting to imagine that the payment system automatically performs:

    Seller                  -€90
    Marketplace             -€10
    Customer               +€100

But systems do not necessarily behave that way.

With Stripe Connect's **separate charges and transfers** model, the customer's charge and the seller transfer are deliberately decoupled. Stripe's current documentation states that refunding the charge does **not** automatically affect associated transfers; the platform is responsible for reconciling that money, for example by reversing the transfer or reducing future transfers. [Stripe-Dokumentation+1](https://docs.stripe.com/connect/separate-charges-and-transfers?utm_source=chatgpt.com)

That one implementation detail produces an entire family of tests.

And this is exactly why domain knowledge matters.

If you didn't understand the marketplace payment model, you might happily automate:

    refund API → 200
    refund status → REFUNDED
    customer balance → correct

and completely miss the platform losing money.

------------------------------------------------------------------------

# Don't begin with test cases. Draw the money flow.

Whenever you're testing marketplace payments, refunds or commission, I recommend drawing something like this first:

                      CUSTOMER
                         |
                         | €100
                         v
                    MARKETPLACE
                     /       \
                €10 /         \ €90
                   v           v
             PLATFORM      SELLER
               FEE          BALANCE

Now apply the refund:

                      CUSTOMER
                         ^
                         | €100 refund
                         |
                    MARKETPLACE
                         ^
                         |
                         ?
                       SELLER

That question mark is where your testing begins.

Who funds the refund?

Does the seller return the money?

Does the marketplace absorb it?

Does it depend on the reason for the refund?

Can the seller's future earnings be reduced?

What if the seller has already been paid out?

What if the seller has no balance?

What if only part of the order is refunded?

Those aren't obscure edge cases.

They are fundamental **business rules**.

------------------------------------------------------------------------

# This is where a tester should ask “Who bears the loss?”

Suppose an order arrives damaged.

The customer receives a full refund.

Who should pay?

Possibilities include:

    Seller
    Marketplace
    Shipping provider
    Insurance provider
    Shared responsibility

Now suppose the seller shipped correctly, but the marketplace's courier lost the package.

Maybe the seller should still receive their money.

The same technical operation:

    REFUND CUSTOMER €100

can therefore require completely different downstream accounting depending on **why the refund exists**.

This is a beautiful example of why testing cannot be reduced to API status codes.

You need the business model.

------------------------------------------------------------------------

# Ask the Product Owner concrete questions, not “What should happen?”

A weak refinement question is:

> “How are refunds supposed to work?”

That's too broad.

A much stronger question is:

> “Customer paid €100, we already transferred €90 to the seller, and then the customer receives a full refund. Should we recover the €90 from the seller, or does the platform absorb it?”

Now everyone can reason about the same transaction.

Then change one variable:

> “What if the refund is because our delivery service lost the package?”

Another:

> “What if the seller has already withdrawn the €90 to their bank?”

Another:

> “What if only €40 of the order is refunded?”

You are doing testing before code execution.

You're testing the **business model for contradictions and ambiguity**.

This also improves collaboration. Instead of telling the PO:

> “Your requirement is incomplete.”

you're exposing a decision that needs to be made.

That is much easier for people to work with.

------------------------------------------------------------------------

# Partial refunds reveal hidden assumptions

Consider:

    Order total:       €100
    Marketplace fee:    10%
    Seller share:       90%

Customer receives a partial refund:

    €40

What should happen to the seller's money?

Perhaps proportional reversal:

    Customer refund:           €40
    Seller transfer reversal:  €36
    Platform fee returned:      €4

But maybe marketplace policy says:

> Commission is non-refundable.

Then perhaps:

    Customer refund:           €40
    Seller bears:              €40
    Platform keeps:            €10 overall

Or perhaps fees are calculated per item rather than proportionally.

The tester should **not invent the answer**.

The tester should expose the missing rule.

This is one reason boundary-value testing alone is not enough.

You can beautifully test:

    refund €39.99
    refund €40.00
    refund €40.01

while still having no idea whether the accounting rule itself is correct.

------------------------------------------------------------------------

# Multi-seller orders make the problem much more interesting

Now imagine a marketplace order contains products from two sellers.

    Seller A products          €60
    Seller B products          €40
    ------------------------------
    Customer total            €100

Marketplace commission is 10%.

So:

    Seller A gets              €54
    Seller B gets              €36
    Marketplace keeps          €10

The customer returns only Seller A's item.

Refund:

    €60

What should happen?

A plausible model might be:

    Seller A reversal          €54
    Marketplace fee reversal    €6
    Seller B                    €0 change
    Customer                  +€60

But now suppose the customer's order also contained:

    €6 shipping fee

Was the shipping fee refunded?

Was it originally split across sellers?

Was shipping paid to the seller, logistics provider, or marketplace?

Suppose a voucher reduced the order from €100 to €80.

Which seller absorbed the voucher?

Suddenly “refund €60 item” is not simple.

This is where domain knowledge starts turning into testing skill.

------------------------------------------------------------------------

# Look for financial invariants

Instead of immediately writing 100 scenarios, think about rules that should remain true.

An **invariant** is something that should remain valid across many different flows.

For example:

> A customer should never receive more total refund than the amount the business rules allow for that transaction.

Another:

> A seller should not have the same transfer reversed twice.

Another:

> Every seller-facing financial adjustment should be traceable back to an order, refund, dispute or explicit correction.

Another:

> A full refund must leave the platform's financial records in a state that can be reconciled with customer and seller records.

Notice that these rules don't depend on which button the user clicked.

That's useful.

They can be checked across:

    UI flows
    API tests
    integration tests
    database queries
    event streams
    production monitoring

This is much stronger than an assertion like:

    expect(refund.status).toBe("succeeded");

A successful refund status proves one operation completed.

It doesn't prove the marketplace ended in a financially correct state.

------------------------------------------------------------------------

# Exploratory testing is perfect for this kind of feature

Marketplace refunds often have too many interacting rules for you to understand the whole system from requirements alone.

This is where exploratory testing becomes powerful.

James and Jon Bach's Session-Based Test Management approach uses four central elements:

**a charter, a time box, a reviewable result, and a debrief.** A charter is a short mission that guides investigation without prescribing every step. [Satisfice+1](https://www.satisfice.com/download/session-based-test-management?utm_source=chatgpt.com)

Ministry of Testing's recent 2026 discussions on charters make the same practical point: structured charters can sharpen exploration, align people around purpose, and make quality work more visible without turning exploration into rigid scripts. [Ministry of Testing+1](https://www.ministryoftesting.com/media-sessions/roundtable-exploring-quality-with-templates-and-charters?utm_source=chatgpt.com)

For this marketplace feature, I might use:

> **Explore partial and full refunds after seller transfer to discover ways customer, marketplace, and seller balances can become inconsistent.**

That's a good charter.

Notice what it does **not** say:

    1. Create order
    2. Click refund
    3. Enter 50
    4. Click submit
    5. Check status

The charter gives you a mission.

Your observations guide what you investigate next.

------------------------------------------------------------------------

# A 60-minute marketplace refund session

Suppose I had one hour.

I might begin with the simplest transaction:

    Customer €100
    Seller €90
    Marketplace €10

Then perform:

    full refund

I would inspect more than the UI.

I would look at:

    order API
    payment provider
    seller balance
    transfer records
    refund record
    platform ledger
    events/messages

If everything works, I might change one thing:

    partial refund

Then:

    second partial refund

Then:

    refund after seller payout

Then perhaps:

    retry the refund request

The next experiment depends on what I learn.

That's exploration.

James Bach describes exploratory testing as active investigation rather than mere execution of prepared artifacts; his more recent Thread-Based Test Management discussion similarly argues that testing is fundamentally an activity of exploration rather than simply producing and executing test-case documents. [Satisfice+1](https://www.satisfice.com/blog/archives/5214?utm_source=chatgpt.com)

------------------------------------------------------------------------

# Don't confuse exploratory testing with random clicking

A lot of people hear:

> “No predetermined test cases.”

and interpret that as:

> “Do whatever.”

That's not skilled exploratory testing.

Your session has:

    mission
    risk
    model
    observations
    questions
    notes
    experiments

You continuously ask:

> What did this result teach me?

and:

> What should I try next because of what I just learned?

For example:

You refund €50.

You notice:

    Customer refund              €50
    Seller transfer reversal     €45

Good.

Then you ask:

> What happened to the marketplace's €5 commission?

You inspect another ledger.

You discover:

    Platform still retains €10

Now your next experiment might be:

    full refund

because you want to see whether the commission remains even when the entire transaction is reversed.

The previous observation designed the next test.

That's exploratory thinking.

------------------------------------------------------------------------

# Time is another test dimension

Marketplace money flows often happen at different moments.

Consider:

    T0   Customer pays

    T1   Order confirmed

    T2   Seller transfer created

    T3   Seller balance becomes available

    T4   Seller payout sent to bank

    T5   Customer requests refund

Testing a refund at `T1` may behave very differently from a refund at `T4`.

So don't model only:

    refund amount

Model:

    refund timing

For example:

    refund before transfer
    refund after transfer
    refund after seller payout
    refund after partial payout
    refund during transfer processing

A feature may work perfectly in one state and fail in the transition between states.

We've seen this principle repeatedly in this series.

Sports:

    goal → corrected goal

Payments:

    authorization → capture

SaaS permissions:

    admin → viewer

Marketplace:

    seller funded → seller paid out → refund

**Transitions are often more interesting than stable states.**

------------------------------------------------------------------------

# Now introduce failures

Suppose refund flow is:

    1. Refund customer
    2. Reverse seller transfer
    3. Update order
    4. Send email

Step 1 succeeds.

Step 2 fails.

What now?

Customer has their money.

Seller still has theirs.

Marketplace carries the loss.

Does the system mark the entire operation:

    FAILED

That would also be misleading, because the customer refund actually succeeded.

Maybe you need states such as:

    CUSTOMER_REFUNDED
    SELLER_RECOVERY_PENDING
    RECONCILIATION_REQUIRED

This is why failure testing can reveal domain-model problems.

Sometimes a feature is hard to test because the product's state model is too simplistic.

That's valuable information.

------------------------------------------------------------------------

# A transfer reversal can itself fail

Real systems make this concrete.

Stripe's Connect documentation says transfer reversals can be full or partial, but recovery depends on the connected account's available balance or configured reserves. [Stripe-Dokumentation+1](https://docs.stripe.com/api/transfer_reversals?api-version=2026-07-29.preview&utm_source=chatgpt.com)

So imagine:

    Seller received            €90
    Seller paid out            €80
    Seller available balance   €10

Marketplace now wants:

    reverse €90

What happens?

That isn't simply a Stripe API question.

It's a **product policy question**.

Perhaps:

    recover €10 now
    record €80 seller debt
    deduct from future sales

Maybe seller accounts can go negative.

Maybe the marketplace absorbs the loss.

Maybe a reserve prevented the seller from withdrawing everything.

Those business decisions should create tests.

------------------------------------------------------------------------

# This is where stakeholder management becomes QA work

A developer may not know the correct answer.

The Product Owner may not know either.

Finance might.

Operations might.

Legal might.

Payments specialists might.

So the QA engineer's job can become:

> “We have a case where the customer refund succeeds after the seller has already withdrawn the funds. What is the intended ownership of that loss, and how should the platform represent it?”

That is excellent stakeholder communication.

You identified:

    specific scenario
    financial consequence
    missing business decision

instead of saying:

> “Requirements unclear.”

QA can sometimes function as the person who discovers that **different parts of the business have different assumptions about the same workflow**.

That's extremely valuable.

------------------------------------------------------------------------

# Reconciliation should be part of your test strategy

Suppose yesterday your system processed:

    Customer charges           €1,000,000
    Customer refunds             €80,000
    Seller transfers            €820,000
    Transfer reversals           €65,000
    Platform commission          ...

How would anyone know if €15,000 of expected seller recovery never happened?

You need reconciliation.

Stripe's own bank reconciliation tooling is based on exactly this general idea: connect transaction activity, payouts and bank deposits so discrepancies can be identified rather than assuming that individually successful operations add up correctly. [Stripe-Dokumentation](https://docs.stripe.com/bank-reconciliation?utm_source=chatgpt.com)

For your marketplace, useful reconciliation dimensions might include:

    order
    payment
    refund
    seller transfer
    transfer reversal
    platform fee
    seller payout

Then you can ask:

> For every refund, is the corresponding financial responsibility accounted for somewhere?

That's much more powerful than monitoring:

    refund-api 99.99% uptime

Your services can be perfectly available while the accounting is wrong.

------------------------------------------------------------------------

# Observability should include business inconsistencies

Imagine Grafana says:

    CPU healthy
    Memory healthy
    HTTP 5xx low
    Database healthy
    Queues healthy

Meanwhile:

    500 refunds yesterday
    472 seller reversals

That may be legitimate.

Or it may mean 28 marketplace losses.

Your observability should make that difference explainable.

Useful domain signals could include things like:

    refunds without seller reconciliation
    duplicate transfer reversals
    seller recovery pending > 24h
    refund amount > recoverable amount
    orders with mismatched financial states

The strongest production monitoring often comes from the same invariants you discovered while testing.

So exploratory testing feeds observability.

Testing is not merely pre-production activity.

------------------------------------------------------------------------

# Automation should come after learning

Suppose your exploratory sessions reveal the important model.

Then automation becomes much easier to prioritize.

I would automate core money-integrity scenarios mostly at API/integration level:

    full refund before transfer
    full refund after transfer
    partial refund
    two partial refunds
    multi-seller partial refund
    duplicate refund request
    seller recovery failure

Then keep perhaps one or two representative UI flows to confirm that customers and sellers see the correct information.

You probably do **not** need every financial combination driven through Playwright.

Rapid Software Testing explicitly recommends using tools and automated checking where they help, while keeping tools subordinate to the testing mission rather than treating automation as the centre of testing. [DevelopSense+1](https://developsense.com/rst-approach?utm_source=chatgpt.com)

The order should usually be:

    Understand
       ↓
    Model
       ↓
    Explore
       ↓
    Find important risks
       ↓
    Learn expected behavior
       ↓
    Automate stable, valuable checks

not:

    Open Playwright
       ↓
    What can I automate?

------------------------------------------------------------------------

# Your testing notes matter

During exploratory testing, write down more than pass/fail.

For example:

    14:05
    Created €100 order.
    Seller transfer = €90.

    14:09
    Full refund succeeded.
    Customer = +€100.

    14:11
    Seller transfer still €90.
    No reversal visible.

    QUESTION:
    Is seller recovery asynchronous?

    14:14
    Checked events.
    refund.completed exists.
    No transfer_reversal event.

    RISK:
    Platform appears to fund entire refund.
    Need confirmation from payments team.

That's incredibly useful.

When you debrief with the developer or PO, you're not saying:

> “Something seems weird.”

You have a short investigation story.

Session-Based Test Management treats the result of exploration as something reviewable and debriefable, not something that exists only in the tester's head. [DevelopSense+1](https://www.developsense.com/presentations/2007-10-PNSQC-AnExploratoryTestersNotebook.pdf?utm_source=chatgpt.com)

That is how exploratory testing becomes credible inside a professional team.

------------------------------------------------------------------------

# The soft-skill lesson: distinguish observation from policy

Suppose you discover:

    Customer refund: €100
    Seller reversal: €0

Don't immediately write:

> “BUG: seller reversal missing.”

Maybe the product intentionally lets the seller keep the money in certain scenarios.

Your observation is:

> The customer was refunded €100 and no seller transfer reversal occurred.

Your question is:

> Is this consistent with the intended refund-liability policy?

Your risk assessment might be:

> If the seller should fund this type of refund, the marketplace currently absorbs €90.

That is much stronger.

You're separating:

    fact
    interpretation
    business rule
    risk

This pattern should become habitual in your testing.

It improves both technical analysis and communication.

------------------------------------------------------------------------

# A reusable marketplace test model

For any marketplace money-related feature, walk mentally through:

    CUSTOMER
    What did the buyer pay or receive?

    ORDER
    What is the commercial state?

    PLATFORM
    What money did the marketplace keep or return?

    SELLER
    What money was credited, removed or owed?

    PAYMENT PROVIDER
    What actually happened financially?

    TIMING
    At which lifecycle stage did this happen?

    FAILURE
    What if only half the workflow succeeds?

    RETRY
    What happens if the action occurs twice?

    RECONCILIATION
    How will we discover disagreement later?

That is already a strong skeleton for testing:

    refunds
    cancellations
    commissions
    seller payouts
    disputes
    chargebacks
    promotions
    multi-seller orders

------------------------------------------------------------------------

# Today's challenge

You're testing a marketplace.

A customer buys:

    Seller A item              €60
    Seller B item              €40
    ------------------------------
    Total                     €100

Marketplace commission:

    10%

So initially:

    Seller A transfer          €54
    Seller B transfer          €36
    Marketplace commission     €10

Seller A has already withdrawn most of their money.

Later, the customer returns **Seller A's €60 item**.

The marketplace refunds:

    €60

Now investigate.

Don't jump directly into test cases.

Ask yourself what you need to know.

Should Seller A return €54?

Should the marketplace return its €6 commission associated with Seller A's item?

What happens if Seller A has only €20 left in their marketplace balance?

Should Seller B be affected at all?

What happens if the transfer reversal fails after the customer refund succeeds?

What does the seller dashboard show?

What does finance see?

What happens if the refund request is retried?

Then create **one exploratory testing charter**, not twenty scripted tests.

For example:

> **Explore refunds of already-paid multi-seller orders to discover ways customer refunds, seller recovery and platform commission can become financially inconsistent.**

Give yourself about an hour.

Keep notes.

Follow interesting observations.

At the end, report three things:

**what you learned about the product, what risks remain, and what you think should be investigated next.**

That is the real exercise.

The important skill today isn't memorizing Stripe terminology.

It is learning to look at a marketplace and think:

> **Where did the money come from, where did it go, who owns it now, and what must happen when the business event changes?**

Once you start thinking that way, a refund is no longer a button or endpoint.

It becomes a distributed business transaction.

And that is the level at which a strong quality engineer should test it.

### Recommended reading

James and Jon Bach's Session-Based Test Management paper is worth studying because it shows how exploratory testing can remain focused, reviewable and manageable without turning into rigid scripted execution. Ministry of Testing's charter material is useful for seeing how practitioners apply that structure today. For the domain side, Stripe's Connect documentation is a good real-world example of why marketplace refunds, transfers and seller balances must be understood as separate financial operations. [Satisfice+2Ministry of Testing+2](https://www.satisfice.com/download/session-based-test-management?utm_source=chatgpt.com)

[James Bach and Jon Bach — Session-Based Test Management](https://www.satisfice.com/download/session-based-test-management?utm_source=chatgpt.com)

[Rapid Software Testing — The RST Approach](https://developsense.com/rst-approach?utm_source=chatgpt.com)

[Ministry of Testing — Exploring Quality with Templates and Charters](https://www.ministryoftesting.com/media-sessions/roundtable-exploring-quality-with-templates-and-charters?utm_source=chatgpt.com)

[Stripe — Separate Charges and Transfers](https://docs.stripe.com/connect/separate-charges-and-transfers?utm_source=chatgpt.com)

[Stripe — Marketplace Refunds and Disputes](https://docs.stripe.com/connect/marketplace/tasks/refunds-disputes?utm_source=chatgpt.com)
