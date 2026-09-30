# QA Interview Q&A — Day 5

## Question: A developer closes your bug as "works as intended" in under two minutes, without running your repro steps. What do you do in the next ten minutes, and what do you do differently for your next ten bug reports?

## Answer

The instinct is to get defensive or escalate immediately. Neither helps. An experienced tester treats this as two separate problems: the immediate one (this bug, right now) and the systemic one (why did a two-minute dismissal feel justified to the developer?).

**In the next ten minutes**, the goal is to lower the cost of the developer actually looking, not to argue you're right. Reopen the conversation with something concrete rather than a rebuttal:

- Attach a screen recording, not just steps. In an ad tech pipeline, "click the campaign toggle and refresh" reads as trivial; a 20-second video showing the impression count silently resetting to zero is not something a developer can wave away in two minutes.
- State the observed vs. expected in one line each, and name the environment and data precisely (browser, account type, campaign state, timestamp). A common reason developers close bugs fast is that the report reads like an opinion ("this feels broken") rather than a specific, checkable claim.
- Ask a genuine question instead of restating your position: "Can you tell me what you saw when you tried it, so I can figure out what's different about my setup?" This does two things — it invites them to actually reproduce, and it surfaces whether the gap is environment, data, or a real misunderstanding of intended behavior.
- If they still disagree after looking, don't relitigate it in the ticket thread. Ask for five minutes live, screen-share, and drive from your machine. Watching a bug happen in real time changes the conversation far more than another comment does.

If it's still unresolved after that and you believe the risk is real, say so plainly to whoever owns the release decision — "I think there's a real risk here, the developer disagrees, here's the video, I'd like a second opinion" — without pulling rank you don't have. That's a request for judgment, not an appeal to authority.

**What to change going forward**: the deeper issue is often that your bug reports don't carry enough evidence to survive a fast read. James Bach makes this point directly in his discussion of bug pipelines — testers often under-invest in making a bug undeniable, and then get frustrated when it's dismissed for reasons that have nothing to do with whether it's real. He also argues the reverse failure mode: testers sometimes over-invest in perfect reproduction before reporting anything, which delays getting a real risk in front of someone who could act on it sooner. The skill is judging, per bug, how much investigation is worth doing before you hand it over versus reporting fast with clear caveats ("intermittent, seen 2 of 5 tries, here's what's constant across both").

Weak answers here: "I'd escalate to my manager immediately," which burns trust and treats a two-minute disagreement as a conflict rather than a communication gap. Also weak: accepting the "not a bug" verdict without pushback just to avoid friction — that's not collaboration, it's conflict avoidance, and it trains developers that your reports don't need a second look. Ministry of Testing's guidance on this is consistent: understand their reasoning first, strengthen the evidence, and only escalate up the chain after a direct, good-faith attempt to resolve it together — escalation is a last step, not a first response.

**Follow-up questions:**
- How would your approach change if this bug only reproduces in production and never in staging?
- If the developer is technically correct that it matches the written spec, but you believe the spec itself is wrong, who owns that conversation, and where does it happen — the ticket, refinement, or somewhere else?

## Sources
- [Unclogging the Bug Pipeline — James Bach, Satisfice](https://www.satisfice.com/blog/archives/487131) — argues testers should calibrate how much reproduction effort to invest before reporting, and pushes back on developers dismissing bugs solely for lack of a guaranteed repro.
- [Zero Bug Policy: The Myths and the Reality — Ministry of Testing](https://www.ministryoftesting.com/articles/zero-bug-policy-the-myths-and-the-reality) — relevant to how bug disagreements get triaged and escalated within a team without the tester claiming authority they don't have.
