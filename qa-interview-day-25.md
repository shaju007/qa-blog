# QA Interview Q&A — Day 25

## Question: Your engineering manager wants QA to approve every pull request before it merges. Do you say yes?

**Scenario:** You're one of two testers on a marketplace payouts team with 11 developers. The payouts service gets about 60 pull requests a week. Last month a PR moved the payout scheduler's daily cutoff from 23:00 to 00:00 "for consistency." Code review approved it in an hour. After the change, sellers in Australia and New Zealand were paid a day late for a week. Support took 400 tickets, and some sellers missed rent payments.

At the retro, the engineering manager says: "From next sprint, every PR in payouts-service needs a QA approval before merge. QA, you'd want this, right?" In Slack, two senior developers are already complaining that it will "turn QA into a merge queue."

---

## Answer

**Short version:** I wouldn't agree to a blanket QA approval on every PR. I also wouldn't just say no and leave it there. The manager has a real problem: a risky change got through review that only looked at the code. I want to fix that problem without making a tester's tick in GitHub the thing everyone relies on. I'd offer a targeted, time-boxed alternative and agree in advance how we'll judge whether it worked.

### 1. Start with the incident, not the process

Before I say anything about approvals, I want to know whether a QA approval would actually have caught this bug. So I'd look at:

- **The PR itself.** Did the diff show the risk? Changing `CUTOFF_HOUR = 23` to `0` looks harmless. The risk was in how that value interacts with the seller's time zone, the bank's settlement window and the payout calendar. None of that is in the diff. A tester skimming 60 diffs a week would likely have approved this one too.
- **What anyone knew beforehand.** Was there a story? Did anyone ask "who gets paid when?" before coding started? A question like that comes up in refinement or a 10-minute test chat, not in PR review.
- **Our recent incident history.** For the last 3–6 months of payout incidents, could we have spotted the risky PRs ahead of time by file path, by type of change (scheduling, currency, ledger, provider config), or by story? If yes, targeted involvement works. If no, PR review is the wrong place to catch them, whoever does it.

This keeps the discussion about evidence. It's not "QA wants to avoid work." It's "let's put the effort where this kind of bug can actually be found."

### 2. Why a blanket QA approval is a weak control

**The numbers don't work.** 60 PRs a week split between two testers is about 6 PRs per tester per day, on top of everything else. A gate that heavy gets rubber-stamped within a month. GitHub also has a setting, "Dismiss stale pull request approvals when new commits are pushed," that teams often turn on. With it, every fixup commit wipes the approval, so testers end up approving the same PR several times. The queue grows and attention drops.

**An approval says less than people assume.** In GitHub, an approval only lets the PR merge. It doesn't record what was tested, what wasn't, or what risks are left. After the next incident, the question becomes "QA approved this, why didn't QA catch it?" Practitioners in a [Ministry of Testing discussion on tester sign-off](https://club.ministryoftesting.com/t/sign-off-from-testers-or-others/84760) describe exactly this. Michael Bolton makes the underlying point in ["Pressing the Green Button"](https://developsense.com/blog/2018/12/pressing-the-green-button): a tester's job is to find and report reasons someone who matters might approve or reject, and the approve/reject decision belongs to management. A QA tick on every PR blurs that. It looks like the tester is vouching for the change, when the tester is really reporting on it.

**The delivery research points the other way.** DORA's [research on change approval](https://dora.dev/capabilities/streamlining-change-approval/) found no evidence that formal approval by people outside the team lowers change failure rates. It also found that such approvals slow delivery and lead to bigger, riskier batches. Its listed pitfalls include "applying identical approval processes to all changes regardless of risk" and "adding more process when production problems occur." A blanket QA gate is both. DORA recommends peer review backed by automated testing, with scrutiny scaled to risk. Testers are team members, not an external board, but a mandatory sign-off from one role on every change works the same way.

**It moves testing late.** The cutoff bug needed someone to ask about time zones and settlement windows before the code existed. A merge gate puts testers at the end of the line again, just with a new tool.

### 3. What I'd propose instead: a 4-week trial

1. **Risk-based involvement by file path.** Use [CODEOWNERS](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners) to automatically add a tester *and* a developer with domain knowledge as reviewers when a PR touches risky areas: scheduling and cutoffs, currency and rounding, the ledger, payout provider adapters, feature-flag config. My preference is to request the tester's review without requiring it. If the team wants it to block, GitHub's "Require review from Code Owners" setting is satisfied by any one listed owner. The domain developer can satisfy it, so the tester never becomes the only gatekeeper.
2. **A testing-notes section in the PR template**, filled in by the author: *What could this break? What did you test, and where? What didn't you test? Is any of this time-, locale- or money-sensitive?* Unlike an approval, this records what was actually done. It also makes the author think about risk, which is the real fix for a PR like the cutoff change.
3. **A 10-minute test chat before coding** on stories labelled payout-sensitive. The developer, the tester and ideally the PO ask: who is affected, at what time, in which currency and time zone, and how would we notice if it went wrong?
4. **Testers review tests, not just code.** On risky PRs I'd check whether the tests cover the right cases. For example, does a cutoff test include a seller at UTC+11 and a bank holiday? I don't need to be a Kotlin expert to spot that a test suite has only ever run in a UTC timezone.
5. **Pairing on request.** Any developer can ask a tester to explore their branch in a preview environment before merge. That's an offer, not a gate.

**How we'd judge it after 4 weeks:** time PRs wait for tester review, the share of PRs routed to testers, how many tester comments led to a code or test change, and payout incidents traced back to unflagged PRs. If risky changes still get through on paths we didn't flag, we widen the paths or reconsider. If tester comments almost never change anything, I'm adding wait time without adding value, and we should stop.

### 4. What I'd say in the retro

> "I want what you want: nobody gets paid late again because of a one-line change. But I don't think my approval on all 60 PRs a week would have caught this one. The diff looked fine. The risk was time zones and the settlement window, and that's a conversation we needed before coding. If I'm approving every PR, I'll be skimming, and the tick will suggest I checked things I didn't.
>
> Here's a proposal for four weeks. Payout-sensitive paths automatically pull in me and a domain dev. Authors fill in a short testing-notes section. Payout-sensitive stories get a ten-minute test chat before anyone writes code. We'll measure wait time and whether my reviews actually change anything. It's your call. If you still want a blanket gate after that, I'll make it work, but I'd want us to write down what a QA approval does and doesn't mean."

That last line matters. I'm not the one who decides team process, and I shouldn't act as if I am. If the manager overrules me, I'd ask for three things in writing: what a QA approval covers ("tester read the testing notes and tested X in a preview environment," not "QA certifies"), a review response time, and a date to look at the decision again.

### 5. Working with the developers

The developers' concern is legitimate, so I'd agree with it out loud: "You're right that a merge queue would slow you down and wouldn't make things much safer." Then I'd ask them to help pick the risky paths and write the template questions. If they help design it, they're more likely to fill it in honestly. I'd also ask what kind of tester input would actually be useful to them. Often the answer is "tell me earlier," which is the whole point of the proposal.

### Common weak answers

- **"Yes, more checks mean more quality."** This ignores the review load, the blame dynamic and the evidence that external approval doesn't lower failure rates.
- **"No, QA tests in staging, not PRs."** This defends your turf and does nothing about the real gap.
- **"Testers should review code to shift left."** Reading diffs isn't the same as testing early. The useful early work is asking about risk before the code is written.
- **Talking only about process and never checking whether the proposed gate would have caught the actual incident.**
- **Saying "I won't approve anything"** as if the tester owned the process. Recommend, measure, and let the manager decide.

---

### Follow-up questions

1. *Three weeks into the trial, you notice a developer splitting a scheduling change into small PRs so that none of them touches a CODEOWNERS path. What do you do, and what does it tell you about the process?* (Look for: treating it as information about the process, not a discipline issue. Talk to the developer first, ask why the path rules felt like a burden, and check whether the paths are drawn too broadly or too narrowly.)
2. *You can't read the language the service is written in. How do you still add real value on a payout-sensitive PR?* (Look for: reviewing the testing notes and test names for missing cases such as time zones, holidays and currencies, exploring the branch in a preview environment, asking "what happens if…" questions, and checking that logs and alerts would show the failure in production.)

---

## Sources

- Michael Bolton, DevelopSense, ["Pressing the Green Button"](https://developsense.com/blog/2018/12/pressing-the-green-button). Argues that the tester's job is to find and report reasons to approve or reject, while the decision belongs to management. It's the basis for not letting a QA tick stand in for evidence.
- Ministry of Testing Club, ["'Sign off' from testers? Or others?"](https://club.ministryoftesting.com/t/sign-off-from-testers-or-others/84760). Practitioners discuss how tester sign-off becomes a target for blame ("you signed off the testing…") and suggest reporting coverage and risk instead.
- DORA, ["Streamlining change approval"](https://dora.dev/capabilities/streamlining-change-approval/). Research finding no evidence that formal external approval lowers change failure rates, with listed pitfalls (same process for every change, more process after incidents) and suggested metrics such as wait time and share of changes needing manual approval. Used for the trial measures.
- GitHub Docs, ["About code owners"](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners). How CODEOWNERS automatically requests reviewers by path, and that approval from any one listed owner satisfies a required code-owner review. That's what lets a domain developer share the role with a tester.
- GitHub Docs, ["About protected branches"](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches). Documents the "Dismiss stale pull request approvals when new commits are pushed" and "Require approval of the most recent reviewable push" settings, which explain why a blanket approval gate leads to repeated re-approvals.
