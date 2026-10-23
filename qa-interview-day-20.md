# QA Interview Q&A — Day 20

## Question: Your retail-media platform caps a campaign at 3 impressions per user per day. The advertiser's report for Tuesday shows an average frequency of 3.4. A developer says, "Caps are best-effort in distributed systems. That's expected." Is it a bug?

**Context for the interviewer:** The company runs sponsored-product and display ads on a large e-commerce marketplace. A sportswear brand runs a campaign with a cap of 3 impressions per user per day. Its account manager forwards an angry email. Tuesday's report shows 4.08 million impressions reaching 1.2 million unique users, an average of 3.4. The brand wants a credit for "every impression over the cap." You're the QA engineer on the ad-serving team.

## Answer

### The short version

"I don't know yet, and neither does the developer." Two quick answers are both weak here. "The cap is 3, the report says 3.4, so it's a bug" treats a single average as the oracle. "Distributed systems are best-effort, so it's fine" treats a known limitation as a blank cheque. An experienced tester would break the 3.4 into a few hypotheses that each have a different owner and a different fix, collect evidence that tells them apart, and put the "how much overshoot is acceptable" question to the people who actually own that decision.

The developer is partly right, and a good answer says so. Google's own AdMob documentation says that "a slight server delay can result in the frequency cap that you've set being exceeded," and that a cap change "can take up to a day to take effect." Some overshoot is a normal, documented property of frequency capping. "Expected" still leaves open how much overshoot, where it happens, why, and whether we ever told advertisers it could happen.

### Why the average is a worse signal than it looks

An average of 3.4 against a cap of 3 sounds like "13% over." It's likely worse than that. In a campaign where the cap works, most users never reach it. Plenty of shoppers see the ad once or twice and leave. A plausible healthy distribution might be 50% of users at 1, 25% at 2 and 25% at 3, which averages 1.75. To pull the average up to 3.4, a large share of users must be well above 3, as the report counts them.

That last part is the important caveat. The report and the cap may not count the same things. So my first move is to stop reasoning from the summary number and ask for the distribution: how many users had 1, 2, 3, 4, 5, 6, 10+ impressions. Then I'd check whether "user" and "day" mean the same thing in the report as in the cap.

### The hypotheses, and the evidence that separates them

| Hypothesis | What it would mean | Evidence that confirms or kills it |
|---|---|---|
| **The report's "day" is a different window from the cap's "day"** | The cap resets at 00:00 UTC, but the advertiser's report runs on New York time. Tuesday in New York is 04:00 UTC Tuesday to 04:00 UTC Wednesday. Someone shopping on Tuesday evening in New York gets a fresh cap partway through "their" Tuesday, so up to 6 impressions per report-day is consistent with the code. | Over-cap impressions cluster just after the cap's reset hour. Per-user counts recomputed in the *cap's* window come out at ≤3 (or close). |
| **The report's "user" is a different identity from the cap's "user"** | The cap is keyed on cookie or device ID. The report deduplicates to a logged-in customer ID across phone, laptop and app. Each device stays within its cap, but each person goes over it. | Recompute frequency per cap key and compare it with per-customer frequency. Check whether over-cap "users" have more than one device ID. |
| **Unique users is an estimate, not a count** | If the report estimates reach with a HyperLogLog sketch, uniques can be undercounted and frequency overstated. | Check the error bound. Redis documents a 0.81% standard error for its HLL. That can't explain a gap this size, so this one is quickly **ruled out** unless the implementation is unusual. |
| **Race on parallel requests** | The search results page loads a carousel of six sponsored slots, plus lazy-loaded slots as the shopper scrolls. All the requests check the counter before any impression gets written back. | For over-cap users, the time between the 3rd and 4th+ impression is under a second, and the same page-view ID shows up on several impressions. |
| **Stale counters across regions** | A user's requests land in two data centres, and the counter replicates asynchronously. | Over-cap impressions are minutes apart and served from different regions. Overshoot rises with traffic or replication lag. |
| **Counting at different points** | The cap counter goes up when an ad is served or the auction is won. Reporting counts on begin-to-render (the IAB/MRC standard), or the reverse. Duplicate render beacons can inflate reported impressions even though the user saw nothing extra. | Compare served IDs with rendered-beacon IDs. Duplicate beacons show up as identical impression IDs. |
| **Configuration and scope** | The cap was applied per line item, not per campaign (three line items × 3 = 9), or someone edited the cap mid-flight and the change hadn't taken effect yet. | Audit log of campaign settings. Check whether the overshoot lines up with line-item boundaries or an edit timestamp. |

Several of these mean the ad server is doing exactly what it was built to do. The defect is in the reporting definition, in what the UI promises, or in a product decision nobody explicitly made. Only some point at enforcement code. That's why "is it a bug?" can't be answered from where we're sitting, and why a tester's value here is in separating the hypotheses, not in picking a side.

### Which oracles I'd use

Michael Bolton's FEW HICCUPPS heuristic is useful here because each piece of evidence comes from a different oracle:

- **Claims.** What does the campaign setup screen say? If the UI says "Shoppers will see this ad at most 3 times per day," that's a claim, and 6 per report-day breaks it, whatever the code does. If the insertion order or help pages say caps are best-effort, the advertiser's expectation is weaker.
- **Comparable products.** Google publicly documents that caps can be exceeded and that only browsers with cookies or device IDs get capped ads in Campaign Manager 360. If our documentation says neither, that's a gap even if our overshoot is small.
- **Product consistency.** If the cap screen and the report use different definitions of "user" and "day," the product disagrees with itself. Advertisers will read that as overcharging.
- **Explainability.** If nobody in the room can explain how 3.4 came about, that's already a finding.
- **Standards.** The IAB/MRC "count-on-begin-to-render" rule tells you which count counts commercially, which matters for any credit.

James Bach's Heuristic Test Strategy Model is a good checklist for *where* the problem could live. Under Product Factors, **Time** covers windows, time zones and concurrency, **Data** covers identity and deduplication, **Platform** covers multi-region infrastructure, and **Operations** covers how shoppers actually browse: fast scrolling, several tabs, app plus web. Frequency-cap bugs almost always sit where Time meets Data.

### What I'd actually test once we know the hypothesis

A sequential automated check ("request four ads for one user, expect the fourth to be refused") will pass and prove almost nothing. It's the one scenario a race can't reach. The tests worth running look like real shopping:

- **Parallel requests from one user.** Fire six slot requests at the same moment, like a search results page does. Repeat with lazy-loaded slots during fast scrolling, then with two tabs open.
- **Region split.** Route requests for the same user ID to two regions within seconds of each other.
- **Window boundaries.** Send impressions just before and just after the cap reset, with the advertiser's report set to a different time zone. In Europe the clocks go back this Sunday (25 October), so one cap "day" will be 25 hours long. It's worth checking which day the extra hour belongs to.
- **Identity transitions.** Anonymous browsing, then login, then the app. Cleared cookies. Safari with limited ID persistence. Requests with no ID at all: do we serve capped campaigns to them? Google's CM360 doesn't.
- **Configuration changes.** Edit the cap mid-flight and measure how long the old cap stays in force.
- **Measurement duplicates.** A retried or doubled render beacon should not create a second billable impression.

Then I'd turn the over-cap measurement into ongoing monitoring: the share of impressions above the cap, per campaign, per day, computed in the cap's own window and identity. That turns "best-effort" from a slogan into a number someone can set a threshold on.

### What I'd say in the meeting

> "I think we're mixing up three questions. First, does the ad server enforce the cap the way it was designed to? Second, does the report measure frequency the same way the cap does? Third, how much overshoot did we tell the advertiser to expect? The developer's right that some overshoot is normal, and Google documents the same thing for its own caps. But an average of 3.4 means a lot of users are well above 3 *as the report counts them*, and right now I can't tell whether that's enforcement, a time-zone mismatch, or identity deduplication.
>
> By tomorrow I can pull Tuesday's log-level data and recompute frequency in the cap's own window and identity. I'll also check how far apart the over-cap impressions are: sub-second gaps point to parallel slot requests, clustering after midnight UTC points to the time zone. That will tell us which team owns this.
>
> What I can't decide is what overshoot is acceptable, or whether the brand gets a credit. That's for product and the commercial team. What I can give them is the real number, an explanation, and a test showing whether a fix holds."

That last part matters. QA doesn't own the tolerance or the credit decision. A tester who says "this must be fixed before the next campaign" is claiming authority they don't have. A tester who says "here's how far over we are, here's why, here's what the UI promises, and here's how we'd know a fix worked" usually ends up shaping the decision anyway.

### Likely outcomes, depending on the evidence

- **Time-zone or identity mismatch:** a product decision. Either align the report's definitions with the cap, or label the report clearly ("frequency per device, cap day in UTC"), and update the UI wording.
- **Parallel-request race:** an engineering fix (for example, reserving a cap slot when the ad is requested, not when it renders), plus a concurrency test in the regression suite.
- **Known, small replication lag:** document it as best-effort with a measured bound, monitor it, and consider not billing impressions above the cap.
- **Any of the above:** advertiser-facing documentation that matches what the system actually does.

### Common weak answers and assumptions

- **"3.4 > 3, so it's a bug."** This treats an average as a pass/fail oracle and ignores that the report may define "day" and "user" differently.
- **"Best-effort means it's fine."** This takes a documented limitation and stretches it into any amount of overshoot, without measuring it.
- **"I'd write an automated test that sends four requests."** A sequential test can't reach the most likely failure modes, which are concurrency, regions and window boundaries.
- **"The report is the source of truth."** Reports are software too, often built by a different team on different definitions.
- **Treating it as a pure engineering problem.** In ad tech, a mismatch between what the UI promises and what the system delivers turns into a commercial dispute. Account managers and product owners need to be in the conversation, not just told the result.

### Follow-up questions

1. **"Product asks you to make the cap a hard guarantee. What do you tell them it costs?"** A strong answer covers the tradeoffs: synchronous checks against a central counter add latency to every ad request, and ad requests have tight time budgets. Refusing to serve when the counter is unreachable loses revenue. Requests without an ID can't be capped at all. A good answer gives product the options and their costs; it doesn't claim to make the decision.
2. **"How would you reproduce the parallel-slot race in a test environment without production traffic?"** Look for a deterministic approach: injected latency on the counter write, a controlled burst of simultaneous requests sharing one user ID, and replication lag simulated between two counter instances. Then assert on the distribution of outcomes across many runs, not on one run.

## Sources

- [Google AdMob Help: Frequency capping for campaigns](https://support.google.com/admob/answer/6177174?hl=en). Google's own documentation that "a slight server delay can result in the frequency cap … being exceeded," that cap changes can take up to a day to take effect, and that caps can apply per campaign or per ad. It supports the developer's point and the configuration-scope hypothesis.
- [Google Campaign Manager 360 Help: Frequency caps](https://support.google.com/dcm/answer/2837363). Explains that the cap is checked against "the time period leading up to the impression" and that only browsers with cookies or device IDs receive capped ads. Used as a comparable-product oracle for the identity and no-ID questions.
- [IAB: Desktop Display Impression Measurement Guidelines](https://www.iab.com/guidelines/desktop-display-impression-measurement-guidelines/). The IAB/MRC shift to "count-on-begin-to-render" impression counting. Relevant because the cap counter and the billable impression may be counted at different points.
- [Redis documentation: HyperLogLog](https://redis.io/docs/latest/develop/data-types/probabilistic/hyperloglogs/). Documents the 0.81% standard error of Redis's HLL estimate. Used to show how a published error bound can rule out a hypothesis ("the uniques are just estimated") with arithmetic.
- [Michael Bolton, DevelopSense: FEW HICCUPPS](https://developsense.com/blog/2012/07/few-hiccupps). Oracle heuristics (Claims, Comparable products, Product consistency, Explainability, Standards) used above to show that "is it a bug?" depends on which expectation you check against.
- [James Bach, Satisfice: Heuristic Test Strategy Model (v6.3)](https://www.satisfice.com/download/heuristic-test-strategy-model). The Product Factors (Time, Data, Platform, Operations) used to locate where frequency-cap failures tend to hide and to design tests beyond the obvious sequential check.
