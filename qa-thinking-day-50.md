# QA Thinking — Day 50

## An Agentic API and UI Testing Workflow: From Agreed Requirements to Reviewed Evidence

“Ask AI to test the feature” leaves too many decisions implicit: which requirements matter, what the agent can change, where it can run, and what counts as success. A useful agentic workflow gives the agent a bounded task, tools to observe the system, and a loop for acting on evidence.

There is no universally best workflow. This is a practical starting point for a team testing an ad campaign pause feature. It builds on [API checks](qa-thinking-day-47.html) and [refinement decisions](qa-thinking-day-49.html), and complements [the interview lesson on reviewing generated tests](qa-interview-day-31.html). It describes a proposed workflow; it has not been benchmarked against a real campaign service in this blog repository.

### 1. Give the agent an evidence pack

Prepare a short folder with these inputs:

```text
specs/campaign-pause/
  requirements.md       agreed rules, examples, unanswered questions
  api-contract.yaml     the service's actual supported OpenAPI contract
  test-plan.md          risks, expected outcomes, check boundaries
  run-notes.md          environment, setup, data ownership, cleanup
```

Also point to existing fixtures and a small trusted test. Keep credentials in the runner's configured secret mechanism. Give the agent the intended non-production environment, scoped test accounts, allowed actions, and a runtime limit. These are practical execution inputs, particularly when tests write records or trigger downstream events.

Expected outcomes need named sources: requirement, agreed business example, independent calculation, or partner contract. An observation from the current app should be labeled as observed behavior until someone confirms it as intended behavior.

### 2. Plan before generating

Ask the agent to map each risk to a check and an expected result:

| Risk | Check boundary | Oracle |
| --- | --- | --- |
| Another tenant pauses my campaign | Authenticated API request | Ownership and role policy |
| State changes but serving continues | Service integration with controlled opportunities | Agreed propagation deadline |
| Pending pause appears complete | UI with controlled delayed response | Agreed interaction design |
| Reload loses the pause | Browser action plus independent API read | Stored campaign state |

Review this plan with QA and the relevant domain owner before generating code. Unanswered business questions should remain questions.

Playwright documents planner, generator, and healer agents: planning, producing tests, and repairing failures. These are browser-testing capabilities; they do not supply your business oracle or a complete API strategy. [Playwright Test Agents](https://playwright.dev/docs/test-agents)

### 3. Generate API checks first, then a few browser journeys

For this feature, generate direct API checks for transitions, validation, authorization, persistence, and concurrency. Add browser journeys for pause, pending feedback, confirmation, and reload. Use API setup to create isolated campaigns efficiently, while retaining a UI journey that tests the real interaction. [Playwright API testing](https://playwright.dev/docs/api-testing)

Use existing fixture conventions. Each test owns its backend records and has teardown. Browser isolation does not isolate shared database records.

Use mocked responses to exercise specific UI states, such as a timeout banner. Label those checks as UI behavior against controlled responses. Add a separate test against the deployed backend for persistence and service integration. Both checks answer useful questions; their evidence differs.

### 4. Use explicit prompts for each step

These templates can be adapted to your coding assistant. They are workflow prompts, not tool-specific commands.

**Plan:**

```text
Read the campaign-pause requirements, API contract, and existing fixtures.
Produce a risk-based test plan before editing tests. For each case, identify
the expected result and its source, data setup, cleanup, and test boundary.
List unresolved business questions. Prioritize permissions, persistence,
propagation, and honest UI feedback. Wait for plan review before generation.
```

**Generate:**

```text
Implement only the reviewed plan cases in the existing test conventions.
Use isolated campaigns and configured authentication. Run the targeted tests
in the designated test environment. Preserve meaningful assertions, record
the exact command and result, and report any case you could not execute.
Treat disagreement between the app and requirements as a finding to inspect.
```

**Diagnose:**

```text
Investigate the named failing check using its trace, HTTP evidence, setup,
and requirement source. Classify the failure as a product issue, test issue,
environment/data issue, or unresolved requirement. Propose a minimal patch
with evidence. Changes to expected results, skips, and deletions need review.
```

The agent may perform these roles sequentially. More simultaneous agents are not inherently better; shared data and duplicated work can make evidence harder to interpret.

### 5. Run, diagnose, and preserve the failure

Capture the commit, environment, command, test-data IDs, timestamps, result, and relevant redacted artifacts. Use traces and response evidence to ask where behavior first diverged.

| Observation | Next investigation |
| --- | --- |
| Locator no longer matches | Inspect the actual UI and intended accessible name |
| Request returns an unexpected status | Inspect auth, input, contract, and server evidence |
| Another test owns the same campaign | Correct data ownership and repeat the affected check |
| Serving continues beyond the deadline | Preserve the failure and investigate propagation |
| UI contradicts the agreed rule | Review the product behavior with its owner |

A healer can propose a repair. Review changes that alter expected behavior or remove a check. Making a failed assertion match the current app can conceal exactly the regression you wanted to detect.

### 6. Prove that a useful check can fail

On an isolated branch or controlled fixture, introduce one deliberate defect: return `paused` without storing it, let another advertiser's request through, or hide the pending message. Run the relevant check and confirm it fails for the intended reason. Remove the deliberate defect and confirm it passes again.

This small experiment gives evidence about detection ability. A large green test count does not. Bolton's automation guidance helps keep the focus on useful tool-supported observations rather than replacing investigation with scripts. [Which Test Cases Should I Automate?](https://developsense.com/blog/2018/06/which-test-cases-should-i-automate)

### 7. Review the diff, then keep CI predictable

Review requirement coverage, assertion strength, isolation, cleanup, secret handling, and any changed skips. Merge reviewed tests through the team's normal process. CI should execute those tests with stable configuration and save evidence; agent-generated repairs can return as reviewable changes.

Track defects detected, unexplained failures, maintenance time, and high-risk rules still uncovered. These measures tell you more about the workflow than generated lines or test count.

### Practical challenge: one vertical slice

Use one agreed campaign-pause example. Create its evidence pack, review a four-case plan, and generate two API checks plus one browser journey. Introduce one controlled fault and verify detection. Finish with a report listing what ran, what failed, what was fixed, and what remains untested.

Next: [use the same questioning skills to discover better adtech products](qa-thinking-day-51.html).
