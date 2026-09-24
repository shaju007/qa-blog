# QA Thinking — Day 3

## Test Before the Code Exists: How a Strong QA Engineer Uses Refinement to Prevent Bugs

Suppose a Product Owner brings this story into refinement:

> **“As a customer, I want free shipping when my cart value is €50 or more.”**

The acceptance criterion says:

> “If cart total ≥ €50, shipping is free.”

A tester can look at that and think:

**Clear enough. I'll test €49.99, €50, and €50.01 after development.**

That is reasonable testing.

But a stronger tester notices something else:

**We don't yet know what “cart total” means.**

Does it mean before discount or after discount?

Does VAT count?

Do gift cards count?

Does €50 apply to physical goods only?

Does every shipping method become free?

Does Germany use the same threshold as France?

What happens when the customer reaches €50, gets free shipping, then removes an item?

What if the cart contains €60 of products but €20 of those products cannot be shipped?

There may already be several defects hiding inside this one sentence—before a developer has written a line of code.

That leads to today's lesson:

> **Testing is not something that has to wait for implemented software.**

A strong tester can test **ideas, assumptions, requirements, examples, models, and decisions** before testing the executable product.

James Bach's work on risk- and requirements-based testing makes an important point: knowing what the requirements say isn't enough; testers also need to understand **why those requirements exist**. [Satisfice](https://www.satisfice.com/download/risk-and-requirements-based-testing)

That changes the way you participate in refinement.

------------------------------------------------------------------------

## Requirements are not truth

Many teams unconsciously treat a requirement like this:

**PO writes requirement → developer implements requirement → tester checks requirement.**

That model assumes the requirement itself is correct.

But requirements can be incomplete, ambiguous, outdated, contradictory, or simply wrong.

Michael Bolton argues that explicit requirement documents represent only some intentions and needs around a product. Legitimate needs may be undocumented, and documented requirements themselves may contain misunderstandings or errors. Good testing therefore includes questioning what the requirement says—not merely checking conformance to it. [Developsense](https://developsense.com/blog/2024/05/missing-requirements)

Imagine this acceptance criterion:

> **“Maximum quantity per product is 10.”**

You could create a nice boundary test:

    9   → allowed
    10  → allowed
    11  → rejected

Everything passes.

But then you discover why the limit exists.

The business wanted to prevent resellers from purchasing large quantities of scarce products.

Now consider:

    Product A × 10
    Product A × 10 in another browser
    Product A × 10 from mobile

Same account.

Thirty items purchased.

Your implementation satisfies the written requirement.

It may completely fail the **business intention**.

That's why the question:

> **“Why do we have this rule?”**

can sometimes generate better tests than:

> “What are the acceptance criteria?”

------------------------------------------------------------------------

# Your job in refinement is not to invent requirements

There is an important distinction here.

A tester shouldn't decide:

> “Free shipping should happen after discount.”

That's a business decision.

Instead, a tester identifies uncertainty:

> “Does the €50 threshold use the subtotal before or after discounts?”

You expose the gap.

The PO or relevant domain expert decides the intended rule.

Then the team shares that understanding.

This is an underrated QA soft skill.

The goal isn't to demonstrate that the requirement is bad.

The goal is to make the team's **mental model more precise**.

That difference matters enormously in how people respond to your questions.

Compare these two approaches:

> “This requirement isn't clear.”

versus:

> “I want to make sure checkout and pricing interpret this consistently. If the customer has €60 of products and applies a €20 coupon, should free shipping remain active?”

The second question gives the team something concrete to reason about.

You're not criticizing.

You're helping.

------------------------------------------------------------------------

# Examples are a testing tool

The phrase:

> “Free shipping starts at €50.”

sounds simple.

Instead of debating definitions abstractly, introduce examples.

**Example 1**

Products: €49.99  
Discount: €0  
Shipping: ?

Obviously probably not free.

**Example 2**

Products: €50  
Discount: €0  
Shipping: ?

Probably free.

Now make it interesting.

**Example 3**

Products: €60  
Coupon: −€15  
Final product total: €45  
Shipping: ?

People may suddenly disagree.

The PO thinks shipping should cost money.

The developer assumed the threshold was calculated before discounts.

The existing backend pricing service already calculates it after discounts.

You have just discovered a potential defect without running the application.

This is one reason approaches such as Three Amigos bring business, development, and testing perspectives together before implementation. Ministry of Testing describes the business perspective as focusing on value and intent, development on feasibility and implementation, and testing on risks, edge conditions, and ways the logic might fail. [Ministry of Testing](https://www.ministryoftesting.com/software-testing-glossary/three-amigos)

The value isn't that there must literally be exactly three people in a meeting.

The value is **multiple models colliding early**.

------------------------------------------------------------------------

# Don't become the tester who asks 40 random questions

There is a danger here.

You learn that testers should ask questions, so every refinement becomes:

“What if the Internet disappears?”

“What if the database fails?”

“What about 400 browser tabs?”

“What happens in Antarctica?”

“What if someone enters emoji?”

“What if there are 10 million products?”

Technically these are questions.

That doesn't make them useful.

Good testing involves **selection**.

You have limited time.

So connect your questions to risk.

For the free-shipping feature, questions about discount calculation, country, currency, eligible products and cart mutation are probably more important than:

> “What happens if the customer's browser language is Finnish?”

unless localization somehow affects price calculations.

James Bach frames testing work around mission and risk rather than blindly completing predetermined actions; his broader point is that the amount and type of testing should serve the testing mission. [Satisfice](https://www.satisfice.com/blog/archives/6203?utm_source=chatgpt.com)

The same principle applies during refinement.

Don't try to prove how many edge cases you can imagine.

Find the **important uncertainty**.

------------------------------------------------------------------------

# A technique you can use immediately: Rule → Variables → Boundaries → Interactions

Let's apply a lightweight reasoning model to our shipping rule.

The rule is:

> Free shipping applies when eligible cart value reaches €50.

First identify the important variables.

You might find:

`cart value`

`discount`

`country`

`currency`

`shipping method`

`product type`

`customer type`

`tax`

`cart state`

Now ask what boundaries exist.

For cart value:

    < €50
    = €50
    > €50

For discounts:

    none
    percentage
    fixed amount
    promotion
    voucher

For destination:

    domestic
    EU
    non-EU

Now interactions appear.

Maybe:

    cart value × discount
    cart value × destination
    discount × product eligibility
    currency × threshold
    shipping method × threshold

You don't need to test every mathematical combination.

You're building a model that helps identify **where different rules meet**.

Rule intersections are excellent places to find bugs.

------------------------------------------------------------------------

# E-commerce domain knowledge makes you a better tester

This is where domain knowledge becomes powerful.

A tester unfamiliar with e-commerce might see:

**€50 → free shipping.**

A tester who understands commerce starts thinking about:

merchandise subtotal → promotions → taxable total → VAT → shipping eligibility → shipping fee → payment total.

That sequence matters.

Suppose the system contains three services:

    Cart Service
        ↓
    Promotion Service
        ↓
    Shipping Service
        ↓
    Checkout Service

Now a requirement change isn't just a UI change.

It may be a distributed business rule.

Maybe Cart Service sends:

    {
      "subtotal": 60,
      "discount": 15
    }

Shipping Service receives only:

    {
      "subtotal": 60
    }

and decides:

    60 >= 50 → FREE SHIPPING

But the business rule eventually becomes:

> threshold calculated after coupon discounts.

Your Playwright test may expose the problem.

But understanding the domain allows you to ask:

**Where should this rule actually be calculated?**

That leads naturally to API and integration testing.

You might want tests around:

    cart
    → promotion calculation
    → shipping eligibility
    → checkout total

That's quality engineering rather than simply browser automation.

------------------------------------------------------------------------

# The tester's soft skill: challenge without becoming “the blocker”

This matters because testers sometimes develop a reputation for saying:

> “No.”

Developers bring a design.

QA says no.

PO brings a requirement.

QA finds ten problems.

Release approaches.

QA says not ready.

Eventually QA becomes perceived as the department preventing work rather than helping the team succeed.

The solution isn't to stop challenging things.

It's to change **how you challenge them**.

Instead of:

> “The acceptance criteria are incomplete.”

try:

> “I see two possible interpretations here. Can we decide which one we want before implementation?”

Instead of:

> “That won't work.”

try:

> “What should happen when the coupon drops the cart below the threshold?”

Instead of:

> “This is wrong.”

try:

> “My understanding was that the threshold applies after discounts. Is that still the intended business rule?”

You are still challenging assumptions.

But you're inviting collaboration rather than declaring judgment.

This connects strongly with the quality-culture article you shared earlier: introducing better quality practices succeeds much more easily when QA builds understanding and trust rather than imposing a process on everyone.

------------------------------------------------------------------------

# Acceptance criteria are not your complete test suite

Another trap:

    AC1 → automated test
    AC2 → automated test
    AC3 → automated test

    All green.

    Done.

Not necessarily.

Bolton points out that explicit requirements are only one source of expectations about the product. Testing can reveal tacit requirements, unanticipated problems, and needs that were never written down. [Developsense](https://developsense.com/blog/2024/05/missing-requirements)

Suppose the story says:

> Shipping becomes free at €50.

You satisfy every acceptance criterion.

Then exploratory testing reveals:

1.  Put €55 into the cart.

2.  Free shipping appears.

3.  Open a second tab.

4.  Remove €10 of products there.

5.  Return to the original tab.

6.  Checkout still shows free shipping.

7.  Payment completes with the €45 cart.

No acceptance criterion told you to test multi-tab state synchronization.

But a real customer can do it.

The product's behaviour creates testing ideas beyond the document.

This is why:

> **Acceptance criteria are a starting point for testing, not the border around testing.**

------------------------------------------------------------------------

# Documentation should serve the team, not become the goal

Cem Kaner made a related argument about test documentation: the right amount and style of documentation depend on the project's needs, readers, risks, rate of change, regulatory environment, and purpose. Very detailed scripts can be expensive to create and maintain, especially where the design changes quickly. [Kaner](https://kaner.com/pdfs/QaiRequirements.pdf)

Apply that to refinement.

You don't necessarily need a giant requirements document containing every conceivable example.

Sometimes three carefully chosen examples and one diagram can establish more shared understanding than a 30-line acceptance-criteria list.

The objective isn't:

**perfect documentation.**

It's:

**sufficient shared understanding for the team to build, test and evaluate the product responsibly.**

------------------------------------------------------------------------

# What I want you to practice at work

When you next enter refinement, don't initially think:

> “What test cases can I write?”

Try this mental sequence instead:

**What business problem are we solving?**

Then:

**What rule is being introduced or changed?**

Then:

**Which words hide assumptions?**

Then:

**What variables affect this rule?**

Then:

**Where are the boundaries?**

Then:

**Which other rules interact with it?**

Then:

**What failure would matter to the customer or business?**

Only afterward think:

**How should I test it?**

And only after that:

**What should be automated?**

The order matters.

A tester who starts with automation often automates examples.

A tester who starts with the business model can discover what actually deserves testing.

------------------------------------------------------------------------

# Today's exercise

Your Product Owner gives you this requirement:

> **“Customers who spend more than €100 receive a 10% discount.”**

Before writing any test cases, investigate the requirement mentally.

Consider questions around the exact €100 boundary, whether the threshold is before or after other discounts, tax, currency, product exclusions, quantity changes, returns, partial refunds, guest checkout, persisted carts, multiple devices, coupon stacking, and where the calculation occurs across services.

Then identify **three questions that are genuinely important enough to ask the PO before development**.

Not twenty questions.

Three.

That constraint is intentional.

A skilled tester isn't merely good at generating questions.

A skilled tester learns **which questions deserve people's attention**.

That's part of testing judgment—and part of becoming a QA engineer people actively want in refinement.

For further reading, James Bach's short piece on risk and requirements is particularly relevant because it directly challenges the idea that knowing the requirement is sufficient for testing. Michael Bolton's “Missing Requirements” extends that idea by showing why undocumented and emergent needs matter, while Ministry of Testing's Three Amigos material gives a practical collaborative mechanism for applying these ideas before code is written. [Satisfice+2Developsense+2](https://www.satisfice.com/download/risk-and-requirements-based-testing)

[James Bach — Risk and Requirements-Based Testing](https://www.satisfice.com/download/risk-and-requirements-based-testing?utm_source=chatgpt.com)  
[Michael Bolton — Missing Requirements](https://developsense.com/blog/2024/05/missing-requirements?utm_source=chatgpt.com)  
[Ministry of Testing — Three Amigos](https://www.ministryoftesting.com/software-testing-glossary/three-amigos?utm_source=chatgpt.com)  
[Cem Kaner — Requirements for Test Documentation](https://kaner.com/pdfs/QaiRequirements.pdf?utm_source=chatgpt.com)
