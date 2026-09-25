# QA Interview Q&A — Day 2

## Question: You get a new feature dropped on your desk with no test plan and 90 minutes before the release freeze. Fifteen minutes before the deadline you find a bug you can't reliably reproduce. What do you do?

## Answer

This question is really testing two separate skills: how a tester structures exploration under time pressure, and how they handle the ambiguity of an intermittent bug when the clock is against them. Weak candidates answer only the first half and then say "I'd write a bug report" as if reproducibility were a formality.

**Structuring the 90 minutes**

An experienced tester doesn't start clicking randomly. They spend the first five minutes turning "test this feature" into a charter — a short, written mission statement that says what they're exploring, with what techniques, and why. This is straight from Session-Based Test Management, which James Bach developed specifically to make exploratory testing accountable without forcing it into scripted steps beforehand ([satisfice.com](https://www.satisfice.com/blog/archives/1509)). A charter for, say, a new "apply promo code" field in a marketplace checkout might read: "Explore promo code entry with boundary and malformed inputs, focusing on interaction with existing cart discounts and currency conversion."

From there they'd use a heuristic like Bach's SFDPOT (Structure, Function, Data, Platform, Operations, Time) to decide where to spend the limited minutes, rather than testing everything shallowly. Given 90 minutes, that usually means: 20 minutes on the obvious happy path and functional coverage, 40 minutes on data variation and edge cases (empty codes, expired codes, codes stacked with existing discounts, codes with unicode or trailing whitespace), 20 minutes on interaction with other features (does the promo survive a currency switch, a saved-cart reload, a guest-to-login conversion), and 10 minutes held in reserve for whatever the first hour turns up. The reserve matters — exploratory testing is adaptive, and the point of not scripting it upfront is that what you learn in minute 30 should change what you do in minute 60. Michael Bolton's writing on exploratory testing emphasizes exactly this: testing and learning happen simultaneously, and a rigid plan defeats the purpose ([developsense.com](https://developsense.com/blog/category/test-framing/exploratory-testing)).

**The unreproducible bug at minute 75**

This is the part candidates fumble. The instinct is either to burn the remaining time chasing repro steps (and miss the freeze deadline with nothing to show), or to drop it because "I can't prove it." Both are wrong.

Cem Kaner's framing of testing as an investigative discipline is useful here: your job is not to produce a perfectly reproducible bug report, it's to produce evidence that informs a risk decision. An intermittent bug found during a real exploration session, on a feature nobody has tested yet, is itself a signal — even without a deterministic repro, it tells you something about the feature's reliability under conditions you haven't fully characterized yet (timing, network latency, state from a previous action, race conditions in async calls).

What I'd actually do:

- Capture everything I have immediately: screenshot or screen recording if one was running, console/network logs, exact timestamp, browser/device, and the rough sequence of actions leading up to it — even if I can't say which step caused it.
- Note what I was doing in the surrounding minutes, since intermittent bugs in checkout/promo flows are very often timing- or state-dependent (e.g., cart total recalculating asynchronously while the promo code POST is in flight — common in marketplace and payments contexts).
- Write it up explicitly as "observed once, not yet reproducible" rather than silently omitting it or overstating it as confirmed. Precision about certainty is part of the report's credibility.
- Flag it live, not in a ticket queue: go to whoever owns the release decision and say something like, "I found something that looked like a discount being applied twice on one attempt, I couldn't reproduce it in the time I had, here's what I captured — I don't have enough to block the release on my own authority, but I think it's worth either a fast pairing session with the engineer who built this or accepting the risk with eyes open."

That last sentence matters for the "navigating disagreement without claiming authority you don't have" angle interviewers are often probing for. A tester's job is to surface risk with evidence and let the person accountable for the release make the call — not to unilaterally block or unilaterally wave it through. If the PM or engineering lead decides to ship anyway, that's a legitimate call as long as it's made with the information in front of them, not in ignorance of it.

**Common weak answers**

- "I'd retest it a few more times to try to reproduce it" — reasonable in isolation, but at minute 75 of 90 this is often the wrong tradeoff; you'd be trading coverage of the rest of the feature for one bug of uncertain severity.
- "I'd log it as a bug and move on" without capturing context — loses the evidence that makes it actionable later.
- "If I can't reproduce it, it's not worth mentioning" — throws away a real signal; intermittent bugs are frequently the ones that matter most in production because they're exactly the class that automated checks (which run the same deterministic path every time) are bad at catching.

## Follow-ups

- How would this change if the feature touched payment capture instead of a promo code — does a lower bar for evidence become acceptable, or a higher one?
- If the same intermittent bug reappeared in the next three releases from three different testers, how would you push for it to be prioritized differently than a fresh one-off report?

## Sources

- [Exploratory Testing 3.0 — James Bach, Satisfice](https://www.satisfice.com/blog/archives/1509) — Bach's own account of how session-based/charter-driven exploratory testing has evolved, used here for the charter and SFDPOT-style heuristic approach to structuring limited testing time.
- [Exploratory Testing — DevelopSense (Michael Bolton)](https://developsense.com/blog/category/test-framing/exploratory-testing) — Bolton's writing on exploratory testing as simultaneous learning, design, and execution, used to justify the adaptive/reserve-time structure rather than a fixed script.
- [Exploratory Testing Explained, James Bach (PDF)](https://satisfice.us/articles/et-article.pdf) — foundational article on treating exploration as a disciplined, accountable activity rather than unstructured ad hoc testing.
