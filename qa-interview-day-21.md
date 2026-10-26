# QA Interview Q&A — Day 21

## Question: The same free-shipping bug has reached production twice this year. Your VP of Engineering announces: "From Monday, no bug ticket gets closed without an automated test that would have caught it." Is that a good rule?

**Scenario:** You're the QA lead at a Hamburg online fashion retailer. Orders of €50 or more get free shipping. In March, customers found that the threshold was checked against the basket total *before* vouchers. A €55 basket with a €10 voucher still shipped free. The bug was fixed. In September it came back after the voucher service was refactored. Code freeze for Black Friday (27 November) starts on 16 November. The VP announces the new rule at the engineering all-hands and asks for objections by Friday.

## Answer

### Short version

The VP is right to worry about recurrence, but I'd change how the rule is written. Taken literally, it says three things:

- A test is the only valid kind of prevention.
- Every bug is best caught by an automated check.
- Compliance is measured by counting new artifacts.

I'd propose a different rule: **every fixed bug closes with an explicit prevention decision.** By default, that decision is an automated check at the lowest layer that can fail for the right reason. There's also a short list of legitimate alternatives, and each one needs a recorded reason. That keeps what's good about the VP's rule and avoids most of the harm.

### 1. Find out which problem the rule is meant to solve

Before arguing for or against anything, I'd want two pieces of evidence. Ideally I'd discuss them with the VP privately before Friday rather than in front of everyone.

**Why did the free-shipping bug come back?** This one fact shapes the whole conversation.
- **No test after the March fix:** the VP's rule targets exactly this gap.
- **A test existed but lived in the old voucher service:** it was deleted or rewritten during the refactor. The rule wouldn't have helped. The real problem is tests tied to implementation details instead of behavior. Google's *Software Engineering at Google* calls these brittle tests. The ideal test only changes when the requirements change.
- **There was a UI end-to-end test, but it was quarantined as flaky months ago:** in that case the problem is how the suite is looked after, not a missing rule.

**How often do escaped bugs come back?** I'd pull the last two quarters of production bugs, say about 40 tickets, and sort them:
- How many were reintroduced bugs that had been fixed before?
- How many were new bugs in new code?
- How many came from configuration, data, or third parties?

A regression check written when bug X is fixed protects against bug X returning. It says nothing about the next new bug. If 3 of the 40 were recurrences, the rule spends a lot of effort on a small slice of the risk. Michael Bolton makes this point in *Regression Obsession*: testers can end up buried under an ever-growing regression suite while the other product risks go unexamined. If 15 of the 40 were recurrences, the VP has found a real pattern, and I'd say so openly.

### 2. Sort real bugs by what would actually have prevented them

This is the most persuasive part of the meeting. Instead of arguing in the abstract, I'd take a handful of real tickets. These are illustrative examples:

| Bug | Test that "would have caught it" | Better prevention | Automated check? |
|---|---|---|---|
| Free-shipping threshold uses the pre-voucher total | UI test: €55 basket, voucher, check shipping | Table-driven service test of the rule "shipping is based on the post-discount merchandise total" for every discount type (voucher, bundle, staff, gift card) | Yes, but covering the rule, not the single incident |
| Austrian VAT rate wrong after a config edit | A test asserting "AT = 20%" | Validate the tax config against its source during deploy, and get a second pair of eyes on config changes | The hard-coded assertion just repeats the config. Validate the pipeline instead |
| Double order when a customer taps "Buy" twice on a slow connection | UI test with simulated network latency | API test showing that a repeated request with the same idempotency key creates one order, plus a database uniqueness constraint | Yes, at the API layer. A timing-dependent UI test would be flaky |
| Payment provider changed the casing of its webhook signature header | A test against our own mock, which would never fail | Alert on the webhook rejection rate, accept headers case-insensitively, and review provider changelogs | Mostly a production monitor. Our own test can't see a change made by the provider |
| "Buy now" button hidden behind the cookie banner on small iPhones in German | Screenshot test on every device | Layout fix, a design-review note about long German labels, and possibly one visual check for the narrowest supported viewport | Maybe one check. Not one per device |
| Typo in a transactional email | Assert on the email text | Fix it | No. A check would just copy the text |

For most bugs, the useful question isn't "is there a test?" It's "what is the cheapest reliable thing that stops this kind of bug from reaching customers?"

### 3. What the rule gets right

I'd say this clearly so nobody thinks I'm against automation:

- **When you fix a bug, a regression check costs very little.** The developer already understands the failure, has a reproduction, and has the code open. Martin Fowler's test pyramid makes a related point: if a high-level test finds a bug, you also have a missing or wrong lower-level test. Replicate the bug there before fixing it.
- **Rules like this can work.** In 2017, the Tor project proposed requiring regression tests for bug fixes in Core Tor. It also proposed a procedure for exceptions, decided during patch review. The exception path was part of the design from the start.
- **It forces a useful conversation** about why the bug happened and where it could have been caught.

### 4. How it goes wrong if adopted literally

1. **Tests at the wrong layer.** Bugs are usually reported through the UI, so the easiest reproduction is a UI test. Forty of those a quarter add minutes to every pipeline run and create new sources of flakiness, just before a code freeze.
2. **Tests that preserve the incident instead of the rule.** "Voucher SPRING10 on SKU 4471 gives €4.95 shipping" turns into a museum of old bugs. The September version of the bug involved a bundle discount, not a voucher, and a test copied from the March incident would probably have missed it. A test of the rule itself, run across all discount types, would have caught it.
3. **Tests that never failed.** A test written after the fix that passes both with and without the fix proves nothing. Require evidence that it fails without the fix: write the test first, or revert the fix on a branch and show the check goes red.
4. **Change-detector tests** for config, copy, and constants. They break whenever someone makes a legitimate change and protect against nothing.
5. **Bad incentives.** When closing a bug costs more, people find workarounds. Bugs get relabelled as "tasks" or "improvements". Testers feel pressure to log fewer bugs. Worst of all, in the week before Black Friday, an urgent fix waits because the check is hard to write. The rule would be adding risk in the period we care about most.
6. **A bottleneck.** If "automated test" quietly means "QA writes it", every fix waits in a queue. Bolton also asks whether testers are even best placed to maintain regression suites.
7. **False confidence.** A green suite of old bugs feels like evidence about the next release, but it isn't. Bolton's *The Secret Life of Automation* puts it this way: automated checking exists, but it cannot do the testing. James Bach's *Test Automation Snake Oil* has been taking apart the "machines are faster, cheaper, more reliable, so automate" argument since 1996. That argument is hiding inside this rule too.

### 5. The rule I'd propose instead

> **Every bug fix records a prevention decision, agreed between the developer and a tester in review:**
> - **A. Automated check (default):** written at the lowest layer that fails for the right reason, against behavior or a public API, and shown to fail without the fix.
> - **B. Check for the whole class of bug:** a rule, table, or property check instead of one example.
> - **C. Structural fix that makes the bug impossible:** a constraint, an idempotency key, a type, or schema validation.
> - **D. Detection in production:** an alert or reconciliation job, when the failure comes from outside our code.
> - **E. No new check:** with a one-line reason, such as "code deleted" or "one-off data fix". The reason has to be visible, not silently skipped.
>
> During the freeze, a missing check never blocks an urgent fix. The ticket for the check stays open, and someone owns it.

Then I'd suggest a **six-to-eight-week pilot** and measuring:
- recurrences of fixed bugs
- the split between options A–E
- changes in pipeline time and flaky-test rate
- time to close fixes

If option E turns into a dumping ground, that shows up in the data and the rule can be tightened.

### 6. What to say in the meeting

> "I support the goal. The free-shipping bug coming back twice is embarrassing, and we should stop that. I looked at the last 40 production bugs. Here's how many were recurrences, and here's what would actually have stopped each of the six I've shown you. For most of them, the right protection is a check at the API or service level. For a few it's a database constraint or an alert, and for one it's nothing. I'm worried that a literal 'test for every ticket' rule will add slow UI tests and relabelled tickets right before the freeze. Can we try a version where every fix records how we'll prevent it, with an automated check as the default? Then let's review the numbers in December."

Notice what this script avoids: "you can't automate everything", "QA won't accept this", or any claim that I have a veto. The policy belongs to the VP. My job is to give them better evidence than they had when they wrote it.

### Common weak answers

- **"Yes, every bug should have a test. It's best practice."** This ignores where the test lives, what it costs, and bugs a test can't catch.
- **"No, you can't automate everything."** A slogan with no evidence and no alternative.
- **"QA will add an end-to-end test for each bug."** This makes the suite slower and QA the bottleneck.
- **Measuring success by test count or coverage** instead of by recurrences and escaped bugs.
- **Treating this as a fight with the VP** instead of improving a rule whose intent is sound.

### Follow-up questions

1. Six weeks into the pilot, the regression check for the free-shipping fix has failed intermittently five times. A developer wants to delete it. What do you do? *(Look for an answer that finds out whether the flakiness is in the check, the test data, or the product. Concurrency in the voucher service would be a real bug. If it's the check, the answer should consider moving it down a layer before deleting it.)*
2. Six months from now, how would you tell whether the rule, or your version of it, actually reduced risk instead of just producing more tests?

## Sources

- Michael Bolton, [Regression Obsession](https://developsense.com/blog/2019/08/regression-obsession), DevelopSense (2019). Argues that testers get buried in maintaining ever-growing regression suites while non-regression risks are neglected, and questions whether testers should own that work. It underpins the "find out which problem we're solving" step and the bottleneck warning.
- Michael Bolton, [The Secret Life of Automation](https://developsense.com/blog/2019/12/the-secret-life-of-automation), DevelopSense (2019, updated 2022). Distinguishes automated checking from testing: checks exist, but they don't do the testing. It supports the false-confidence point.
- James Bach, [Test Automation Snake Oil](https://www.satisfice.com/download/test-automation-snake-oil), Satisfice (1996, revised 1999). A classic rebuttal of the "machines are faster, cheaper, more reliable, so automate" argument that sits under blanket automation mandates.
- Martin Fowler, [Test Pyramid](https://www.martinfowler.com/bliki/TestPyramid.html) (2012). Says a bug found by a high-level test reveals a missing lower-level test, and recommends reproducing it there before fixing. It's the basis for "lowest layer that fails for the right reason."
- Google, [Software Engineering at Google, Chapter 12: Unit Testing](https://abseil.io/resources/swe-book/html/ch12.html). Defines brittle tests, recommends testing behavior through public APIs, and describes the ideal test as one that changes only when requirements change. It explains how a bug's regression test can disappear in a refactor.
- Taylor Yu, [Moving toward requiring regression tests for bug fixes](https://archive.torproject.org/websites/lists.torproject.org/pipermail/tor-dev/2017-June/012361.html), tor-dev mailing list (June 2017). A real project proposing this kind of rule, with an exception procedure decided during patch review. It shows the rule works better when exceptions are part of the design.
