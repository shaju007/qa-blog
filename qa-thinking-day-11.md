# QA Thinking — Day 11

## Feature Flags Change What “the Version” Means

Imagine your e-commerce team has built a new promotion engine.

The old engine calculates discounts like this:

    Cart
      ↓
    Old promotion service
      ↓
    Final price

The new engine supports more advanced rules:

    Buy 3 get 20% off
    Category discounts
    Customer-segment pricing
    Voucher stacking rules
    Country-specific campaigns

The developers deploy the new code to production, but keep it behind a feature flag:

    new-promotion-engine = OFF

Everyone feels safe.

The Product Owner says:

> “It is deployed, but nobody is using it yet.”

QA tested the new engine in staging.

CI is green.

Tomorrow the team plans to enable it for 5% of customers.

This looks like a good release strategy.

But the important testing question is not:

> “Does the feature work when the flag is ON?”

It is:

> **What different states can this system now enter, and what risks appear when it moves between them?**

Feature flags change the meaning of a software release. Once flags exist, the code deployed to production is no longer necessarily the behavior every user receives.

A useful model becomes:

    DEPLOYMENT
          ≠
    RELEASE
          ≠
    EXPOSURE

The code may be deployed today, exposed to your QA account today, released to 5% tomorrow, increased to 50% next week, and disabled again five minutes later.

Ministry of Testing's April 2026 practitioner article on feature flags describes exactly this change: once flags entered the author's system, behavior stopped being binary and became conditional on flag state, user group, partial rollout, and interaction with other flags. Tests passing under one configuration no longer guaranteed the behavior of another.

That makes feature flags a very good subject for learning **test strategy, testability, observability, risk analysis, collaboration, and production testing** at the same time.

------------------------------------------------------------------------

## A feature flag is not simply ON or OFF

At first glance, this looks binary:

    OFF → old behavior
    ON  → new behavior

But production may actually look like this:

    Code deployed
         |
         +→ Flag OFF for normal users
         |
         +→ Flag ON for QA users
         |
         +→ Flag ON for employees
         |
         +→ Flag ON for 5% of customers
         |
         +→ Flag ON for customers in Germany
         |
         +→ Flag ON for Premium tenants only
         |
         +→ Fallback value if flag evaluation fails

LaunchDarkly's current documentation describes flags as contextual decisions: the application supplies information about a user or organization, targeting rules determine which variation that context receives, and different customers can therefore receive different behavior from the same deployed artifact.

That changes your testing question.

Instead of:

> “Which version are we testing?”

you may need to ask:

> **“Which deployed code, flag configuration, user context, data state, and rollout stage are we testing?”**

That's much closer to the real system.

------------------------------------------------------------------------

# The most dangerous assumption: OFF means inactive

Suppose the flag is:

    new-promotion-engine = OFF

The UI still uses the old pricing engine.

You might conclude that the new feature cannot affect customers.

But imagine the implementation looks like:

    Cart change
           ↓
    Old pricing engine → shown to customer

           +
           ↓

    New promotion worker
           ↓
    Processes cart in background
           ↓
    Writes promotion metadata

The new output isn't shown.

But new code is still running.

The Ministry of Testing practitioner article describes a real case where testing behind a disabled flag looked safe, but a background process associated with the feature was still active. The problem became visible only when the flag was enabled. The team's mistaken assumption was effectively:

    disabled = inactive

when the architecture didn't actually guarantee that.

That is a very important testing lesson.

When someone tells you:

> “Don't worry, the feature is off.”

ask:

> **“What exactly becomes inactive when the feature is off?”**

The answer might be:

    UI only

or:

    UI + API route

or:

    entire business workflow

Those are very different systems.

------------------------------------------------------------------------

# Test the flag boundary, not only the feature

Suppose you test:

    Flag OFF
    Old engine gives €80
    ✓

    Flag ON
    New engine gives €80
    ✓

Good.

Now consider the transition:

    Customer starts checkout
    Flag OFF
           ↓
    Cart calculated by old engine
           ↓
    Product Owner changes rollout
           ↓
    Flag becomes ON
           ↓
    Customer changes quantity
           ↓
    Cart recalculated by new engine

What happens?

Perhaps the old engine stored:

    {
      "discount": 20
    }

while the new engine stores:

    {
      "promotion": {
        "campaignId": 789,
        "discountLines": [...]
      }
    }

Can the cart survive switching engines halfway through its lifetime?

Stable states might both work:

    OFF → works
    ON  → works

while the transition:

    OFF → ON

fails.

The same applies to rollback:

    ON → OFF

That rollback path can be even more important.

------------------------------------------------------------------------

# A kill switch is useful only if turning it off is safe

Teams often say:

> “If anything goes wrong, we'll just disable the flag.”

That sounds excellent.

But let's test that assumption.

Imagine the new promotion engine has already processed 20,000 carts.

It wrote new promotion records:

    promotion_v2

The old system knows only:

    promotion_v1

Now monitoring shows elevated checkout errors.

Operations switches:

    new-promotion-engine = OFF

The old code becomes active again.

What happens when it encounters carts written by the new engine?

Perhaps:

    500 Internal Server Error

Your emergency rollback mechanism has just created another incident.

This is why I would explicitly test:

    old → new
    new → old

using data created on both sides of the transition.

Feature flags give teams operational control, including rapid disabling and gradual rollout, but that control is valuable only when both the forward and fallback paths are actually viable. Martin Fowler's feature-toggle guidance has long emphasized keeping fallback behavior viable and testing the production configuration as well as the intended upcoming configuration.

------------------------------------------------------------------------

# Don't test every combination of every flag

Now imagine your application has:

    Flag A
    Flag B
    Flag C
    Flag D
    Flag E
    ...

With ten Boolean flags:

    2¹⁰ = 1024 configurations

Twenty flags:

    2²⁰ = 1,048,576 configurations

Trying to exhaustively test them is hopeless.

Fortunately, exhaustive testing is usually unnecessary.

Fowler's feature-toggle guidance recommends focusing on configurations that matter, particularly the current production configuration, the configuration intended for the next release, and useful fallback configurations rather than blindly enumerating every combination.

LaunchDarkly's current testing guide makes the same practical point. It recommends prioritizing the current production state, upcoming intended state, and fallback values rather than falling into a combinatorial-explosion mindset.

This is where testing judgment matters.

Suppose you have:

    new-checkout
    new-search
    new-recommendations
    new-promotion-engine

You probably don't need all sixteen combinations.

But if:

    new-checkout

and:

    new-promotion-engine

both modify how the final price is calculated, their interaction is interesting.

Meanwhile:

    new-search

may have no meaningful interaction with either.

So instead of asking:

> “How many flag combinations exist?”

ask:

> **“Which flags influence the same business state or downstream system?”**

That gives you a much better basis for selecting combinations.

------------------------------------------------------------------------

# Use domain knowledge to identify interacting flags

Consider this e-commerce configuration:

    Flag A: new voucher engine
    Flag B: new tax engine
    Flag C: new shipping engine

At first these look like separate features.

But checkout total might be calculated as:

    Product subtotal
          ↓
    Voucher
          ↓
    Taxable amount
          ↓
    Tax
          ↓
    Shipping eligibility
          ↓
    Final total

Now the flags clearly interact.

A defect in:

    voucher × tax

may produce the wrong VAT.

A defect in:

    voucher × shipping

may grant free shipping incorrectly.

A defect in:

    tax × shipping

may affect countries where shipping itself is taxable.

Flag interaction is therefore not primarily a mathematical question.

It is a **business-rule interaction question**.

Understanding the domain helps you select the combinations that deserve attention.

------------------------------------------------------------------------

# Feature flags improve testability — when testers can control them

Michael Bolton describes testability partly in terms of **observability and controllability**: to test effectively, testers need ways to reach meaningful states, control relevant conditions, and observe what the product actually does.

Feature flags can provide excellent controllability.

Imagine that instead of deploying a separate build, you can say:

    QA-user-123
    → new engine ON

    everyone else
    → new engine OFF

Now you can test production infrastructure without exposing the feature to normal customers.

LaunchDarkly's current testing guidance explicitly describes targeted production testing as one use of flags: teams can expose a feature to designated test contexts before increasing rollout to ordinary users.

That can dramatically shorten feedback loops.

But there's an important requirement:

> **QA needs to know which variation they are actually receiving.**

Imagine the screen looks wrong.

You ask:

> “Am I on the new checkout?”

Nobody knows.

Now you must inspect:

    browser storage
    cookies
    logs
    flag dashboard
    network calls

That's poor testability.

A much better system might expose diagnostic information such as:

    User: QA-742
    checkout-v2: ON
    pricing-engine-v2: OFF
    shipping-v3: ON

perhaps in an internal debug panel or structured logs.

That small feature can save enormous testing time.

A tester should therefore sometimes request **testability features**, not simply test product features.

James Bach's updated *Heuristics of Software Testability* explicitly treats testability as something that can be analyzed and improved, not merely accepted as a fixed property of the product.

------------------------------------------------------------------------

# Progressive rollout is a testing opportunity

Suppose you've tested the new promotion engine.

Instead of:

    0% → 100%

the team plans:

    QA users
        ↓
    1%
        ↓
    5%
        ↓
    25%
        ↓
    50%
        ↓
    100%

That is not merely a release mechanism.

It can be part of your testing strategy.

At 1%, you might learn whether production data contains promotion combinations your test environment never contained.

At 5%, you might discover country-specific rules.

At 25%, you might begin seeing meaningful load effects.

At 50%, you might expose interactions with unusual customer segments.

Current feature-flag platforms explicitly support progressive and guarded rollouts; LaunchDarkly, for example, can increase exposure gradually while monitoring selected metrics for regressions.

The important principle isn't the vendor.

It is this:

> **Exposure can be increased as evidence increases.**

That is a risk-management strategy.

------------------------------------------------------------------------

# But “no errors” is not enough evidence

Imagine the 5% rollout starts.

Monitoring shows:

    HTTP 5xx      unchanged
    CPU           unchanged
    Memory        unchanged
    Latency       unchanged

Looks safe.

But then:

    Average discount before rollout:  €7.80
    Average discount new variation:   €13.90

Is that correct?

Maybe.

Perhaps the new engine intentionally gives better promotions.

Or perhaps it is stacking vouchers incorrectly.

Technical health alone doesn't tell you whether the **business behavior** is correct.

For our promotion-engine rollout, useful signals might include:

    pricing calculation errors
    checkout failures
    voucher rejection rate
    average discount amount
    free-shipping rate
    order conversion
    orders with negative totals
    orders where UI total ≠ payment total

LaunchDarkly's current feature-monitoring tooling illustrates the broader principle by correlating flag variations with errors, logs, traces, and sessions so teams can compare health between variations.

For a quality engineer, I would add:

> **Which domain metrics tell us the feature is behaving sensibly?**

because technical observability and business observability answer different questions.

------------------------------------------------------------------------

# Use the flag itself as an observability dimension

Imagine an error dashboard says:

    Checkout error rate: 2.1%

That's interesting.

Now separate by variation:

    old-promotion-engine:
    0.3%

    new-promotion-engine:
    7.8%

That's much more useful.

Or imagine global latency appears normal:

    Checkout p95 = 700 ms

but:

    flag OFF → p95 430 ms
    flag ON  → p95 1.8 sec

Without the flag dimension, the 5% rollout may be diluted inside the 95% healthy population.

This is an important observability principle:

> **When behavior differs by configuration, telemetry should let you distinguish those configurations.**

Otherwise gradual rollout can hide the very regression it is supposed to limit.

------------------------------------------------------------------------

# Shadow testing can reduce rollout risk further

Suppose the old pricing engine is trusted.

Instead of immediately letting the new engine determine customer prices, you can sometimes run:

    Incoming cart
         |
         +→ OLD ENGINE → customer receives this result
         |
         +→ NEW ENGINE → result recorded only for comparison

Now you can compare:

    old total = €78
    new total = €78
    ✓

or:

    old total = €78
    new total = €68
    ?

Ministry of Testing describes this pattern as **shadow testing**: a new implementation receives real traffic or data alongside the live implementation, but its output isn't allowed to affect the real customer. This makes old/new comparisons possible under production-like conditions.

This can be extremely powerful for:

    pricing engines
    recommendation systems
    fraud detection
    tax calculation
    search algorithms
    ad-ranking systems
    sports-data processing

But there is a trap.

------------------------------------------------------------------------

# Shadow mode must not create real side effects

Imagine the new promotion engine does:

    Calculate voucher
          ↓
    Mark voucher as redeemed

Running it in shadow mode could cause:

    OLD engine
    → redeems voucher

    NEW shadow engine
    → also redeems voucher

Now a test mechanism has changed production state.

The same concern exists with payment systems.

You can safely shadow:

    fraud score calculation

perhaps.

You cannot blindly shadow:

    capture payment

because two executions could charge the customer twice.

Whenever someone proposes shadow testing, ask:

> **“Is this operation pure computation, or does it create side effects?”**

That one question can prevent serious incidents.

------------------------------------------------------------------------

# Rollout percentage itself deserves testing

Suppose:

    5% rollout

Does this mean every request has a 5% random chance of receiving the feature?

That could produce this customer experience:

    Page 1 → old checkout
    Page 2 → new checkout
    Page 3 → old checkout

Probably undesirable.

Usually you want a stable assignment based on something like:

    customer ID
    tenant ID
    device ID

so the same person receives a consistent experience.

Now SaaS makes this more interesting.

Imagine a B2B platform.

A tenant has 100 employees.

Do you roll out:

    5% of individual users

or:

    5% of tenant organizations

If permissions, workflows or shared data differ between versions, putting half an organization on the new feature and half on the old feature may create confusion or incompatible data.

That is a product decision, not merely an implementation detail.

A good tester might raise it during refinement:

> “Should rollout stickiness be per user or per organization? If two users from the same customer account work on the same order while receiving different versions, can they produce conflicting state?”

That's a high-value QA question.

------------------------------------------------------------------------

# Fallback behavior deserves explicit testing

Suppose your application asks the flag system:

    Should checkout-v2 be enabled?

But the flag service is unavailable.

What happens?

Maybe:

    timeout

Maybe:

    false

Maybe:

    cached value

Maybe:

    last known configuration

Maybe:

    application fails

LaunchDarkly's current testing guide specifically recommends testing the **fallback value** used when flag evaluation cannot complete normally.

That deserves attention because feature flags are supposed to reduce release risk.

If losing the flag service can disable checkout entirely, the control mechanism has become another critical dependency.

For each important flag, I want to understand:

    What is the fallback?

    Why is that fallback safe?

    How long can cached configuration live?

    What happens during recovery?

------------------------------------------------------------------------

# A tester should participate in rollout design

Imagine the PO says:

> “We'll release to 10% tomorrow.”

A tester could simply say:

> “Okay.”

A stronger quality engineer might ask:

> “What would make us increase from 10% to 50%, and what would make us stop?”

That question forces the team to define evidence **before** seeing the results.

For example:

    Continue rollout if:

    checkout error rate remains within baseline
    pricing mismatches remain zero
    p95 latency does not materially regress
    no unexplained increase in support contacts

And perhaps:

    Stop rollout if:

    payment/cart totals diverge
    error rate exceeds agreed threshold
    new-engine latency materially exceeds old
    unexpected voucher stacking appears

Without pre-agreed criteria, rollout discussions easily become:

Developer:

> “Looks fine.”

Tester:

> “I'm still worried.”

Product:

> “Can we just ship?”

Now the decision is largely emotional.

With agreed signals, the discussion becomes evidence-based.

That is QA influence without authority.

You don't decide whether 50% goes live.

You help the team define **what information should drive that decision**.

------------------------------------------------------------------------

# Don't say “I am not comfortable releasing this”

Sometimes that is useful shorthand inside a trusted team.

But it is weak as the entire argument.

Try:

> “At 10% rollout we've seen six pricing mismatches from 1,400 new-engine checkouts, while none appeared in the control group. Four involve stacked vouchers. I don't yet understand whether the mismatch is display-only or reaches payment. I recommend holding at 10% while we trace those orders.”

Now your position is understandable.

It contains:

    observation
    comparison
    scope
    uncertainty
    risk
    proposed action

That is much more persuasive than:

> “QA says no.”

Good testers influence releases through evidence, not authority.

------------------------------------------------------------------------

# Feature flags can become technical debt

Feature flags are very useful when temporary.

They become dangerous when nobody remembers why they exist.

Imagine code like:

    if (flagA) {
      if (!flagB && flagC) {
         ...
      }
    }

Three years later:

    Who owns flagA?
    Unknown.

    Can flagB still be OFF?
    Nobody knows.

    Is flagC used by anyone?
    Maybe.

Now every change requires reasoning about historical paths.

Fowler's guidance recommends retiring release flags once they have served their purpose because accumulated toggles increase complexity.

The 2026 Ministry of Testing practitioner article reports the same lesson from experience: persistent flags expanded the test surface and became technical debt, leading the team to introduce ownership and deprecation tracking.

So feature-flag lifecycle itself becomes a quality concern:

    create
      ↓
    test
      ↓
    roll out
      ↓
    100%
      ↓
    stabilize
      ↓
    remove flag
      ↓
    remove dead path

Removing the flag matters.

Otherwise you're permanently paying complexity for a rollout that ended months ago.

------------------------------------------------------------------------

# The test strategy I would use

For an important flagged feature, I would reason about six distinct situations:

    CURRENT
    What does production do with the flag OFF?

    NEW
    Does the intended feature work ON?

    TARGETING
    Do the right users/tenants receive it?

    TRANSITION
    What happens OFF → ON and ON → OFF?

    FAILURE
    What happens if flag evaluation fails?

    ROLLOUT
    Can we observe correctness and risk as exposure increases?

I would then ask whether the feature leaves lasting state.

If the answer is **yes**, I become especially interested in rollback compatibility.

Consider:

    pricing calculation

Perhaps mostly ephemeral.

But:

    new order schema
    new account permissions
    database migration
    payment state

can survive long after the flag changes.

Those require deeper transition testing.

------------------------------------------------------------------------

# Today's challenge

Your team introduces:

    Flag:
    checkout-v2

The rollout plan is:

    QA accounts
        ↓
    5%
        ↓
    25%
        ↓
    100%

The new checkout introduces:

    new address form
    new shipping selection
    new promotion calculation

and writes a new field to orders:

    {
      "checkoutVersion": 2
    }

The team says:

> “Don't worry. If anything goes wrong we'll turn the flag off.”

Your job is not to create 50 test cases.

Design **four experiments** that would give you the strongest evidence about whether the flag is genuinely a safe rollback mechanism.

At least one experiment should test:

    OFF → ON

one should test:

    ON → OFF

and one should involve an order or cart created while V2 was active and then accessed after V2 has been disabled.

For the fourth, choose the risk you consider most important.

Maybe it is:

    flag service unavailable

Maybe:

    same customer assigned inconsistently

Maybe:

    new promotion × old checkout

Maybe:

    background side effects while flag OFF

But don't merely state the experiment.

For each one, answer:

> **What failure would this experiment reveal that a simple “flag ON / feature works” test would miss?**

That is the skill I want you to practice.

Because today's deeper lesson isn't really about feature flags.

It is this:

> **Whenever software can change behavior without changing the deployed code, configuration becomes part of the product state—and therefore part of your test strategy.**

A weak tester sees:

    Feature OFF
    Feature ON

A stronger tester sees:

    targeting
    transitions
    fallback
    side effects
    persistent data
    rollback
    observability
    flag interaction
    rollout criteria
    cleanup

And a quality engineer asks one step further:

> **“How will we know, with evidence, that it is safe to expose this behavior to more people?”**

That question connects testing, observability, product risk, deployment strategy, and collaboration.

That is quality engineering.

### Recommended reading

James Bach's updated *Heuristics of Software Testability* is useful for thinking about how products can be made easier to control and observe during testing. The April 2026 Ministry of Testing feature-flag article is particularly valuable because it is not theoretical—it describes what changed in a real testing strategy when conditional behavior, invisible background processing and stale flags entered the system. Fowler's feature-toggle article remains useful for flag lifecycle and configuration strategy, while LaunchDarkly's current testing and monitoring documentation provides concrete examples of targeted testing, fallback states and variation-aware observability.

[James Bach — Heuristics of Software Testability](https://www.satisfice.com/download/heuristics-of-software-testability?utm_source=chatgpt.com)

[Ministry of Testing — Testing with feature flags: what we expected and what actually happened](https://www.ministryoftesting.com/insights/testing-with-feature-flags-what-we-expected-and-what-actually-happened?utm_source=chatgpt.com)

[Ministry of Testing — Shadow Testing](https://www.ministryoftesting.com/software-testing-glossary/shadow-testing?utm_source=chatgpt.com)

[Martin Fowler — Feature Toggles](https://martinfowler.com/articles/feature-toggles.html?utm_source=chatgpt.com)

[LaunchDarkly — Testing code that uses feature flags](https://launchdarkly.com/docs/guides/flags/testing-code?utm_source=chatgpt.com)

[LaunchDarkly — Feature monitoring](https://launchdarkly.com/docs/home/releases/feature-monitoring?utm_source=chatgpt.com)
