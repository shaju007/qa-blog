# QA Thinking — Day 54

## System Design for QA and SDETs: Build a Test Architecture Around One Report Pipeline

An architect draws an API, queue, worker, database, and cache. QA is asked to automate the flow. A browser test that waits for “Report ready” would cover one outcome, but it would say little about duplicate processing, stale reads, lost jobs, or recovery.

System design learning becomes useful when you can explain where work and data move, what can fail between components, and which evidence would reveal the failure. This lesson proposes a test architecture for an invented reporting product. It is a design exercise, not a running implementation.

### 1. Define the promise before choosing components

Suppose the team agrees:

- A request creates one logical report job for an advertiser and reporting window.
- Retrying the same idempotent request returns the same logical job within the documented key lifetime.
- Reports contain only that advertiser's data.
- The job survives a worker restart.
- The UI distinguishes pending, complete, and failed work.

An **idempotency key** lets the service recognize requests representing the same operation according to its contract. A **queue** separates accepting work from processing it. **Eventual consistency** means readers may temporarily observe older state; it still needs an explicit product expectation about when and how that state catches up.

Choose load and completion targets with product and operations. Google's SRE guidance distinguishes a service-level indicator, a measurement, from a service-level objective, its target. Define the population and measurement window before calling a latency number an SLO. [Service Level Objectives](https://sre.google/sre-book/service-level-objectives/)

### 2. Trace an interruption, not only the happy path

```text
1. API stores job J as pending
2. API arranges publication of J to the queue
3. Worker processes J
4. Worker stores report output
5. Worker marks J complete and acknowledges the message
```

What if the API stops between steps 1 and 2? What if the worker stops after storing output but before acknowledging the message? A retried operation may repeat work.

Discuss the actual transaction boundaries with engineering. One design may use a transactional outbox for publication; another may use a different recovery mechanism. The testable promise is that accepted work can be accounted for and retries do not create incorrect user-visible results.

### 3. Assign risks to useful test boundaries

| Check layer | Main question | Example |
| --- | --- | --- |
| Unit | Is isolated transformation logic correct? | Aggregate a tiny known event dataset and verify its amount |
| Service integration | Do real components cooperate across a boundary? | Restart the worker and redeliver a queued job |
| Contract | Can a caller interpret the interface? | Check the supported job-status response and documented failures |
| Deployed API | Are the deployed service and access rules usable? | Submit, poll, retrieve, and reject cross-tenant access |
| Browser | Can the user complete and understand the journey? | Show pending, then ready, then download the correct report |
| Operational experiment | Can the system detect and recover from trouble? | Stop test workers and observe backlog alerts and recovery |

The layers overlap intentionally where risks justify it. Avoid selecting percentages first. Choose checks based on the failures they can detect and the cost of understanding their failures.

Bolton's automation discussion helps frame this as choosing useful tool-supported observations within testing. A test architect should explain both the evidence gained and the gaps that remain. [Which Test Cases Should I Automate?](https://developsense.com/blog/2018/06/which-test-cases-should-i-automate)

### 4. Design seams that make evidence possible

A **test seam** is a place where the system lets a test supply a controlled input or observe a result. Useful seams here include a job-status endpoint, a controlled clock for reporting windows, deterministic small datasets, and correlation IDs linking accepted work to output.

An SDET can implement reusable fixtures, clients, dataset builders, and assertions around those seams. Keep helpers focused: creating a report should not secretly alter unrelated permissions or hide retries from the test author. Preserve request IDs and useful response evidence when setup fails.

Use a real deployed integration for a small number of critical journeys. Playwright's API facilities can set up data and inspect server state around browser checks; that capability does not make mocked UI checks evidence of backend persistence. [Playwright API testing](https://playwright.dev/docs/api-testing)

### 5. Architecture includes ownership and feedback

Write down who maintains each suite, where it runs, how it provisions data, how failures are diagnosed, and what unresolved failures mean for release decisions. Include runtime and environment constraints. A framework diagram alone cannot answer those operational questions.

Review one historical defect against the proposed portfolio. Which check would detect it? If the answer is none, add a justified check or explicitly record the remaining risk.

### Practical challenge: make one design decision reviewable

Draw a five-component system you know. Mark the durable writes and two interruption points. Create a six-row check portfolio like the one above. For one row, write fixture inputs, expected evidence, cleanup, owner, and one failure it cannot detect. Ask a developer to challenge your transaction assumptions before implementing the check.
