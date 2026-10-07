# QA Thinking — Day 23

## A Flaky Check Is a Witness You Haven't Questioned Yet: Investigating Intermittent Failures in a Live Betting-Odds Pipeline

Most teams have a moment like this. A check fails in CI. Someone re-runs the pipeline and it passes. A developer writes "flaky, added `retry: 2`" in the PR, and the team moves on.

This lesson argues that this moment is a testing decision, and often a risky one. A retry policy is a rule for **which evidence gets ignored**. That makes it a tester's business, and in some domains it's also a money and compliance question.

Today's domain is **live sports betting**. In a sportsbook, "it passes most of the time" can mean "most of the time we stop taking bets after a goal is scored."

---

### 1. The core idea: the check isn't unreliable. Your model of the system is incomplete.

In [Flaky Testing](https://developsense.com/blog/2021/02/flaky-testing), Michael Bolton says the phrase "flaky test" points the blame the wrong way. It treats the check as a broken experiment. He argues the experiment is working well: it shows that someone's models of the product, the check code, the environment and the expected outcomes don't line up. In his words, it's telling you *"there's something you don't know."*

Bach and Bolton's [Testing and Checking Refined](https://www.satisfice.com/blog/archives/856) explains why this matters. **Checking** is "the mechanistic process of verifying propositions about the product". **Testing** is evaluating the product by learning about it. A machine can run a check and turn it red or green. It can't tell you what an intermittent red *means*. Interpreting that is testing work, and adding a retry hands that interpretation back to the machine.

The [Ministry of Testing glossary entry on flaky tests](https://www.ministryoftesting.com/software-testing-glossary/flaky-test) gives the practical warning: patching or suppressing a flaky test without understanding the root cause risks masking a real problem.

**How to apply this at work:** stop asking "is this test flaky?" Ask "**which of my models is wrong: the product, the check, the environment, or the oracle?**" Each answer leads to a different fix and a different person who owns it.

---

### 2. Domain primer: how a live odds pipeline works and where it can lose money

A sportsbook usually doesn't calculate all its live odds itself. It consumes a feed from a data/odds provider and turns the messages into **markets**, such as "Match Result", "Next Goal" or "Over/Under 2.5". Each market has **outcomes** with prices. Customers place **tickets** (bets) against those prices.

I'm using Sportradar's Unified Odds Feed (UOF) as a concrete example because it's publicly documented. Other providers differ in the details, but the concepts carry over. The [UOF message reference](https://docs.sportradar.com/uof/data-and-features/messages) lists messages with explicit priorities:

| Message | Priority | Business meaning |
|---|---|---|
| `odds_change` | High | New prices, and can also signal a bet stop |
| `bet_stop` | High | Suspend a group of markets now (e.g. a dangerous attack or a penalty) |
| `bet_cancel` | High | Void a market because of an error |
| `fixture_change` | High | Kickoff time or other fixture details changed |
| `bet_settlement` | Low | Settle bets: winners get paid |
| `rollback_bet_settlement` | Low | Undo a settlement sent by mistake |
| `alive` | Low | Heartbeat. If it stops arriving, something is broken |

The [recovery documentation](https://docs.sportradar.com/uof/error-handling/recovery-using-api) contains several business rules a tester should know:

- **Disconnects require recovery.** After a lost connection, or an `alive` with `subscribed="0"` (that producer went down), the client requests recovery and processes messages until `snapshot_complete` arrives.
- **Stateful messages wait.** Settlements, cancellations and rollbacks that arrive during recovery should be queued and processed **after** `snapshot_complete`.
- **Stale data can arrive.** The docs say the client "may receive messages sent before the timestamp provided" and must handle that.
- **Lost connection means suspend.** If the live-odds producer connection drops, the client should immediately suspend all live markets and stop accepting tickets.
- **Recovery has a lookback window.** It varies by producer, for example 10 hours for live odds. Past that window, a partial recovery can't fully rebuild your state.

**Failure modes that cost money:**

- **Late acceptance (past-posting risk).** A goal happens, `bet_stop` arrives, but the market stays open for another second and accepts bets at pre-goal prices. Sharp bettors and bots look for exactly this window.
- **Stale overwrite.** An older recovery `odds_change` overwrites newer live prices, so you offer yesterday's price for today's game state.
- **Settle-then-rollback mishandled.** You pay winners, then a `rollback_bet_settlement` arrives. If wallet balances aren't reversed correctly, or the bet is settled twice, the ledger is wrong.
- **Silent producer death.** No `alive` messages arrive, nobody notices, and markets stay open on frozen odds.

Notice that almost all of these are **timing and ordering** problems. Timing and ordering are also the main causes of intermittent check failures.

---

### 3. Why intermittent failures and product risk overlap here

The research backs this up:

- Luo et al.'s [An Empirical Analysis of Flaky Tests](https://mir.cs.illinois.edu/lamyaa/publications/fse14.pdf) (FSE 2014) studied 201 flaky-test-fixing commits across 51 Apache projects. The top three root causes were **async wait, concurrency, and test order dependency**.
- Eck et al., [Understanding Flaky Tests: The Developer's Perspective](https://arxiv.org/html/1907.01466v1) (ESEC/FSE 2019), found the root cause isn't always in test code. In their data, **34% of concurrency-related flakiness came from production code**, along with 15% of resource-leak cases and 10% of platform-dependency cases.
- Parry et al., [Systemic Flakiness](https://arxiv.org/html/2504.16777) (EASE 2025), analysed 810 flaky tests in 24 Java projects. **75% of flaky tests belonged to clusters that failed together**, often because of networking or external-dependency problems. Triaging tests one at a time wastes effort and hides the shared cause.

Put this together with the domain. An odds consumer is an async, concurrent, priority-sensitive system. When the check `market_suspends_within_500ms_of_bet_stop` fails 1 time in 20, "the test is too impatient" is one hypothesis. "Under load, our consumer processes high-priority messages behind a backlog of low-priority settlements" is another, and it describes a production incident waiting to happen.

---

### 4. The Flake Interview: questions to ask before anyone adds a retry

Treat each intermittent failure like a witness interview. For every symptom you need **at least one check-side and one product-side hypothesis**, plus **an experiment that tells them apart**.

| Symptom | Check/environment hypothesis | Product hypothesis | Experiment that tells them apart |
|---|---|---|---|
| Market still `ACTIVE` 500ms after `bet_stop` | Polling interval too coarse; slow CI runner | Priority inversion: one consumer thread drains a `bet_settlement` flood before the `bet_stop` | Run the check alone on a fast machine while the stub feed injects a burst of 5,000 settlements. If latency jumps only with the burst, it's the product. |
| Settlement check fails only when run after the recovery check | Shared state leaks between tests (order dependency) | Settlements are applied **before** `snapshot_complete` instead of being queued | Run in reverse and in random order. Then replay a recovery where a settlement arrives mid-snapshot. |
| Odds value differs from expected, rarely | Test fixture timestamps collide | Older recovery message overwrites newer live odds (the docs say this can happen) | Send a recovery `odds_change` with an older timestamp after a live update and assert that the newer one wins. |
| Wallet balance off by exactly one payout | Test reads the balance before an async write finishes | Rollback isn't idempotent when it arrives twice, or the settlement is applied twice | Send the same rollback twice. Reconcile the ledger entries, not just the balance. |
| A dozen unrelated checks fail in the same run | Broker container restarted; network hiccup | Your reconnect logic doesn't suspend markets during the outage | **Check the cluster first.** Then ask: during that outage, did the product suspend markets as the rules require? |

The last row is the subtle one. Even when the cause really is "just infrastructure," the product's **response** to that infrastructure failure is something you should be testing. A dropped broker connection in CI is a free chaos experiment, and most teams throw away the result.

**Techniques for turning "intermittent" into "reproducible":**

- **Loop it.** Run the check 200 times in isolation, then 200 times in the full suite. A difference between the two is a strong clue.
- **Squeeze it.** Limit CPU, add network latency to the broker, or run tests in parallel. Async bugs tend to show up under pressure.
- **Shuffle it.** Randomise test order to expose order dependency.
- **Record the number, not just pass/fail.** For timing checks, log the measured latency on **every** run. A latency distribution of "40–180ms on passes, 600–1,900ms on failures" is much stronger evidence than "fails sometimes."

Martin Fowler's [Eradicating Non-Determinism in Tests](https://martinfowler.com/articles/nonDeterminism.html) covers the check-side fixes: poll or use callbacks instead of bare sleeps, wrap the clock, isolate state, and use test doubles for remote services. Use those fixes **after** you've ruled out the product hypothesis, not instead of ruling it out.

---

### 5. The oracle trap: raising a timeout changes the requirement

The most common "fix" for a timing failure is to raise the timeout, say from 500ms to 3s. That doesn't fix the check. It **quietly rewrites a business rule**.

How long a live market may stay open after a bet stop is a trading-risk decision. It shouldn't be whatever number makes CI green. So before accepting the change, ask the product owner or trading lead:

> "Our check says markets must suspend within 500ms of `bet_stop`. Under settlement load we measured up to 1.9s. Is 1.9s acceptable exposure for in-play football? If not, what is? I'd like the check's threshold to come from your answer, not from what CI tolerates."

That one question moves the conversation from "QA vs. dev arguing about a test" to "the business deciding how much risk it accepts." This is influence without authority in practice: you don't win the argument, you bring the right decision-maker in with the right evidence.

---

### 6. Handling the "just retry it" disagreement

The developer who adds a retry usually isn't being careless. They're dealing with a real cost: blocked merges, noisy pipelines, lost trust in the suite. Fowler describes the same problem: once people start ignoring failures, a whole suite becomes useless. If your response is "retries are bad," you'll lose the argument, and you probably should.

Offer a deal instead:

1. **Retries are allowed, but the first attempt is always recorded.** Report "passed on retry" as its own outcome, not as a pass. The trend line is evidence.
2. **Some checks can't be retried without a written hypothesis.** For a sportsbook, that's anything guarding market suspension, settlement, rollback or wallet balance. A retry there needs a ticket that says what you believe is happening and how you'll confirm it.
3. **Quarantine has limits.** Fowler suggests limiting both the number of quarantined tests and how long they stay there, for example no more than eight tests and no more than a week. Pick your own numbers, and make them visible.
4. **Triage clusters first.** If ten checks failed together, open one investigation, not ten tickets.

When you raise it, lead with evidence and use careful language:

> "Over 300 runs, `market_suspends_within_500ms` failed 14 times. Eleven of those happened while settlement checks were running in the same shard, and suspend latency on those runs was 620ms–1.9s. I can't yet rule out that the consumer delays `bet_stop` behind settlements under load, and if that's true, it's an exposure window in production. Can we pair for an hour on a load-injection experiment before we merge the retry? If it turns out to be the runner, I'll help fix the polling."

This message works because it gives numbers, names the business consequence, says what you don't know yet, offers a small time-boxed next step, and commits you to helping whichever way the evidence points.

---

### Practical challenge

You're the QA engineer on a sportsbook's odds-ingestion service. Over 300 CI runs of `live_market_suspends_on_bet_stop` (threshold: 500ms):

- **14 failures.** Run alone, it never failed in 200 runs.
- **11 of the 14** happened while `settlement_*` checks ran in the same shard within the same ~2s window. Measured suspend latency on those runs was 620–1,900ms. On passing runs it was 40–180ms.
- **3 of the 14** happened in runs where 9 other checks also failed, all logging `connection refused: broker:5672`.
- A developer's PR raises the timeout to 3s and adds `retry: 2`.

**Your tasks (aim for about 45 minutes):**

1. **Separate the clusters.** Which failures share a cause? Why should the three broker failures not be dismissed, and what product behaviour could you check in those runs?
2. **For the group of 11, write two competing hypotheses**, one about the check or environment and one about the product. Note that "never fails in isolation" fits both shared-state leakage **and** load-induced latency.
3. **Design one experiment that tells them apart.** For example: run the check alone while a stub feed sends a burst of low-priority settlements, versus running it with settlement checks that touch shared state but send no feed traffic. Predict the result under each hypothesis **before** you run it.
4. **Write the question for the trading or product owner** that sets the real threshold. Include the measured worst case.
5. **Write a reply of 5 sentences or fewer to the PR** that keeps the developer's goal (a green, trustworthy pipeline), proposes the deal from section 6, and asks for a specific next step.

**What separates a strong answer:** your experiment produces different results under each hypothesis, your reply contains numbers rather than adjectives, and you've noticed that the broker outage is free evidence about whether markets suspend when the feed connection drops.

---

### Takeaways

- An intermittent failure is reliable evidence that some model is wrong. Your job is to find out **which** one.
- In async, money-moving domains like live betting, payments and ad auctions, the root causes of flaky checks (timing, ordering, concurrency) are also the root causes of expensive production bugs.
- Raising a timeout is a requirements change. Get the threshold from the business.
- Retries are a policy about evidence. Negotiate that policy openly, record first-attempt results, and protect the checks that guard money.

---

### Sources

- Michael Bolton, [Flaky Testing](https://developsense.com/blog/2021/02/flaky-testing), DevelopSense, 2021
- James Bach & Michael Bolton, [Testing and Checking Refined](https://www.satisfice.com/blog/archives/856), Satisfice
- Ministry of Testing, [Glossary: Flaky Test](https://www.ministryoftesting.com/software-testing-glossary/flaky-test)
- Martin Fowler, [Eradicating Non-Determinism in Tests](https://martinfowler.com/articles/nonDeterminism.html), 2011
- Luo, Hariri, Eloussi & Marinov, [An Empirical Analysis of Flaky Tests](https://mir.cs.illinois.edu/lamyaa/publications/fse14.pdf), FSE 2014
- Eck, Palomba, Castelluccio & Bacchelli, [Understanding Flaky Tests: The Developer's Perspective](https://arxiv.org/html/1907.01466v1), ESEC/FSE 2019
- Parry, Kapfhammer, Hilton & McMinn, [Systemic Flakiness: An Empirical Analysis of Co-Occurring Flaky Test Failures](https://arxiv.org/html/2504.16777), EASE 2025
- Sportradar, [Unified Odds Feed: Messages](https://docs.sportradar.com/uof/data-and-features/messages)
- Sportradar, [Unified Odds Feed: Recovery Using API](https://docs.sportradar.com/uof/error-handling/recovery-using-api)
