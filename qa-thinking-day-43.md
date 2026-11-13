# QA Thinking — Day 43

## Testing Marketplace Promotions for Abuse: The Attacker Follows Your Rules More Carefully Than Your Customers Do

Most of the defects you report show the product **breaking a rule**. The incidents that cost a marketplace the most money often look different: the product **follows every rule** and still ends up paying someone it never meant to pay.

The OWASP Top 10 for Business Logic Abuse (first published in 2025) says business logic abuse "thrives when systems function exactly as intended, but not as expected." Keep that sentence in mind for today's lesson. A promotion can pass every acceptance criterion and still turn into a cash machine for anyone patient enough to read the rules closely.

Today's subject is promotion and incentive abuse on a two-sided marketplace. You'll practise three things:

1. **Technical judgment:** turning "think like an attacker" into concrete, repeatable test ideas.
2. **Domain knowledge:** who actually pays for a discount, and why that decides how dangerous the discount is.
3. **Soft skills:** raising abuse risk without sounding paranoid, and without hearing "that's the fraud team's problem" or "works as designed" in reply.

---

## 1. Start with users you don't want

Michael Bolton wrote about this in his column ["Users We Don't Like"](https://www.developsense.com/articles/2007-08-UsersWeDontLike.pdf). Testers usually model the users the product is built for. You learn a lot more when you also model **disfavored users**: people whose goals you deliberately want to frustrate, such as fraudsters, data thieves and people who exploit policy loopholes. He also covers a second group: users we say we care about but whose needs we quietly ignore.

Most teams talk about disfavored users only during security reviews, and then only about hackers. On a marketplace, the dangerous disfavored users are mostly **ordinary account holders with spare time and a spreadsheet**:

| Disfavored user | What they want | Feature they love |
|---|---|---|
| The self-dealing seller | Turn platform money into their own payout | New-buyer voucher, platform-funded promos |
| The referral farmer | Mint credit from fake accounts | "Give €10, get €10" |
| The threshold gamer | Get the discount, then undo the purchase that qualified for it | "€10 off orders over €60", free-shipping thresholds |
| The scalper | Buy limited stock faster than humans | Limited drops, launch-day promos |
| The code harvester | Find valid codes without being given one | Voucher validation endpoint |

**How to apply it at work:** in refinement for any feature involving money, credit, scarcity or reputation, ask one question: *"Who would love this feature for the wrong reasons?"* Write down the answers as personas. You can test against a persona. You can't test against "security".

---

## 2. Domain knowledge: who funds the discount?

A marketplace isn't a shop. The platform sits between buyers and sellers, takes a fee (commission, a payment fee or both) and pays sellers later. Before you test any promotion, find out who funds it, because that decides who loses money when it's abused.

- **Seller-funded discount:** the seller chooses to sell for less. Abuse mostly hurts the seller, who opted in.
- **Platform-funded discount (subsidy):** the buyer pays less, and the **seller still receives the full price minus fees**. The platform pays the difference out of its marketing budget.
- **Co-funded:** split by a rule, such as 50/50 or "platform covers up to €5".

The key point: **on a platform-funded promotion, a seller who buys from themselves turns the subsidy into a payout.** Here's how it works:

1. A seller lists an item at €40.
2. They create a "new buyer" account and apply the platform's €15 first-order voucher.
3. They pay €25, and the platform's checkout covers the other €15.
4. The seller ships nothing or an empty envelope. Or the "buyer" just confirms receipt, because both accounts belong to the same person.
5. The payout is €40 minus commission. The seller has turned €25 into roughly €35. Repeat with the next email address.

No code was broken. Every step matched the spec. That's why this risk lives *between* teams: growth owns the voucher, payments owns the payout, trust & safety owns account linking, and nobody owns the gap between them.

Other domain terms worth knowing before you talk to stakeholders:

- **Payout hold / delay:** how long seller funds stay with the platform after delivery. This is your biggest lever against cash-out abuse.
- **Promo budget / burn:** marketing tracks how fast the voucher budget is spent. A sudden burn spike is often the first visible sign of abuse.
- **Clawback:** taking back credit or subsidy after a refund or cancellation. It only works if the system remembers who funded what.
- **Velocity:** how many events happen per account, device, card or payout account in a time window.

---

## 3. Turn abuse into test ideas, using a taxonomy

"Try to abuse it" is too vague to plan with. Use the OWASP [Top 10 for Business Logic Abuse](https://owasp.org/www-project-top-10-for-business-logic-abuse/?tab=top10) as a checklist of failure *shapes*, then translate each one into your domain. Here are the categories that matter most for promotions:

**BLA1: Action Limit Overrun (single-use isn't single-use under concurrency).**
A voucher check usually runs *check the code is unused → apply → mark used*. PortSwigger's [race conditions guide](https://portswigger.net/web-security/race-conditions) calls the gap between check and update the "race window". It describes how sending many requests at the same moment, for example with HTTP/2's single-packet technique, lets several of them pass the "unused" check before any of them writes "used".
*Test idea:* in staging, send 20 identical "apply voucher and place order" requests in parallel from two sessions on the same account. **Your oracle isn't the HTTP response. It's the ledger:** count redemptions for that voucher ID, and count the platform subsidy actually booked.

**BLA6: Missing Transition Validation (eligibility checked once, never again).**
PortSwigger's [logic-flaw examples](https://portswigger.net/web-security/logic-flaws/examples) describe "discount stacking": add items to cross a threshold, get the discount, then remove items and keep it. Marketplaces have a harder version: a **multi-seller cart**.
*Test idea:* the cart holds items from three sellers, totals €62 and qualifies for "€10 off over €60". Seller B cancels their €25 item after checkout because it's out of stock. Answer three questions: Is the buyer still entitled to €10? Who absorbs the refund difference? Was the €10 split across sellers, and how? Then try the same thing as a *buyer-initiated* partial return 3 days later.

**BLA5: Artifact Lifetime Exploitation (a voucher that comes back to life).**
Order cancelled → voucher reinstated, which is reasonable. Now combine that with a payout that has already happened, or with a dispute the buyer wins later.
*Test idea:* redeem, cancel, check the voucher is reinstated, redeem again, then raise a chargeback on the first order. Count how many times the subsidy was paid out in total.

**BLA8: Internal State Disclosure (the validation endpoint as an oracle for attackers).**
If `POST /vouchers/validate` returns "expired" for real codes and "invalid" for made-up ones, anyone can enumerate the code space.
*Test idea:* compare the response body, status code, **and response time** for a nonexistent code, an expired code, a code already used by someone else and a valid code. Any difference you can tell apart is information you're handing out.

**API6:2023, Unrestricted Access to Sensitive Business Flows.**
The [OWASP API Security Top 10 entry](https://api-security.owasp.org/editions/2023/en/0xa6-unrestricted-access-to-sensitive-business-flows) lists three scenarios: automated scalping, mass-booking and then cancelling to force a price drop, and **scripted registrations to farm referral credit**. Note what it says about prevention: it starts at the *business* layer by identifying which flows would hurt if used at machine speed, and only then moves to engineering controls.
*Test idea:* script the referral flow end to end in staging, then answer: *what, if anything, stops the 50th account linked to the same device, delivery address or payout IBAN?*

### Oracles that actually catch abuse

When you test abuse, the UI and status codes will usually say "success", because from the system's point of view it *was* a success. Use **invariants** instead:

- Platform subsidy booked per single-use voucher ≤ face value, always.
- For every order: buyer paid + platform subsidy = seller payout + platform fee + refunds (+ subsidy clawed back).
- No payout account receives seller funds from orders whose buyer funding came mainly from subsidies granted to accounts linked to that payout account. That's harder to check, but it's the actual risk.
- Promo burn rate per hour stays within an expected band. If it doesn't, someone gets alerted. *Find out who.*

The last one tests observability, not code. Asking "if this were happening in production right now, who would notice, and when?" is often your most valuable finding.

---

## 4. The hard part: getting anyone to care

Testers often find abuse paths and then lose the conversation. Here are the three objections you'll hear, and what to do about each.

### "Works as designed."

Agree with them, because it's true, and then reframe. Bolton's definition of a bug is anything that threatens the value of the product to someone who matters. The design is the problem, and the person who matters is whoever owns the promo budget or the P&L.

> "Yes, every step is behaving as specified. The question I'm raising is whether the spec intends a seller to be able to fund their own sales with the new-buyer budget. If it does, fine. Let's write that down. If it doesn't, the spec has a gap."

Saying it this way removes the blame (nobody coded it wrong) and turns the finding into a **product decision**, which is where it belongs.

### "That's fraud/trust & safety's job."

Partly true. They own detection and response. But fraud teams usually see the abuse **after** the money has left. You're in the room **before** launch, when a payout delay or a redemption cap costs nothing to add. Don't hand the finding over and walk away. Bring the fraud analyst into the conversation with a concrete scenario and ask them: "Would your current rules catch this? How quickly?" Their answer *is* evidence.

### "You're being paranoid. Real users don't do this."

Don't argue about likelihood in general. Make the economics of the attack visible. For each abuse case, report:

| Field | Self-dealing example |
|---|---|
| **Actor & motive** | Seller; wants cash from platform subsidy |
| **Cost to attacker per attempt** | One email address, ~5 minutes, one cheap listing |
| **Gain per attempt** | ~€10–13 net after commission |
| **Scales by** | Accounts, so it's limited only by account-creation friction |
| **Who pays** | Platform marketing budget (not the seller, not the buyer) |
| **Would we notice?** | Not before payout. No alert on voucher burn per payout account (*verified with X on date*) |
| **Cheapest mitigations, by friction** | 1) Exclude orders where buyer and seller share device/address/IBAN signals from subsidy; 2) hold payout on subsidised first orders until N days after delivery; 3) cap subsidised orders per seller per day; 4) heavier identity checks (high friction, last resort) |
| **What I did NOT test** | Production fraud rules, device-fingerprint quality, collusion between genuinely different people |

This puts you in the **negotiation** with a menu, not an ultimatum. Growth wants zero friction for new buyers. Finance wants zero leakage. Neither can have all of what they want. The tester's job is to make the trade-off **visible and priced** so the people who own it can choose consciously. If they accept the risk, that's a legitimate outcome. Get it in writing, with a monitoring trigger that reopens the decision ("if subsidy burn per payout account goes above X, we revisit").

### Facilitation: a 25-minute abuse-case session

Run this in refinement for any incentive feature:

1. **(5 min) Money map.** On a whiteboard: who pays, who receives, and when money moves. Mark every place where value is *created* (voucher issued, credit granted).
2. **(10 min) Disfavored personas.** Each person writes one "user we don't like" and their best play. Silent writing first, so the most senior voice doesn't anchor the room.
3. **(5 min) Rank** by gain per attempt × how easily it scales × how late we'd detect it.
4. **(5 min) Decide** for the top 2: test it, mitigate it, monitor it, or accept it (and name who accepts it).

If you need permission to hold the session, ask the product owner like this: "I'd like 25 minutes to check that the voucher budget goes to new buyers and not to whoever reads the T&Cs most carefully." It's hard to say no to.

---

## 5. Guardrails: be an ethical attacker

- Do this in **test or staging environments**, with test payment instruments, and with your security team aware of it when you use concurrency tools. Don't fire race-condition traffic or mass account creation at production. Don't create fake accounts on live systems "to see what happens".
- Treat working abuse recipes as **sensitive information**. Put them in a restricted ticket, not the public channel or the release notes.
- If a finding touches real customer money or data, escalate through the security process rather than ordinary bug triage.

---

## Today's challenge: carry the skill into a different domain

A German energy supplier is launching a **new-customer bonus**: €120 credited to the customer's account, paid out after the customer has been supplied for 12 months. There's also a **"recommend a friend" credit** of €50 for both parties, granted when the friend's supply starts.

Spend 45 minutes on this:

1. **Money map (10 min).** Who funds each incentive? When is the value *granted*, when is it *paid*, and when could it be *clawed back*? Pay attention to moving house, changing supplier before 12 months, a contract being taken over by another household member, and final bills.
2. **Three disfavored personas (10 min).** For example: a household that switches back and forth between suppliers to collect bonuses, someone who "refers" their own second meter point or a relative at the same address, or a reseller managing many small commercial meters. For each persona, write down their play and the gain per attempt.
3. **Map to the taxonomy (10 min).** Match each play to a BLA category (limit overrun, missing transition validation, artifact lifetime…). Find at least one that is about **time**, not concurrency.
4. **Write two invariants (5 min)** that would catch the abuse in the billing data even if every API call returns success.
5. **Write the one-paragraph risk note (10 min)** you'd send the product owner, using the "actor / cost / gain / scales by / who pays / would we notice / mitigations / not tested" structure. Keep it under 150 words. Don't use the words "hacker" or "obviously".

**Stretch:** find a real incentive in your own product (trial, credit, voucher, free tier, loyalty points) and run step 1 on it this week. If you can't answer "who pays, and when?" in under 5 minutes, that gap is your first finding.

---

## Sources

- Michael Bolton, ["Users We Don't Like"](https://www.developsense.com/articles/2007-08-UsersWeDontLike.pdf), *Better Software* column (DevelopSense): disfavored users as a testing heuristic.
- OWASP, [Top 10 for Business Logic Abuse (2025)](https://owasp.org/www-project-top-10-for-business-logic-abuse/?tab=top10): taxonomy used in section 3; [project overview](https://owasp.org/www-project-top-10-for-business-logic-abuse/).
- OWASP API Security Top 10, [API6:2023 Unrestricted Access to Sensitive Business Flows](https://api-security.owasp.org/editions/2023/en/0xa6-unrestricted-access-to-sensitive-business-flows): scalping, mass-booking and referral-farming scenarios, and the business-layer-first approach to prevention.
- PortSwigger Web Security Academy, [Race conditions](https://portswigger.net/web-security/race-conditions): limit-overrun, race windows, the single-packet attack, and atomic fixes.
- PortSwigger Web Security Academy, [Examples of business logic vulnerabilities](https://portswigger.net/web-security/logic-flaws/examples): discount stacking and flawed assumptions about user behaviour.
