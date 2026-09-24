# QA Interview Q&A — Day 1

## Question: Your team just shipped a checkout redesign. The automation suite is green, but a support ticket says customers in Germany can't complete a purchase with a saved SEPA mandate. How does this happen with "full coverage," and what do you change?

## Answer

The first move is not to defend the suite — it's to find out what "full coverage" actually meant before the redesign shipped. In most orgs that phrase is inherited folklore: someone counted test cases or looked at a code-coverage percentage, not at what the suite could actually *detect*. An experienced tester treats the green pipeline as evidence of "nothing we checked for broke," not "nothing is broken."

**Reasoning through it before the meeting:**

1. **Pull the actual scenario.** SEPA mandates involve a stored payment method with locale-specific mandate text, a different confirmation flow (delayed debit, no instant auth), and possibly a different state machine than card payments. Ask: was SEPA in the test matrix at all, or was "payment methods" represented by one happy-path card test that the team assumed generalized? Nine times out of ten, the gap is that automation encoded *one* instance of a category and the team quietly treated that instance as covering the category.

2. **Check what layer the checks ran at.** If the suite mocks the payment gateway (common, for speed and reliability), it can pass while a real SEPA mandate integration silently breaks — the redesign might have changed how the mandate ID is passed to the gateway, something a mocked test can't catch because the mock doesn't enforce the real contract. This is the classic automation trap: fast, deterministic checks are only as good as the fidelity of what they're checking against.

3. **Look at who wrote the automated checks and when.** If they were written once during the original SEPA rollout and never revisited, they may assert against UI text or element structure that no longer matches the redesigned checkout, and could have been silently skipped, soft-failing, or asserting the wrong thing without anyone noticing — a maintenance rot problem, not a coverage problem.

**What to say in the meeting:**

Don't say "the tests missed it" as if that's the root cause — that's a symptom. Say something like: "Our automated checks validate the card-payment path end-to-end, but SEPA runs through a different mandate flow, and we don't have a check that exercises it against a real or contract-tested gateway response. I want us to decide: do we add that as an automated regression check, or is this a case where a scripted manual/exploratory pass on alternative payment methods before each checkout release is more cost-effective given how rarely that flow changes?" That framing puts a real tradeoff in front of the team instead of implying "more automation" is automatically the fix — sometimes the right answer is a pre-release exploratory charter on payment method variants, not another brittle script, especially if SEPA-specific bugs are rare and expensive to reproduce automatically (real bank mandate states, locale-specific text, timing of async debit confirmation).

**What a weak answer looks like:** "We'll add a SEPA test to the automation suite" without diagnosing *why* it wasn't there or whether an automated check is even the right tool for something involving asynchronous bank-side state and locale text. Also weak: blaming the developers for not writing a unit test, when the real issue is a testing/coverage strategy that never made explicit which payment methods, locales, and layers were actually being checked versus assumed.

**The underlying principle:** as Michael Bolton argues, a test itself can't be automated — only checks for specific facts within it can be — so "the automation didn't catch it" is really a claim about which facts we chose to check, at which layer, and how current those checks are. A context-driven automation strategy treats tool-based checking as one tactic in a broader test strategy that still requires human judgment about what's risky and unverified.

**Good follow-ups:**
- "How would you decide whether this gap should be closed with an automated regression check, a contract test against the payment gateway, or a recurring exploratory charter?"
- "If the mocked gateway is the problem, how do you balance test speed against fidelity to the real integration?"

## Sources
- [Which Test Cases Should I Automate? — DevelopSense (Michael Bolton)](https://developsense.com/blog/2018/06/which-test-cases-should-i-automate)
- [A Context-Driven Approach to Automation in Testing — DevelopSense](https://developsense.com/blog/2016/01/a-context-driven-approach-to-automation-in-testing)
