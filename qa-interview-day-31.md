# QA Interview Q&A — Day 31

## Question: An AI agent wrote 412 end-to-end tests over the weekend, and every one passed on the first run. Your engineering manager says, "Merge them and drop the two-day manual regression." Do you agree?

**Context:** You test a B2B SaaS subscription-billing portal for a Hamburg company that sells to businesses across the EU. During a hackathon, a developer used Playwright's test agents. The planner explored the app, the generator turned its plans into tests, and the healer fixed the tests that broke. The result is a pull request with 412 new specs. Coverage on the dashboard went from 31% to 78%.

## Answer

### The short version

No to both halves, but I wouldn't reject the work either. "Every test passed on the first run" tells us the tests agree with how the app behaves today. It doesn't tell us that behaviour is correct, or that the tests would fail if it changed for the worse. Before 412 tests become a release gate, and before we drop the people who currently find our billing bugs, I want evidence that these tests catch problems. Getting that evidence takes a few days, not a quarter.

### Step 1: Ask where the expected results came from

This is the most important question. Bach and Bolton separate *checking*, "the mechanistic process of verifying propositions about the product," from *testing*, which a tool can support but can't do. A check is only as good as the proposition it verifies.

The [Playwright docs](https://playwright.dev/docs/test-agents) say the generator checks its selectors and assertions against the live app while it writes the tests. So most of these assertions were taken from what the app showed at the time. Kaner, drawing on Hoffman's list, would call that a regression or consistency oracle. It is useful for spotting change. It can't spot something that was wrong from the beginning.

Here's how that goes wrong. In a sample review, I find a test where an Austrian business customer with a valid VAT ID gets an invoice asserting `Total: €119.00`. That's net plus 19% German VAT. For a cross-border B2B service, I'd expect a reverse-charge invoice instead. I'd check that with finance before calling it a bug, but either way the test has frozen a possible tax defect as the expected result. A green suite like this reflects the app's current behaviour, not the requirements.

### Step 2: Look at what the healer did

The docs say the healer ends a run with either a passing test or "a skipped test if the healer believes that functionality is broken." So I'd ask:

- How many tests are skipped, `fixme`'d, or were changed by the healer?
- In which of those healer changes did the *assertion* change, rather than just a locator?

A healed locator is maintenance. A healed assertion is a decision about what the product should do, and the healer made it without anyone reviewing it. A skipped test might be the most useful output in the whole PR, because it could be a bug the agent noticed and then set aside.

### Step 3: Review a sample by risk

Reading all 412 tests is waste. I'd pick about 40, weighted toward the areas where bugs cost money or customers: proration on plan changes, VAT and reverse charge, dunning and retries, seat changes mid-cycle, cancellation and refunds, invoice PDFs, and role permissions. For each test I'd ask:

- **Is the assertion meaningful?** Are there tests that only check `toBeVisible()` on a heading, or that click through five pages and assert nothing about money or state?
- **Is it a duplicate?** Agents tend to produce many near-identical happy paths.
- **Does it depend on data or order?** Shared seed accounts, tests that only pass in sequence, dates fixed to "today".
- **Does it reach the parts that matter?** Does it get past the UI to webhooks, emails, the ledger and the PDF, or does it stop at "Payment successful"?

The planner's Markdown plans in `specs/` are cheaper to review than the generated code. A product owner or someone from finance can read "Upgrade from Team to Business on day 12 of 30 → expected charge…" and tell us whether the expected result is right. That gets other people checking the oracle, not just QA.

### Step 4: Seed bugs and see whether the suite fails

Coverage shows which code ran, not what was checked. Mutation testing makes the difference visible: as [Stryker](https://stryker-mutator.io/docs/) describes it, you change the code and see whether the tests notice. Full mutation testing over a 412-test end-to-end suite is too slow. A small hand-made version on a branch works fine:

- Make proration one day off.
- Apply 19% VAT to every EU customer.
- Stop sending the dunning email on the second failed retry.
- Let a "billing viewer" role cancel the subscription.
- Re-introduce two real production bugs from the past year.

If the suite catches most of these, that's real evidence. If it stays green, we've learned something important for very little effort.

### Step 5: Count the running costs

- **Runtime:** 412 browser tests at about 25 seconds each is close to three hours serially. Can CI shard them, and will developers wait for them?
- **Flakiness:** Run the suite 20 times in CI, in parallel, against a fresh environment. A test that fails 2% of the time, across 412 tests, gives you a red build most days.
- **Ownership:** Who fixes test 287 when it fails at 18:40 before a release? "The healer" can't be the answer for a release gate.

### Step 6: Find out what the manual regression catches

Before dropping two days of human testing, look at what those two days found in the last six to eight releases. In billing products, I'd expect a lot of findings like these: a PDF where the VAT ID wraps into the address block, a renewal email with last month's amount, an upgrade preview that doesn't match the actual charge, confusing wording on a failed-payment banner. Many of these aren't things anyone thought to assert. Someone noticed them. Bach's point that "testing cannot be automated" isn't a slogan here. It describes what was actually lost if those findings stop.

The useful move is to cut the scripted parts of the regression that the seeded-bug results show are now covered. Spend the freed time on focused exploratory sessions on whatever changed in each release.

### What I'd say in the meeting

> "This is a real head start. Writing these by hand would have taken weeks, and I want to keep a good chunk of it. But 'all green on the first run' mostly tells us the tests agree with the app as it is today. I found at least one test that may have locked in wrong VAT on an Austrian B2B invoice. I'm checking that with finance. And the healer skipped some tests where it thought the feature was broken, which we haven't looked at yet.
>
> So here's my proposal. This week we review a risk-weighted sample, run the suite 20 times for flakiness, and seed six known billing bugs on a branch to see what it catches. Tests that pass that bar get merged with an owner. Tests with weak or wrong assertions get rewritten or deleted. The healer can propose fixes, but any change to an assertion goes through review. Then we cut the parts of manual regression these tests have actually been shown to cover, and keep exploratory time for billing changes. I'll bring the numbers to next Monday's planning so you can decide with evidence."

Notice what this does and doesn't claim. I'm not vetoing anything. Whether to merge and whether to drop the regression are the manager's decisions. My job is to make sure those decisions rest on what the tests actually show, and to say clearly what remains unknown.

### Weak answers interviewers hear

- **"AI-generated tests can't be trusted, so reject them."** This is reflexive, throws away useful work, and makes QA look like it's protecting its own territory.
- **"Coverage went from 31% to 78%, so we're much safer."** That number shows which code ran, not whether anything meaningful was checked.
- **"I'd review all 412 line by line."** That doesn't scale, and it treats every test as equally important.
- **"Keep the manual regression exactly as it is."** That ignores the real chance to free up time for better testing.
- **Judging by test count or pass rate,** instead of by what the tests would catch and what they cost to run and maintain.

### Follow-up questions

1. **"Should the healer run automatically in CI and commit its fixes?"** A good answer: let it propose patches as PRs. Auto-approve locator-only changes at most. Require a person to review any change to an assertion, and any skip, because those can quietly redefine "correct."
2. **"Only 2 of the 6 seeded bugs were caught. The manager says that's still better than nothing. Do you merge?"** A good answer: merge the tests that caught bugs and are stable. Don't let the rest gate releases. Report clearly that most billing calculation risk is still uncovered, and propose a few targeted checks with independent oracles, such as proration calculated separately in the test from the plan prices, or invoice totals reconciled against the ledger.

## Sources

- [Playwright — Test Agents (official documentation)](https://playwright.dev/docs/test-agents): what the planner, generator and healer do. The answer relies on two details from it: the generator checks assertions against the live app, and the healer can leave a skipped test "if the healer believes that functionality is broken." The oracle and healer-review points come from these.
- [James Bach & Michael Bolton — "Testing and Checking Refined" (Satisfice)](https://www.satisfice.com/blog/archives/856): the definition of checking as "the mechanistic process of verifying propositions about the product," and checking as one tactic within testing. Basis for asking what proposition each generated test actually verifies.
- [James Bach — "We. Use. Tools." (Satisfice)](https://www.satisfice.com/blog/archives/1598): the argument that tools support testing but testing as a thinking process can't be automated. Used to judge what the manual regression actually catches before cutting it.
- [Cem Kaner — "The Oracle Problem and the Teaching of Software Testing"](https://kaner.com/?p=190): oracles are heuristic and incomplete, and Hoffman's list of programmable oracle types (regression, calculation, reference program and others) is useful for automation. Used to name what kind of oracle the generated tests rely on and to suggest independent oracles in the follow-up.
- [Stryker Mutator — documentation](https://stryker-mutator.io/docs/): mutation testing as changing the code and checking whether the tests notice. The basis for the smaller seeded-bug check used instead of coverage.
