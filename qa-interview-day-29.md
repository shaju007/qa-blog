# QA Interview Q&A — Day 29

## Question: "Load test passed: 2,000 virtual users, p95 of 240 ms, 0.1% errors." The cup-final ticket sale opens in eight days. The product owner asks, "So we're good?" What do you say?

**Context for the scenario:** You test a football club's ticketing platform. Next Saturday at 10:00 it sells tickets for a cup final, and demand will be far higher than supply. The performance engineer ran a 30-minute k6 test against staging. 2,000 virtual users (VUs) looped through the journey: browse, pick seats, hold them, log in, pay with a stubbed payment provider. The dashboard is green. At the last big sale, about 38,000 sessions arrived in the first 90 seconds and the seat map timed out for most of them. The product owner needs a yes or no for Monday's operations meeting.

## Answer

**Short version:** "Not yet. Not because the test failed, but because it answered a different question from the one Saturday will ask. It tells us how the system behaves when 2,000 polite users wait for each response before sending the next request. Saturday is tens of thousands of impatient people, and a good number of bots, all arriving within seconds and all wanting the same 4,000 seats. I can tell you this week how close we are, and what we'll watch on the day."

Then back it up with specifics. Here is how an experienced tester would reason it through.

### 1. Turn "2,000 VUs" into an arrival rate

A VU count isn't a workload. It's a setting in the load tool. A looping VU only starts its next journey after the last one finishes, so the system's own response time controls how much load it gets. In k6's documentation this is the **closed model**. If the system slows down, the test sends less traffic. The slowness that would hurt real users gets smoothed out of the latency numbers. That effect is called *coordinated omission*.

Do the arithmetic in the meeting:

- Say a scripted journey takes about 60 seconds, including think time. Then 2,000 VUs start roughly **33 journeys per second**.
- The last sale saw 38,000 sessions in 90 seconds, or about **420 per second**. That's more than ten times what we tested, and it arrived as a spike, not a steady 30-minute plateau.
- Real fans don't wait politely. When the seat map hangs they hit refresh, which adds load at exactly the moment the system is struggling.

**Evidence to ask for:** the arrival rate the test actually achieved, not the VU count. Then rerun with an **open model**: k6's `ramping-arrival-rate` executor, ramping from near zero to the target in seconds, not minutes. Check whether k6 dropped iterations because it ran out of VUs. If it did, the load generator was the bottleneck, not the system.

### 2. Ask what the traffic looked like, not just how much there was

Ministry of Testing's glossary puts it well: a load test is only as meaningful as its workload model. For this sale, the questions that matter are:

- **Contention:** Did the virtual users pick random seats across random events? On Saturday everyone wants the same event and the cheapest blocks, so the same database rows get hit at once. Seat holds that never conflict in a test will lock-wait in production.
- **Caching:** Did every VU request the same seat map with the same query? Then the CDN or app cache may have served most of the test. On sale day the availability data changes every second.
- **Accounts:** Did 2,000 VUs share 40 test logins? Then session handling, per-account purchase limits and login throttling were barely exercised.
- **Dependencies:** The payment provider was stubbed with a fixed 50 ms response. What is the provider's real rate limit, and what does our checkout do when it gets a 429 (Too Many Requests) or the 3-D Secure step takes eight seconds?
- **Environment:** Is staging sized like production? Were the WAF, bot protection and virtual waiting room actually in the request path? If not, the most important parts of Saturday's traffic path weren't tested at all.

### 3. Fast and wrong isn't a pass

Michael Bolton argues that checking a system against fixed performance criteria is the least interesting part of performance testing. The goal is to describe how the system actually behaves and find the problems. A 240 ms p95 tells you nothing about the failures that would end up in the newspaper:

- **Overselling:** two buyers confirmed for the same seat when both hold requests land within milliseconds.
- **Seat holds:** released seats that never come back on sale because the hold expiry job falls behind under load. "Sold out" with 600 seats sitting in dead holds.
- **Payments:** charged, but no ticket issued, when the payment confirmation arrives after the hold has expired.
- **The 0.1% of errors:** about 33 journeys a second for 30 minutes is roughly 60,000 journeys, so 0.1% is about 60 failures. Were they harmless 503s with a retry prompt, or payment-step failures? An error rate is useless until someone has read the actual errors.

After an open-model run, check the data as well as the dashboards: seats sold vs. orders vs. payments captured, and orphaned holds.

### 4. Security belongs in a performance question here

On a high-demand sale, scalping bots may be a large share of peak traffic. Security controls change the load profile, and load changes how those controls behave:

- **Waiting-room bypass:** Can someone skip the queue and call the hold API directly? If the queue token is checked only on the front end, the queue protects nothing and the bots get in first.
- **Per-account limits under concurrency:** "Max 4 tickets per account" may hold for one request at a time but break when 10 parallel requests arrive with the same session. This race condition is a load bug and a fraud bug at once.
- **Bot protection side effects:** Does the challenge add latency, or block legitimate fans on shared mobile carrier IPs? You need to know before Saturday, not from Twitter.

Bot-defence and security testing needs clear authorization and a target environment. Never point a high load at third-party sandboxes or production without the owners' agreement.

### 5. Accessibility gets worse under load, too

The two features that only matter on sale day are the queue page and the seat-hold timer. Both need accessibility testing:

- **Queue page:** Does it announce position updates to screen readers without stealing focus or reloading the page every few seconds? Does the CAPTCHA have an accessible alternative?
- **Hold timer:** WCAG 2.2.1 (Timing Adjustable) uses a ticketing case as its example: the user gets a short window to confirm, is warned before it ends, and can extend it. Check that we warn, that an extension is one simple action, and that the warning is announced.
- **The interaction between the two:** A 10-minute hold may be fine when pages load in 200 ms. When each step takes six seconds under load, keyboard and screen-reader users, who need more steps, lose their seats first. Test the timer at sale-day latency, not staging latency.

### What to say in the meeting

> "The load test is useful and the team did solid work. It shows the system handles about 33 journeys per second of steady, uncontended traffic. Saturday is likely to be more than ten times that, as a spike, aimed at the same seats, with the waiting room and bot protection in the path. Those weren't in the test.
>
> By Wednesday we propose: one open-model spike test at the last sale's arrival rate, with real seat contention and the waiting room in front. A data check afterwards for oversells and orphaned holds. A queue-bypass check. A timer-and-queue run with a screen reader at slowed latency.
>
> Whether to go ahead, and what queue capacity to set, is your call and ops'. My job is to make sure you're deciding on the right numbers. For the day itself, I'd want a live oversell check, a known setting to slow queue admission, and someone watching payment-to-ticket reconciliation."

This doesn't claim veto power. It says what the evidence covers, what it doesn't, what it would cost to close the gap, and leaves the decision with the people who own it.

### Common weak answers

- **"p95 is under 300 ms, so yes."** Accepts the dashboard without asking what produced it.
- **"Rerun with 40,000 VUs."** Ten times more of the same closed-model, uncontended, cache-friendly traffic. It may also hit third-party sandboxes without permission.
- **"Performance is the perf engineer's job."** Testers bring the workload questions, the correctness checks, the security and accessibility angles, and the risk framing.
- **"We can't test realistically, so we'll find out Saturday."** You can't recreate Saturday exactly, but you can learn a lot about the gap in a week.
- **A flat "No."** No authority to give it, and nothing the product owner can act on.

### Follow-up questions

1. The payment provider's sandbox is rate-limited to 25 requests per second and they won't raise it. How do you get useful evidence about the payment step at sale-day load?
2. Saturday goes smoothly. What would you look at on Monday to tell whether the test was right or you just got lucky, for example because the waiting room was set conservatively?

## Sources

- [Grafana k6 docs: Open and closed models](https://grafana.com/docs/k6/latest/using-k6/scenarios/concepts/open-vs-closed/): primary documentation. It explains how looping VUs tie the arrival rate to response time, why that hides slowdowns (coordinated omission), and that the `constant-arrival-rate` and `ramping-arrival-rate` executors implement the open model. This is the basis for sections 1 and 2.
- [Ministry of Testing: Load testing (glossary)](https://www.ministryoftesting.com/software-testing-glossary/load-testing): says a load test is only as meaningful as its workload model, which is why the answer treats a VU count as a setting, not a workload.
- [Interview with Michael Bolton: The Software Tester & the Unexpected](https://iamondemand.com/?p=1697): Bolton argues you don't need fixed performance criteria to do performance testing, and that describing actual behaviour and finding problems matters more than conformance. This shapes section 3 (fast and wrong isn't a pass).
- [Satisfice: Heuristic Test Strategy Model (James Bach)](https://www.satisfice.com/download/heuristic-test-strategy-model): its quality-criteria list (capability, reliability, usability, security, scalability, performance, and others) is a reminder that one load test touches several risk categories at once. That's why security and accessibility are part of this answer.
- [W3C: Understanding WCAG 2.2 SC 2.2.1 Timing Adjustable](https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html): primary specification. It describes the turn off, adjust and extend options, the real-time and essential exceptions, and a ticket-reservation example with a warning and extensions. This is the basis for section 5.
