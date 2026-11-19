# QA Thinking — Day 57

## From a Missing-Reward Report to a Product Decision: A QA Investigation That Goes Beyond the Bug

In a hypothetical rewarded-game platform, a player says: “I completed the task, but my points never arrived.” Support proposes a clearer status screen. Engineering suspects delayed events. Product wants to reduce repeat contacts. These are related concerns, but the report has not established the cause.

Your first contribution is to make the uncertainty inspectable. Your next is to help the team decide whether the right response is a defect fix, clearer requirements, better explanations, or further investigation.

### 1. Follow the evidence through the journey

Use an invented state model as a discussion aid:

```text
offer accepted -> progress observed -> completion validated
               -> reward recorded -> host-app balance updated
```

This is not a universal architecture. Ask which states exist in the actual product and which team owns each transition. Some apparent steps may happen in one transaction; others may cross organizations.

Create a timeline with the offer and user identifiers permitted for investigation, the version of the offer rules, relevant event IDs, event times, processing times, and the balance observation. Keep sensitive data out of broadly shared reports.

### 2. Compare explanations instead of assuming one

| Possible explanation | Evidence that would help distinguish it |
| --- | --- |
| The completion event never arrived | Source-side evidence and ingestion records |
| The event arrived but validation failed | Applied rule version and explicit validation outcome |
| Processing is delayed | Queue age and timestamps for the same event |
| Reward was recorded but delivery failed | Ledger entry and host-app delivery evidence |
| Balance changed but the UI is stale | Independent balance read and UI/network observations |
| Eligibility was misunderstood | Offer wording shown to that user and the agreed rules |

Absence from one log is not proof that an event never existed. Check instrumentation coverage and retention before drawing that conclusion.

### 3. Take the ambiguity into refinement

Bring product, development, support, and relevant integration owners together. Ask what counts as completion, how long processing may take, what happens on retries, and which explanation a user should see.

Capture rules, concrete examples, and unanswered questions separately. Example Mapping provides that structure. [Cucumber: Example Mapping](https://cucumber.io/docs/bdd/example-mapping/)

Suppose the team chooses these fictional rules:

- The same validated completion contributes one reward even if delivered repeatedly.
- A delayed completion displays pending until the stated processing deadline.
- An unconfirmed outcome is not presented as a permanent rejection.
- Support can distinguish a rule rejection from a delivery failure.

Now create examples for delayed, duplicate, out-of-order, invalid, and interrupted deliveries. Written requirements may omit real needs; investigation can expose them. [Michael Bolton: Missing Requirements](https://developsense.com/blog/2024/05/missing-requirements)

### 4. Turn the finding into an opportunity

Write the smallest problem statement the evidence supports:

> In the investigated cases, users cannot distinguish pending processing from a rejected completion. We need to establish how frequently this misunderstanding causes repeat contact and whether clearer status information helps.

Do not generalize a few cases into a platform-wide failure rate. Review a suitable sample of tickets, include successful journeys, and interview users about recent experiences.

Possible responses include fixing delivery, clarifying eligibility, improving status wording, or adding diagnostic evidence. Compare them by affected population, impact, confidence, effort, and dependencies.

### 5. Measure the result without hiding the problem

For a status explanation experiment, measure whether users choose the correct next action. Also monitor reward correctness, processing delay, repeat contacts, and return visits. Fewer tickets alone could mean the support path became harder to find.

As QA, own the quality of the investigation and test evidence. To practice product skills, facilitate the refinement discussion or write the opportunity proposal with your PO. Follow the outcome after release.

### Practical challenge

Draft a timeline where a completion is delivered twice, a reward is recorded once, and the balance display updates late. Write one integration check, one UI check, and one question that requires product judgment. Finish with a 100-word opportunity note separating observation, hypothesis, and the next decision.
