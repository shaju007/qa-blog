# QA Thinking — Day 49

## QA in Refinement: Turn “Pause the Campaign Immediately” Into Decisions the Team Can Test

The product owner brings a story: “As an advertiser, I want to pause a campaign immediately so I can stop spending.” A designer has drawn a pause button. A developer estimates one day. QA is asked whether anything is missing.

Your contribution starts with the user's purpose: control financial exposure. That purpose is broader than a button or an HTTP response. This lesson extends [Day 3's introduction to refinement](qa-thinking-day-03.html) into a practical requirements workshop with concrete outputs.

### 1. Prepare questions around one business example

Before refinement, read the story, inspect the existing campaign states, and bring one realistic timeline:

```text
10:00:00.000  advertiser clicks Pause
10:00:00.050  API accepts the change
10:00:01.000  an already-started auction wins
10:00:04.000  another bidder receives the updated state
10:01:10.000  a billable event from the earlier auction arrives
```

Ask: “Which of these activities should pause prevent, and what should the advertiser see about the later charge?” This gives product and engineering a decision they can discuss together.

The goal is shared understanding, including needs that the ticket has not captured. Michael Bolton's discussion of missing requirements is a useful reminder that written specifications do not exhaust what matters. [Missing Requirements](https://developsense.com/blog/2024/05/missing-requirements)

### 2. Map rules, examples, and questions together

Cucumber's Example Mapping separates the story, rules, concrete examples, and unanswered questions. Use that structure with product, development, and QA; include design or operations when their knowledge matters. [Example Mapping](https://cucumber.io/docs/bdd/example-mapping/)

For our invented platform, the workshop might produce:

| Rule under discussion | Example to test our understanding | Open decision |
| --- | --- | --- |
| Only campaign managers may pause | A read-only analyst sends the API request directly | Which roles are campaign managers? |
| Pause stops new bid decisions | A serving node has stale cached campaign state | What is the maximum propagation delay? |
| Existing obligations remain payable | A prior auction produces a later billable event | What explanation and amounts appear in the UI? |
| Repeating pause is safe | A client retries after losing the response | Same response or documented no-op result? |
| Concurrent edits do not silently overwrite intent | Another manager resumes while pause is pending | Version conflict, ordering policy, or another explicit rule? |

Keep the table visible. A question with an owner and a follow-up date is useful output. An invented answer hidden inside a test is a future disagreement.

### 3. Make acceptance criteria observable

Suppose the team chooses a 30-second propagation target. Record it as an example policy, not an adtech standard:

> Given an active campaign and an authorized campaign manager, when pause is accepted, the campaign API reports `paused`, and all serving nodes stop making new bid decisions for the campaign within 30 seconds of acceptance. Previously accepted obligations remain billable. The UI explains the delay and the possibility of later charges.

Now ask how each part can be observed. Do we have a request timestamp, a campaign version, decision logs, and a way to generate controlled opportunities? What exactly counts as a “new decision” at the deadline? Product intent and testability need to meet before estimation is reliable.

Check boundaries: a decision just before the deadline, at it, and after it; a disconnected serving node; a pause during another edit; a client that loses the response. Agree on the authoritative timestamp and allowable measurement precision.

### 4. Cover more than functional behavior

Bring a short requirements checklist to the conversation:

- **Actors and access:** campaign owner, agency user, support operator, service account, another tenant.
- **Data and state:** valid transitions, stale versions, retention, audit events.
- **Time and failure:** propagation, retries, outages, recovery, late events.
- **User experience:** pending state, double clicks, keyboard use, understandable consequences.
- **Operations:** evidence for support, alerts for missed propagation, rollback behavior.
- **Business outcome:** whether advertisers understand and trust the pause promise.

Use the checklist to find gaps in this story. It is a conversation aid rather than a demand to expand every story into every possible concern.

### 5. Leave refinement with a small, usable package

The package should include the agreed rules, examples with expected outcomes, unresolved decisions with owners, a proposed story slice, and the testability work needed for it. Link those artifacts to the story so developers and testers use the same decisions.

A useful slice might deliver authorized manual pause, visible propagation state, and an audit trail. Automatic budget recommendations can be a separate discovery item. The product owner decides priority with the team; QA contributes evidence about risk and uncertainty.

When a meeting becomes defensive, try:

> “I can test that the button calls the endpoint. To check the advertiser's promise, we also need a decision about when new bids stop and how we explain later charges. Could we agree those two examples before estimating?”

### Practical challenge: run a 25-minute refinement exercise

Take “Notify advertisers when a campaign is underperforming.” Spend five minutes defining whose problem this is, ten mapping rules and examples, five identifying unanswered questions, and five proposing a small first slice.

Produce at least one example where an alert would be misleading: delayed conversion data, a campaign too new to evaluate, or a tiny sample. Write the acceptance criterion only after the team decides the policy. Keep unresolved questions visible instead of turning them into assumptions.

Next: [give an AI testing agent this evidence before asking it to generate checks](qa-thinking-day-50.html).
