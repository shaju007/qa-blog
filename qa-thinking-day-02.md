# QA Thinking — Day 2

## Bug Advocacy: A Strong Tester Doesn’t “Win” the Bug Argument — They Help the Team Make a Better Decision

Imagine you find this problem during checkout:

A customer has **€120 worth of products**, applies a 20% discount, and the cart correctly displays €96. But when the payment request is sent to the payment provider, the backend still sends **€120**.

You create a bug:

**“Checkout payment amount is incorrect after applying discount.”**

The developer replies:

> “It works for me.”

You reproduce it again and respond:

> “I tested it three times. It is definitely a bug.”

The discussion starts becoming tester-versus-developer.

This situation teaches an important QA skill that has almost nothing to do with Selenium, Playwright, Postman, or programming.

It is **bug advocacy**.

Cem Kaner's BBST material treats bug reporting as more than documenting technical facts. The tester's credibility, investigation, clarity, and judgment influence how seriously a problem will be taken. His Bug Advocacy material explicitly examines questions such as how much investigation a tester should perform, how bugs should be presented, and how a tester's decisions affect credibility. [Kaner+1](https://kaner.com/pdfs/bugadvoc.pdf?utm_source=chatgpt.com)

The objective therefore isn't:

**“Prove that I am right.”**

It is:

**“Give the team enough trustworthy information to make a good decision about this risk.”**

------------------------------------------------------------------------

## Start separating three things: observation, inference and risk

This is one of the most useful habits you can develop as a tester.

Suppose you observe:

**Cart UI:** €96  
**Payment API request:** €120

That is an **observation**.

You might then think:

> “Customers will be overcharged.”

That is not yet an observation.

It is an **inference**.

Perhaps the payment provider ignores that field. Perhaps another service recalculates the price. Perhaps the payment request is only a preliminary authorization.

So investigate.

You complete the payment using a test payment account and discover that the provider actually authorizes €120.

Now you have stronger evidence.

Then ask:

**What is the consequence?**

If a customer expects €96 but €120 is authorized, possible consequences include customer complaints, abandoned purchases, refunds, chargebacks, loss of trust and potentially legal/compliance concerns.

That's the **risk**.

Notice how much stronger this is than:

> “Price is wrong. Severity: Critical.”

A senior tester increasingly learns to communicate this way:

**I observed X. Under conditions Y. I investigated Z. This appears capable of producing consequence Q.**

That style makes your reasoning inspectable.

And inspectable reasoning creates credibility.

------------------------------------------------------------------------

# Bug severity isn't the same as bug importance

Suppose another bug exists:

The checkout button is misaligned by 6 pixels on Safari.

And another:

Some discounted orders can charge the customer the pre-discount amount.

You don't need a complicated severity matrix to understand which one deserves attention first.

But sometimes testers accidentally weaken themselves by saying:

> “Both are High because they fail acceptance criteria.”

Acceptance criteria tell you something about expected behaviour.

They do **not automatically tell you business impact**.

Michael Bolton's risk-focused testing material emphasizes organizing testing around suspected product risks and grounding risk discussions in evidence. He also describes product risk as leading to business risk. [DevelopSense+1](https://developsense.com/rstf-risk?utm_source=chatgpt.com)

So instead of:

**Severity = High**

try thinking:

**Who can be affected? How often? Under what conditions? What could it cost? Can the customer recover? Can the business detect it?**

Now you are discussing risk.

------------------------------------------------------------------------

# The sentence that improves many QA conversations

Try replacing:

> “This is a critical bug.”

with:

> **“I'm concerned this could…”**

For example:

> “I'm concerned this could charge customers the original amount when a cart-level discount is applied.”

Then present the evidence.

This sounds like a tiny communication change, but it matters.

You aren't surrendering your technical opinion.

You are separating:

**evidence** from **assessment** from **decision**.

The tester contributes information.

The PO, engineering, business and other stakeholders may contribute information you don't have.

Perhaps the Product Owner tells you:

> “That discount feature launches next month, so no production customer can currently reach this path.”

Interesting.

The bug is still real.

But the **immediate release risk has changed**.

Good testers allow new information to modify their assessment.

Bad bug advocacy looks like:

> “I found the bug, so it MUST be fixed.”

Good bug advocacy looks like:

> “Here is the failure, here are the conditions, here is why I believe it matters, and here is the evidence.”

------------------------------------------------------------------------

# Your credibility is part of your testing toolkit

Suppose over six months you repeatedly create tickets like:

**CRITICAL!!! CHECKOUT BROKEN!!!**

Then developers open the ticket and discover:

Safari 15 occasionally shows a 1-pixel border around an icon.

Eventually something dangerous happens.

You write:

**CRITICAL!!! PAYMENT BROKEN!!!**

What happens psychologically?

People have learned to discount your signal.

Cem Kaner's Bug Advocacy work explicitly connects the tester's reporting choices and quality of investigation with their credibility. [Kaner](https://kaner.com/pdfs/bugadvoc.pdf?utm_source=chatgpt.com)

This doesn't mean you should avoid reporting small problems.

It means **describe them proportionately**.

James Bach has even described a technique called “mipping”—*mentioning in passing*—for situations where something seems worth communicating but doesn't justify extensive formal investigation. The larger principle is useful: reporting doesn't have to be binary between “huge Jira ticket” and “say nothing.” [Satisfice](https://www.satisfice.com/blog/archives/97?utm_source=chatgpt.com)

Your team might use Slack, a comment on the story, pairing with the developer, a lightweight ticket, or a formal defect depending on the situation.

Ministry of Testing makes a similar point: sometimes a conversation or pairing session is more useful than immediately creating a formal bug report. [MoTaverse+1](https://www.ministryoftesting.com/courses/bug-reporting-101?utm_source=chatgpt.com)

That's quality engineering thinking.

The tool is secondary.

The communication objective comes first.

------------------------------------------------------------------------

# Now suppose the developer says: “That's an edge case”

This is one of the best moments for a tester to investigate rather than argue.

Imagine the failure occurs only when:

Customer has 27 products + coupon + French delivery address + PayPal.

Perhaps that truly is extraordinarily unusual.

Don't immediately defend the bug.

Try to **uncorner the corner case**.

Cem Kaner's Bug Advocacy material specifically recommends investigating whether a failure discovered with unusual conditions can also be reproduced under more mainstream conditions. [Kaner+1](https://kaner.com/?utm_source=chatgpt.com)

Remove variables.

Twenty-seven products → three.

France → Germany.

PayPal → credit card.

Coupon → automatic promotion.

You discover this:

Three products + **any percentage discount** reproduces the problem.

Now your strange corner case has become:

> “Any customer using a cart-level percentage discount may be charged the undiscounted amount.”

That is dramatically more persuasive.

Notice what made the report stronger.

Not better wording.

**Better testing.**

Bug advocacy and test design are connected.

------------------------------------------------------------------------

# Don't make the developer your opponent

Michael Bolton describes testing as socially challenging because testers challenge both the product and people's beliefs about the product. That can naturally create discomfort. [DevelopSense](https://developsense.com/blog/2023/03/testing-is-socially-challenging?utm_source=chatgpt.com)

Suppose a developer says:

> “That isn't our service. Pricing comes from checkout-core.”

A weak tester hears:

**“He's trying to reject my bug.”**

A stronger tester hears:

**“I just learned something about the architecture.”**

Now ask:

> “Interesting. So should checkout-core always be the source of truth for the amount sent to payments?”

That question might expose something more important than the original defect.

Perhaps you discover:

Frontend calculates promotions.

Checkout service calculates promotions separately.

Payment service receives another independently calculated total.

Now the real risk might be:

**three systems can disagree about the order amount.**

That leads to much more valuable testing:

UI total ↔ checkout API total ↔ order total ↔ payment authorization ↔ invoice total ↔ refund total.

Your original bug just revealed an architectural testing opportunity.

That's the difference between:

**Bug finder**

and

**Quality engineer who learns from bugs.**

------------------------------------------------------------------------

# Don't measure yourself by number of bugs

This is especially important.

Ten cosmetic bugs do not automatically represent more valuable testing than one payment-integrity defect.

James Bach published a useful piece in 2026 arguing against treating bug counts as a measure of quality. Such metrics can be manipulated without improving the system—for example by changing reporting rules, classification, or what gets recorded. [Satisfice](https://www.satisfice.com/blog/archives/487091?utm_source=chatgpt.com)

This also means:

**“I found 30 bugs this sprint.”**

is usually weak evidence that you tested well.

A much stronger story might be:

> “We identified a risk where promotion calculation could diverge between checkout and payments. I investigated the affected discount types, helped isolate the responsible service, and we added API-level checks around the calculation boundary.”

That tells me far more about the tester's skill.

------------------------------------------------------------------------

# How this changes your work tomorrow

When you find your next meaningful bug, resist opening Jira immediately.

Spend another 10–15 minutes investigating.

Try to answer:

**What exactly happened?**

**What conditions trigger it?**

**Which condition actually matters?**

**Can I simplify reproduction?**

**Can I reproduce it through API as well as UI?**

**Which component appears responsible?**

**How many users/workflows might be affected?**

**What business consequence could result?**

**What evidence would change someone's mind about its importance?**

Then write the report.

You will frequently discover that those extra minutes either make the bug much stronger—or prove that the problem is less serious than you initially thought.

Both outcomes are valuable.

------------------------------------------------------------------------

## Today's challenge

Consider this e-commerce defect:

> A logged-in customer adds products worth €80 to their cart. After logging out and logging back in on another device, the cart contains the products but the previously applied discount has disappeared.

Don't write test cases yet.

Imagine you are about to discuss this with the Product Owner and developer.

Determine the **observation**, your **initial hypothesis**, at least three possible **business risks**, what you would **investigate before reporting it**, and what evidence could make you either **increase or decrease its priority**.

The important part isn't finding one “correct” answer.

It's practicing the transition:

**Bug → Investigation → Evidence → Risk → Communication → Decision.**

That's one of the transitions that separates someone who executes tests from someone who can genuinely influence product quality.

For deeper reading, Cem Kaner's original Bug Advocacy material is worth studying, and James Bach's Rapid Testing bug-reporting guide is a useful companion. [Kaner+1](https://kaner.com/pdfs/bugadvoc.pdf?utm_source=chatgpt.com)

[Cem Kaner — Bug Advocacy material](https://kaner.com/pdfs/bugadvoc.pdf?utm_source=chatgpt.com)  
[James Bach — Rapid Testing Guide to Making Good Bug Reports](https://www.satisfice.com/download/rapid-testing-guide-to-making-good-bug-reports?utm_source=chatgpt.com)  
[Michael Bolton — Testing Is Socially Challenging](https://developsense.com/blog/2023/03/testing-is-socially-challenging?utm_source=chatgpt.com)
