# QA Interview Q&A — Day 6

## Question: A designer tells you in a design review, "Just test against the Figma file — if it matches the spec, it's correct." You've found three cases where matching the spec exactly would create a broken or confusing experience. How do you handle this conversation?

## Answer

This question tests whether a tester understands the difference between *conformance* and *quality* — and whether they can push back on a design authority without being dismissive of design expertise or overstepping their own.

**Why "matches Figma" isn't the same as "correct."** A Figma file is a snapshot of one happy-path state, usually at one viewport, one locale, one data volume, and one user permission level. It's a hypothesis about what good looks like, not a complete specification. Michael Bolton's point about testing being an investigation, not a confirmation, applies directly here: checking pixel-for-pixel conformance to a static mockup is a *check*, but discovering where the design breaks down under real conditions is *testing* (developsense.com). The designer's statement conflates "I approved this image" with "this is the right behavior in every context," and an experienced tester's job is to surface the gap without implying the designer did bad work.

**What to bring to the conversation — concrete, not abstract.** Vague pushback ("this might not work well") gets overridden by a deadline. Specific, reproducible cases don't. For each of the three cases, come with:
- The exact condition that breaks the design (e.g., "the saved-cards dropdown in the Figma file has three entries; a seller on our marketplace plan can have twelve — does it scroll, truncate, or paginate?")
- What currently happens if built literally to spec (text overflow, overlapping elements, a disabled state with no explanation)
- A screenshot or recording, not a description — designers reason visually, so show them the broken state rendered, not just describe it

**Weak answers to watch for:** "I'll just log it as a bug after dev builds it" (too late — rework cost is highest post-implementation); "I'll silently make a judgment call and deviate from spec" (removes the designer's authority over their own decisions and creates inconsistency); "the spec is the spec, I'll test exactly what's drawn" (abdicates the tester's actual job, which per Cem Kaner's framing of testing as an empirical, technical investigation is to evaluate quality, not just conformance — kaner.com). All three dodge the actual conversation.

**How to frame it in the room.** Don't say "this design is wrong." Say: "I want to flag three states the mockup doesn't show — can we decide together what should happen here, or do you want me to log these as open questions for refinement?" This keeps the designer as the owner of the decision while making clear these aren't edge cases you're inventing — they're states real users and real data will produce. For a sports-data platform, this might be a live-score widget design that only shows one match; what happens during a nine-game Saturday slate when ten matches are live simultaneously? For an energy utility portal, a tariff-comparison card designed for three tariffs — what renders when a customer has a single historical tariff with a null end date?

**Evidence to gather before the meeting, not during it.** Pull actual production data distributions (cardinality of lists, string lengths, locale variants) so the conversation is grounded in "here's what real accounts look like" rather than "I imagine this could be a problem." This is the same discipline Bolton and Bach's Rapid Software Testing heuristics push for — oracles grounded in consistency with history, comparable products, and user expectations, not just the artifact in front of you.

**Follow-up questions an interviewer might ask:**
- The designer agrees the three cases are real problems but says "that's a fast-follow, ship the happy path now" — how do you respond?
- How would you handle the same disagreement if the designer is also your most senior stakeholder and visibly irritated at being questioned in front of the team?

## Sources
- [Michael Bolton, DevelopSense — "An Exploratory Tester's Notebook"](https://www.developsense.com/presentations/2007-10-PNSQC-AnExploratoryTestersNotebook.pdf) — grounds the testing-vs-checking distinction used to separate "matches Figma" from "is correct."
- [Cem Kaner, kaner.com — writings on testing as empirical technical investigation](https://kaner.com/) — supports the framing that a tester's role is evaluating quality against context, not just verifying conformance to an artifact.
- [Design QA: A Very Scrappy, Practical Guide (Shannon Bain, Medium)](https://medium.com/@shannonmbain/design-qa-a-very-scrappy-practical-guide-51fda5aab5c1) — practical perspective on where design specs commonly fall short against real data and edge states, used to ground the concrete examples.
