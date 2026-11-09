# QA Interview Q&A — Day 27

## Question: "Can you just change it from Critical to Major? The release gate only blocks on Criticals, and we'll fix it next sprint." Do you change the label?

**Scenario for the interview:** You test the mobile app of a UK energy supplier. Thursday's release replaces the prepayment smart-meter top-up flow. The old flow showed "Top-up pending" until the meter confirmed it had received the credit. The new flow shows **"Top-up successful ✓"** as soon as the card payment is authorised.

During a load test that replayed last winter's evening peak, about 0.4% of top-ups took 2–6 hours to reach the meter. The cause was a backed-up queue in the head-end system, the platform that sends credit to meters. You filed this as Critical. The team's release gate is simple: no open Critical bugs. In the go/no-go meeting, the product owner says: "It's not a crash, and the credit arrives in the end. Make it Major so we can ship. We'll fix it next sprint." You don't own the release decision.

---

## Answer

### The short version

No, I don't change the label so that a gate turns green. I also don't make the meeting about the label. Severity is my best account of how bad the problem is. Whether to ship anyway belongs to the product owner and whoever they answer to. My job is to keep the two separate: an honest severity, plus a clear route for someone with authority to accept the risk and put their name on it.

If I quietly downgrade the bug, the record says the gate passed, when really someone decided to ship past it. When this hurts a customer in January, nobody will be able to see who accepted the risk or why.

### First, check whether I'm actually right

Bug advocacy only works if people trust you. Before I defend "Critical", I check my own claim.

1. **What does our severity scale actually say?** If our definitions say "Critical = crash, data loss or security breach", then Major may be the *correct* label under the current scale. If so, I say that openly: "By our current definitions this is Major. I think that shows a gap in the definitions, because this bug can leave a customer without energy." That keeps my credibility and still keeps the impact visible.
2. **Is the delay new, or is the message new?** I check the old flow and production telemetry. If the head-end queue already backs up at peak today, the delay isn't new. What's new is that we now **tell the customer it worked when we don't yet know**. That changes the fix: it may be a copy-and-state change, not an infrastructure project.
3. **How often does this happen in production?** A replayed load test isn't production. I ask for last winter's head-end delivery latency (p95/p99 by hour) and how many evenings it went above, say, 30 minutes. 0.4% of top-ups during peak is a very different number from 0.4% of all top-ups.
4. **Who is affected?** People topping up in the evening often have little or no credit left, and some are already on emergency credit. I ask the data team how many top-ups happen when the balance is near zero. I don't guess.
5. **What can support see?** If a customer calls, can the agent see "payment taken, not yet delivered to the meter"? Or will they read out the same "successful" status the customer sees?

Michael Bolton describes severity as "not a property; it's a relationship" between a problem and the people it affects. These questions are how I describe that relationship with evidence instead of adjectives.

### Why this is serious, stated without drama

The symptom sounds harmless: a payment confirmation arrives before the credit. The impact is different. A customer with almost no credit on a November evening sees "successful", stops worrying, and may run out of credit overnight. Because the app already said "done", they have no reason to call anyone.

Prepayment customers are also a group that energy regulators treat with care. In the UK, Ofgem's 2020 decision on self-disconnection requires suppliers to identify prepayment customers who are self-disconnecting and to offer emergency and friendly-hours credit. I'm not a compliance expert, and I won't claim this bug breaches a licence condition. I will say: "This touches a regulated, vulnerable-customer area. Compliance should see it before we decide, not after."

What I avoid saying is "someone could freeze." It might be true in an extreme case, but I can't support it with evidence. Overstating it would make people trust my next Critical less.

### What I say in the meeting

> "I'd rather not relabel it. The label is there so the next person reading this ticket knows how bad it is. But I'm not trying to block Thursday. That's your call, not mine. Here's what I know and what I don't.
>
> **What I know:** in a replay of last winter's peak, 0.4% of top-ups took 2–6 hours to reach the meter. The new flow tells those customers 'successful' straight away. The old flow said 'pending'.
>
> **What I don't know yet:** how often the queue backed up in production last winter, and how many of those customers were near zero credit. I've asked data for both. We should have them by tomorrow midday.
>
> **What worries me:** a customer with low credit believes the top-up worked and runs out overnight. It's rare, but it's hard to undo, it falls on vulnerable customers, and it's in an area Ofgem watches.
>
> **Options, roughly cheapest first:**
> 1. Change the confirmation to 'Payment received, sending to your meter', with a push notification when the meter confirms. I've asked [dev] for an estimate, and they think it might be under a day.
> 2. Ship Thursday, but keep prepayment customers on the old flow behind the flag until (1) is done.
> 3. Ship as planned, with an alert on top-up delivery latency, a support script, and a fix date.
>
> If you choose option 3, I'm fine with that being recorded as a risk acceptance under your name, with compliance informed. I just don't want the ticket to say it was Major when it wasn't."

That last line matters. It's not an accusation. It offers the product owner a legitimate way to do what they want, without the data being changed to make it happen.

### After the meeting, whatever they decide

- **Write the decision down in the ticket:** who accepted the risk, which option they chose, what monitoring exists, and the agreed fix date. Use neutral language. No "QA disagreed" notes added for self-protection.
- **Check the safeguards myself.** If we ship with an alert, I make sure it fires. I push a delayed top-up through staging and confirm someone gets paged.
- **Propose fixing the gate, not just the bug.** A gate that only counts labels invites people to change labels. A better rule: "Open Criticals block the release unless a named owner records a risk acceptance." Pressure to relabel then becomes a normal, visible decision instead of a quiet edit. I raise this in the retro, not in the middle of the release argument.
- **If the product owner changes the label themselves,** I don't start an edit war. I add a comment: "Severity changed from Critical to Major by [name] on [date] for release gating. Original assessment and evidence above." Then I mention it to my lead. Covering it up would be worse than the change itself.

### Common weak answers

- **"Yes, the PO owns priority."** True, but they're asking about *severity*. Bolton's point is that management decides priority. Severity is the tester's input to that decision, and changing it to fit the decision ruins the input.
- **"No. I'll block the release."** You don't have that authority, and pretending you do turns a risk discussion into a power struggle you will lose.
- **Escalating to the director straight away.** Try the meeting first. Escalate if a risk is being hidden, not because someone disagrees with you.
- **Fighting over the label.** If the whole meeting is "Critical vs Major", nobody talks about the cheap fix in option 1, which is the most useful outcome you could get.
- **Disaster language without evidence.** Kaner and Bach's bug advocacy material is about researching a bug until its real reach is clear: following up to see whether it is more general or more serious than it first looked. It is not about turning up the volume. Credibility is what you spend in these meetings.

### What a strong candidate shows

They separate the facts from the decision. They check their own severity call before defending it. They turn "it's bad" into something concrete about real customers. They offer options cheaper than "delay the release". They make risk acceptance visible and owned instead of quiet. And they stay calm when they lose the argument.

### Follow-up questions

1. **"Your team's Criticals have been inflated for months, and developers now ignore them. How do you rebuild trust in severity without relabelling everyone's old bugs?"** Look for: calibrating against real incidents, short impact statements on every Critical, and starting with your own reports.
2. **"Data comes back tomorrow: the production queue never went over five minutes last winter. What do you do with your Critical?"** Look for: downgrading it openly with the evidence attached, and keeping the message-wording issue open as a separate, smaller bug. Being able to say you were wrong is part of being credible.

---

## Sources

- Michael Bolton, DevelopSense — ["Severity vs. Priority"](https://developsense.com/blog/2013/03/severity-vs-priority). Source for "severity is a relationship, not a property", for the view that people with authority over the work decide priority, and for saying a problem *looks like* a trivial one rather than *is*. This is the core of why the tester keeps severity honest and leaves the ship decision to others.
- Michael Bolton, DevelopSense — ["Taking Severity Seriously"](https://developsense.com/blog/2015/01/taking-severity-seriously). Argues that severity scales should describe the effect on people and the business (regulators, refunds, reputation), not only how the system fails. Used for the "our scale may be missing this" step and for the advice to redesign the gate.
- Cem Kaner — [Publications page](https://kaner.com/?page_id=7), which lists his *Bug Advocacy* (2000) and *Effective Bug Reporting* (2002) slides. It's the original source for treating a bug report as something you research and argue for, not just log. I couldn't extract text from the PDF slides, so the follow-up-testing point rests on the next source.
- Parwal & Rajpurohit — [*Bug Advocacy* (Leanpub)](https://leanpub.com/bugadvocacy). A summary of Kaner and Bach's BBST Bug Advocacy course. Used for the distinction between finding a problem and getting it addressed, and for its emphasis on credibility and influence.
- Ofgem — ["Self-disconnection and self-rationing: decision"](https://www.ofgem.gov.uk/publications/self-disconnection-and-self-rationing-decision) (decided 19 October 2020, in force 15 December 2020). Primary source for the domain risk: suppliers must identify prepayment customers who are self-disconnecting and offer emergency, friendly-hours and additional support credit. It shows why a misleading "successful" message on prepayment top-ups belongs in a regulated area and should be raised with compliance.
