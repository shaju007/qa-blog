# QA Thinking — Day 58

## Competitor Research for QA and Future Product Owners: Compare User Tasks Before Copying Features

Someone shares a competitor screenshot and says, “They have a reward-status page. We need one too.” That screenshot provides a research lead. It does not establish whether users understand the page, whether it solves your users' problem, or whether an equivalent capability already exists in your product.

This lesson uses rewarded advertising to teach a method that also applies to checkout, billing, reporting, and other products. The comparison worksheet and experiment below are proposed activities, not results from completed competitor testing.

### 1. Choose the task and the comparable product

A company can offer several products with different audiences and integration models. Compare a particular journey, such as “find out why a reward is pending,” rather than declaring one company better overall.

Two official sources provide useful research leads:

- Mistplay describes LoyaltyPlay within third-party partner ecosystems. That makes the embedded rewarded-gaming journey a relevant comparison to investigate. [Mistplay Audience Network announcement](https://business.mistplay.com/resources/announcing-mistplay-audience-network)
- Unity Rewards documents reward-status access and support for its web offerwall. That provides a documented reference for pending-reward explanations and help entry points. [Unity Rewards support terms](https://tapjoy.helpshift.com/hc/en/5-unity-rewards/faq/74-terms-of-service/?han=1&hpn=1)

These sources establish described capabilities. They do not establish comparative speed, satisfaction, reliability, or applicability to every region and platform.

### 2. Separate documentation, observations, and interpretations

Use an evidence table:

| Claim | Evidence type | What it establishes | What remains unknown |
| --- | --- | --- | --- |
| A reward-status view is documented | Official support page | The provider describes that capability | Actual availability and usability in the target journey |
| A participant found the pending status | Observed task session | Success for this participant under recorded conditions | General success rate |
| Clearer wording may reduce repeat contacts | Product hypothesis | An idea worth testing | Whether wording causes the problem or changes outcomes |

Record the date, product, operating system, region, eligibility, and source. Write “not observed” rather than “does not exist” when your access or sample is limited.

### 3. Compare equivalent tasks

Prepare tasks with clear completion criteria:

```text
Task A: Explain the actions required to earn an offer's reward.
Task B: Find the current status of an accepted offer.
Task C: Choose the correct next step for a delayed reward.
```

Run a small usability investigation with target users using authorized access and suitable test scenarios. Avoid purchases or activity that creates real financial obligations merely to collect screenshots.

Observe task success, time, misunderstandings, unnecessary steps, and confidence. Counterbalance the order where possible so learning the first product does not systematically favor the second. Include equivalent tasks on your own product.

### 4. Convert a difference into competing explanations

Suppose users understand one product's pending message more accurately. The cause might be wording, placement, familiarity, a simpler policy, or a different task. Identify which explanation the evidence supports before choosing a feature.

Test a small prototype with an improved explanation. Also consider whether better processing, eligibility information, or existing support tooling would address the problem more directly.

Evaluate value, usability, feasibility, and business viability rather than treating feature parity as the goal. [SVPG: The Four Big Risks](https://www.svpg.com/four-big-risks/)

Bolton's requirements discussion supports investigating user needs beyond the written ticket. Here that means asking what users need to decide, not merely whether another product exposes a screen. [Missing Requirements](https://developsense.com/blog/2024/05/missing-requirements)

### 5. Write a recommendation with honest limits

A useful recommendation says:

> A documented competitor capability suggested a task to investigate. In our small study, participants struggled to distinguish delayed processing from rejection in our prototype. We propose testing clearer explanations before adding a new page. This study does not establish market-wide superiority or a revenue effect.

As QA, contribute reproducible tasks and careful evidence. To practice product ownership, help choose the problem, compare options, and define what would justify investment.

### Practical challenge

Choose one user task and two official product references. Build the evidence table, marking what you can and cannot verify. Propose one improvement to your own product, one alternative explanation for the apparent gap, and one cheap experiment that could show your idea is unnecessary.
