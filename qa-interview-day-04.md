# QA Interview Q&A — Day 4

## Question: A product owner tells you in backlog refinement, "If it's not in the acceptance criteria, it's not in scope — we'll fix it fast-follow if it comes up." You think the AC for a new marketplace checkout story only covers the happy path and ignores what happens when a seller's payout account is suspended mid-transaction. What do you say in that meeting?

## Answer

The trap here is treating this as a fight over whether the AC is "complete." It never will be — acceptance criteria are a communication device, not a specification of every state the system can enter. Michael Bolton makes this point directly: testers don't need acceptance criteria to test, because testing's job is to investigate the product and reveal information that AC, by design, can't fully capture (developsense.com/blog/2015/02/very-short-blog-posts-26-you-dont-need-acceptance-criteria-to-test). So the first move is not to argue "the AC should be bigger," it's to separate two different questions the PO has conflated: what defines "done" for the story, and what testing will actually investigate before release. Those don't have to be the same list.

In the meeting, the useful move is to name the specific risk in business terms, not testing terms. "If a seller's payout account gets suspended by finance or fraud review while a buyer's order is mid-checkout, does the buyer see a generic error, get charged and never confirmed, or does the order silently fail? I don't know which of those happens, and I think that's worth thirty seconds of the developer's time right now to answer." This does three things: it stays out of "testing vs. product" framing (which Bach warns builds risk into the system because each side stops informing the other — satisfice.com/download/risk-and-requirements-based-testing), it asks a concrete question a developer can answer in the room, and it doesn't assume the PO is wrong to keep AC narrow — narrow AC is often correct for velocity.

What you're negotiating is not "add this to AC," it's "acknowledge this as a known risk and decide, out loud, whether to test it before release or accept it as fast-follow risk." Say exactly that: "I'm not asking to block this story. I want it on record that we're shipping without knowing the answer to X, so if support gets a ticket about a stuck payment next week, it's a known tradeoff, not a surprise." A PO who says "fine, log it and we'll fast-follow" has made an informed decision — that's a legitimate outcome. What's not legitimate is the risk disappearing because nobody said it out loud.

Evidence to bring, if you have it: has a similar payout-suspension edge case caused a support ticket or chargeback before, in this system or a comparable marketplace flow (Etsy, Amazon seller suspensions are public examples of this exact scenario)? If you have log or ticket history, cite it — a PO weighs "I have a hunch" very differently from "we had two tickets like this last quarter." If you don't have evidence, say that plainly rather than inflating the concern: "I don't have data this has happened, it's a gap I noticed reading the flow."

**Weak answers to watch for:**
- Insisting AC must be rewritten to include every edge case — this makes you the bottleneck and trains the team to write vaguer AC to avoid the friction.
- Staying silent because "it's not in AC so not my job" — this is exactly the failure mode Bolton's post argues against; testers who wait for AC to license their investigation miss the point of the role.
- Escalating to "we can't ship this" without authority to make that call — communicate risk, don't issue verdicts you can't back with a release decision that isn't yours to make.
- Treating "fast-follow" as automatically wrong — sometimes it's the right call; your job is making sure it's a decision, not a default.

**Follow-up questions an interviewer might ask:**
- The PO agrees it's a real gap but says there's no time before the sprint ends to spec or test it. How do you make sure it doesn't just get forgotten?
- How would your approach differ if this were a payments-adjacent flow with regulatory reporting requirements versus a purely cosmetic feature?

## Sources
- [Michael Bolton, "You Don't Need Acceptance Criteria to Test" — DevelopSense](https://developsense.com/blog/2015/02/very-short-blog-posts-26-you-dont-need-acceptance-criteria-to-test)
- [James Bach, "Risk and Requirements-Based Testing" — Satisfice](https://www.satisfice.com/download/risk-and-requirements-based-testing)
- [Ministry of Testing Club, "Story Acceptance Criteria between Product Owner and Quality Engineer"](https://club.ministryoftesting.com/t/story-acceptance-criteria-between-product-owner-and-quality-engineer/47974)
