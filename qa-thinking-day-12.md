# QA Thinking — Day 12

## Accessibility Testing: “0 Axe Violations” Does Not Mean Your Checkout Is Usable

Imagine your CI pipeline contains this check:

    Checkout accessibility scan
    Violations: 0

    PASS

The team is happy.

Then you try to buy something without touching the mouse.

You press `Tab` through the checkout.

    Email        ✓
    First name   ✓
    Last name    ✓
    Street       ✓
    City         ✓
    Country      ✓

The country selector receives focus.

You press:

    Enter
    Space
    Arrow Down

Nothing happens.

The control is a custom dropdown that works beautifully with a mouse but cannot be operated from the keyboard.

Because country is required, you cannot continue to shipping.

Your automated accessibility check was completely green.

Your checkout is inaccessible.

Neither observation contradicts the other.

The automated tool answered something like:

> “Did I detect any accessibility problems covered by my rules?”

Your actual testing question was:

> **“Can a customer who does not use a mouse successfully buy something?”**

Those are different questions.

Michael Bolton and James Bach's distinction between testing and algorithmic checking is useful here. Automated checks can be valuable parts of a test strategy, but the tester still has to decide what matters, investigate the product, observe behavior, model users and interpret the results. Michael explicitly warns against treating automated checking as though it represented the entirety of testing. [DevelopSense+1](https://developsense.com/blog/2016/04/you-are-not-checking?utm_source=chatgpt.com)

Accessibility is one of the clearest places to see that distinction.

------------------------------------------------------------------------

## First: automated accessibility testing is extremely useful

I don't want you to leave today's lesson thinking:

> “Axe is useless.”

Quite the opposite.

Automation can detect large numbers of problems cheaply and consistently.

For example:

    missing form labels
    invalid ARIA relationships
    some contrast problems
    missing document language
    invalid accessible names
    certain structural problems

Deque analyzed more than 13,000 page/page states containing nearly 300,000 accessibility issues from first-time audits. In that dataset, its axe-core-powered automated testing identified 57.38% of the total recorded issues. That is substantial value for something that can run continuously in CI. [Deque](https://www.deque.com/automated-accessibility-coverage-report/?utm_source=chatgpt.com)

The mistake is making this jump:

    axe found no issues
            ↓
    page is accessible

The evidence does not support that conclusion.

In the same Deque dataset, automated checks found **none** of the recorded issues categorized as Focus Order or Focus Visible, and only a very small share of the Keyboard issues. Those were overwhelmingly found manually. [Deque](https://www.deque.com/automated-accessibility-coverage-report/?utm_source=chatgpt.com)

That is exactly the type of problem our broken country selector represents.

So a better model is:

    Automation
        ↓
    cheap repeatable accessibility checks

    +

    Human investigation
        ↓
    actual interaction and usability

    +

    Assistive technology
        ↓
    how information and controls are exposed

    =

    much stronger accessibility testing

------------------------------------------------------------------------

# Don't test accessibility as a separate page inspection

Suppose somebody tells you:

> “Please accessibility-test checkout.”

A weak approach might be:

    Open checkout
    Run axe
    Check contrast
    Check labels
    Done

I would instead start from the **business journey**.

For an e-commerce product, the mission might be:

> **Can a customer complete a purchase without relying on a mouse or visual-only information?**

Now the journey becomes something like:

    Find product
          ↓
    Choose variant
          ↓
    Add to cart
          ↓
    Change quantity
          ↓
    Apply voucher
          ↓
    Start checkout
          ↓
    Enter address
          ↓
    Select shipping
          ↓
    Enter payment
          ↓
    Handle validation errors
          ↓
    Place order
          ↓
    Understand confirmation

Accessibility failures anywhere in that chain can become commercial failures.

W3C's current forms guidance explicitly uses purchasing as one of the major form use cases and notes that forms can be visually and cognitively complex. It recommends clear labels, meaningful grouping, instructions and understandable feedback, while also noting that unnecessary complexity can contribute to abandonment. [W3C](https://www.w3.org/WAI/tutorials/forms/?utm_source=chatgpt.com)

This is therefore not merely:

> “Check whether labels have `for` attributes.”

The meaningful product question is:

> **Can the user accomplish the transaction?**

------------------------------------------------------------------------

# Start with the cheapest manual accessibility test you have: put the mouse away

Ministry of Testing recommends a remarkably simple exercise:

> navigate the product using only the keyboard.

You don't need expensive accessibility tooling for this first experiment. Keyboard-only exploration can reveal problems with operability, focus visibility and navigation very quickly. [Ministry of Testing](https://www.ministryoftesting.com/insights/simple-tests-for-accessibility-every-tester-should-know?utm_source=chatgpt.com)

On a typical web application, experiment with:

    Tab
    Shift + Tab
    Enter
    Space
    Arrow keys
    Escape

But don't merely ask:

> “Can every control receive focus?”

That's too shallow.

Ask:

> **Can I understand where I am and complete the workflow?**

Consider this checkout.

You tab through:

    Email
    First name
    Last name
    Street
    City
    Country
    Continue

That sounds good.

But perhaps the visible focus indicator looks like this:

    normal field:
    ┌────────────────────────┐
    │ Germany                │
    └────────────────────────┘

    focused field:
    ┌────────────────────────┐
    │ Germany                │
    └────────────────────────┘

Nothing visually changes.

Technically, keyboard focus exists.

Practically, a sighted keyboard user cannot tell where it is.

That's why WCAG distinguishes keyboard operability from visible focus. [W3C+1](https://www.w3.org/WAI/WCAG22/Understanding/?utm_source=chatgpt.com)

------------------------------------------------------------------------

# Now look for the bug between “focus exists” and “focus is useful”

Imagine checkout has a sticky order summary:

    ┌────────────────────────────┐
    │ Address fields             │
    │                            │
    │                            │
    │                            │
    │                            │
    ├────────────────────────────┤
    │ TOTAL €87   PLACE ORDER    │ ← sticky footer
    └────────────────────────────┘

You tab downward.

Eventually focus reaches:

    Terms and conditions checkbox

But that checkbox sits underneath the sticky footer.

So technically:

    focused = true

Yet the customer cannot see it.

WCAG 2.2 introduced **Focus Not Obscured (Minimum)** at Level AA specifically for this kind of problem: when a component receives keyboard focus, author-created content should not completely hide it. W3C gives sticky headers, footers and overlapping content as typical examples. [W3C+1](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/?utm_source=chatgpt.com)

Notice what happened.

A DOM assertion might say:

    expect(element).toBeFocused();

and pass.

The actual user experience is still broken.

That distinction should become familiar:

    technical state
    ≠
    usable state

------------------------------------------------------------------------

# Dynamic components deserve special attention

Modern e-commerce sites contain lots of custom components:

    country combobox
    size selector
    date picker
    voucher drawer
    cart side panel
    address autocomplete
    payment widget
    confirmation modal

These are often much riskier than plain HTML controls.

Imagine clicking:

    Apply voucher

opens:

    ┌────────────────────┐
    │ Apply voucher      │
    │                    │
    │ Code: [________]   │
    │                    │
    │ [Apply]       [X]  │
    └────────────────────┘

With the mouse, everything works.

Now use the keyboard.

You press Enter on **Apply voucher**.

The dialog appears.

But focus remains on the button behind it.

Then `Tab` moves through:

    Cart
    Checkout
    Header links
    Footer links

while the modal remains visually open.

That is a serious interaction problem.

Your accessibility test should ask things such as:

    Where does focus go when the dialog opens?

    Can I navigate only inside the active dialog?

    Can I close it using the keyboard?

    Where does focus return when it closes?

These questions are difficult to reduce to a generic static scanner because they concern **state transitions and interaction behavior**.

This connects beautifully with the state-based testing we've practiced throughout this series.

Don't test only:

    Voucher dialog closed

and:

    Voucher dialog open

Investigate:

    closed
      ↓
    opening
      ↓
    open
      ↓
    validation error
      ↓
    success
      ↓
    closing
      ↓
    return focus

Bugs often live in those transitions.

------------------------------------------------------------------------

# Accessibility testing is also API/state testing in disguise

Suppose a customer enters an invalid postcode.

Checkout sends:

    POST /checkout/address

Backend responds:

    {
      "errors": {
        "postcode": "Invalid postcode"
      }
    }

The frontend renders a red border.

A sighted mouse user sees:

    Postcode
    [123]    ← red border

But nothing else happens.

The API is correct.

The visual UI displays the error.

Yet a screen-reader user may receive no useful notification of what changed.

W3C's forms guidance recommends making errors understandable, associating them with the corresponding field and ensuring dynamic error feedback is programmatically exposed. Its examples include connecting error text with fields and making dynamic summary messages available to assistive technologies. [W3C+1](https://www.w3.org/WAI/tutorials/forms/notifications/?utm_source=chatgpt.com)

Again, don't reduce the test to:

    Error appears ✓

Ask:

> **Can the affected user discover the error, understand it and recover from it?**

That is a much stronger oracle.

------------------------------------------------------------------------

# Error recovery matters more than error presence

Suppose checkout contains six fields.

Three are invalid.

After clicking:

    Continue

you see:

    3 errors

Good.

Now imagine using the keyboard.

Focus remains on:

    Continue

The errors are 800 pixels above.

You don't know which fields failed.

You begin tabbing.

Eventually you discover:

    Street → okay
    City → error
    Postcode → error
    Country → error

That may technically expose all required information somewhere on the page.

But the recovery experience is poor.

W3C's current guidance says error notifications should be clear, identify the relevant field and provide useful information about how the mistake can be corrected. It also describes moving focus to an erroneous field as a useful pattern in appropriate cases. [W3C+1](https://www.w3.org/WAI/tutorials/forms/notifications/?utm_source=chatgpt.com)

For a QA engineer, that suggests a better test mission:

> **After making realistic mistakes, can I efficiently recover without needing to rediscover the whole form?**

That's very different from checking:

    error div exists

------------------------------------------------------------------------

# Labels are more than visible text

You see:

    Email address
    [________________]

So you conclude:

> “It has a label.”

But inspect how the markup works.

Maybe:

    <div>Email address</div>
    <input type="text">

Visually, that looks perfectly reasonable.

Programmatically, the input may have no associated accessible label.

W3C recommends explicitly associating labels with form controls, commonly using:

    <label for="email">Email address</label>
    <input id="email">

because that relationship helps assistive technologies identify the control and also increases the clickable area for users who may have difficulty selecting small targets. [W3C](https://www.w3.org/WAI/tutorials/forms/labels/?utm_source=chatgpt.com)

Automated tools are often excellent at finding this kind of issue.

This is precisely where automation shines.

So your strategy should not be:

    manual OR automation

It should be:

    automation finds cheap structural problems

    human testing finds behavioral problems

    assistive technology exposes interaction/meaning problems

Different techniques attack different risks.

------------------------------------------------------------------------

# Accessibility automation belongs in CI — but use it as a guardrail

Suppose you're using Playwright.

Running axe against important pages is sensible.

Conceptually:

    test('checkout has no automatically detectable violations', async ({ page }) => {
      await page.goto('/checkout');

      const results = await scanAccessibility(page);

      expect(results.violations).toEqual([]);
    });

That's valuable because developers get quick feedback when somebody introduces:

    missing label
    bad ARIA
    contrast regression
    invalid structural relationship

But notice how I would name the check:

> **no automatically detectable violations**

not:

> **checkout is accessible**

The first statement reflects what the evidence actually tells us.

That wording may feel pedantic, but precision matters in QA.

A test report should not claim more confidence than the test actually provides.

------------------------------------------------------------------------

# Don't run accessibility automation only on page load

Here's another subtle mistake.

Imagine checkout initially contains:

    Address
    Shipping
    Payment

You scan it.

Everything passes.

Then clicking:

    Apply voucher

loads a modal containing a missing label.

Clicking:

    Pay by credit card

loads a payment iframe.

Submitting an invalid address creates new error content.

The page now has states that never existed during the initial scan.

Deque recommends thinking in terms of page **states** and user flows rather than assuming one scan of the initial DOM covers an interactive application. Its accessibility testing guidance explicitly discusses testing critical user flows such as retail add-to-cart and similar interactions. [Deque+1](https://www.deque.com/blog/scripted-user-flow-testing-vs-end-to-end-testing-for-accessibility/?utm_source=chatgpt.com)

So your automated checks may need to scan after meaningful transitions:

    checkout loaded

    voucher modal open

    validation errors displayed

    shipping option selected

    payment UI loaded

That is state-based accessibility testing.

------------------------------------------------------------------------

# Accessibility is another reason to think in critical journeys

Suppose your application has 3,000 pages.

Scanning all of them sounds impressive.

But customers make money-generating transactions through perhaps a handful of flows.

For an e-commerce platform, I would prioritize:

    Product discovery → cart → checkout → payment

    Login → account → order history

    Return/refund request

    Customer-service contact

That doesn't mean ignore everything else.

It means risk guides depth.

James Bach's Heuristic Test Strategy Model encourages exactly this kind of contextual reasoning: testing effort should be influenced by product factors, quality criteria and project risk rather than by mechanical enumeration. [Satisfice](https://www.satisfice.com/download/heuristic-test-strategy-model?utm_source=chatgpt.com)

Accessibility becomes much more manageable when you ask:

> **Which user journeys would cause the greatest harm if somebody couldn't complete them?**

That's a better starting point than:

> “How many WCAG criteria do we have?”

------------------------------------------------------------------------

# Now use a screen reader — but have a mission

Eventually you should investigate with assistive technology such as:

    NVDA + browser

    VoiceOver + Safari

But don't open a screen reader and randomly tab around.

Pick a mission.

For example:

> **Complete guest checkout and investigate whether every required control, state change, validation error and transaction result is understandable without relying on visual presentation.**

Then listen critically.

Imagine the visible button says:

    Place order — €82.40

but the screen reader announces:

    Button

That's a problem.

Perhaps another control says:

    Remove

three times:

    Remove
    Remove
    Remove

A sighted user knows which item each belongs to because of layout.

Someone navigating through the accessibility tree may lack that context.

Testing accessibility requires asking:

> **What information did the visual design communicate implicitly, and is that meaning available through another representation?**

That's deeper than standards memorization.

It's a product-modeling skill.

------------------------------------------------------------------------

# Touch targets show why accessibility often improves general usability

WCAG 2.2 added a Level AA minimum target-size requirement. In general, pointer targets should be at least 24 × 24 CSS pixels or have enough spacing to avoid accidental activation, subject to specified exceptions. W3C explains that the goal is to help people who have difficulty with fine motor control avoid activating adjacent targets by mistake. [W3C](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum?utm_source=chatgpt.com)

Think about a mobile cart:

    Quantity

    [-][1][+]

    Remove ×

Tiny controls packed together may be particularly difficult for someone with motor impairment.

But they can also be annoying when you're:

    on a moving train
    holding a baby
    using the phone one-handed
    wearing gloves
    tired

This is a useful mindset:

> Accessibility is not a collection of weird special cases.

Many accessibility improvements increase robustness for a much broader range of real-world use.

------------------------------------------------------------------------

# Don't become the “WCAG police”

This is where soft skills matter.

Suppose you find that the voucher modal cannot be operated with the keyboard.

You tell the developer:

> “This violates WCAG 2.1.1.”

Developer responds:

> “Okay, but we have release blockers already.”

You repeat:

> “But WCAG says it has to work.”

The conversation can quickly become adversarial.

Try communicating the **product problem** first:

> “When checkout opens the voucher dialog, keyboard focus stays on the page behind it. A keyboard-only customer can't reliably interact with the dialog or close it. I reproduced it in Chrome and Firefox. Mouse interaction works. Because this occurs during checkout, it can block customers who don't use a mouse from completing the purchase.”

Then add:

> “It also maps to WCAG keyboard-access requirements.”

Now the standard supports your evidence.

It isn't substituting for the explanation.

That's the same bug-advocacy principle we learned earlier:

    observation
        ↓
    user consequence
        ↓
    evidence
        ↓
    relevant standard

rather than:

    standard
        ↓
    therefore fix it

You are helping the team understand risk rather than merely quoting rules.

------------------------------------------------------------------------

# What if the developer says “axe passes”?

Don't argue about the tool.

Agree with the evidence.

You can say:

> “Yes, the automated scan passes. The failure appears during interaction: after the modal opens, keyboard focus remains behind it. Automated scans are useful for structural issues, but this one is about focus behavior. I can reproduce it with the keyboard in about ten seconds.”

That's persuasive because you are not saying:

    tool bad

You're saying:

    tool answered one question
    our experiment answered another

Deque's own data is useful supporting evidence here: many focus-order, visible-focus and keyboard issues in its audit dataset required manual detection even though automated checks found many other accessibility problems. [Deque](https://www.deque.com/automated-accessibility-coverage-report/?utm_source=chatgpt.com)

This is a mature QA conversation.

------------------------------------------------------------------------

# A useful accessibility test strategy

I would think about a critical journey through several complementary lenses.

First, use automated tooling continuously to catch cheap structural regressions.

Then perform keyboard-only exploration of the complete workflow.

Inspect dynamic state transitions:

    modal opens
    validation appears
    loading starts
    results update
    form succeeds

Then use a screen reader on the most important journeys and components.

Investigate zoom/reflow and responsive behavior where relevant.

Use real mistakes rather than pristine test data so you exercise error recovery.

And most importantly, don't stop at:

    Can I activate this control?

Ask:

    Can I understand it?

    Can I discover what happened?

    Can I recover from mistakes?

    Can I complete the business goal?

That final question keeps accessibility testing grounded in product quality rather than checklist compliance.

------------------------------------------------------------------------

# A current standards note

As of September 2026, W3C continues to encourage teams to use **WCAG 2.2** as the latest finalized WCAG 2 standard. WCAG 2.2 includes criteria such as Focus Not Obscured and Target Size (Minimum). [W3C+1](https://www.w3.org/WAI/standards-guidelines/wcag/?utm_source=chatgpt.com)

You may also see discussion of **WCAG 3.0**. W3C published an updated Working Draft on September 10, 2026, but it remains a draft under development. Don't treat WCAG 3 as though it has already replaced WCAG 2.2. [W3C](https://www.w3.org/TR/2026/WD-wcag-3.0-20260910/?utm_source=chatgpt.com)

For day-to-day testing now, WCAG 2.2 plus strong user-focused investigation is the practical place to work.

------------------------------------------------------------------------

# Today's challenge

You are testing checkout.

Your automated axe scan reports:

    0 violations

Now perform this thought experiment.

The checkout contains:

    Address form

    Country combobox

    Apply voucher modal

    Sticky order-summary footer

    Place order button

You discover three things.

When the voucher modal opens:

    focus remains behind the modal

When address validation fails:

    three fields turn red

but no obvious error summary or focus movement occurs.

And while tabbing near the bottom of checkout:

    the sticky order summary completely covers
    the currently focused Terms checkbox

Don't create three tickets immediately.

Your exercise is to design **three investigations**.

For each one, identify:

    the user task

    the failure condition

    what evidence you would collect

    the business consequence

    what part is worth automating afterward

For example, with the voucher modal, your mission might be:

> Open and use the voucher workflow using keyboard only, including invalid voucher, successful voucher and closing the dialog, while observing focus movement at every state transition.

Then ask:

> **What would this teach me that the initial axe scan could not?**

That's the important question.

Because today's central lesson is not:

> “Do manual accessibility testing.”

It is:

> **Understand what information each testing technique can and cannot give you.**

Automated accessibility checks are powerful.

Keyboard testing is powerful.

Screen-reader testing is powerful.

Standards are useful.

None of them alone tells you:

> **Can this person successfully accomplish what the product exists to let them do?**

Answering that requires testing judgment.

And when the product is an e-commerce checkout, that judgment connects directly to accessibility, customer experience, conversion, technical correctness and business risk.

That is quality engineering.

### Recommended reading

W3C's Forms Tutorial is one of the most useful practical accessibility references for testers because it connects labels, validation, feedback and assistive-technology behavior directly to workflows such as purchasing. Ministry of Testing's keyboard-testing article is an excellent low-cost technique you can use immediately. Deque's accessibility coverage study is useful for understanding both the power and the limitations of automated checks, while Michael Bolton's testing/checking work explains why those checks should sit inside a larger investigative testing strategy. [DevelopSense+3W3C+3Ministry of Testing+3](https://www.w3.org/WAI/tutorials/forms/?utm_source=chatgpt.com)

[W3C — Forms Accessibility Tutorial](https://www.w3.org/WAI/tutorials/forms/?utm_source=chatgpt.com)

[W3C — Understanding WCAG 2.2](https://www.w3.org/WAI/WCAG22/Understanding/?utm_source=chatgpt.com)

[Ministry of Testing — Simple Tests for Accessibility Every Tester Should Know](https://www.ministryoftesting.com/insights/simple-tests-for-accessibility-every-tester-should-know?utm_source=chatgpt.com)

[Deque — Automated Accessibility Coverage Report](https://www.deque.com/automated-accessibility-coverage-report/?utm_source=chatgpt.com)

[Michael Bolton — Checking Is Inside Testing](https://developsense.com/blog/2025/04/checking-is-inside-testing?utm_source=chatgpt.com)

[James Bach — Heuristic Test Strategy Model](https://www.satisfice.com/download/heuristic-test-strategy-model?utm_source=chatgpt.com)
