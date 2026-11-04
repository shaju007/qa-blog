# QA Thinking — Day 39

## Reporting on a Ticket On-Sale: "It Works" Describes What You Saw. It Can't Promise Friday at 10:00

It's Thursday afternoon. Your ticketing platform opens sales for a stadium tour tomorrow at 10:00 CET, and you expect a few hundred thousand people in the waiting room. The same release adds "all-in" price display for US events. The product owner messages you: **"Are we good for tomorrow?"**

You've spent three days testing. You found and retested two bugs. Your regression suite is green. The easy reply is "Yes, looks good 👍".

Today's lesson is about why that reply is risky, and what to send instead. It comes in two parts: the domain (how an on-sale works and where it breaks) and the communication skill (reporting what you know so that a decision-maker doesn't confuse your coverage with a guarantee).

---

### Part 1: Domain primer. How a ticket on-sale works

Ticketing looks like e-commerce, but its business model is different in ways that change your risk model:

- **Inventory is unique and perishable.** Seat 14, Row F, Block 112 exists once, and it's worth nothing after the show starts. You can't restock it.
- **Demand arrives all at once.** Most of the revenue for a big show can come in the first minutes of the on-sale. Load is a spike, not a curve.
- **There are two markets.** The *primary* market sells tickets at face value for the promoter or venue. The *secondary* market (resale) is a marketplace where fans list tickets at prices they set, and the platform takes fees. Many platforms run both.
- **Fairness is part of the product.** Fans and press judge an on-sale on whether real fans got a fair chance, not only on uptime.

**The on-sale lifecycle and its vocabulary:**

| Stage | What happens | Typical business rules |
|---|---|---|
| **Pre-queue** | Early arrivals wait on a countdown page | Arrival before start shouldn't give an advantage |
| **Queue randomization** | At start time, everyone in the pre-queue gets a random position. Queue-it, for example, [describes its scheduled waiting room](https://queue-it.com/product/scheduled/) as randomizing on-time visitors and then serving latecomers first-in, first-out | Boundary at T₀: who counts as "on time"? |
| **Admission** | Users are let through at a controlled *inflow rate* and get a token that grants access to the protected site | One token per visitor; tokens expire; tokens shouldn't be shareable |
| **Selection** | Seat map or "best available" within a *price level* | Some seats are held back by the venue or promoter and never go on sale; presale codes unlock some allocations |
| **Hold** | Selected seats are reserved for a limited time | Unpaid holds go back to the pool when they expire; per-account ticket limits apply |
| **Payment** | Authorize and capture | A hold expiring during payment is the classic race condition |
| **Fulfilment** | Mobile ticket, often with a rotating barcode | Only issue a ticket for a captured payment, and issue it exactly once |
| **Afterlife** | Transfer, resale, cancellation/refund | Resale price caps, refund rules for fees, name changes |

**Failure modes worth knowing by name:**

- **Orphaned holds.** A client crashes and the release job lags, so seats look sold out while nobody is buying them. Fans see "no tickets", then tickets "reappear" ten minutes later and the press calls it a scam.
- **Hold/payment split-brain.** The hold expires, someone else takes the seat, and then the first buyer's payment succeeds. One seat now has two paid buyers, or one payment has no ticket.
- **Limit bypass.** A six-ticket limit is enforced per session, not per account or per payment card, so two browser tabs give you twelve.
- **Queue leakage.** An admission token works in a second browser, or a direct deep link to checkout skips the queue entirely.
- **Price-display drift.** The price on the event page, the seat map tooltip, the cart and the confirmation email are computed by different code paths and disagree.

That last one is not hypothetical.

### The case that should change how you report

In the US, the FTC's [Rule on Unfair or Deceptive Fees](https://www.ftc.gov/node/88198) took effect on **12 May 2025**. It covers live-event tickets and short-term lodging and requires businesses to disclose the **total price**, including mandatory fees, up front and clearly and conspicuously. It does not ban fees. It bans hiding them.

In April 2026 the FTC announced that [StubHub would pay $10 million](https://www.ftc.gov/news-events/news/press-releases/2026/04/stubhub-refunding-10-million-fees-consumers-after-deceptive-ticket-pricing) over violations on **12–14 May 2025**, the rule's first three days. According to the FTC, StubHub didn't give the total price on its first three pricing displays. On the first two, the advertised price left out mandatory fees. On the third, fees were listed but the total still wasn't shown.

Look at this from a tester's point of view. Imagine a tester who reported "All-in pricing verified ✅" after checking that checkout showed the right total. That tester may have been **completely truthful about what they observed** and still left decision-makers believing something false. The rule applies to the **pricing displays a buyer sees on the way to checkout**, not only to checkout. The coverage gap wasn't in the testing. It was in the report, which never said what wasn't covered.

(One caveat: I'm not saying anything about how StubHub tested internally. I don't know, and the FTC release doesn't say. The case is useful as a model of how a narrow observation becomes a broad claim.)

---

### Part 2: The skill. Reporting what you know without overclaiming

Michael Bolton's article [How is the testing going?](https://developsense.com/blog/2018/02/how-is-the-testing-going/) argues that a useful answer weaves together three strands:

1. **The product story:** what you learned about the product, especially problems and risks.
2. **The testing story:** how you tested, what you covered, and what you *haven't* covered and won't unless something changes.
3. **The quality-of-testing story:** what made testing harder, slower or less trustworthy. These are *issues*, as distinct from product *bugs*.

A vague "testing is going well" is dangerous because each listener applies it to whichever strand they care about. The PO hears "the product is fine". The engineering manager hears "QA has no blockers". Neither is what you meant.

In an older DevelopSense post, [Statistician or Journalist?](https://developsense.com/?p=529), Bolton makes a related point: numbers are incidental to the story, not central to it. "47/47 checks passed" isn't a status. It's one fact inside a story that you still have to tell.

Rapid Software Testing pairs this with **safety language**: wording that marks the limits of a claim. "So far…", "I haven't yet seen…", "It appears…", "I infer…", "I assumed…" (see the [RST Reporting slides by Bach and Bolton](https://www.slideshare.net/slideshow/rapid-software-testing-reporting/36885704)). Safety language isn't hedging to protect yourself. Used well, it's **precision**. Each qualifier tells the listener which kind of evidence stands behind the claim.

#### A working tool: the claim ledger

Before you answer "are we good?", spend ten minutes sorting your claims into four bins:

| Bin | Wording | Example from tomorrow's on-sale |
|---|---|---|
| **Observed** | "I saw…" | "I saw the total price, fees included, on the event page, seat-map tooltip and checkout for US events on web, desktop and mobile Chrome." |
| **Inferred** | "I infer… because…" | "I infer the iOS app shows the same totals because it calls the same pricing endpoint. I haven't looked at the app." |
| **Assumed** | "We're assuming…" | "We're assuming the hold-release job keeps up at peak. Load testing ran at 40% of expected admissions/minute." |
| **Not covered** | "I haven't checked…, and here's why it matters…" | "I haven't checked the 'sort by price' filter, the confirmation email or the affiliate listing feed. Those are pricing displays too." |

Then write your reply so that each sentence draws on one bin and the reader can tell which.

#### Before and after

**Before:**

> Yes, looks good! All-in pricing verified, queue tested, the two hold bugs are fixed. 👍

**After (about 120 words, three strands):**

> **Product:** No blocking problems known. Both hold-expiry bugs are fixed and retested. Expired holds now return seats within ~5 s in staging.
> **Coverage:** All-in totals confirmed on event page, seat map and checkout (web). **Not yet checked:** iOS/Android app, price-sorted search results, confirmation email, affiliate feed. Some of these count as pricing displays under the FTC fees rule, so they're a compliance risk, not polish. Queue randomization tested at the T₀ boundary. Token reuse across browsers is rejected.
> **Testing limits:** Load tested at 40% of planned inflow. We don't know how hold release behaves at peak.
> **Recommendation:** Go is defensible if someone checks the four uncovered price surfaces by 18:00 (I can do two). For 10:00–10:30 I'd watch holds created vs. released vs. converted, and payments captured without a ticket issued.

The second version is longer but faster to act on. The PO can decide in one read, and it's clear who decides: you inform the decision and don't make it.

#### When they push back: "Just give me a yes or no"

That request is reasonable. The PO has a decision to make. Don't refuse it. **Answer it with conditions:**

- *"Yes, if X. If X can't happen, I'd still go, but with Y watched live."* This gives a yes or no and keeps the uncertainty visible.
- Put the **cost of the gap** in their terms: "If the app shows a pre-fee price to US buyers, that's the exact pattern the FTC acted on last spring." One concrete precedent persuades more than "there might be compliance issues".
- If they accept the risk, **write down the acceptance** in one line in the release ticket: "Shipping without app price check; accepted by [PO], 16:40." This isn't a trap. It makes sure the next person knows it was a decision, not an oversight.
- Don't **inflate uncertainty to win.** If you've seen the hold release work reliably 200 times, say so plainly. Safety language that hides real confidence is as misleading as overclaiming.

---

### Part 3: Test ideas for an on-sale

The questions to test the domain with, rather than more checks to automate:

**Queue and fairness**
- Join the pre-queue at T₀−1 s and T₀+1 s. Which group do you land in? Is "on time" decided by the client clock or the server clock?
- Copy the admission token or cookie to a second browser or device. Does it work in both?
- Deep-link straight to `/checkout?event=…` without a token.
- If you refresh in the queue, do you keep your place or lose it? Does the on-screen copy match what actually happens?

**Holds and limits**
- Let a hold expire *while* the payment request is in flight. Who owns the seat afterwards? Is there a payment with no ticket?
- Two tabs on the same account, each holding the per-account maximum. Is the limit enforced at hold, at payment, or at issuance?
- Abandon checkout by killing the app rather than clicking "cancel". How long until the seat comes back to the pool?

**Price parity (the StubHub lesson)**
- **Inventory every surface that shows a price** before you test any of them: search results, sort/filter, event page, seat map, cart, checkout, emails, push notifications, app, affiliate and partner feeds, ads. The inventory is the coverage claim. Testing without it only gives you anecdotes.
- Turn on a "show prices without fees" toggle if one exists. What is the default for a US visitor arriving from a search ad?
- Resale listings: when the platform fee depends on the seller's price, is the buyer's total recomputed when the seller edits the price?
- Check which fees are excluded from the total under the rule (the FTC lists government charges, shipping and optional add-ons) and make sure your product classifies each fee the same way legal does.

**Observability during the on-sale**
- Are there live counters for holds created, released and converted? A rising "held" line with flat "converted" is how orphaned holds show up.
- Can someone see "payment captured, no ticket issued" within minutes, not at tomorrow's reconciliation?

---

### Challenge (30–40 minutes)

Pick a feature your team ships this week. It doesn't have to be ticketing.

1. **Build a claim ledger.** List at least 8 claims you'd make about it, sorted into *Observed / Inferred / Assumed / Not covered*. You'll probably find that some claims you'd have reported as "verified" are really inferences.
2. **Inventory the surfaces.** Find one value that shows up in more than one place: a price, a balance, a stock level, a score, a meter reading. List *every* surface that shows it. Mark the ones you actually looked at.
3. **Write the report.** Send a three-strand status in no more than 120 words, ending in a conditional recommendation ("Go if…, watch…").
4. **Reflect afterwards.** Did anyone ask about an uncovered item? Did the conditional recommendation change what happened? Write down one sentence you'd phrase differently next time.

**Stretch:** Take the ticketing scenario and design one *monitoring* check for 10:00–10:30 that would catch hold/payment split-brain within five minutes. Specify the signal, the threshold and who gets paged.

---

### Sources

- Michael Bolton, DevelopSense: [How is the testing going?](https://developsense.com/blog/2018/02/how-is-the-testing-going/) (the three-strand testing story)
- Michael Bolton, DevelopSense: [Statistician or Journalist?](https://developsense.com/?p=529)
- James Bach & Michael Bolton: [Rapid Software Testing: Reporting (slides)](https://www.slideshare.net/slideshow/rapid-software-testing-reporting/36885704) (safety language)
- U.S. FTC: [FTC Rule on Unfair or Deceptive Fees to Take Effect on May 12, 2025](https://www.ftc.gov/node/88198)
- U.S. FTC: [StubHub Refunding $10 Million in Fees to Consumers After Deceptive Ticket Pricing](https://www.ftc.gov/news-events/news/press-releases/2026/04/stubhub-refunding-10-million-fees-consumers-after-deceptive-ticket-pricing) (April 2026)
- Queue-it: [Scheduled waiting room](https://queue-it.com/product/scheduled/) (vendor page, used only to describe how pre-queue randomization and admission tokens work, not as evidence of effectiveness)
