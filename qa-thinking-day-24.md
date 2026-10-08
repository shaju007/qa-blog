# QA Thinking — Day 24

## Facilitating a Pre-Mortem: How a Tester Finds the Risks That Live Between Teams (Marketplace Seller Payouts)

### The situation

Your marketplace's product owner announces a Q4 goal: **"Next-day payouts for sellers."** Sellers have complained for months that they wait 7 days for their money, and competitors pay faster. A developer looks at the payment provider's dashboard and says, "It's a config change. The payout schedule is one setting." The ticket lands in refinement with an estimate of 2 points, and someone asks QA to "test that payouts arrive the next day."

You could do exactly that. You'd set up a test seller, make a sale, and confirm the payout lands. It would pass, and you would have tested almost nothing that matters.

The most expensive risks in this feature are not in the code. They sit in the gaps between the payments team, finance, fraud and risk, customer support, and the seller's bank. No single person in refinement can see all of them. Today's lesson is about a skill that strong QA engineers rely on and rarely get taught: **facilitating a session that gets those risks out of people's heads and turns them into testable, ownable work.**

---

### Part 1 — Domain knowledge: why the payout delay exists in the first place

You can't facilitate a risk conversation if you don't understand the business, so start here.

**How money moves in a marketplace.** A buyer pays, and the money doesn't go straight to the seller. Most marketplaces use what Stripe calls *indirect charges* (destination charges or "separate charges and transfers"). In that model the **platform** processes the payment, takes its commission, and transfers the seller's share to the seller's connected account. The seller's balance then moves from **pending** (not yet withdrawable) to **available**, and a **payout** sends it to the seller's bank account.

**Negative events come later than positive ones.** Refunds, partial refunds, and chargebacks (disputes) can arrive days or months after the sale. [Stripe's Connect balance documentation](https://docs.stripe.com/connect/account-balances) states plainly that refunds and chargebacks create *negative transactions*. The provider tries to offset them against future payments, but a connected account's balance can still go negative. Once it does:

- payouts to that seller stop until the balance is positive again
- the provider may try to debit the seller's bank account, but only in supported regions and only if that's enabled; it can't recover funds from a debit card
- if the **platform** is liable for losses, the provider holds a **reserve on the platform's balance** to cover the gap
- if the balance stays negative for **180 days**, the provider takes it from the platform's funds (a `connect_collection_transfer`)

**Who carries the loss?** [Stripe's Connect risk guide](https://docs.stripe.com/connect/manage-risk) separates **transaction risk** (buyers charging back) from **account risk**, which is the seller being unable or unwilling to cover those chargebacks. Account risk breaks down further into credit risk (the seller goes out of business) and fraud risk (the seller never meant to deliver). The guide also notes that marketplaces using indirect charges are responsible for negative balances on their own platform balance, whatever they configure for connected accounts.

**The insight that should change how you see the ticket:**

> **The 7-day payout delay is not just slowness. It is a risk buffer.** It's the window in which refunds, cancellations, and early fraud signals arrive *while the money is still inside the platform*. "Next-day payouts" doesn't speed up an existing process. It moves money out of the platform's control before the negative events that would have clawed it back can arrive.

A config change can shift who carries financial risk. That's the conversation the team needs to have, and a tester who understands the domain is well placed to start it.

---

### Part 2 — Why a tester should facilitate rather than just critique

If you walk into refinement and say "this is risky," you're one voice against an estimate and a quarterly goal. You'll be seen as the blocker, and you'll only surface the risks *you* can imagine.

Gary Klein's **pre-mortem** reverses that dynamic. In [The Pre-Mortem Method](https://www.psychologytoday.com/ie/blog/seeing-what-others-dont/202101/the-pre-mortem-method), Klein describes asking the team to assume the plan has *already failed* ("a fiasco") and write down why. In ordinary meetings, people who raise doubts look negative. In a pre-mortem, Klein says, people show how smart they are by the quality of the issues they raise. Raising doubts becomes the task instead of the obstacle.

The Ministry of Testing community has a complementary format, **RiskStorming**, created by Beren Van Daele. In a [write-up of running a RiskStorming workshop](https://www.ministryoftesting.com/insights/riskstorming-workshop-experience), Uros Stanisic describes three phases:

1. Narrow about 20 quality-aspect cards down to the 6 that matter most.
2. Attach risks to those aspects.
3. Attach mitigation cards to the risks.

Two of his observations are worth stealing. His 15-person team struggled to cut down to 6 aspects, and it was in the risk phase that they discovered how much the team didn't know about its own product.

Michael Bolton's [More of What Testers Find, Part II](https://developsense.com/?p=848) (DevelopSense) supplies the third piece. He argues that testers find **risk stories**, built on the four-part model from Rapid Software Testing: a **victim** suffers **harm** because of a **vulnerability** in the product that is triggered by a **threat**. He also recommends starting from the "bad things" and asking who would suffer, rather than starting from the requirements.

Put together:

- the pre-mortem **generates** failure stories safely
- RiskStorming **focuses** them on the quality aspects that matter
- the four-part risk story **makes them precise enough to act on**

Your job as facilitator is to run that pipeline, not to supply all the answers.

---

### Part 3 — The session, step by step (45 minutes)

**Before the session (15 minutes of your time)**

- **Invite the people who hold the missing knowledge, not just the delivery team.** For payouts, that means the PO, a payments developer, someone from **finance/reconciliation**, someone from **fraud/risk or trust & safety**, and a **support lead** who handles seller tickets. Keep it to 5–7 people. Stanisic's 15-person session ran over time.
- **Send a five-line pre-read:** the change, the current payout delay, the target delay, the charge model you use (direct or indirect), and one open question: *"Who is liable when a seller's balance goes negative?"* If nobody can answer that before the meeting, you've already found your first risk.

**Step 1 — Frame the failure (2 minutes)**

> "It's March. Next-day payouts shipped in November, and it's now considered a serious mistake. Finance is unhappy, support is overwhelmed, and the PO is writing an incident review. What happened?"

Make the failure vivid and specific to your context. "The feature failed" is too abstract to trigger experience.

**Step 2 — Silent writing (4 minutes)**

Everyone writes failure reasons alone, one per sticky note. **Don't skip the silence.** If the most senior person speaks first, everyone else anchors on their answer, and the quiet support lead who has seen every weird seller ticket never gets heard.

**Step 3 — Round-robin (10 minutes)**

Each person reads *one* note per round, and you go around until the notes run out. No debate yet. Your only job is to cluster notes on the board as they come in. Typical clusters for this feature:

| Cluster | Example notes you'd expect |
|---|---|
| Negative balances | "Seller got paid Tuesday, buyer refunded Wednesday, balance negative, nobody noticed" |
| Fraud | "Fraudsters opened seller accounts, sold non-existent goods, cashed out in 24h" |
| Reconciliation | "Finance's month-end didn't match because a platform reserve appeared that nobody expected" |
| Seller experience | "Sellers saw 'payout paused' with no explanation and flooded support" |
| Operational | "Bank holiday plus weekend meant 'next-day' was 4 days, so sellers thought we lied" |
| Failure handling | "A transfer to a seller failed for insufficient platform balance and was never retried" |

That last row comes straight from the domain. Stripe's balance docs note that failed transfers between the platform and a connected account **are not retried automatically**; you have to re-send them explicitly. If a developer in the room didn't know that, you've just justified the session.

**Step 4 — Pick what matters (5 minutes)**

This is RiskStorming's narrowing move. Ask: *"Which of these quality aspects would hurt most: capability, reliability, security (fraud), usability for sellers, or supportability?"* Use dot-voting with three dots each. You're not trying to ignore the rest, only to agree on where depth goes first.

**Step 5 — Turn the top clusters into risk stories (12 minutes)**

This is where the tester earns their place. Rewrite each top cluster using Bolton's four parts:

| Victim | Harm | Vulnerability | Threat |
|---|---|---|---|
| Platform (finance) | Absorbs refund and chargeback losses it used to recover from pending funds | Payout delay shortened from 7 days to 1; platform liable for negative balances | Refund or dispute arrives after the payout has already left |
| Honest buyers and the platform | Chargebacks, reputation damage | New sellers get the same fast payouts as established ones | Fraudster onboards, sells phantom goods, withdraws within 24h |
| Sellers | Payouts silently paused; trust lost | Negative balance blocks payouts, and the seller UI doesn't explain why | Single refund on a low-volume seller account |
| Finance | Month-end reconciliation fails | Reserve and collection transactions aren't mapped in the ledger export | Platform reserve created or released by the provider |

Notice what happened: "Fraudsters cash out" became a *specific, testable vulnerability*: the eligibility rule for fast payouts doesn't distinguish new sellers from established ones.

**Step 6 — Mitigation, owner, and "is this even a test?" (7 minutes)**

For each risk story, ask three questions:

1. **Prevent, detect, or recover?**
2. **Who owns it?** Name a person, not "the team."
3. **Is the mitigation a test, a monitor, or a policy?**

Many of the best mitigations here aren't tests:

- **Policy:** fast payouts only for sellers with more than 90 days of history and a dispute rate under a threshold. Finance and risk own this, and QA tests that the eligibility rule is enforced.
- **Monitoring:** alert on the count of connected accounts with negative balances, and on the platform's reserved balance. This is observability, owned by payments engineering.
- **Test:** a seller paid out yesterday receives a full refund today. Check the balance, payout status, seller-facing message, auto-debit behaviour, and ledger entries.
- **Testability request:** "Can our sandbox simulate a dispute *after* a payout? If not, we need a way to." File this as a ticket, not a hope.

---

### Part 4 — Facilitation moves for when it gets difficult

**"That can't happen."** Don't argue. Ask about the evidence: *"What would have to be true for it to happen? How would we know if it did?"* If the answer is "we'd see it in the balance report," ask who reads that report and how often. Often "can't happen" really means "we've never seen it," and nobody has been watching.

**PO and finance disagree on appetite.** The PO says the competitive pressure justifies some losses, and finance says no losses are acceptable. Don't pick a side. That's a business decision, and both positions are legitimate. Make the trade-off explicit: *"So the question is how much loss per month we'd accept for next-day payouts, and for which sellers. Can we leave with a number, or with the name of who decides?"* Your role is to make sure decision-makers aren't guessing, not to make the decision for them.

**The session becomes blame.** If a note reads "the devs didn't handle X," rephrase it out loud as a system vulnerability: "Failed transfers aren't retried." Pre-mortems die quickly once people feel accused.

**Someone dominates.** The round-robin structure is your protection, so enforce it politely: "Let's hold that. One note per person per round."

**You run out of time.** Stop at the agreed time. Put the unclustered notes in a parking lot with an owner. A 45-minute session that ends on time with 4 owned risks beats a 90-minute session that ends with exhaustion.

---

### Part 5 — Reporting out: one paragraph, not a document

Afterwards, send the PO something like this:

> *"Pre-mortem on next-day payouts: we found four risks worth acting on. The biggest is that a 1-day payout delay removes the window in which we currently recover refunds and disputes from pending funds, and because we use indirect charges, those losses land on our platform balance. Proposed: (1) eligibility rule for fast payouts based on seller tenure and dispute rate (decision needed from Finance + Risk by Friday), (2) monitoring on negative-balance accounts and platform reserve (Payments eng), (3) seller-facing message when payouts pause (Seller UX), (4) explicit retry for failed transfers (Payments eng). QA will cover the post-payout refund scenarios, the eligibility rule, and ledger reconciliation of reserve transactions. Board photo attached."*

This message doesn't say "QA blocks the release," and it doesn't say "testing will make it safe." It turns a 2-point config change into a decision the business can make knowingly.

---

### Practical challenge

**Option A — At work (recommended):** Pick an upcoming feature that changes **timing**, **money**, or **who is responsible for what**, such as a retry policy, a cancellation window, a payout schedule, a billing date, or a data-retention period. Run a 30-minute pre-mortem with at least one person from *outside* the delivery team.

**Option B — Solo, using today's scenario:** Assume your marketplace sells event tickets and wants next-day payouts for organisers. Then:

1. Write **6 failure reasons** in silent mode (set a 4-minute timer, honestly).
2. Convert your **top 3** into four-part risk stories (victim / harm / vulnerability / threat). At least one must involve an event being **cancelled after the organiser has been paid**.
3. For each one, label the mitigation **test, monitor, or policy**, and name the role that would own it.
4. Write the **one-paragraph report** to the PO, in under 120 words.

**Self-review questions:**

- Did any of your risk stories have a victim other than the end user? (Look for finance, support, the platform's own balance, honest sellers.)
- How many of your mitigations were *not* tests? If the answer is zero, look again. A tester who only proposes tests is underselling what they found.
- If you ran a live session: who spoke least, and what did they know that nobody else did?

---

### Sources

- Gary Klein, [The Pre-Mortem Method](https://www.psychologytoday.com/ie/blog/seeing-what-others-dont/202101/the-pre-mortem-method), *Psychology Today* (2021): the pre-mortem steps and why reversing meeting dynamics surfaces doubts.
- Uros Stanisic, [RiskStorming Workshop Experience](https://www.ministryoftesting.com/insights/riskstorming-workshop-experience), Ministry of Testing: the three RiskStorming phases and lessons from running one. See also [RiskStorming activity overview](https://www.ministryoftesting.com/activities/riskstorming).
- Michael Bolton, [More of What Testers Find, Part II](https://developsense.com/?p=848), DevelopSense (2011): risk stories built from victim, harm, vulnerability, and threat; starting from "bad things" rather than requirements.
- Stripe, [Understanding Connect account balances](https://docs.stripe.com/connect/account-balances): pending/available balances, negative balances, platform reserves, the 180-day collection, and transfers that aren't retried automatically.
- Stripe, [Manage risk and liability with Connect](https://docs.stripe.com/connect/manage-risk): direct vs indirect charges, who carries negative balances, transaction vs account risk, and credit vs fraud risk examples.
