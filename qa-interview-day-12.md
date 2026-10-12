# QA Interview Q&A — Day 12

## Question: Your new QA manager says, "If it isn't written as a test case before you start, it didn't happen." Starting next sprint, every test has to be in the test management tool before anyone runs it. You think this will make testing of the new budget-pacing feature worse. What do you bring to Thursday's meeting?

**Context:** You test a self-serve advertising platform used by small and mid-sized advertisers. The team is shipping *Pacing v2*. Advertisers set an average daily budget. On a busy day the system may spend up to twice that amount, but billing for the month must stay within 30.4 × the daily budget. This mirrors the model Google Ads documents publicly. Last quarter a pacing bug overspent a Los Angeles advertiser's daily budget by 2.6×. The postmortem asked, "Did anyone test advertisers outside UTC?" Nobody could answer. A week later the new QA manager announced the rule.

## Answer

### The short version

The manager has found a real failure: the team could not account for its testing. I wouldn't defend the status quo. The proposed fix, though, treats documents as proof of testing. For a feature like Pacing v2, writing every case up front would cost a lot and still hide the risks that matter most. I'd go to the meeting with three things:

1. A real example of accountable exploratory testing from this sprint
2. A list of the checks we *should* script or automate
3. A two-sprint pilot with criteria the manager sets

The two of us want the same result: being able to answer "what did we test, what didn't we test, and what did we find?" quickly and honestly.

### Step 1: Agree on the problem before you argue about the fix

Most people get this wrong first. They come to defend exploratory testing. The manager isn't attacking exploration. The manager is reacting to a postmortem where the team looked unaccountable, and that is a fair complaint. If our sessions left no charters, notes or debriefs, then from the outside "exploratory" really did look like clicking around.

So I'd start by splitting the manager's statement into two claims:

- **"Testing must be accountable and reviewable."** I agree completely and would help enforce it.
- **"Accountability means writing test cases before running them."** I disagree, and I'd say so with evidence.

James and Jon Bach developed Session-Based Test Management (SBTM) at Hewlett-Packard for exactly this tension. They describe it as *activity-based* test management, an alternative to *artifact-based* management. Their argument is that managing by artifacts instead of activities damages testing craft and tester morale. The point isn't "trust me, I'm a good tester." It's "here is a different, reviewable unit of accountability."

### Step 2: Show why pre-written cases fall short on this feature

General arguments won't move a manager who has just been through a bad postmortem. Specific ones might. With Pacing v2, the important risks are in how things interact, and you only learn about them by watching the system behave:

- An advertiser **lowers** the budget at 15:00 local time after spending 1.8× today. Does today's 2× ceiling drop at once, at the advertiser's midnight, or at UTC midnight?
- A campaign is paused at 23:50 in the advertiser's time zone and resumed at 00:10. Is that one pacing day or two?
- An advertiser **raises** the budget on the 28th of the month. Does the 30.4× monthly limit scale up for the remaining days or for the whole month?
- Auction traffic spikes in the last hour of the day. Does the pacing controller spend the unused budget in a burst?
- Reporting shows *served* cost while billing shows *billed* cost. Can an advertiser see why the two differ? (Google's overdelivery documentation tells advertisers to compare these two numbers, so ours will probably get the same support tickets.)

Some of these came from a single 90-minute session. For the first one, the spec doesn't say what "day" means for the daily ceiling. That isn't a failed test case. It's a **product question** that nobody had asked, and you can't write a case for a question you don't know exists yet.

Bach and Bolton make this point in *Exploratory Testing 3.0*. They describe testing as learning about a product through exploration and experimentation, and they treat scripting as a technique you choose to use inside that work. Writing everything first reverses that order: you'd be documenting your guesses before you've learned anything.

Cost matters too, and it's easy to measure. If we wrote cases for every pacing combination we can think of, we'd have hundreds. The pacing algorithm will change three times before launch, so most of them would need rewriting. And "287 of 290 passed" would look reassuring while saying very little about the overspend risk.

### Step 3: Bring an actual session, not a slide about sessions

I'd bring one complete record from this sprint:

> **Charter:** Explore mid-day budget changes on Pacing v2 using the auction simulator and an advertiser in America/Los_Angeles, to find out whether the daily and monthly limits hold when a budget changes during an active day.
> **Tester / date / duration:** Priya, 8 Oct, 90 min
> **Time split:** about 55% testing, 30% investigating and reporting bugs, 15% setup (the simulator needed reseeding twice)
> **Bugs:** PACE-412: lowering the budget mid-day doesn't lower today's 2× ceiling until UTC midnight, which is 9 hours late for LA advertisers.
> **Issues/questions:** The spec doesn't define which time zone "day" uses for the daily ceiling (sent to the PO). The simulator can't replay realistic end-of-day traffic.
> **Not covered:** shared budgets across campaigns, currency conversion, the US clock change on 1 November, budget changes made through the API.
> **Debrief:** Next day with the QA lead. Two follow-up charters were created and linked to the story.

This answers the postmortem's question directly. It records who tested what, when, in which time zone, what was found, and what was **explicitly not covered**. A list of passed test cases rarely tells you the last part, and that's the part a manager needs most when a release decision is on the table.

The time split is useful to management in its own right. If setup keeps taking 40% of every session, the testers aren't the problem. The environment is, and the manager can take that to the platform team.

Debriefs make the process trustworthy. Ministry of Testing's debrief exercise suggests asking three things: Was the charter achieved? Where did the session drift from it? What did we discover? A reviewer who asks those every day will spot shallow sessions faster than they'd spot weak test cases.

### Step 4: Agree on what *should* be scripted

If I only defended exploration, I'd lose credibility, and I'd also be wrong. Some things should be written in advance:

- **Pacing invariants as automated checks.** Billed spend never goes over 2× the daily budget on any day, or over 30.4× for the month, across simulated traffic patterns, time zones and budget changes. These are clear rules a machine can verify, so they shouldn't depend on someone remembering to explore them.
- **A regression check for last quarter's incident.** It's known, it's specific, and it must never happen again.
- **Contractual and billing commitments.** Finance and legal may want a fixed, traceable list. That's a legitimate reason to write cases.
- **A path from exploration to scripts.** When a session finds something that matters, like PACE-412, it becomes a scripted check. The exploratory work feeds the checks over time.

This also takes the debate out of "your way or mine." Writing scripted checks in advance is clearly worth it where the expected result is known. Exploration is worth it where the questions aren't known yet.

### Step 5: Propose a pilot on the manager's terms

> "For the next two sprints on Pacing v2, let's run charters and session sheets linked to each story, with a debrief within 24 hours, alongside the automated invariant checks. At the end, you pick any risk area, say non-UTC advertisers, and ask what we tested. If we can't show you the sessions, findings and gaps within five minutes, we switch to your approach."

The manager sets the success criteria, so this isn't a negotiation tactic. It's a test. It uses the manager's actual concern, which is being able to answer for what was tested, as the measure.

### What I'd say in the meeting

> "You're right that we couldn't account for our testing in the postmortem, and that's on us. I'd like to fix it in a way that also catches the next pacing bug. Here's a session from last week. It found a time-zone overspend bug and an open spec question, and it records what we *didn't* cover. We'd never have written a test case for that bug in advance, because we didn't know the question existed. I also agree some things should be scripted, so here's the list. Can we run this for two sprints and judge it by whether you can answer 'what did we test' in five minutes?"

I'm not asking for authority here. The manager decides on process. My job is to make the tradeoff visible and suggest a cheap way to find out.

### Common weak answers

- **"Exploratory testing finds more bugs."** It's unproven here, it's generic, and it ignores the manager's actual problem, which was accountability, not bug counts.
- **Giving in and writing 300 cases.** That looks cooperative, but it moves effort from finding risks to maintaining documents, and the next postmortem will look the same.
- **"Test cases are useless."** That's false, and it throws away the reasonable middle ground of scripted checks for known rules.
- **Treating the postmortem as unfair.** Calling it "We *did* test it, we just didn't write it down" admits the problem.
- **Arguing in principle without bringing a real session.** A manager can't judge an approach they haven't seen.

### Follow-up questions

1. *Six weeks into the pilot, one tester's session sheets are consistently thin: vague charters, few notes, no "not covered" section. What do you do, and does this undermine the approach?*
2. *An external auditor asks for "the test cases executed for the release." How do you meet the requirement without converting every session into a script after the fact?*

## Sources

- [Satisfice — Session-Based Test Management](https://www.satisfice.com/download/session-based-test-management): James and Jon Bach's original article on SBTM, developed at Hewlett-Packard. It frames SBTM as activity-based rather than artifact-based management, which is the core of the reply to the manager.
- [Satisfice — Exploratory Testing 3.0 (Bach & Bolton)](https://www.satisfice.com/blog/archives/1509): Defines testing as learning through exploration and experimentation and treats scripting as a technique used within it. Supports the argument against writing everything before learning anything, while still leaving room for scripted checks.
- [Ministry of Testing — Activity 5.3: Debrief your exploratory testing session](https://club.ministryoftesting.com/t/activity-5-3-debrief-your-exploratory-testing-session/31964): A practitioner exercise for debriefing sessions (Was the charter achieved? Where did it drift? What was found?). Used for the debrief step that makes sessions reviewable.
- [Google Ads Help — About overdelivery and your average daily budget](https://support.google.com/google-ads/answer/1704443?hl=en): Primary documentation for the domain model in the scenario: daily spend up to 2× the average budget, monthly limit of 30.4× the daily budget, and comparing served cost with billed cost. The pacing risks and automated invariant checks are based on it.
