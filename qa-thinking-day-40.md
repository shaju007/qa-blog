# QA Thinking — Day 40

## Testing Bet Settlement: A Rule Table Is a Domain With Gaps, Not a Lookup to Copy Into Your Tests

### The situation

You're the tester on a sportsbook's settlement service. The new feature handles horse-racing **non-runners**: when a horse is withdrawn after you've bet on another runner at a fixed price, your winnings are reduced under **Tattersalls Rule 4**. The ticket includes the deduction table, and the product owner says: *"It's an industry-standard table. Just check every row."*

That would give you 19 green checks, and they'd tell you almost nothing. The table is a specification of a **domain**: a set of variables, classes and boundaries. Today's lesson is about reading it that way. Cem Kaner's domain testing gives you the method, and racing and tennis settlement give you a domain where the risk is concrete. One penny in the wrong place, repeated across a busy Saturday's bets, adds up to real money. A badly chosen input price can also become a regulatory story.

---

### Part 1: Domain primer — what "settlement" actually means

You can't partition a domain you don't understand. Here's the minimum vocabulary:

| Term | What it means | Why a tester cares |
|---|---|---|
| **Settlement** | Turning an official result into a payout or a loss for every open bet | It's a batch job over a huge number of bets. A systematic error hits everyone. |
| **Fixed / early price vs. SP** | A fixed-odds bet locks in the price at the time it was placed. A Starting Price (SP) bet is paid at the price returned when the race starts. | Rule 4 applies to fixed prices taken *before* the withdrawal. SP bets don't get a deduction because the market reforms and the SP already reflects the smaller field ([Sporting Life](https://www.sportinglife.com/free-bets/guides/horse-racing-beginners-guide/rule-4-explained)). |
| **Non-runner / reformed market** | A declared runner is withdrawn, and the market is rebuilt without it | Every bet's deduction depends on *when the bet was placed* relative to *each* withdrawal |
| **Rule 4 deduction** | Pence per £1 of winnings, scaled by how short the withdrawn horse's price was: 90p at 1/9 or shorter, down to 5p at 10/1–14/1, nothing beyond 14/1. With several withdrawals the total is capped at 90p ([Sporting Life](https://www.sportinglife.com/free-bets/guides/horse-racing-beginners-guide/rule-4-explained)). | It comes off winnings only. The stake is always returned. |
| **Dead heat** | Runners tie for a paying position. The stake is split by the number tied, and each part is paid at full odds. | The stake is split, so a "winning" bet can return less than its stake |
| **Void / retirement rules** | The conditions under which a bet stands, is refunded, or is settled | These differ by operator. In tennis, depending on the book, a match bet may stand from the first ball, only after the first set is completed, or only if the match is completed ([Action Network](https://www.actionnetwork.com/tennis/tennis-betting-rules-player-retires-rain-weather-delay)). |

There's also an integrity side. In 2018 the UK Gambling Commission published lessons from a 2015 case. A trader had deliberately shortened the price of a horse (Tango Sky) that was known to be coming out, which made the Rule 4 deduction applied to customers' winning bets bigger. The Commission set out expectations on policies, training, monitoring and clear terms. It also warned that it could mandate how Rule 4 is calculated if operators fell short ([UKGC, 4 July 2018](https://www.gamblingcommission.gov.uk/news/article/important-lessons-for-the-betting-industry-on-rule-4-application)). For a tester, that turns *"which price did we use, and can we prove it?"* into a requirement, not a nice-to-have.

---

### Part 2: Kaner's lens — domain testing is about modelling, not reading rows

Kaner, Padmanabhan and Hoffman describe domain testing as a generalized approach to equivalence class analysis and boundary testing. Their workbook builds it around **notional variables**: the tester's model of a variable "as if it were part of the code", whether or not the code has it ([Kaner, *The Domain Testing Workbook*](https://kaner.com/?p=363)). Their related paper treats domain testing as a way to *sample* an almost unlimited input space. You group values by **how the program might fail**, pick the **best representatives** (usually boundaries), and then follow the variable into what uses it downstream and how it combines with other variables ([Kaner & Padmanabhan, PDF](https://kaner.com/pdfs/kanerPadmanabhanDomainTesting.pdf)).

Applied at work, that means three moves the "check every row" approach skips.

#### Move 1: List the notional variables, not the table rows

The table shows one input: the withdrawn horse's odds. Settlement actually depends on at least these:

1. **Withdrawn runner's price**, but *which* price? The last traded price, the displayed board price, or the price at the moment of withdrawal? The UKGC case shows this choice isn't neutral.
2. **Bet placement time** relative to **each** withdrawal time
3. **Number of withdrawals**, and the reformed price used for each one after the first
4. **Accumulated deduction**, capped at 90p
5. **Bet type**: fixed price vs. SP, win vs. each-way (two parts with different place terms)
6. **Dead-heat factor** (1/2, 1/3, …)
7. **Multiples**: a deduction applies per leg, and the legs' returns compound
8. **Rounding policy and order of operations**

Rule 4 belongs to each bet, not to the race. Two customers on the same horse in the same race can get different deductions: one bet before the first withdrawal, the other between the first and second. If your fixtures put one deduction on the race, your tests have the same blind spot as a buggy implementation.

#### Move 2: Look for gaps between classes, not just edges

The table is written in **fractional odds**. Your system almost certainly stores **decimal** odds, and price boosts, exchange-derived prices and odds-format conversion all produce values that aren't on the traditional ladder. Convert the published bands to decimal and lay them end to end:

- 25p band ends at **3/1** (4.00); 20p band starts at **16/5** (4.20). So where does **31/10** (4.10) go?
- 20p band ends at **4/1** (5.00); 15p band starts at **9/2** (5.50). Where does **17/4** (5.25) go?
- 10p band ends at **9/1**; 5p band starts at **10/1**. Where does **19/2** go?
- "Over 14/1: no deduction". Is exactly 14/1 a 5p deduction (yes, per the table), and what about 14/1 stored as `15.0000001` after a float conversion?

These are **unassigned regions** in the specification. The code will do *something* with them: fall through to the next band, round to the nearest ladder price, or throw. Each choice is a business decision someone has made without saying so. Your job isn't to pick the right answer. It's to show that the question exists.

One caveat. I've used a commonly published version of the table (Sporting Life's). Before raising gaps, get the version your operator's terms actually publish, because that's the contract with customers.

#### Move 3: Follow the value downstream, where invariants hide

Here's a worked example where order of operations matters. A £1.00 win bet at 5/2 dead-heats three ways, and there's a 15p Rule 4 deduction:

- **Unrounded:** stake share £0.3333 → winnings £0.8333 → after Rule 4 £0.7083 → return **£1.04**
- **Rounding the stake share first** (£0.33): winnings £0.825 → after Rule 4 £0.70125 → **£1.03**

The difference is one penny. It's tiny per bet, but it applies to every bet settled that way and compounds inside accumulators. Whichever policy is right, it should be **written down and applied the same way** in settlement, the bet-history display, the cash-out calculation and finance reconciliation. Four components each rounding their own way is the actual bug pattern.

The domain also corrects a tempting invariant. *"A winning bet always returns at least its stake"* holds for Rule 4, because only winnings are reduced. It's **false** under dead heat: £10 at 1/2 split two ways returns £7.50. If you add the unqualified invariant to a property-based test, you'll either get false alarms or quietly weaken the check until it's worthless. Invariants hold within classes, so state the class:

- Deduction is non-increasing as the withdrawn price lengthens
- Total deduction ≤ 90p, however many withdrawals there are
- For *non-dead-heat* winning bets, return ≥ stake
- SP bets never get a Rule 4 deduction
- A bet placed after a withdrawal gets no deduction *for that withdrawal*

---

### Part 3: The same lens on a sports-data feed (tennis retirements)

Now switch roles. You work for a **sports-data platform** that sells results to dozens of sportsbooks. A player retires in a match. Your feed sends `winner: Player A`.

Here the notional variable is **match progress at the moment of retirement**, and the classes come from your *customers'* rules, not yours:

- Before the first ball (a walkover, not a retirement, but do the records distinguish them?)
- During the first set
- **Exactly at the end of the first set**, before the first point of set two (a boundary that "first set completed" rules depend on)
- Mid-match, after one or more sets
- During a tiebreak, or a match-tiebreak deciding set

A feed that sends only the winner gives a "first ball" book everything it needs and a "first set completed" book nothing. The domain-testing question for a B2B data product is: **for each customer rule class, does the payload carry enough facts to settle correctly?** That means sets completed, a retirement flag, a walkover flag, and timestamps. That's a contract-coverage question, and it's how you find feed gaps before an operator's customers do.

---

### Part 4: The soft skill — raising a spec gap without starting a turf war

Rule 4 belongs to trading and compliance, not engineering. When you've found the 3/1–16/5 gap, two approaches tend to fail:

- **"The spec is wrong."** That's accusatory, and the people who own the spec can quote it from memory.
- **Quietly deciding in a test fixture.** Your automation now encodes a business rule nobody approved, and it becomes the de facto policy.

What works is a short message that brings evidence, keeps ownership with the owners and makes the decision cheap to take:

> *"Converting our published Rule 4 table to decimal odds, I found four price regions that no band covers (attached: band edges in decimal, plus three real boosted prices from last month that fell into them). Today the code puts them in [observed behaviour]. I'm not proposing an answer. Can trading confirm the intended band for each? I'll then add one check per boundary so we notice if it ever changes. Also: which price snapshot is authoritative for the withdrawn runner, and do we keep it in the bet's audit trail?"*

That message does five things. It shows the gap with data rather than opinion. It reports what the system actually does. It asks the owner to decide. It offers to protect whatever they decide. And it connects to the audit-trail expectation the regulator has already stated, which turns "QA nitpick" into "compliance exposure". That's influence without authority built from evidence.

---

### Practical challenge (45 minutes)

**Part A: Partition (20 min).** Choose a rule table from your own product. Fee tiers, shipping thresholds, tariff bands, commission rates and volume discounts all work. Then:

1. List the notional variables. The table usually shows one or two, and settlement-style logic depends on five or more.
2. Convert the bands to the representation the system actually stores (decimal, cents, kWh, integer units). Mark every gap, overlap and ambiguous inclusive/exclusive edge.
3. Write three invariants and state the class each one holds in. Find one that's false in a neighbouring class, like "return ≥ stake" under dead heat.

**Part B: Calculate (10 min).** Work out the return on each of these, and say what you'd need to ask before you could be sure:

- £20 win, fixed 4/1, placed *before* two withdrawals: first runner at 6/4, second at 2/1 in the reformed market
- £20 win, same horse and price, placed *between* the two withdrawals
- £10 each-way at 8/1, 1/5 odds for places, horse dead-heats for third (the last paying place) with one other, plus a 10p Rule 4

**Part C: Communicate (15 min).** Write the message you'd send to the rule's owner about your biggest gap, using the four-part structure above: evidence, observed behaviour, a decision request, and an offer to protect the decision. Keep it under 120 words.

*Stretch:* if you work on a data feed, list your customers' settlement rules for one market and check whether your payload carries enough facts for each.

---

### Takeaway

A rule table is a **summary of a domain**, written for humans and in the humans' notation. Checking every row confirms that the code copied the table. Domain testing, as Kaner frames it, asks what variables sit behind the table, where its classes leave gaps, and where the value flows next. In settlement those answers are worth money, and sometimes they're what a regulator will ask about.

---

### Sources

- Cem Kaner — [New Book: *The Domain Testing Workbook*](https://kaner.com/?p=363) (domain testing as generalized equivalence/boundary analysis; notional variables)
- Kaner & Padmanabhan — [Domain Testing paper (PDF)](https://kaner.com/pdfs/kanerPadmanabhanDomainTesting.pdf) (risk-based classes, best representatives, downstream and multi-variable analysis)
- Sporting Life — [What is a Rule 4 in horse racing and how does it work?](https://www.sportinglife.com/free-bets/guides/horse-racing-beginners-guide/rule-4-explained) (deduction bands, 90p cap, reformed-market rule, SP vs. early prices)
- UK Gambling Commission — [Important lessons for the betting industry on Rule 4 application (4 July 2018)](https://www.gamblingcommission.gov.uk/news/article/important-lessons-for-the-betting-industry-on-rule-4-application) (Tango Sky case; operator expectations)
- Action Network — [Tennis betting rules: player retires, rain/weather delay](https://www.actionnetwork.com/tennis/tennis-betting-rules-player-retires-rain-weather-delay) (variation in retirement rules across operators)
