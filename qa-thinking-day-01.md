# QA Thinking — Day 1

## A Good Tester Does Not Just Verify Requirements

A common mistake in software testing is to think:

> “The requirement says X. I tested X. X works. Therefore testing is finished.”

That is checking, but it is only one small part of skilled testing.

Michael Bolton describes testing as learning about a product through **experiencing, exploring, experimenting, investigation, risk analysis, critical thinking, and reporting**. The purpose is to reveal useful information about the actual state of the product—not simply to confirm expected outputs.

This distinction changes how you approach almost every ticket.

Imagine the requirement:

**“A customer can change the quantity of a cart item from 1 to 10.”**

A basic tester might create these tests:

- quantity = 1

- quantity = 5

- quantity = 10

- quantity = 0

- quantity = 11

Useful, but a strong tester immediately starts asking questions.

### What does “1–10” actually mean?

Why is 10 the maximum?

Is 10:

- a UI restriction?

- a business restriction?

- an inventory restriction?

- a restriction per product?

- a restriction per cart?

- a restriction per customer?

- a restriction per order?

Those are completely different rules.

Suppose the UI prevents entering 11.

What happens if someone calls the API directly with:

`quantity: 11`

If the backend accepts it, then your UI test passed while the **business rule failed**.

That is an important difference between testing an interface and testing a system.

------------------------------------------------------------------------

## Follow the consequences

Now suppose quantity changes from:

`2 → 5`

Don't only ask:

**Did the quantity become 5?**

Ask what else should change because of it.

For example:

`quantity`  
→ item subtotal  
→ cart subtotal  
→ discounts  
→ tax  
→ shipping threshold  
→ inventory reservation  
→ checkout total  
→ payment amount

A defect somewhere downstream can be much more serious than the quantity field itself.

For example:

Quantity changes:

`2 → 5`

but price remains:

`€20`

instead of:

`€50`

The quantity feature technically works.

The business, however, could lose money.

This is why risk is so important in testing. Rapid Software Testing explicitly treats risk analysis and strategy as central testing skills, rather than treating testing as executing predefined cases.

------------------------------------------------------------------------

# Think in relationships, not individual fields

A powerful habit is:

**Whenever something changes, ask what else depends on it.**

For an e-commerce cart:

`Quantity`  
↓  
`Stock`  
↓  
`Price`  
↓  
`Discount`  
↓  
`Tax`  
↓  
`Shipping`  
↓  
`Payment`  
↓  
`Order`

Each connection gives you possible tests.

For example:

### Quantity ↔ Inventory

Stock available = 4.

Customer requests 5.

What happens?

Possible expected behaviours:

- reject quantity 5

- automatically reduce it to 4

- show “Only 4 available”

- allow backordering

The tester should not invent the expected behaviour.

Instead, recognize:

**There is an unanswered business question.**

That question should go to the Product Owner/domain expert.

Finding unclear requirements **before development or release** is valuable testing work.

------------------------------------------------------------------------

# James Bach: Don't blindly follow “best practices”

James Bach's Context-Driven Testing work argues against assuming that one testing practice is universally “best”. What is appropriate depends on the project, product, risks, people, constraints, and circumstances.

This means:

> “Always test these 20 cart cases”

is weaker thinking than:

> “What problems matter for THIS cart?”

Consider two products.

### Shop A

Sells downloadable €5 ebooks.

### Shop B

Sells €8,000 industrial machinery.

Both have a quantity field.

Should their test strategy be identical?

Of course not.

For Shop B you might care much more about:

- authorization

- maximum order value

- quotation rules

- fraud

- payment limits

- contractual pricing

- inventory allocation

The feature looks identical.

The **risk context is completely different**.

That is Context-Driven Testing.

------------------------------------------------------------------------

# A useful model: Product → Risk → Test

When you receive a feature, don't start with test cases.

Start here:

### 1. Understand the product

What is this feature supposed to accomplish?

### 2. Understand the business

Why does the company need it?

### 3. Identify failure possibilities

What could go wrong?

### 4. Ask who would care

Customer?

Merchant?

Finance?

Support?

Operations?

Security?

### 5. Estimate impact

If this fails, how bad is it?

### 6. Design experiments

What tests would expose those failures?

Only then start thinking about:

- Playwright

- Cypress

- Postman

- API automation

- test cases

Automation comes **after thinking**.

------------------------------------------------------------------------

# Today's tester exercise

You have this requirement:

> “A logged-in customer receives free shipping when the cart total reaches €50.”

Do **not** immediately write test cases.

First write at least **10 questions**.

Think about things like:

- exactly €50

- €49.99

- €50.01

- discounts

- coupons

- tax

- shipping country

- multiple currencies

- removing an item

- refunds

- guest → login transition

- persisted carts

- multiple browser tabs

- API manipulation

But don't just copy those.

Ask questions that you believe could expose a **real business problem**.

Tomorrow's lesson will build on this and show how a good tester turns those questions into:

**Business Rule → Risk → Test Condition → Concrete Test → Automation decision.**
