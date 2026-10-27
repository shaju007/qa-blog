# QA Interview Q&A — Day 22

## Question: You spent a full day exploring a new feature and found zero bugs. At the debrief, your engineering manager asks: "So it's ready — or was that a wasted day?" What do you say?

**The scenario:** You work at a B2B SaaS company that sells a project-management tool with per-seat pricing, billed through Stripe. A new self-serve feature lets workspace admins change plans and seat counts in the middle of a billing cycle. The app shows a price preview, the admin confirms, and Stripe works out the prorated amount. You ran three 90-minute exploratory sessions:

1. Upgrades and downgrades between Starter, Team and Business, on monthly and annual billing.
2. Seat-count changes, checking that the preview matches the confirmed invoice.
3. Admin permissions, confirmation emails and the billing-history page.

You logged no bugs. The sprint ends Thursday.

## Answer

### The short answer

Neither conclusion follows from "zero bugs." The count only means something once you know what the testing covered, how it was done and how good it was. My job at the debrief is to give the manager all three, so that "zero bugs" doesn't get read as "tested and safe." Whether to ship is the team's and product owner's call. I should give them what they need to make it, not answer the "is it ready?" question for them.

### How I'd reason before the meeting

**1. Check whether the result is believable.** A billing feature with proration, discounts, annual plans and permissions came through a full day with no bugs. That might mean the team built it well, or it might mean my testing missed things. Before I say anything, I'd look at my own session notes:

- **How much of the day was actually testing?** Session-Based Test Management splits a session into test design and execution, bug investigation, and setup. If about 40% of each session went on creating workspaces, waiting for invoices and resetting subscriptions, then I tested for about 3.5 hours, not 8. I should say so.
- **What were my oracles?** If I mostly checked that the preview showed the same number Stripe returned, both sides come from the same calculation. That check would miss a wrong input, such as the wrong price or the wrong discount being sent. Did I work out any expected amounts myself, from the plan prices and the timestamps? If not, my "no bugs" on the amounts is weaker than it sounds.
- **Which risks did I never reach?** I'd compare my notes with the provider's own documentation. Stripe's [proration docs](https://docs.stripe.com/billing/subscriptions/prorations) list several behaviours a full day of happy-ish paths could easily miss:
  - **Preview drift.** Stripe prorates to the second, so the amount can change between preview and confirmation unless the same `proration_date` is passed to both calls. My previews matched, but I was clicking quickly. Did I ever wait ten minutes before confirming?
  - **Unpaid invoices.** If a customer changes plan while an invoice for the current period is still unpaid, Stripe can give them credit for time they never paid for. I didn't test with a failed or unpaid invoice.
  - **Downgrade credits aren't refunds.** Stripe doesn't automatically refund negative prorations. It credits them. If our confirmation screen or email says "you'll be refunded," we've made a product promise that isn't true. I'd need to recheck my screenshots.
  - **Discounts.** Prorations use the discounted price, and proration line items aren't discountable themselves. I didn't test a workspace with a coupon, and many of our annual customers have one.
  - **Billing mode.** `billing_mode` `classic` and `flexible` calculate some credits differently. Stripe's own example shows a downgrade invoice of −$3.34 under classic and $0.00 under flexible. Do I know which mode our subscriptions use, and whether older customers are on a different one?

**2. Separate what I found from bugs.** A day without bugs is rarely a day without findings. Mine would probably include:

- **Product questions.** Should a downgrade credit appear as account balance, and does the UI say so?
- **Testability obstacles.** In staging I couldn't move time forward to the renewal date, so I never saw a full cycle end to end.
- **Confirmed behaviour.** Seat changes on monthly plans matched my own calculation in six of six cases. That positive evidence is worth stating precisely.
- **New charters.** Each of the risks above is a candidate for the next session.

### What I'd say in the meeting

Following Michael Bolton's three strands (product status, how I tested, how good the testing was) and the Satisfice debrief format (Past, Results, Obstacles, Outlook, Feelings), I'd keep it to about two minutes:

> "Product status: I found no bugs in what I covered. Monthly upgrades and seat changes behaved correctly, and I checked the amounts against my own calculation, not just against the preview.
>
> How I tested: three sessions. Roughly 40% of the time went on setup, because we can't advance time in staging. So it was closer to half a day of real testing, and I haven't seen a renewal invoice at all.
>
> Not covered yet: workspaces with coupons, plan changes with an unpaid invoice, annual-plan downgrades, and preview-versus-confirm drift when there's a delay. Those are where I'd expect money to go wrong, and they're the cases support would have to deal with.
>
> One product question: our downgrade copy says 'refund,' but Stripe will create a credit. Can we confirm which one we intend?
>
> My read: the core path looks solid. I'm not yet comfortable about the money edge cases. If we can get time simulation working in staging, I think one more focused session would cover most of that. Whether that fits before Thursday is your and the PO's call."

That last line matters. I'm describing risk and what it would cost to reduce it. I'm not blocking the release, and I'm not approving it either.

### Was the day wasted?

That's a fair question, so I'd answer it honestly. The day wasn't valuable just because it happened. It was worth it if it reduced uncertainty about the risks that matter, and I can show what it reduced. As Callum Akehurst-Ryan writes in Ministry of Testing, a tester's output is information, not bugs. But that only works if the information is specific. "I explored and it seemed fine" is a weak report. "Monthly seat proration matches an independent calculation, and here are the four money scenarios nobody has seen yet" is a strong one.

I'd also admit when exploration was badly aimed. If my second session went over permissions that the unit tests already cover well, I should say so and point the next charter at billing edge cases instead. And if repeated sessions on a stable area keep finding nothing, moving effort elsewhere is a perfectly good decision. A good debrief is one way to make that call.

### Common weak answers

- **"No bugs, so quality is high."** This mixes up the absence of evidence with evidence of absence, and ignores how much was actually covered.
- **"No bugs means I need to dig harder."** It's defensive, and it says nothing about where to dig or why.
- **"You can't measure exploratory testing."** Session sheets, time breakdowns, charters and debriefs exist exactly for this.
- **Logging cosmetic bugs to have something to show.** It erodes trust and hides the real report.
- **Answering "yes, it's ready."** That decision isn't yours, and saying it removes the context the decision-makers need.
- **Reporting only the product strand.** Leaving out the obstacles (no time simulation) and the gaps (no coupons) makes the testing look more complete than it was.

### Follow-up questions

1. **"Your director wants one number to track exploratory testing across teams. What do you offer, and what do you warn against?"** A good answer: track coverage of charters against agreed risk areas, plus the share of session time lost to setup or blocking (a testability signal). Warn against bugs per session, because people will game it straight away.
2. **"The extra session on coupons and unpaid invoices also finds nothing. Now what?"** Say clearly what that evidence supports. Suggest turning the independent proration calculations into automated checks against invoice previews. Then move exploration to renewal day and production monitoring of credit balances.

## Sources

- [Michael Bolton, "How is the testing going?" — DevelopSense](https://developsense.com/blog/2018/02/how-is-the-testing-going): the three strands of a testing story (product status, how it was tested and what wasn't, and how good the testing was, including obstacles). This is the structure of the meeting script, and the reason "zero bugs" alone is ambiguous.
- [James Bach & Jonathan Bach, "Session-Based Test Management" — Satisfice](https://www.satisfice.com/download/session-based-test-management): the activity-based way of managing exploratory testing that underlies the session time breakdown (setup, design and execution, bug investigation) and the charter and debrief practice used here to judge how much testing actually happened.
- [Callum Akehurst-Ryan, "The Awesome Power of the Debrief" — Ministry of Testing](https://www.ministryoftesting.com/insights/the-awesome-power-of-the-debrief-why-debriefing-is-the-key-to-successful-exploratory-testing): a practitioner's account of debriefs covering scope, positive findings, issues and questions. It supports the point that a session without bugs isn't a failure if it produces information.
- [Stripe Docs, "Prorations"](https://docs.stripe.com/billing/subscriptions/prorations): the primary technical source for the domain risks in the answer: per-second proration and `proration_date` for preview consistency, credits for unpaid periods, negative prorations not refunded automatically, how discounts are handled, and `classic` vs `flexible` billing-mode differences.
