# QA Thinking — Day 47

## API Testing in Practice: Prove the Business Change, the Permissions, and the Failure Path

Your campaign API returns `200 OK` when an advertiser pauses a campaign. The dashboard shows “Paused.” Five minutes later, the bidder is still buying inventory. Which observation would your current API tests have caught?

This lesson starts a five-part path: API testing today, [adtech reconciliation](qa-thinking-day-48.html), [refinement and requirement analysis](qa-thinking-day-49.html), [an AI-assisted API/UI testing workflow](qa-thinking-day-50.html), and [adtech product discovery](qa-thinking-day-51.html). All examples describe an invented platform; its endpoints and policies are teaching examples, not industry requirements.

### 1. Start with a state change and its consequences

A request is an action against a business model. Before writing assertions, describe the model:

```text
draft -> active -> paused -> active
                    |
                    +-> archived (cannot resume)
```

For this example, the team agrees that pausing prevents new bid decisions within 30 seconds. Already accepted obligations can still produce later billing events. Those are two different promises. A test that rejects every charge after pause would encode the wrong requirement.

An **oracle** is the information you use to judge a result. Here the oracles are the agreed state diagram, the 30-second propagation policy, and the billing policy. The current response body is evidence to compare with those oracles.

### 2. Build a portfolio of API questions

| Layer | Question | Concrete check |
| --- | --- | --- |
| HTTP contract | Can callers understand the response? | Agreed status, content type, required fields, documented errors |
| Business rule | Did the operation mean what we intended? | Only an active campaign can transition to paused |
| Persistence | Did it survive the request? | Read the campaign through a fresh request and check state |
| Authorization | Who may change whose campaign? | Advertiser B cannot pause advertiser A's campaign |
| Concurrency | What happens when requests overlap? | Pause and resume with the same prior version; enforce the agreed conflict policy |
| Downstream effect | Did serving change? | Observe the decision service with a controlled opportunity after propagation |
| Recovery | What happens after an uncertain outcome? | Drop the response, retry according to the operation's documented semantics |

OpenAPI describes an HTTP interface and its schemas; use the API's actual supported specification version. Schema checks support the first row. They need separate assertions for business meaning and effects. [OpenAPI 3.1.1 specification](https://spec.openapis.org/oas/v3.1.1.html)

For authorization, send the request with another tenant's authenticated credentials and the first tenant's object ID. Check both the rejection and that the owner's record did not change. OWASP identifies this object-level authorization problem as a major API risk. [OWASP API1:2023](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/)

### 3. Separate a write from the read that verifies it

This illustrative Playwright test assumes an existing campaign fixture and a configured `request` fixture with `baseURL` and authentication. Our invented contract specifies `200` for pause and read, with a `state` field in both responses.

```ts
import { test, expect } from '@playwright/test';

test('pausing persists the campaign state', async ({ request }) => {
  // Supply a unique active campaign owned by this test's advertiser.
  const campaignId = process.env.TEST_CAMPAIGN_ID;
  if (!campaignId) throw new Error('Provide an isolated TEST_CAMPAIGN_ID');

  // WRITE: request a change.
  const pauseResponse = await request.post(`/campaigns/${campaignId}/pause`);
  expect(pauseResponse.status()).toBe(200);
  expect(await pauseResponse.json()).toMatchObject({ state: 'paused' });

  // READ: ask the service for the stored state separately.
  const readResponse = await request.get(`/campaigns/${campaignId}`);
  expect(readResponse.status()).toBe(200);
  expect(await readResponse.json()).toMatchObject({
    id: campaignId,
    state: 'paused',
  });
});
```

The first request asks the system to change. The second checks what the system now reports. This establishes API-visible persistence; a service returning cached state incorrectly could still fool it. Add a separate decision-service check to establish the serving consequence. Playwright supports direct HTTP testing as well as API setup and verification around UI flows. [Playwright API testing](https://playwright.dev/docs/api-testing)

In a real suite, a fixture should create the active campaign and clean it up. A browser context isolates cookies, not shared backend campaign records. Give parallel tests different records. Capture the campaign ID before assertions that might fail so teardown can still remove it.

For asynchronous effects, poll an observable result up to the agreed deadline. Report elapsed time and the final observation. An arbitrary sleep may miss the real boundary; an unlimited retry may hide a broken propagation promise.

### 4. Design failure experiments before expanding the happy path

Try a malformed ID, a missing required field, an unknown enum value, an expired token, a forbidden transition, and a stale version. Use raw HTTP when a form or Swagger UI prevents sending an invalid value. Record what happened separately from what the contract says should happen.

Then interrupt the request after the server receives it. A timeout leaves the client uncertain about the outcome. Before retrying, learn whether the operation is idempotent, whether it accepts an idempotency key, and how callers reconcile state. These are contract questions, not assumptions a test generator should fill in.

Michael Bolton's automation guidance asks us to think about which parts of testing tools can perform. Apply that here: automate repeated state and permission checks; keep investigating whether the pause promise matches the advertiser's needs. [Which Test Cases Should I Automate?](https://developsense.com/blog/2018/06/which-test-cases-should-i-automate)

### Practical challenge: one endpoint, six kinds of evidence

Choose a write endpoint you already test. Write down its starting state, authorized actor, expected stored result, downstream consequence, retry policy, and cleanup method. Mark unknowns as questions for refinement.

Implement or outline three checks: a successful write followed by a read, a cross-tenant rejection with unchanged owner state, and one uncertain-outcome experiment. For each, finish the sentence: “This check would fail if…” If you cannot name the defect it detects, strengthen the assertion before adding another test.
