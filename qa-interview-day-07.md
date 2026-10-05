# QA Interview Q&A — Day 7

## Question: A rounding bug undercharges customers by a few cents on 0.3% of subscription renewals. In the release go/no-go meeting, the engineering lead says "it's cosmetic, ship it." You have no authority to block the release. What do you say, and what do you do before and after the meeting?

## Answer

This question tests whether a candidate can practice **bug advocacy** — getting a bug taken seriously on its merits — without pretending to have decision rights they don't have. Cem Kaner's BBST Bug Advocacy course frames this exactly: a bug report (and the conversation around it) is persuasive writing, not a verdict. Your job is to give the people with authority the best possible information, not to win an argument.

**Before the meeting**, an experienced tester does the investigation work that makes the bug hard to dismiss:

- **Reproduce the pattern, not just the instance.** Is 0.3% consistent, or does it spike with certain currencies, proration periods, or coupon stacking? A flat 0.3% across months looks like noise; a pattern tied to EUR-to-cent conversion or mid-cycle plan changes looks like a systemic rounding bug, which is a very different story.
- **Generalize and externalize** (Kaner/Bach's terms from Bug Advocacy): where else in the codebase does this rounding function get called — invoices, refunds, proration, tax calculation? And what happens when this hits the real world at scale — finance reconciliation, customer trust, regulatory reporting for billing accuracy? A "cosmetic" bug that's actually a shared rounding utility used in five billing paths is a different risk than an isolated display glitch.
- **Quantify in business terms, not test terms.** "0.3% of renewals" sounds small. "At our volume that's roughly $X/month in silent undercharges, plus it will show up as a reconciliation discrepancy in finance's monthly close" is something a release owner can act on.
- **Separate severity from priority explicitly.** Michael Bolton's point (developsense.com) is important here: severity — how bad the problem *is* — is something a tester can assess with evidence. Priority — whether to fix it *now* — is a business call that belongs to product/release owners. Conflating the two is a common weak move: testers who either downgrade severity to avoid conflict, or who insist a bug must be fixed because they've personally decided it's important, both overstep or understate their actual role.

**In the meeting**, the framing should sound like this, not like an ultimatum:

> "I'm not saying don't ship — that's your call. Here's what I found: the rounding affects renewals across at least two currencies, it's in a shared proration function also used in refunds, and at current volume it's roughly $X/month in discrepancies that finance will likely flag in reconciliation. I haven't been able to rule out it affecting refund amounts too — I'd want 30 minutes to check that before we decide. What I need from you is: are we okay accepting that financial exposure and the finance team's reconciliation overhead, or does someone want to look at scope before we ship?"

This does three things: states evidence, states the actual (not catastrophized) risk, and asks a direct question that puts the decision where it belongs — without the tester silently agreeing it's "fine" just because they lack veto power.

**Weak answers to watch for:**
- "I'd escalate to my manager" as the whole answer — escalation without having first done the investigation that makes escalation useful is just passing the ball.
- Treating "cosmetic" as a technical judgment rather than naming it as what it is — a priority call the engineer isn't necessarily qualified to make alone, since they likely haven't seen the finance/reconciliation angle.
- Refusing to let it go after the decision is made — if leadership hears the evidence and still ships, a professional tester notes the risk in writing (for the record, not as a threat) and moves on.

**After the meeting**, regardless of outcome: write down what was decided and why, including the evidence presented, in the ticket or release notes. This isn't CYA — it's so that if the 0.3% turns into 3% next quarter, there's a paper trail showing this was a known, deliberate tradeoff rather than something QA missed.

**Follow-up questions:**
- "The engineering lead says finance already has a monthly adjustment process for exactly this kind of discrepancy — does that change your recommendation?"
- "How would your approach differ if this were a 0.3% *overcharge* instead of an undercharge?"

## Sources
- [Cem Kaner & James Bach, "Bug Advocacy" (BBST course materials)](https://kaner.com/pdfs/bugadvoc.pdf) — the foundational framing of bug reporting as persuasive, evidence-based communication, including the maximize/generalize/externalize techniques used above.
- [Michael Bolton, "Severity vs. Priority," DevelopSense](https://developsense.com/blog/2013/03/severity-vs-priority) — the distinction between severity (a tester's evidence-based assessment) and priority (a business decision), central to how the tester communicates risk without overclaiming authority.
