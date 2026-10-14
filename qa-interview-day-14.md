# QA Interview Q&A — Day 14

## Question: "I don't need the details. Out of 100, how confident are you that it's ready?" What do you tell a product owner who needs one number for a steering-committee slide tomorrow?

**Scenario:** It's Wednesday, 14 October. You're the QA lead for a home-and-garden retailer launching click & collect in 140 stores. Go-live is Monday 2 November, so the stores have time to settle in before Black Friday on 27 November. In your weekly sync, the product owner says:

> "Steering committee is tomorrow at ten. I don't need the details. Out of 100, how confident are you that click & collect is ready? That number goes on my slide."

Here's what you know:

- **Web and app ordering:** Tested in depth, including exploratory sessions on stock edge cases, substitutions and cancellations. Two minor open bugs, both cosmetic.
- **Stock accuracy:** 114 stores send stock levels from the new POS every 15 minutes. That integration has been tested end to end. The other 26 stores are still on the legacy POS, which sends one batch file overnight. You've replayed a single sample file from one store.
- **Store picking app:** Tested on the two handhelds the team owns. 31 stores use an older model on an older Android version. Nobody has tried the app on one.
- **"Ready for pickup" SMS:** Only tested against the provider's sandbox. No real message has reached a real phone.
- **Payment:** The card is authorised at checkout and captured when the customer collects. Customers get 10 days to collect. Yesterday, reading the payment provider's documentation, you saw that online card authorisations usually last about 7 days. You don't yet know if the team handles that gap.
- **Load:** No peak-volume test has been run.

What do you say?

---

## Answer

### The short version

Don't give a made-up "85" and don't refuse to answer. The product owner needs something that fits on a slide and helps the committee decide. A single readiness percentage doesn't do that. It hides which parts are well known and which are unknown, and it makes the decision look like QA's.

What you give instead is about as short: a one-line headline, the specific unknowns and what each could cost, when each will be resolved, and the options that follow. If they still want numbers, attach them to specific claims you can defend, not to "ready."

### Why the number is the wrong tool, even though the need is real

Start by taking the request seriously. The product owner isn't being lazy. They have three minutes in front of senior people who will ask "are we OK?", and a number feels safe. James Bach has a sharp line on this. He argues that the urge to measure product quality often comes from "fear of hot debate" rather than a need for rigour. A number lets everyone skip the awkward conversation. He also notes that quality is something people assess from evidence, not a property you can read off a gauge ([Satisfice, "Assess Quality, Don't Measure It"](https://www.satisfice.com/blog/archives/487091)).

Michael Bolton makes a point that matters here: confidence is "a relationship between the product and some stakeholder." It isn't something testing produces and hands over. The tester's job is to find problems that would make someone's confidence unjustified ([DevelopSense, "Very Short Blog Posts (2): Confidence"](https://developsense.com/blog/2013/09/very-short-blog-posts-2-confidence)). "QA is 85% confident" puts the tester's feeling on a slide as if it were a property of the product.

There's a nuance that weak answers miss: numbers aren't the enemy. In 1951, CIA analysts called a Soviet attack on Yugoslavia a "serious possibility." When Sherman Kent asked colleagues what that meant, their answers ranged from roughly 20% to 80%. His fix was to tie estimate words to agreed probability ranges ([CIA, *Studies in Intelligence*, "Words of Estimative Probability"](https://www.cia.gov/resources/csi/studies-in-intelligence/archives/vol-8-no-4/words-of-estimative-probability); summary in [Jason Collins](https://corporate.jcx.au/words-of-estimative-probability)). So vague words are just as dangerous as a fake number. The problem with "85% ready" is that it's a number about nothing specific. "Ready" isn't defined, and the 85 isn't built from anything.

### Ask two questions before answering

In the meeting, before you give any number or refuse one:

1. **"What decision is the committee making tomorrow?"** Is it launch versus delay? Committing marketing spend? Deciding how many stores go live? The answer tells you what information is actually useful.
2. **"Ready for whom, and for what?"** Ready for customers to place orders? For store staff to pick them? For finance to get paid? Each has a different answer. The ordering flow is in good shape. Payment capture after day 7 is an open question.

These questions aren't stalling. They're the quickest way to give an answer that's actually useful.

### What to actually say

Roughly this, out loud, in under a minute:

> "I can't give you one honest number for the whole thing, because it's really three different stories. But I can give you something that fits on the slide.
>
> The part customers see, ordering on web and app, is well tested. I don't know of anything that would stop launch.
>
> Three things I can't vouch for yet. One: stock accuracy in the 26 stores still on the old POS. If their nightly file is wrong, customers order things that aren't on the shelf and get turned away at the desk. Two: the picking app on the older handhelds in 31 stores. We've never run it on one. Three: I think customers who collect after day 7 might not get charged, because card authorisations usually expire around then. I need a developer to confirm how we handle that. It could be fine already.
>
> Each of those has a check I can finish by next Wednesday. Whether to launch all 140 stores, start with the 114 on the new POS, or wait is your call and the committee's. I just want those three unknowns on the slide, not hidden inside a percentage."

Notice what this does. It leads with the headline, the way a journalist would. It doesn't overstate the bad news or call itself a blocker. It names what each risk costs in business terms, gives dates, and is explicit about who decides. Bolton argues testers should report more like journalists than statisticians: tell a coherent story about the product and about the testing that backs it up ([DevelopSense, "Statistician or Journalist?"](https://developsense.com/blog/2010/08/statistician-or-journalist)).

### A slide the product owner can actually use

Offer to write it so they don't have to translate:

> **Click & collect — QA status, 14 Oct**
> 🟢 Customer ordering (web/app): tested in depth, no known blockers.
> 🟡 Stock accuracy, 26 legacy-POS stores: only one sample file tested. Full check by 21 Oct.
> 🟡 Picking app on older handhelds (31 stores): untested. Device borrowed from a store, check by 19 Oct.
> 🟡 Payment capture for collections after day 7: may fail. Dev confirmation by 16 Oct.
> ⚪ Peak load: not tested. Needs a decision on whether to test before Black Friday.
> **Options:** full launch 2 Nov · phased (114 stores first) · delay.

Each colour is backed by a sentence explaining it, so nobody can strip the reason off later. This follows Bach's description of a testing story: the product's status, how you know it, and how good that testing was ([Satisfice, "How Much is Enough? Testing as Story-Telling"](https://www.satisfice.com/blog/archives/6203)).

### If they insist on "a number, any number"

Some product owners will push: "The committee wants a percentage." Don't turn it into a standoff. Give numbers attached to specific claims:

- "Of the 140 stores, 83 run the stack we've tested end to end: new POS plus the handhelds we own. That's about 60%." (114 minus the 31 older-handheld stores, assuming those 31 are all among the 114. Check that overlap before you say it.)
- "I'd say it's more likely than not that we'll see stock mismatches in legacy-POS stores in the first week. I've only seen one file."

Those numbers can be checked and argued with. "85% ready" can't.

### Evidence to gather before tomorrow, and before 2 November

The meeting goes better if one or two unknowns have already shrunk:

- **Payment capture after day 7 (today):** Ask the developer who built capture how collections after day 7 are handled. Stripe's documentation, for example, says online card authorisations are typically held for 7 days. For some merchant-initiated Visa transactions it's shorter, and an expired authorisation is released and the payment cancelled. Extended authorisation is a separate feature you have to request ([Stripe Docs, "Place a hold on a payment method"](https://docs.stripe.com/payments/place-a-hold-on-a-payment-method)). If the answer is "we capture at picking, not at pickup," the risk mostly goes away. Then remove it from the slide. Don't keep it there to look thorough.
- **Older handhelds:** Ask a store manager to courier one device. It's quicker than asking IT to buy one.
- **Legacy POS files:** Ask for a week of real nightly files from three different stores, including one with returns and one with a stocktake adjustment, and replay them.
- **SMS:** Send one real message to a few staff phones on different networks.

### Tradeoffs to acknowledge

- **Detail versus attention.** If you bring 30 risks, the committee hears noise. Three named unknowns plus "full list available" is about right.
- **Phased launch isn't free.** Launching only 114 stores means separate marketing, store comms and a second rollout. That cost belongs in the conversation. QA shouldn't present phasing as obviously "safe."
- **Your own credibility.** If every status report is yellow, people stop listening. Saying "ordering is green" clearly is part of why the yellows get believed.

### Weak answers interviewers hear

- **Giving the number:** "I'd say 85%, because 85% of test cases passed." Pass rate measures how many of your own checks passed. It says nothing about the stores, devices and payment paths you never tested.
- **Lecturing:** "Testing can't provide confidence. Quality can't be quantified." That may be true, but the product owner leaves with nothing and stops asking QA next time.
- **Using the gate:** "I can't sign off until all three are tested." You're informing a decision, not making it (see Day 7 on authority you don't have).
- **Dumping everything:** Forwarding the test-management dashboard and letting them work it out.
- **Treating a hypothesis as a bug:** Telling the committee "payments will fail after day 7" before a developer has confirmed how capture actually works.

---

### Follow-up questions

**1. The slide shows up in the committee deck as "QA confidence: 90%," a number you never gave. What do you do?**
Talk to the product owner privately before the meeting if you can, not in front of the committee. Ask where the number came from and offer your slide or the line "3 open unknowns, checks due by 21 Oct" instead. If it's already been presented, send a short follow-up to the product owner, not the whole committee, saying what QA actually reported. Unless something serious is being hidden, correcting the record quietly is enough. You protect your credibility without embarrassing them in public.

**2. The committee chooses a full launch on 2 November despite the yellows. What's QA's job now?**
Make the accepted risks cheap to detect and cheap to fix. Set up alerts on cancellations at collection by store, failed captures and picking-app crashes. Agree in advance who watches the first weekend and what triggers pausing click & collect in a single store. Write down which risks were accepted and by whom, plainly and without blame, so the post-launch review compares what happened with what was known, not with hindsight.

---

## Sources

- **James Bach, "Assess Quality, Don't Measure It"** (Satisfice, May 2026). https://www.satisfice.com/blog/archives/487091
  The core argument for why quality is assessed from evidence rather than measured, and the observation that demands for numbers often come from fear of a hard conversation. This supports taking the product owner's need seriously while replacing the number.
- **James Bach, "How Much is Enough? Testing as Story-Telling"** (Satisfice, 2019). https://www.satisfice.com/blog/archives/6203
  The three-part testing story (product status, how you know, how good the testing was) that structures the slide and the spoken summary.
- **Michael Bolton, "Very Short Blog Posts (2): Confidence"** (DevelopSense, 2013). https://developsense.com/blog/2013/09/very-short-blog-posts-2-confidence
  Confidence as a relationship between product and stakeholder, and testing's job of exposing unjustified confidence. This is why "QA is 85% confident" is the wrong frame.
- **Michael Bolton, "Statistician or Journalist?"** (DevelopSense, 2010). https://developsense.com/blog/2010/08/statistician-or-journalist
  Reporting as journalism: lead with the headline and tell the product story and the testing story. This shaped the one-minute spoken answer.
- **Sherman Kent, "Words of Estimative Probability"** (CIA, *Studies in Intelligence*, 1964). https://www.cia.gov/resources/csi/studies-in-intelligence/archives/vol-8-no-4/words-of-estimative-probability, with a readable summary of the "serious possibility" anecdote at https://corporate.jcx.au/words-of-estimative-probability
  Shows that vague words are as dangerous as fake numbers, and supports giving numbers tied to specific claims. I couldn't read the CIA PDF directly, so the anecdote's details come from the summary.
- **Stripe Docs, "Place a hold on a payment method."** https://docs.stripe.com/payments/place-a-hold-on-a-payment-method
  Primary technical source for authorisation validity windows (typically 7 days for online card payments, shorter for some Visa merchant-initiated transactions) and for expired authorisations being cancelled. This grounds the day-7 capture risk in the scenario.
