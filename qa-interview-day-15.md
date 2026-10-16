# QA Interview Q&A — Day 15

## Question: "It's behind a feature flag, so there's nothing for you to test yet." Is the developer right?

**The scenario:** You're the tester on the checkout team of a European fashion marketplace. On Thursday afternoon a senior developer posts in the team channel:

> "Promotion stacking v2 is merged and goes out in tomorrow morning's deploy, behind `promo-stacking-v2`. The flag is off in prod. Nothing for QA until we start the rollout in three weeks."

The pull request has about 1,400 changed lines in 23 files. A quick skim shows three things that aren't only about stacking. It refactors the shared cart-total calculation into a new pricing pipeline. It adds a migration to the `promotions` table. And it adds an `applied_promotions` field to the cart API response.

What do you reply, and what do you do before tomorrow's deploy?

---

## Answer

### The short version

The developer is half right. The flag hides the **new behavior**, but it doesn't hide the **change**. Anything that runs whatever the flag says goes live tomorrow. Here that means the refactored shared code, the migration, the new API field, the flag-evaluation code and what it does when the flag service fails, and the flag's configuration in each environment.

So test that now, in a small and targeted way. Leave the stacking rules alone until they're ready to test. And raise it as a question for the developer, not a correction.

### Start with what the developer has right

Feature flags let a team deploy code without releasing it to users. Pete Hodgson's article on feature toggles makes this the main reason they exist. Testing the stacking rules now would waste time, because they will probably change over the next three weeks.

If QA insisted on a full test cycle for every flagged merge, developers would go back to long-lived branches. QA would become the bottleneck the flag was supposed to remove. A strong candidate says this plainly. It shows you know why the team works this way and that you aren't just defending your own job.

### What actually ships with the flag off

I don't write a test plan here. I spend about 20 minutes going through the diff with the product elements from James Bach's Heuristic Test Strategy Model (SFDIPOT) as a checklist. The question for each one is: what changes for a customer, or for the system, even with the flag off?

- **Structure: code outside the `if (flag)` check.** Both the old and new paths now call the refactored cart-total function. From tomorrow, every customer goes through the refactored code. This is the biggest risk. It's a "no behavior change" refactor of code that calculates money, and that's exactly the kind of claim that needs evidence, not just confidence.
- **Data: the migration.** It adds a `stack_priority` column and backfills it for existing promotions. Questions to ask:
  - Does it lock a busy table during the morning deploy?
  - If we roll back the app, can the old code run against the new schema?
  - Can the migration itself be reversed?
- **Interfaces: the API response.** Is `applied_promotions` returned even when the flag is off? Is it an empty array, `null`, or left out completely? What happens in the oldest app version we still support, and in partner integrations that parse this response strictly?
- **Platform: what happens when flag evaluation fails.** Under the OpenFeature specification, if evaluation fails, the SDK must return the default value supplied in the code. It must not throw an error (requirement 1.4.10). LaunchDarkly works the same way: if the SDK can't reach its service and has no cached value, it returns the fallback value from the code. So the real "off" switch is partly in the code. If the code says `getBooleanValue("promo-stacking-v2", true)`, a flag-service outage turns the feature on for everyone.
- **Operations: who controls the flag.** Who can change it, in which environments, and is it really off in every production project or region? Do targeting rules already exist? For example, an "internal users" segment might include customer-service accounts that place real orders. One more detail: in LaunchDarkly, turning a flag off serves its **off variation**, and that setting can be changed. For a boolean flag it starts as `false`, but someone can change it. "Off" in the dashboard doesn't guarantee `false` in the code.
- **Time: consistency and timing.** Is the flag checked once, or separately in the cart service and the order service? If someone changes it while a customer is checking out, the cart could show €18 off while the order charges €12 off. Also:
  - Did the cart-total cache key change? Then the cache starts empty after the deploy, which could slow things down at peak time.
  - During a rolling deploy, old and new pods run side by side and share that cache.

There's a well-known example of how a flag's meaning depends on what code is actually running. According to the SEC, Knight Capital's router sent more than 4 million orders in 45 minutes while trying to fill 212 customer orders, and the firm lost more than $460 million. The SEC order describes the cause: a repurposed flag reached a server still running old, unused code. The lesson isn't "flags are dangerous." It's that "the flag is off" says nothing about the code that ships with it. (Use this example once in an interview. Don't build the answer around it.)

### What I'd reply to the developer

I'd reply in the same channel, quickly, and keep it short:

> "Agreed, no point testing the stacking rules yet; they'll change. A few things do go live tomorrow with the flag off, though, and I'd rather understand them before the deploy than after:
> 1. The cart-total refactor runs for every customer. How do we know totals come out the same, to the cent?
> 2. What does the code return if the flag service can't be reached?
> 3. Is the `promotions` migration safe under load, and safe to roll back past?
> Have you got 20 minutes after stand-up to walk me through the diff?"

Why this works:

- It agrees with the developer's actual point.
- It asks for **evidence**, not a "QA phase."
- It offers my time instead of handing them work.
- It names a deadline, the deploy, without claiming I can block it.

### What I'd test before the deploy (about half a day, much of it paired)

1. **Compare old and new totals.** Run the old and new pricing code on a sample of real cart shapes, taken from last month's orders with personal data removed. Include several promotions on one cart, gift cards, mixed VAT rates, store credit and rounding edge cases, then compare totals to the cent. The developer can often build this into a unit-test harness faster than I could. Unit-test coverage only shows which lines ran. This shows whether the answers match.
2. **Targeted flag-off regression** in staging, covering promotions, checkout and refunds. Don't rerun the whole suite just to say it ran.
3. **Flag-service outage.** Block the SDK's network access in staging, or give it an invalid key, and restart the service. Then check two things:
   - Did we get flag-off behavior?
   - Does the service start promptly instead of hanging while it waits for the flag service?
4. **Migration rehearsal.** Run the migration on a production-sized masked copy, time it, and check for locks. Then run the previous app version against the migrated schema to prove a rollback works.
5. **API comparison.** Compare the cart response before and after the change, with the flag off. Then check it against the oldest supported app version.
6. **Kill-switch test.** In staging, switch the flag off, then on, then off again, with active carts and a checkout in progress. Strictly speaking, this is flag-on testing. But the rollout in three weeks depends on the kill switch working, so I'd want to know it works now.

**Deliberately left out:** stacking-rule combinations, discount wording, and the admin screen for setting stack priority. Those come later, along with the configurations Hodgson suggests prioritizing: the one going live and the one expected next, not every possible combination.

### Evidence to ask for after the deploy

- Log the evaluated variant and the reason on every cart and order. OpenFeature's evaluation details include a reason and an error code for this.
- Watch three signals:
  - How many evaluations return the default value or an error.
  - Discount per order compared with the same weekday last week.
  - Total mismatches between the cart and the payment step.
- **Agree before the deploy** what number triggers a rollback, and who makes that call. After the deploy, everyone is busy and nobody wants to decide.

### If the developer still disagrees

The developer might say, "The refactor doesn't change anything. I'm confident." I'd answer: "I believe you. I'd like that confidence to be visible to the next person who touches this code. Can we add the comparison to the PR?"

If the team ships without it, that's the engineering manager's decision, not mine. I'd write the risk in the ticket in plain words:

> "The refactored total calculation reaches all customers on Friday without a comparison against the old calculation. If it's wrong, the first signal will be customer complaints or the finance team's reconciliation. Rollback means redeploying the previous version. The migration has to stay compatible with it."

That's a clear statement of risk, not a veto, and not a quiet "I told you so."

### Also raise now: when does the flag go away?

Hodgson describes toggles as inventory with a carrying cost. Ask for a removal ticket now, with a date. Otherwise, in six months there will be two pricing paths, tests for both, and a flag name someone might reuse.

### Common weak answers

- **"Agreed, nothing to test."** This mixes up whether customers can see the feature with whether anything changed.
- **"Nothing merges until QA has tested it."** This ignores why the team uses flags, turns QA into a bottleneck, and tests behavior that will change anyway.
- **"Test every flag combination."** That's a combinatorial explosion. Choose configurations based on risk and on what will actually go live.
- **"The regression suite is green, so flag-off is fine."** That's true only if the suite checks the money edge cases the refactor touched. Look at what it actually checks.
- **"I'll escalate to the manager."** This skips the person who knows the code best. Talk to the developer first.
- **"Flag-off means it behaves like the previous release."** It doesn't. It's new code taking the old route.

### What a strong answer shows

The candidate:

- reads the diff, or asks for a walkthrough
- separates new behavior from new change
- knows how flag defaults and fallbacks work
- proposes cheap, targeted checks
- respects how the developers work
- communicates risk without claiming authority they don't have

---

## Follow-up questions

**1. "Three weeks later the flag has been at 100% for two weeks. The developer wants to delete the old path and the flag in one PR. What do you check?"**

That PR changes behavior for anyone who wasn't actually getting the new path. Check for:

- segments that were excluded from targeting
- services that check the flag separately
- background jobs that never had a user context, for example nightly price recalculation using the fallback value

Ask for the evaluation logs: is anything still receiving `false`? Also confirm whether tests for the old path will be deleted or rewritten. Deleting them quietly can hide edge cases that only those tests covered.

**2. "The developer says the refactor has 95% unit-test coverage. What do you ask next?"**

Coverage shows which lines ran, not whether the answers are right. Ask three things:

- Which assertions compare full totals, rather than intermediate values?
- Does the test data include several promotions on one cart, mixed VAT rates and values that round at half a cent?
- Was any test changed so that it would pass after the refactor? That's the quickest sign the behavior actually changed.

---

## Sources

- **Pete Hodgson, ["Feature Toggles (aka Feature Flags)"](https://martinfowler.com/articles/feature-toggles.html), martinfowler.com.** Used for: separating deployment from release, testing both the on and off states, prioritizing the configuration you expect to go live, avoiding every-combination testing, and treating toggles as inventory with a carrying cost. The article also cites Knight Capital as a flag-management warning.
- **James Bach / Satisfice, [Heuristic Test Strategy Model (v6.3)](https://www.satisfice.com/download/heuristic-test-strategy-model).** Its product elements (Structure, Function, Data, Interfaces, Platform, Operations, Time) provide the quick checklist for reviewing what ships with the flag off.
- **Ministry of Testing Club, ["What's the best test strategy that fits the use of feature toggles?"](https://club.ministryoftesting.com/t/whats-the-best-test-strategy-that-fits-the-use-of-feature-toggles/68082).** A practitioner discussion. Colm O'Connor's reply treats testing both toggle states as an investment decision, which supports testing flag-off risk now and stacking rules later.
- **[OpenFeature Specification: Flag Evaluation API](https://openfeature.dev/specification/sections/flag-evaluation).** Requirement 1.4.10 says evaluation must not throw and must return the caller's default value when something goes wrong. That's why the default value in the code is a real production setting.
- **LaunchDarkly docs, ["The off variation"](https://launchdarkly.com/docs/home/flags/off-variation), and the support article ["How to avoid unknown flag variations"](https://support.launchdarkly.com/hc/en-us/articles/40294488101787-How-to-avoid-unknown-flag-variations-when-evaluating-a-flag).** Primary documentation showing that "off" serves a configurable variation, and that the SDK returns the code's fallback value when it can't connect or initialize.
- **U.S. SEC, [press release 2013-222 on Knight Capital](https://www.sec.gov/news/press-release/2013-222).** Source for the figures: more than 4 million orders in 45 minutes while trying to fill 212 customer orders, and losses above $460 million. The full [SEC order (Release No. 34-70694)](https://www.sec.gov/litigation/admin/2013/34-70694.pdf) describes the repurposed flag and the server running old code. The PDF couldn't be read as text during research, so that detail is also backed by Hodgson's summary.
