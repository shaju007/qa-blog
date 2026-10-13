# QA Thinking — Day 26

## Testing Payment Disputes: The Deadline and the Verdict Both Belong to Someone Else

Most of the workflows you test are owned by your company. You decide when a state changes, what counts as success, and how long things take.

Payment disputes (chargebacks) work differently. A cardholder's bank opens the case, the card network sets the deadline, and the issuing bank decides the result, sometimes two or three months later. Your system only reacts. You may also get just one chance to respond.

So "the dispute screen works" tells you very little. The useful questions are whether your system reacts correctly to events it doesn't control, on a timeline it doesn't control, without wasting the one chance it gets.

Today's domain is payments, set in a **ticketing platform** that sells tickets for concerts and football matches. The testing lens is **time as a product element**, taken from the Heuristic Test Strategy Model. The soft skill is **asking questions that show who owns each deadline**.

---

## 1. Domain primer: how a card dispute actually works

The details below are from Stripe's documentation. Other payment service providers (PSPs) use different names, but the card-network mechanics are similar. Card scheme rules are the final authority, and the timelines differ by network.

**Who is involved**
- **Cardholder**: the customer who complains to their bank.
- **Issuer**: the cardholder's bank. It decides the outcome.
- **Card network**: Visa, Mastercard, Amex and so on. It sets the rules and timelines.
- **Acquirer/PSP**: Stripe, Adyen and others. They pass the case to you and debit your balance.
- **Merchant**: you. You can accept the dispute or contest it with evidence.

**Two stages**
- **Inquiry** (also called a retrieval or request for information). This is a pre-dispute question from the issuer. Stripe says Amex and Discover use it most, and Visa and Mastercard no longer do. Inquiries show up in the API with a `warning_` prefix: `warning_needs_response`, `warning_under_review`, `warning_closed`. You can resolve an inquiry by answering it or by refunding in full, without a dispute fee. **If you ignore it, the issuer may read that as acceptance and escalate.**
- **Chargeback**: a formal dispute (`needs_response` → `under_review` → `won` / `lost`). Stripe's current enum also includes `prevented`.

**What happens when a chargeback opens**
- The disputed amount **plus a dispute fee** is taken from your balance immediately. This happens before anyone has decided anything.
- You usually have **7 to 21 days** to respond, depending on the network. **If you miss the deadline, you lose automatically.**
- Stripe's dashboard flow allows **one submission**. You can't edit it or add files afterwards.
- The issuer usually takes **60 to 75 days** to decide. The whole process can take **2 to 3 months**.
- Stripe describes the outcome as normally final. In rare cases a dispute changes from `lost` to `won` (a "late win").

**Facts that become test ideas**
- The **disputed amount can differ from the charge**. Causes include exchange-rate changes, partial disputes, a bank combining several recurring payments into one dispute, and full disputes on partially refunded payments.
- **One payment can receive several disputes.** Each one has to be accepted or contested separately.
- Cardholders can usually dispute **within 120 days**. For **future events** such as concerts, trips or appointments, the window generally **starts at the event date, not the purchase date**.
- **Early fraud warnings** can arrive *after* a fraud dispute has already opened, because the networks run those systems separately.
- Some disputes **can't be contested at all**. Stripe closes them as lost as soon as they open.

Think about what that last group of facts means for a ticketing company. Someone who buys a ticket in March for a match in September can still dispute in December.

---

## 2. Why this breaks your normal testing habits

Disputes have three properties that most flows don't have:

1. **There's no oracle when you test.** Whether your evidence would *win* is decided by a bank weeks later, using criteria you can't run.
2. **The deadlines come from outside.** Your code receives `evidence_details.due_by` as a Unix timestamp. It doesn't calculate the deadline.
3. **Some actions can't be undone.** You get one submission. Accepting a dispute can't be reversed by you.

The sandbox squeezes all of this into seconds. Stripe has test cards that create a fraud dispute (`4000000000000259`), a product-not-received dispute (`4000000000002685`), an inquiry (`4000000000001976`) and an early fraud warning (`4000000000005423`). It also has special evidence values: `winning_evidence`, `losing_evidence` and `escalate_inquiry_evidence`.

These are useful, but be clear about what they prove. **They test how your system handles outcomes. They tell you nothing about the quality of your evidence.** A green run with `winning_evidence` means your ledger handles a win. It doesn't mean your ops team would win a real dispute.

When you report on this area, say that explicitly. For example: *"Outcome handling tested with sandbox values. Evidence completeness tested against our own per-reason checklist. Actual win rate is untestable before release and needs production monitoring."* That's an honest coverage statement. "Disputes tested ✅" isn't.

---

## 3. Applying the HTSM "Time" guideword

James Bach's [Heuristic Test Strategy Model](https://www.satisfice.com/download/heuristic-test-strategy-model) (v6.3, December 2024) lists **Time** among the product factors. It covers when inputs and outputs happen and the gaps between them, fast and slow inputs, changing rates (spikes, bursts, stalls) and concurrency.

Teams often skip Time because their test environment hides it. Disputes are a good place to use it on purpose. Take each part of it in turn and turn it into concrete risks.

### Input/Output timing: when does "due" actually mean due?

Stripe's example dispute object has `due_by: 1682294399`. That's **2023-04-23 23:59:59 UTC**. In Hamburg (CEST, UTC+2) it's **01:59:59 on 24 April**.

Now picture an internal ops dashboard that shows "Due: 24 Apr" because it formats the timestamp as a local date. An agent who plans to submit "on the due date" at 10:00 Berlin time is already eight hours late. The result is an automatic loss of the disputed amount plus the fee.

Note the direction: teams **east of UTC** see a date that's *later* than the real deadline. That's the dangerous direction, and it's where you are.

Test ideas:
- Look at how every surface shows `due_by`: dashboard, email digest, Slack alert, CSV export. Do they all show the same instant?
- Compare `due_by` values around **25 October 2026**, when Germany leaves daylight saving time.
- Find the **internal** deadline. Gathering evidence takes time: ticket-scan logs, emails, refund-policy screenshots. Is anything alerting at `due_by` minus *your* lead time, or only at `due_by`?

### Fast/Slow: being too fast is also a failure

Suppose an engineer automates disputes: *"When a `product_not_received` dispute arrives, attach the ticket-scan record and submit."* It's fast and clean.

Now ask when the scan data actually arrives. If gate scans reach the warehouse in a nightly batch, a dispute that arrives at 14:00 gets submitted with **no scan evidence**. Because you only get one submission, the chance has been used and can't be fixed.

At the slow end, an issuer decision 75 days later can fall after a quarter has closed. Does finance reporting handle a dispute opened in Q3 that's won in Q4? Is the `balance_transactions` array (zero, one or two entries, according to the API) reconciled each time it changes, or only once when the dispute is created?

### Changing rates: the postponed match

A Saturday match is postponed, and the refund announcement is unclear. Over the next ten days, several hundred `credit_not_processed` and `product_not_received` disputes arrive.

- Does the ops queue sort by `due_by`, or by created date? It needs to sort by the deadline.
- Does the automation respect your PSP's API rate limits, or does it fail silently on dispute 201?
- Does anything warn that this event is raising the dispute rate? Stripe documents [dispute monitoring programs](https://docs.stripe.com/disputes/how-disputes-work), and those programs care about rates, not individual cases.

### Concurrency: the refund race

These bugs cost real money:
- Customer service issues a refund, and the cardholder files a dispute the same afternoon. Can the customer get the money twice? Stripe says you can't refund outside the dispute process once a chargeback is open, and the dispute object has `is_charge_refundable`. **Does your code read that flag, or does it assume?**
- A rule auto-refunds every early fraud warning. The warning arrives *after* the fraud dispute. What does the refund call do, and what does your ledger record?
- Webhooks arrive out of order. `charge.dispute.closed` arrives before your handler has finished processing `charge.dispute.created`.
- Two disputes on one payment. Does your UI show both, or does the second overwrite the first in a `payment.dispute_id` column?

---

## 4. When you can't test the verdict, move the oracle

You can't check "did we win" before release, so test things you *can* check that predict a good outcome and keep the books correct:

| Instead of… | Check… |
|---|---|
| "Evidence wins" | Evidence is **complete for the reason code** (fraud, product not received and credit not processed each need different evidence) and submitted **before the internal deadline** |
| "Status updates" | **Every** status maps somewhere, including `prevented`, any value your code doesn't know yet, and `lost → won` (late win) |
| "Refund works" | Customer refunds + dispute debits + reinstatements **add up** per payment, including FX and partial-dispute amounts |
| "Old purchases are safe" | **Data retention ≥ dispute window measured from the event date.** If scan logs are deleted 90 days after purchase, a dispute filed three months after a September match will have no evidence. |

That last row is the one most worth raising this week. It needs no fancy tooling, just a question asked across three teams.

One more practical point: `lost` is often treated as final in code. Replay a fixture that moves `lost → won` and see whether your state machine ignores it. If it does, the money credited to your PSP balance never shows up in your own reports.

---

## 5. Soft skills: ask who owns each clock

The HTSM's Project Environment section includes *Information* and *Customers*: who knows what, and who relies on the result. In dispute work, nobody owns the timeline from start to finish, so the main testing skill here is **asking questions**. Ask these in refinement, before you test anything:

**To the product owner:** "When a dispute arrives, who gets told, through which channel, and how many working days before `due_by`? If the answer is 'Stripe emails us', which inbox is it, and who reads it on a Sunday?"

**To finance:** "When a dispute is won 70 days later, which period does the reinstated money go to? Who reconciles disputes where the amount differs from the charge?"

**To data/platform:** "How long do we keep gate scans, delivery confirmations and support transcripts? Is that measured from purchase or from the event?"

**To customer service:** "Can an agent refund a payment that has an open inquiry? Should they?" Stripe treats a full refund as a valid way to resolve an inquiry, but a partial refund can still lead to a chargeback.

**To the developer who says "Stripe handles the deadlines":** agree with what's true, then make the gap specific. *"Right, Stripe enforces the deadline. It doesn't collect our scan logs or warn ops three days early. Can we look at what happens between `charge.dispute.created` and submission?"* You're not saying they're wrong. You're pointing at the part of the timeline nobody has claimed.

**Turning a finding into a risk statement.** Don't write "timezone bug in dispute dashboard". Write:

> "For disputes whose `due_by` falls in the last two hours of a UTC day (all of them, as far as the samples we've seen show; Stripe's deadlines appear to end at 23:59:59 UTC), our dashboard shows a due date one day later than the real one. An agent working to the displayed date will miss the deadline, and a missed deadline is an automatic loss of the disputed amount plus the fee. Fix: show the deadline in UTC with a local-time hint, and alert at `due_by` minus 72h."

That gives the scope, the mechanism, the cost, and a proposed fix. A product owner can decide on that in two minutes.

**Negotiating testability.** Ask for two things: an **injectable clock** in the dispute service, and a **webhook replay harness** with fixtures for every status, including an unknown one and `lost → won`. Explain why: the sandbox can't make you live through 21 days, so without these the time-related risks can only be found in production.

---

## 6. Challenge (45–60 minutes)

**Scenario:** Your ticketing platform automatically submits evidence for `product_not_received` disputes as soon as a gate-scan record exists. If there's no record, the dispute goes to an ops queue. Gate scans are batch-loaded at 03:00 UTC. Scan logs are deleted 120 days after **purchase**. Ops works from a Berlin-time dashboard.

1. **Model the timeline.** For each part of the HTSM Time guideword (input/output timing, fast/slow, changing rates, concurrency), write **two** test ideas specific to this scenario. At least one has to involve money appearing twice or disappearing.
2. **Split what the sandbox can and can't show.** Which of your eight ideas can you run with Stripe test cards and evidence values? Which need an injectable clock or replayed webhooks? Which can only be watched in production?
3. **Check a deadline.** A dispute arrives with `due_by = 1793145599`. Convert it to UTC and to Berlin local time. *(Check: it should be 2026-10-27 23:59:59 UTC, which is 00:59:59 CET on 28 October, after the clocks change. What date does your dashboard show?)*
4. **Ask before you test.** Write the three questions you'd bring to refinement, each aimed at a different person, and a risk statement of no more than five sentences about the retention rule.
5. **Stretch:** sketch the dispute state machine you'd expect, including inquiry escalation, `prevented`, `warning_closed` after 120 days, uncontestable disputes and the late win. Then compare it with what your code actually handles.

If you do this for a real payment integration at work, step 4 alone is often worth more than a week of UI checks.

---

### Sources
- Stripe Docs: [How disputes work](https://docs.stripe.com/disputes/how-disputes-work). Covers inquiries vs chargebacks, timelines, fees, disputed-amount differences, multiple disputes, uncontestable disputes and late wins.
- Stripe Docs: [Respond to disputes](https://docs.stripe.com/disputes/responding). Covers the single submission, automatic loss on missed deadlines and evidence guidelines.
- Stripe API Reference: [The Dispute object](https://docs.stripe.com/api/disputes/object). Covers `evidence_details.due_by`, `is_charge_refundable`, `balance_transactions` and the status enum including `prevented`.
- Stripe Docs: [Testing](https://docs.stripe.com/testing). Covers dispute test cards and the `winning_evidence` / `losing_evidence` / `escalate_inquiry_evidence` values.
- James Bach, Satisfice: [Heuristic Test Strategy Model, v6.3](https://www.satisfice.com/download/heuristic-test-strategy-model) (also hosted by DevelopSense as a [PDF](https://developsense.com/htsm)). Used here for the Time product factor and the Project Environment questions.
