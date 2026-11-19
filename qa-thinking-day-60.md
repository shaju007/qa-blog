# QA Thinking — Day 60

## Agentic API and UI Testing for a Reward Journey: Preserve the Business Oracle Through Every Layer

An AI assistant can generate a browser journey that ends at “Reward earned.” The useful question is whether the tests would catch a duplicated credit, another user's balance being exposed, or a completion event lost during recovery.

This lesson designs a small testing workflow around a hypothetical reward service. Endpoints, states, and policies are illustrative. No reward service was deployed or tested for this article. The goal is to connect QA investigation, SDET skills, system design, cloud testing, and product judgment through one vertical slice.

### 1. Agree a checkable promise

Suppose refinement establishes these example rules:

- One validated completion credits one reward under the documented deduplication policy.
- Repeated deliveries of that completion do not add another credit.
- A player can read only their own balance and reward status.
- Interrupted processing eventually recovers within an agreed deadline.
- Pending work remains distinguishable from a confirmed rejection.

Record the rule source and owner. Use examples for duplicates, invalid completions, late delivery, identity changes, and interrupted processing. Example Mapping helps separate rules, examples, and questions. [Cucumber: Example Mapping](https://cucumber.io/docs/bdd/example-mapping/)

### 2. Draw the writes and failure boundaries

```text
Client -> Completion API -> Queue -> Validation worker -> Reward ledger
                                                          |
                                                     Balance API -> UI
```

Ask where data becomes durable, when messages are acknowledged, and how a retry is recognized. A ledger write followed by a lost acknowledgement is different from a failure before the write. The required test depends on the actual transaction boundaries.

For cloud execution, verify the intended service identity can access the queue and ledger, while unintended identities cannot. Local mocks cannot establish deployed permissions or network access. Include resource ownership, bounded traffic, and teardown in the test plan.

### 3. Select a small portfolio of checks

| Check | Expected evidence | Important limit |
| --- | --- | --- |
| Duplicate completion via API/integration | One ledger credit and one balance increment | Depends on the actual deduplication boundary |
| Cross-user status or balance request | Rejection and no unintended disclosure | Does not establish every access path |
| Worker interruption and redelivery | Accepted work accounted for, with no duplicate credit | Requires controlled interruption and observable state |
| Pending UI with controlled responses | Accurate status and useful next action | Does not establish backend persistence |
| Real UI journey plus independent API read | Visible result agrees with stored user state | One journey cannot cover every failure mode |

Playwright supports API setup and verification alongside browser tests. Use owned data and existing fixtures so parallel tests do not share mutable balances. [Playwright API testing](https://playwright.dev/docs/api-testing)

### 4. Give the agent a bounded workflow

Playwright documents planner, generator, and healer agents. The business expectations still need independent sources and review. [Playwright Test Agents](https://playwright.dev/docs/test-agents)

Use this planning prompt with your assistant:

```text
Read the agreed reward rules and existing fixtures.
Plan checks for duplicate delivery, cross-user access, interrupted processing,
and honest pending feedback. For each, name the expected result, its source,
test boundary, owned data, cleanup, and observable failure evidence.
Keep unanswered business questions explicit. Produce the plan for review.
```

After review, ask it to generate only the selected checks, run them in the designated test environment, and report exact commands and results. Preserve failures rather than making expectations match whatever the app currently does.

For a failing check, ask for classification: product defect, test defect, environment/data problem, or unresolved rule. Review assertion changes, skips, and deletions as changes to the evidence the suite provides.

### 5. Prove detection, then carry the evidence into CI

In an isolated implementation or controlled fixture, deliberately make duplicate delivery increment the balance twice. Confirm the relevant check fails for that reason, remove the fault, and confirm it passes. This experiment tests detection ability, not universal correctness.

Retain revision, environment, data IDs, timestamps, redacted request evidence, and relevant traces. Assign ownership for failures. A reviewable CI report should distinguish executed checks from proposed or blocked checks.

Bolton's automation guidance supports choosing repeatable observations while retaining investigation around the assumptions and results. [Which Test Cases Should I Automate?](https://developsense.com/blog/2018/06/which-test-cases-should-i-automate)

### Practical challenge

Create a four-case plan for the portfolio above. Write one rule example, identify one durable-write interruption, and draft one assertion that would detect duplicate crediting. If you can run an isolated service, perform the controlled-fault experiment and record the result. Otherwise, publish the plan as a plan and list what is needed to execute it.
