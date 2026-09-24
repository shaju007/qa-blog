# QA Thinking — Day 9

## Bug Advocacy: Finding the Bug Is Only Half the Job

Imagine you are testing an e-commerce checkout.

You enter a valid international phone number:

    +49 176 12345678

and the form says:

    Invalid phone number

You remove the spaces:

    +4917612345678

Still invalid.

You could immediately create:

> **BUG: Checkout rejects phone number with + prefix**

Severity: Medium.

Steps. Screenshot. Done.

But a stronger tester does not stop there.

You now have evidence of a **failure**, but you don't yet understand its **scope, conditions, or business significance**.

Cem Kaner's Bug Advocacy material makes this distinction explicit: when a test exposes a failure, you're seeing a symptom of some underlying fault. Follow-up testing can show that the problem is more serious or more general than the first example suggests. [ManualZilla+1](https://manualzilla.com/doc/5991722/bug-advocacy---cem-kaner--jd--ph.d.?utm_source=chatgpt.com)

That follow-up work can turn an ordinary-looking ticket into information that changes a release decision.

Today's lesson is:

> **A tester does not advocate for a bug by exaggerating it. A tester advocates by discovering and communicating the strongest truthful story about the problem.**

------------------------------------------------------------------------

## A bug report is a decision-support tool

Why do we report bugs?

Not primarily so Jira contains a record.

The real reason is that somebody needs to make a decision:

    Should we fix this?
    When?
    Before release?
    After release?
    What happens if we don't?

Michael Bolton describes testing more broadly as helping people understand the true status of a product so that they can make informed decisions. [DevelopSense](https://www.developsense.com/?utm_source=chatgpt.com)

That means a useful bug report should reduce uncertainty around the decision.

A ticket saying:

> “Phone validation is broken.”

doesn't tell the Product Owner much.

A ticket saying:

> “Guest checkout rejects phone numbers containing an international `+` prefix. I reproduced it across Chrome and Safari and with German, French and UK examples. Customers cannot continue because phone number is mandatory, and there is no guidance explaining an accepted format.”

is much more useful.

And if you discover:

> “Entering the local version without `+` works.”

that matters too, because now you have a possible workaround.

You are progressively building the **bug story**.

------------------------------------------------------------------------

# Start with the symptom, then investigate

Suppose your initial failure is:

    Delivery country: Germany
    Phone: +49 176 12345678
    Result: validation error

Don't immediately assume:

> “The system doesn't support international phone numbers.”

That's a hypothesis.

You don't yet know that.

Maybe the problem is:

    +
    spaces
    country prefix
    field length
    JavaScript validation
    backend validation
    locale
    browser

Your next tests should help distinguish these explanations.

Try:

    017612345678
    +4917612345678
    004917612345678
    +49 176 12345678
    +49-176-12345678

Now suppose you discover:

    017612345678        ✓
    +4917612345678      ✗
    004917612345678     ✓
    +49 176 12345678    ✗

That is already more informative.

The likely issue may be specifically related to the `+` character.

Notice the difference.

Before:

> “International numbers don't work.”

After investigation:

> “Numbers containing `+` are rejected.”

The second claim is narrower and supported by evidence.

That precision builds credibility.

------------------------------------------------------------------------

# One of Kaner's best ideas: uncorner your corner case

Suppose you originally discover a failure with something strange:

    Cart contains 99 products
    Coupon = 99.99%
    Currency = CHF

You report it.

Someone responds:

> “Nobody does that.”

Sometimes they're right.

Kaner recommends a clever follow-up technique: after finding a failure using extreme conditions, try progressively more ordinary values. He calls this **uncornering your corner case**. If the problem also occurs under common conditions, the bug becomes far easier to understand and evaluate. [Kaner+1](https://kaner.com/?utm_source=chatgpt.com)

Imagine you discovered:

    99 products → checkout price incorrect

Then test:

    50 products → wrong
    20 products → wrong
    10 products → wrong
    5 products  → wrong

Now the report isn't really about an exotic 99-item cart.

It is:

> Cart totals become incorrect when quantity exceeds 4.

That tells a completely different risk story.

Your original test exposed the bug.

Your follow-up testing discovered its significance.

------------------------------------------------------------------------

# Don't confuse severity with priority

This distinction matters a lot in real QA work.

**Severity** roughly concerns how bad the failure or consequence is.

**Priority** concerns how urgently the organization chooses to act.

Those aren't always the same.

Consider:

    Typo on homepage during today's major advertising campaign

Technically:

    Severity: low

But maybe:

    Priority: high

because millions of people are about to see it.

Now consider:

    Application crashes when importing a 17 GB catalog

Potentially serious.

But perhaps only one internal customer uses that function once per year and has a workaround.

The Product Owner may legitimately decide:

    Fix later.

Ministry of Testing community discussions make the same practical distinction: severity and priority serve different purposes, and triage benefits from product, development, testing and stakeholder perspectives rather than treating the tester's label as the final decision. [Ministry of Testing+1](https://club.ministryoftesting.com/t/how-do-you-prioritise-bugs/46946?utm_source=chatgpt.com)

Your job isn't:

> “Make sure my High severity bug gets fixed.”

Your job is:

> **Give the team enough evidence to make a sensible decision.**

------------------------------------------------------------------------

# The tester shouldn't become a lawyer trying to win

Imagine you report:

> “Checkout sometimes charges shipping when it should be free.”

Developer replies:

> “I can't reproduce it.”

A poor interaction becomes:

**Tester:** It definitely happens.

**Developer:** Works on my machine.

**Tester:** I already tested it.

**Developer:** Then give me proper steps.

Now the discussion becomes about who is right.

That's wasted energy.

Cem Kaner's bug advocacy material explicitly treats reproducibility as something worth investigating rather than a moral judgment. Non-reproducible failures can contain valuable information; timing, configuration, earlier application state, concurrent processes, load and delayed responses may all explain why a failure is intermittent. [ManualZilla+1](https://manualzilla.com/doc/5991722/bug-advocacy---cem-kaner--jd--ph.d.?utm_source=chatgpt.com)

A stronger response would be:

> “I can currently reproduce it about 2 out of 10 times. I'm going to compare the successful and failing requests and see whether I can identify the condition.”

Now you and the developer are investigating the product together.

That is a very different relationship.

------------------------------------------------------------------------

# “Cannot reproduce” is information

Suppose this happens:

    Test 1 → failure
    Test 2 → pass
    Test 3 → pass
    Test 4 → failure
    Test 5 → pass

Don't immediately conclude:

> “Flaky environment.”

Intermittency itself may suggest something.

Think about:

    timing
    cache state
    race condition
    async event
    load
    previous test state
    database replication
    network latency
    feature flags
    different backend instances

For example, imagine checkout calls two pricing-service instances:

    pricing-1 → new promotion logic
    pricing-2 → old promotion logic

Load balancing might give you:

    request 1 → pricing-1 → correct
    request 2 → pricing-2 → wrong
    request 3 → pricing-1 → correct

From the UI, the defect appears random.

From an infrastructure perspective, it may be completely deterministic.

The tester's job is to keep asking:

> **What variable haven't I identified yet?**

That's investigative thinking.

------------------------------------------------------------------------

# Simplify the reproduction

Another strong idea from Kaner's Bug Advocacy work is eliminating unnecessary steps from long reproductions. [ManualZilla](https://manualzilla.com/doc/5991722/bug-advocacy---cem-kaner--jd--ph.d.?utm_source=chatgpt.com)

Imagine your initial steps are:

    1. Create account
    2. Verify email
    3. Log in
    4. Search product
    5. Add product
    6. Open cart
    7. Apply voucher
    8. Change quantity
    9. Go to checkout
    10. Change delivery country
    11. Enter address
    12. Select DHL
    13. Go back to cart
    14. Return to checkout
    15. Observe wrong shipping price

Before submitting that monster, investigate.

Maybe you discover:

    1. Add €60 product
    2. Apply €20 voucher
    3. Go to checkout
    4. Shipping incorrectly remains free

Much better.

Why?

Not merely because developers like shorter tickets.

Simplification teaches you something about the bug.

You discovered that:

    changing country
    changing quantity
    navigation
    login state
    DHL

were irrelevant.

You've narrowed the failure mechanism.

That can help the developer locate the fault.

------------------------------------------------------------------------

# Follow the bug beyond the first visible symptom

Suppose you find:

    Checkout total displays €80

but it should show:

    €90

Don't immediately stop.

Try completing the order.

You may discover:

    UI shows             €80
    payment provider     €90
    invoice              €90

Now the story becomes:

> Customer sees €80, but card is charged €90.

That's far more serious than:

> “Checkout total label is wrong.”

Or perhaps you find:

    UI                  €80
    payment             €80
    invoice             €80
    merchant ledger     €90

That's a different class of problem.

Kaner explicitly recommends looking for **follow-up errors** after a failure puts the application into a state the developer may not have anticipated. Sometimes the first symptom is mild while later consequences are much worse. [ManualZilla](https://manualzilla.com/doc/5991722/bug-advocacy---cem-kaner--jd--ph.d.?utm_source=chatgpt.com)

This technique is extremely powerful in e-commerce.

Whenever you find a cart/pricing problem, consider following it through:

    cart
    → checkout
    → payment
    → order
    → invoice
    → refund
    → reporting

One inconsistency can propagate through the entire business workflow.

------------------------------------------------------------------------

# Connect technical failure to customer or business consequence

Michael Bolton's March 2026 article *Bugs Cost the Business* gives a simple real-world example.

While trying to buy books online, he was blocked by a required phone-number field whose validation rejected the formats he tried and whose help text didn't explain what format was acceptable. He abandoned the purchase and bought from another retailer instead—over \$200 in lost revenue for that attempted purchase alone. [DevelopSense](https://developsense.com/blog/2026/03/bugs-cost-the-business?utm_source=chatgpt.com)

Think about how different these reports sound:

> Phone validation doesn't accept international format.

versus:

> A customer with a valid phone number can be prevented from completing checkout, with no instruction for recovering. Because the field is mandatory, this can directly cause checkout abandonment.

Same software problem.

Better risk communication.

Don't exaggerate by writing:

> “We will lose millions!”

unless you have evidence.

Instead say what you actually know:

> “This blocks checkout for the affected input format.”

Then, if available, add evidence:

    12% of customers use international numbers

or:

    support received 18 complaints this week

or:

    analytics show 4.7% abandonment at this field

Now your advocacy becomes much stronger because the evidence comes from the business, not from your opinion.

------------------------------------------------------------------------

# Separate observation, inference and risk

This is one of the best communication habits a tester can develop.

Suppose you find duplicate orders.

Instead of saying:

> “Our retry system creates duplicate orders.”

structure your thinking like this:

**Observation**

    One checkout action produced orders 8121 and 8122.
    Both contain the same customer, products and payment reference.

**Inference**

    The requests appear to have been processed twice.
    I suspect retry handling or missing idempotency.

**Risk**

    Customers may receive duplicate orders or be charged twice if duplicate processing also reaches payment.

Notice that you haven't claimed something you haven't proved.

You can be confident about the observation, tentative about the mechanism, and clear about the possible consequence.

This makes your reports much easier to trust.

------------------------------------------------------------------------

# A strong bug title tells a story

Weak:

    Voucher bug

Better:

    Voucher doesn't work

Much better:

    €10 voucher is deducted twice when checkout is refreshed

Even better when business consequence matters:

    Refreshing checkout applies €10 voucher twice, allowing orders below intended price

Kaner's Bug Advocacy teaching emphasizes that reports should communicate the problem clearly and make the reader understand why it matters. [ManualZilla](https://manualzilla.com/doc/5991722/bug-advocacy---cem-kaner--jd--ph.d.?utm_source=chatgpt.com)

A useful title often contains:

    condition + failure + consequence

For example:

    Changing delivery country after applying voucher keeps old VAT rate

You shouldn't turn titles into paragraphs.

But a developer should be able to scan the ticket list and understand the issue.

------------------------------------------------------------------------

# Screenshots are evidence, not explanation

A common QA habit:

    Screenshot attached.

And almost nothing else.

A screenshot can show:

    what appeared

but not necessarily:

    what happened before
    what should have happened
    which data was used
    which environment
    which request failed
    whether it reproduces
    why it matters

Logs are similar.

Dropping 20 MB of logs into Jira is not automatically good reporting.

Evidence should reduce investigation cost.

Maybe the useful evidence is:

    request ID
    order ID
    timestamp
    API request
    API response
    console error
    network trace
    short video

Ministry of Testing's Bug Reporting material similarly emphasizes compelling impact stories, scope/severity investigation, reproducibility and selecting useful evidence rather than treating the ticket template itself as the goal. [MoTaverse](https://www.ministryoftesting.com/courses/bug-reporting-101?utm_source=chatgpt.com)

------------------------------------------------------------------------

# Don't automatically file a ticket

Sometimes the best bug report is a conversation.

You're pairing with the developer.

You say:

> “Look at this.”

Developer sees it.

> “Ah, that's obvious. I'll fix it now.”

Five minutes later it's fixed.

Creating a Jira ticket with:

    description
    steps
    severity
    screenshots
    labels
    component
    priority

might add no value.

Ministry of Testing explicitly notes that alternatives such as pairing or direct conversation can be better than formal reports in some situations. [MoTaverse+1](https://www.ministryoftesting.com/courses/bug-reporting-101?utm_source=chatgpt.com)

But sometimes documentation is important.

For example:

    complex bug
    deferred bug
    cross-team issue
    production defect
    compliance impact
    customer complaint
    financial issue
    hard-to-reproduce problem

Again:

> **Context decides the process.**

Good testers aren't Jira operators.

------------------------------------------------------------------------

# A practical bug-advocacy loop

When you find an important failure, use this loop:

- **Observe precisely.** What actually happened, without interpretation?

- **Reproduce and vary.** Which conditions matter and which do not?

- **Simplify.** Remove unnecessary steps.

- **Broaden.** Does it affect mainstream cases, other configurations, users, products or workflows?

- **Follow through.** What happens after the initial failure?

- **Find consequence.** What can this do to customers, revenue, data, security or operations?

- **Collect evidence.** Logs, IDs, requests, videos, metrics—only what helps.

- **Communicate uncertainty honestly.** Separate facts, hypotheses and risk.

- **Help the decision.** Make the bug easy to understand and evaluate.

That's bug advocacy.

Notice what isn't in the loop:

    ARGUE UNTIL DEVELOPER AGREES.

------------------------------------------------------------------------

# A realistic example

You discover:

    Cart subtotal:     €55
    Voucher:          -€10
    Product total:     €45
    Free-shipping threshold: €50

Checkout still shows:

    Shipping: FREE

Initial report:

> Free shipping applied incorrectly.

Before reporting, investigate.

You test:

    €51 - €2 = €49     → FREE
    €60 - €11 = €49    → FREE
    €100 - €60 = €40   → FREE

Now you suspect the shipping threshold is calculated before vouchers.

Then:

    Promotion discount → shipping recalculates correctly
    Voucher discount   → shipping stays free

That's much more interesting.

Now you have evidence that this is not simply:

    shipping calculation broken

It may specifically involve the interaction:

    voucher × shipping eligibility

Then complete the order.

Suppose:

    Checkout UI              FREE
    Order API                shipping = 0
    Payment                  €45

The customer actually receives free shipping.

Now estimate impact.

If shipping normally costs €5:

    100 affected orders → €500 loss
    10,000 affected orders → €50,000 loss

Don't claim 10,000 orders exist unless you know that.

Instead ask the PO or data team:

> “Can we estimate how many below-threshold orders use vouchers? That would help us assess exposure.”

That's bug advocacy plus stakeholder management.

You aren't merely handing a defect to somebody.

You're helping the organization understand its risk.

------------------------------------------------------------------------

# What if the Product Owner says “We won't fix it”?

That doesn't mean your testing failed.

Imagine you explain:

> “The issue affects voucher orders where the post-discount subtotal drops below the shipping threshold. Customers receive free shipping in those cases. We estimate about 20 orders per month, giving roughly €100 monthly exposure.”

PO says:

> “We're redesigning shipping next month. We'll accept €100 risk rather than changing this code now.”

That can be a perfectly rational decision.

You did your job.

Testing's purpose isn't:

    all bugs fixed

It's closer to:

    important product information
    → understood by decision makers
    → informed decision

If the organization consciously accepts the risk, that's different from nobody knowing the risk exists.

That distinction matters.

------------------------------------------------------------------------

# Today's exercise

You find this defect:

    Product price: €100
    Promotion: 20% off

    Expected checkout price: €80
    Actual checkout price:   €80

Looks correct.

But after increasing quantity from 1 to 2:

    Expected: €160
    Actual:   €180

Don't write the Jira ticket yet.

Spend 20 minutes doing bug advocacy.

Investigate whether the issue happens with quantities 2, 3 and 10; whether decreasing quantity restores the correct price; whether refreshing the page corrects it; whether it occurs with percentage promotions, fixed-value vouchers, or both; whether the cart API is wrong or only the UI is wrong; and whether the incorrect value reaches payment and order creation.

Then produce a bug story containing only four things:

    Observation
    Conditions
    Consequence
    Evidence

For example, maybe your final story becomes:

> Increasing quantity after applying a percentage promotion recalculates only the newly added unit at full price. The problem occurs with percentage promotions but not €-value vouchers. The incorrect total is also sent to checkout and payment, so customers can be overcharged. Refreshing the cart recalculates the correct amount.

Compare that with:

> Promotion price wrong when quantity changes.

Both describe the same initial bug.

Only one helps the team quickly understand **what is happening, how far it goes, and why it matters**.

That is today's core lesson:

> **Finding a failure is testing work. Understanding its conditions and consequences is deeper testing work. Communicating that story credibly enough for other people to make a good decision is bug advocacy.**

A strong tester learns all three.

### Recommended reading

Cem Kaner's *Bug Advocacy* remains one of the best practical sources on follow-up testing, simplifying reproductions, investigating intermittent failures, making corner cases more representative, and communicating bugs persuasively without distorting the facts. Michael Bolton's 2026 *Bugs Cost the Business* is a short real-world reminder that apparently small usability or validation problems can become direct business losses when they block customers. Ministry of Testing's Bug Reporting material is useful for turning those principles into modern team practice. [Kaner+2DevelopSense+2](https://kaner.com/pdfs/bugadvoc.pdf?utm_source=chatgpt.com)

[Cem Kaner — Bug Advocacy](https://kaner.com/pdfs/bugadvoc.pdf?utm_source=chatgpt.com)

[Cem Kaner — Follow-Up Testing in the BBST Bug Advocacy Course](https://kaner.com/?utm_source=chatgpt.com)

[Michael Bolton — Bugs Cost the Business](https://developsense.com/blog/2026/03/bugs-cost-the-business?utm_source=chatgpt.com)

[Ministry of Testing — Bug Reporting 101](https://www.ministryoftesting.com/courses/bug-reporting-101?utm_source=chatgpt.com)
