# QA Thinking — Day 51

## Think Like a Product Owner: Turn Adtech Testing Observations Into Product Experiments

During testing, you notice advertisers repeatedly export campaign reports, join them in spreadsheets, and ask support why spend differs. You could file a usability issue. You could also bring product a better question: what decision are those advertisers trying to make, and what evidence would help them make it?

This lesson uses a hypothetical advertising platform. Its examples illustrate discovery and testing methods rather than the implementation or shortcomings of a particular company.

QA can contribute to discovery because testing exposes workarounds, confusing states, and costly uncertainty. Product thinking means connecting those observations to a user problem, a measurable outcome, and a cheap experiment. The product owner or product manager remains accountable for prioritization with the team.

This helps in two ways. In your current QA work, understanding users, business goals, and tradeoffs helps you question requirements and prioritize meaningful risks. If you later want to move into product ownership, the same practice gives you a foundation in discovery, prioritization, stakeholder communication, and outcome measurement. Build experience by participating in those decisions and following their results; reading about the role alone cannot establish that experience.

In Scrum specifically, the Product Owner is accountable for maximizing product value and effective Product Backlog management. A useful next step is to partner with your PO on a small discovery or backlog-ordering exercise and explain the tradeoffs behind the decision. [Scrum Guide: Product Owner](https://scrumguides.org/scrum-guide.html#product-owner)

### 1. Capture evidence before naming a feature

Start with a short problem note:

```text
User: agency campaign manager reconciling a client's weekly spend
Observed task: compare platform reports with a partner's invoice
Evidence to collect: recent examples, time spent, support conversations,
                    report filters, data freshness, and mismatch categories
Decision blocked: approve the invoice or investigate the discrepancy
Unknown: how frequent and costly this problem is across customers
```

Avoid treating one tester's frustration as proof of market demand. Ask users to walk through a recent reconciliation, showing the actual steps where possible. Look for existing reports or settings that already solve it before proposing something new.

Marty Cagan's discovery guidance emphasizes adjusting direction based on what you learn. Apply it here: be willing to discover that clearer documentation, a filter default, or a bug fix solves the problem. [Product Discovery](https://www.svpg.com/product-discovery/)

### 2. Generate competing ideas from the same problem

These are original product hypotheses for an invented platform, not claims of novel features or competitive advantage.

| Idea | User problem | Small first experiment | Outcome to measure |
| --- | --- | --- | --- |
| Spend reconciliation explainer | “Why does your total differ from the partner?” | Annotated report distinguishing late events, duplicates, currency, and billing basis | Time to correctly explain a sampled discrepancy |
| Campaign launch preflight | “I launched, but delivery never started” | Read-only checklist for a narrow set of known configuration problems | Preventable launch failures and false warnings |
| Conversion-data freshness panel | “Is performance poor, or is data late?” | Show processing watermark and incomplete reporting windows | Correct decisions on delayed-data examples |
| Budget-change impact preview | “Will this change disrupt delivery?” | Preview with documented assumptions and ranges | User understanding and harmful budget edits |
| Creative rejection action guide | “What exactly must I change?” | Map a few verified rejection reasons to actionable examples | Time to a valid resubmission and repeat rejection rate |

For adtech, keep metric definitions explicit. An auction win and a billable impression are different observations; changing a label cannot reconcile them. OpenRTB's notification semantics illustrate why a trustworthy explainer needs partner-specific meaning. [OpenRTB Bid object](https://github.com/InteractiveAdvertisingBureau/openrtb2.x/blob/main/2.6.md#423---object-bid)

### 3. Evaluate the risks before ranking the ideas

SVPG describes four product risks: value, usability, feasibility, and business viability. Use them to challenge one idea rather than score five ideas with invented precision. [The Four Big Risks](https://www.svpg.com/four-big-risks/)

For the reconciliation explainer:

- **Value:** do campaign managers need an explanation here, or only a correct export for their finance tool?
- **Usability:** can they distinguish a temporary mismatch from an unresolved accounting issue?
- **Feasibility:** do event lineage and partner identifiers exist to explain the difference reliably?
- **Viability:** can the platform provide the explanation within partner agreements, support costs, and access controls?

Add the strongest contrary evidence. If users rarely reconcile manually, or if most differences come from one known export bug, the case for a new feature weakens.

### 4. Design an experiment before a delivery backlog

For this hypothetical example, start with a read-only report on synthetic or appropriately authorized data. Include three known discrepancies and one case where the explanation is genuinely unknown.

Run exploratory sessions with a small group of target users. Ask each person to explain the discrepancy and choose a next action before and after seeing the report. Measure correct explanations, time taken, and confident wrong answers. Ask what they would otherwise use.

Agree a decision rule before looking at the results. For example: proceed to a limited pilot only if the report improves explanation accuracy without encouraging mistaken invoice approval. Define the actual threshold with product and research based on risk; a small usability study cannot establish revenue uplift.

If the prototype works, compare pilot outcomes against a suitable baseline and account for changes in customers, campaign mix, and data quality. A lower support-ticket count alone could mean users gave up.

### 5. Let QA shape acceptance criteria and measurement

Once the team chooses to build, derive criteria from the intended outcome:

- Every explanation identifies the reporting window, time zone, currency, and freshness.
- A known cause links to supporting evidence the user is authorized to see.
- An unclassified discrepancy is shown as unexplained, with a next action.
- Changes in late-arriving events update the explanation without hiding the earlier snapshot.
- Another advertiser's identifiers and event details remain inaccessible.

If AI summarizes the explanation, calculate financial differences through a deterministic path and supply the model with those verified facts. Test unsupported claims, missing data, and cross-tenant retrieval. Measure whether users reach correct decisions; polished wording alone is insufficient.

This also applies Bolton's distinction between useful automated observations and broader testing work: checks can verify amounts and access, while observation and conversation investigate whether the explanation actually helps. [Automation guidance](https://developsense.com/blog/2018/06/which-test-cases-should-i-automate)

### 6. Apply the discovery approach to rewarded advertising

For a rewarded-gaming exercise, follow the player's reward journey as well as advertiser and publisher outcomes. Candidate investigations include:

- **Reward-status explanations:** can a player understand whether progress is pending, credited, or needs support? First verify the actual product's states and existing support tools.
- **Publisher integration diagnostics:** can an integration team distinguish SDK initialization, configuration, event-delivery, and reward-crediting problems using permitted diagnostic evidence?
- **Advertiser reporting freshness:** can campaign managers distinguish incomplete data from poor performance before changing a campaign?

These are hypotheses to investigate, not claims that a particular platform lacks these capabilities. Interview the relevant users, inspect current documentation, and compare existing solutions before proposing a feature. Keep player rewards, publisher revenue, advertiser spend, and advertiser outcomes as separate quantities with explicit definitions.

Use bidding and auction examples when studying the applicable product or integration. Do not assume every rewarded flow is an OpenRTB auction or that a generic CPM example describes its commercial model.

### 7. Make this a recurring QA-to-product practice

Use the same investigation to strengthen both kinds of judgment. As QA, trace the journey, reproduce the behavior, examine failure modes, and separate observations from possible causes. As a future Product Owner, ask whose goal is affected, how widespread the problem is, which improvement deserves priority, and how the team will know it helped.

Keep an opportunity log with the user, goal, evidence, frequency, impact, alternative explanations, current workaround, and smallest next investigation. Compare opportunities by reach, severity, confidence, and effort. Bring the evidence to product and engineering before committing to a solution.

Rotate your practice across reward reliability, offer clarity, publisher integration, advertiser reporting, performance, access, and operational efficiency. For each opportunity, propose one measurable outcome and the guardrails that protect other users and partners. A revenue experiment should identify platform revenue separately from advertiser spend, publisher earnings, player rewards, and contribution margin.

Build experience by taking one small responsibility with your PO: participate in a user conversation, facilitate refinement, propose backlog ordering, or review an experiment's outcome. Keep the resulting artifact and seek feedback on your reasoning. These practical investigations can be repeated as a learning series while the wider blog continues its technical topics.

### Practical challenge: bring one idea to product

Choose an adtech pain point you have observed. Write a one-page pitch with the user, recent evidence, current workaround, proposed outcome, two possible solutions, biggest uncertainty, cheapest experiment, success measure, and one reason to stop.

Open the conversation with: “I noticed this recurring problem while testing. Here is the evidence we have and what we still need to learn. Could we try this small experiment?”

That contribution connects QA's investigative skills to product decisions, from discovering a need through defining requirements to checking whether the delivered feature improves the user's work.
