# QA Thinking — Day 17

## Influence Without Authority: You Don't Assure Quality, You Assure That Decision-Makers Aren't Guessing

A recurring trap for testers: someone asks you to "sign off" on a release, or a PM says "QA approved it, so we're good to ship." It feels like power, but it's a trap — it puts accountability for a business decision on the person with the least authority to make it, and it quietly turns "quality assistance" into "quality assurance," a job no tester can actually do.

Michael Bolton makes this distinction sharply in an old but still-load-bearing DevelopSense post: testers can't assure quality because they don't control the code, the schedule, or the budget — only the people who do can "assure" anything. What testers *can* do is supply "valuable, timely information about the actual state of the product and the project" so the people with authority decide with open eyes instead of closed ones ([DevelopSense, "Testers: Get Out of the Quality Assurance Business"](https://developsense.com/blog/2010/05/testers-get-out-of-the-quality-assurance-business)).

That reframe is where your actual influence comes from. You don't get leverage by insisting harder that a bug is bad. You get it by making the *cost of ignoring your information* visible and specific enough that the decision-maker can't pretend they didn't know.

### Why "I found bugs" doesn't move anyone

Most testers' influence problem isn't a communication-style problem, it's an information-shape problem. "I found 12 bugs, 3 are high severity" tells a PM nothing about what they're actually deciding between. Compare:

- Weak: "There's a bug where seller payouts can double-trigger under retry."
- Strong: "If a payment gateway retries during a network blip, a seller can be paid twice for one order with no reconciliation flag. I reproduced it 3 times in 20 attempts. If this ships and we process 5,000 orders/day, that's a plausible pattern for real money loss with no alert to catch it. I haven't checked whether the ledger service dedupes on its side — that's the open question that decides whether this is a blocker or a monitored risk."

The second version does three things at once: gives a concrete mechanism, gives a plausible scale, and names the *specific unknown* that would change the decision. That last part is what turns you from an obstacle into a service to the decision — you're not saying "don't ship," you're saying "here's the one fact that flips this from acceptable to unacceptable, go get it or let me get it."

### The Ministry of Testing thread underneath this

A Club discussion on making testing visible to stakeholders lands on the same idea from a different angle: don't report activity, report business threats. One contributor's framing was to answer "what is the product's state and what business threats exist?" instead of "I completed my planned testing" — and to tailor the artifact to the audience (a one-page wall report for the team, narrative Jira issues with evidence for developers, a dashboard for anyone who wants raw status) ([Ministry of Testing Club, "How Do You Make Your Testing Visible To Stakeholders?"](https://club.ministryoftesting.com/t/how-do-you-make-your-testing-visible-to-stakeholders/43063)). Influence without authority is mostly this: matching the shape of your evidence to what the specific person in front of you needs in order to act.

### Applying it: the "sign-off" moment

Next time you're asked to sign off or say "is it good to go," don't answer yes/no. Answer with three things:

1. **What I checked and how confident I am in that coverage** (not "I tested it," but "I covered X and Y paths; Z was out of scope because...")
2. **What I found and its plausible business impact**, sized to something the decision-maker cares about (money, customers affected, SLA, regulatory exposure)
3. **What's still unknown**, and who needs to close that gap before this is a fully-informed decision

This hands the decision back to whoever actually has authority over it — which is correct — while making it obvious that "QA said it's fine" was never a real basis for shipping.

### Small exercise

Take the last bug or risk you reported that didn't get the reaction you wanted. Rewrite it in three lines using the structure above: mechanism + plausible scale + the one open question that would change the call. Then ask yourself honestly — did your original version actually contain that information, or did you assume the reader would infer it? Most influence failures are missing information, not missing assertiveness.

**Sources used:**
- [DevelopSense — "Testers: Get Out of the Quality Assurance Business" (Michael Bolton)](https://developsense.com/blog/2010/05/testers-get-out-of-the-quality-assurance-business)
- [Ministry of Testing Club — "How Do You Make Your Testing Visible To Stakeholders?"](https://club.ministryoftesting.com/t/how-do-you-make-your-testing-visible-to-stakeholders/43063)
