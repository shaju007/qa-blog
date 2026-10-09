# QA Interview Q&A — Day 11

## Question: Your director says the 2-hour end-to-end suite is too slow and nobody trusts it: "Get it to 20 minutes by end of quarter. Delete whatever you have to." Which tests do you delete first, and how do you know it's safe?

**Scenario:** You're the QA lead on a self-serve ad-buying platform. Advertisers use it to create campaigns, set daily budgets and targeting, upload ads, and pay by card or invoice. Every pull request runs 1,850 Playwright end-to-end tests against shared staging. A run takes 2h10m, with `retries: 2`.

Over the last 30 days, about one pipeline run in nine had at least one test that failed and then passed on a retry. Developers now press "re-run" without reading the failure.

Last month a pacing bug reached production. Some campaigns spent their whole daily budget by mid-morning. Afterwards someone found that the pacing test had failed on its first attempt in the PR pipeline, passed on retry, and was shown as green.

---

## Answer

### The short version

I don't start by deleting tests. I start by finding out what each test tells us, what it costs, and whether anyone acts when it fails. The 20-minute target is a reasonable limit, but runtime is a symptom. The real problem is that the suite stopped giving trustworthy information, and that has already cost us money once.

My plan has four parts: collect evidence per test, sort tests into a few groups, make the cheap reversible moves first, and only delete tests after watching what they would have caught. I also make the risk we're giving up visible to the people who own that decision. I don't decide it quietly myself.

### 1. Reframe the goal, without arguing about the deadline

Bach and Bolton define checking as "the mechanistic process of verifying propositions about the product." Testing is the wider work of learning about the product through exploring, experimenting and questioning. It helps to see the suite this way: 1,850 propositions, each one a claim that someone once thought was worth checking automatically.

So the real question isn't "which 1,500 tests do we delete?" It's "which claims are worth checking on every PR, which belong somewhere else, and which no longer matter?" The director cares about cycle time, and they're right to. I can commit to the 20 minutes for the PR gate. I can't promise how much regression-catching ability survives until I've done the analysis.

### 2. Gather evidence for each test (about one week, mostly scripted)

Export the last 60–90 days of CI results. Playwright's JSON or JUnit reporter gives you the raw data. For each test, collect:

- **Runtime**, and its share of the critical path once tests are sharded across machines.
- **First-attempt failure rate.** Playwright labels a test "flaky" when it "failed on the first run, but passed when retried." With `retries: 2`, those runs look green on the dashboard, so this column is where most of the hidden information sits.
- **Real bugs caught.** Did a failure of this test ever lead to a fixed product bug? Link it to the ticket. This takes manual digging, so sample it if you have to.
- **Which risk the test claims to cover**, in one sentence. If nobody can write that sentence, that tells you something.
- **Duplicate coverage.** Is the same claim already checked at API, component, or contract level?
- **Reversibility.** If we drop this check and the risk happens, how quickly would we notice, and what would it cost? For ad tech that means overspend, under-delivery, billing errors, or wrong reports to advertisers.

### 3. Deal with the pacing incident first

The incident shows why "delete the flaky ones" is dangerous. A failure that passes on retry isn't automatically a broken test. A race condition in the product gives you exactly the same pattern.

Martin Fowler's list of causes of non-determinism (no isolation between tests, asynchronous behaviour, remote services, time, resource leaks) applies to the system under test as well. Budget pacing runs on timers, in the advertiser's time zone, and across several services. It's exactly the kind of code where a real intermittent bug looks like a "flaky test."

So the rule becomes: **a retry-pass is a finding, not a pass.** In practice:

- Report flaky results as their own category on the dashboard, never folded into green.
- For the small gate suite, consider Playwright's `failOnFlakyTests` option (added in v1.52), which makes the run exit with an error if any test was marked flaky. Pair it with a quick triage path so people don't simply learn to work around it.
- Every flaky result in a high-risk area (budget, pacing, frequency caps, billing, pausing campaigns) gets investigated: is the cause in the test, the environment, or the product?

### 4. Sort the suite into groups

The numbers below are illustrative. The point is that every group comes with a reason you can defend.

| Group | Typical members | Action |
|---|---|---|
| **Gate: keep end-to-end on every PR** (~60–100 tests) | Create and launch a campaign. **Pause a campaign** (if pausing breaks, money keeps burning). Add a payment method. Ad upload and approval. Login and roles. | Make them fast and isolated, with seeded per-run accounts and no shared budgets. |
| **Push down a level** | Hundreds of form-validation tests going through the UI. Targeting combinations (geo × device × audience) run as UI permutations. | Rewrite as API or component checks. Use pairwise selection for the combinations. Pacing and frequency-cap logic gets service-level tests with a controlled clock, so you're not waiting on wall time in a browser. |
| **Move off the PR path** | Long reporting reconciliations, cross-browser runs, integrations with third-party exchanges and ad-verification vendors. | Run them nightly or before release, each with a named owner who reads the results. Replace live third-party calls in the gate with test doubles plus contract checks, as Fowler suggests. |
| **Quarantine with a deadline** | Tests that are truly non-deterministic and cover a risk that matters. | Fowler suggests limiting quarantine by count or by time, for example no more than a week. When the limit is hit, the test is either fixed or explicitly deleted. |
| **Delete** | Tests for retired features. Exact duplicates of lower-level checks. Checks of things nobody would act on if they failed (pixel-exact copy that isn't a legal or brand requirement). | Delete them, but only after the evidence below. |

The order matters: **move first, delete later.** Moving a test to a nightly run is reversible. After four to six weeks, if a nightly test never caught anything the gate missed, and its risk is covered elsewhere or explicitly accepted, deleting it is a decision backed by evidence rather than a guess.

### 5. Weigh "never failed" carefully

"This test hasn't caught a bug in a year" is weak evidence when used alone. A check for "a paused campaign stops spending" may never fail and still be the most valuable test in the suite. It works like insurance against a costly, fast-moving loss.

Judge each test on risk impact and how hard the problem would be to detect without it, not just on its catch history. A catch history is only a strong argument for deletion when the risk is also low, or already covered elsewhere.

### 6. Fix the environment problems behind the flakiness

A lot of this flakiness is probably caused by shared staging. If parallel runs create campaigns on the same advertiser account, they compete for the same budgets and pacing state. Giving each run its own seeded account and test data often removes more flaky failures than rewriting the tests would.

Sharding (splitting tests across more CI machines) is a fine quick win for wall-clock time. Say so, and do it. But it makes an untrusted suite faster without making it trustworthy.

### 7. What to say in the meeting

> "I can get the PR gate to 20 minutes this quarter. I'd like to do it in a way that doesn't repeat the pacing incident. That bug was caught by a test, but the retry hid it. So step one is making retry-passes visible and triaged, not green.
>
> Then I'll sort the suite by evidence: what each test costs, what it has actually caught, and what risk it covers. About 80 critical flows stay on the gate. Most of the rest move down to API level or into a nightly run. I'd rather move tests first and delete them after a few weeks of data. Moving is reversible; deleting isn't.
>
> Some checks we'll drop on purpose. I'll list the risks they covered and how we'd notice those risks now, for example spend-anomaly alerts. Product and engineering can then decide whether that's acceptable. That's your call to make, not mine. My job is to make sure the decision is made knowingly."

That last part matters. You don't own the risk appetite. You own making the tradeoff visible and honest.

### 8. What replaces deleted checks

Some value in an end-to-end suite was never in its assertions. It came from someone looking at a failure and noticing something odd. As the suite shrinks, add short, focused exploratory sessions with a stated goal ("charters") on the risky areas. Examples: pacing near midnight in different advertiser time zones, budget edits while a campaign is live, pausing during a spend spike. Also add production signals such as alerts when spend jumps against the pacing target. Checks confirm what you expected; people find what you didn't think to check.

### Common weak answers

- **"Delete the flaky ones."** Flakiness might be a real intermittent bug, and flaky tests often sit in the most timing-sensitive, highest-risk areas.
- **"Just shard it."** That helps runtime, but leaves trust and the hidden failures unsolved.
- **"Refuse, because coverage will drop."** That ignores a legitimate business limit. Also, as one Ministry of Testing Club contributor put it, coverage nobody trusts isn't really coverage.
- **"Apply the test pyramid ratio."** A shape isn't a strategy. Decide per risk, not per percentage.
- **"Add AI self-healing locators."** That makes failures quieter, which is the opposite of what this team needs.
- **Treating 20 minutes as the only success measure**, without also tracking escaped defects, the flaky rate, and time to triage.

### Follow-up questions

1. *A test has passed every run for 18 months, takes 4 minutes, and checks that invoices for agency clients total correctly across currencies. Keep it on the gate, move it, or delete it? What would you need to know?*
2. *Developers want to keep `retries: 2` because "staging is just slow." What evidence would change their mind, or yours?*

---

## Sources

- James Bach & Michael Bolton, ["Testing and Checking Refined"](https://www.satisfice.com/blog/archives/856), Satisfice. Source of the testing-versus-checking distinction and the definition of checking as "the mechanistic process of verifying propositions about the product." Used to treat the suite as a set of claims whose value has to be judged, not counted.
- Martin Fowler, ["Eradicating Non-Determinism in Tests"](https://www.martinfowler.com/articles/nonDeterminism.html). Explains why non-deterministic tests ruin trust in a whole suite, gives the five common causes, and recommends quarantine with count or time limits, polling instead of sleeps, and test doubles plus contract tests for remote services.
- Playwright docs, ["Retries"](https://playwright.dev/docs/test-retries). Defines how Playwright labels tests passed, flaky and failed, which is why retry-passes can look green and hide real failures.
- Playwright docs, ["TestConfig: failOnFlakyTests and retries"](https://playwright.dev/docs/api/class-testconfig). Confirms `failOnFlakyTests` (added in v1.52, "Useful on CI") and that retries are off by default.
- Ministry of Testing Club, ["New here – Question about flaky tests and trust"](https://club.ministryoftesting.com/t/new-here-question-about-flaky-tests-and-trust/87089) (February 2026). A practitioner discussion arguing that trust is the tipping point (engineers rerunning without looking means the suite has lost value) and that each flaky test should be explicitly classified as fix, quarantine, or delete. Used as a practitioner cross-check, not as the main evidence.
