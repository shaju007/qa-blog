# QA Thinking — Day 37

## Testing SCA Exemptions: You Can Ask for a Frictionless Payment, but the Issuer Decides

A product owner on a European checkout team comes to you with a clear goal: "Small payments should go through without a 3-D Secure challenge. Cut the friction." The developers wire up exemption flags with the payment provider and the sandbox tests pass. The ticket says "SCA exemptions implemented. It works."

The phrase "it works" is today's risk. Your code sends a *request* for an exemption. Someone else grants or refuses it, using information you will never see, and every answer has a cost. Today's lesson covers the domain, a structured way to find the risks, and how to report what you know without overclaiming.

---

### 1. The domain in five minutes: who decides what

Under PSD2, remote card payments in the EEA generally need **Strong Customer Authentication (SCA)**, which means two independent factors. Online, that usually happens through 3-D Secure (3DS). The Regulatory Technical Standards (RTS) define **exemptions**. The two that matter most for checkout teams:

- **Low-value (RTS Art. 16):** single remote payments up to €30. Once the payments exempted since the last SCA exceed €100 in total, or once there have been five of them, SCA comes back. ([Osborne Clarke summary of the EBA standards](https://www.osborneclarke.com/insights/psd2-the-ebas-standards-on-strong-customer-authentication-where-are-we-now))
- **Transaction Risk Analysis (TRA, Art. 18):** payments up to €100, €250 or €500 can be exempted. Which ceiling applies depends on the PSP's measured fraud rate: 0.13%, 0.06% and 0.01% respectively for card payments. ([Stripe: SCA exemptions](https://docs.stripe.com/payments/3d-secure/strong-customer-authentication-exemptions))

Next to these sit **merchant-initiated transactions (MITs)**: off-session charges on a stored card, such as subscription renewals. They are out of scope for SCA, but only if the card was authenticated when it was saved and the customer agreed to future charges. Stripe notes that in practice, flagging a payment as MIT works much like requesting an exemption.

Four facts change how you test this:

1. **The counters live at the issuer.** The "five payments / €100 since last SCA" counter covers the cardholder's activity with *every* merchant. Your system cannot know that this card was used for four coffees elsewhere this morning. You are not testing whether your counter is correct, because you don't own one. You are testing what you do when the issuer's counter says no.
2. **An exemption is a request.** Stripe's documentation says plainly that the issuer may still require SCA for low-value payments.
3. **Frictionless costs liability.** If the issuer approves an exemption, the fraud liability shift is lost (Stripe again). An approved exemption that turns into a fraud chargeback lands on the merchant. That connects directly to Day 26's dispute economics.
4. **A refusal arrives as a soft decline.** The issuer answers "authentication required": Visa uses response code **1A** and Mastercard uses **65**. The correct reaction is to run 3DS and resubmit with the authentication result, not to retry the same request. A retry engine that treats all declines alike will miss this, and may also retry hard declines, which breaks scheme rules. ([Checkout.com: how and when to retry SCA soft declines](https://www.checkout.com/resources/blog/how-and-when-to-retry-sca-related-soft-declined-transactions); [Checkout.com docs: automated SCA soft-decline retry](https://www.checkout.com/docs/risk-management/3d-secure/automated-sca-soft-decline-retry)). Checkout.com's docs add one constraint: only customer-initiated payments can be retried this way, because the cardholder has to be in session to authenticate. A soft decline on an MIT usually points to a setup problem with the original authentication.

Two more details to note. First, thresholds in non-euro currencies are not obvious. The EBA says PSPs should convert using the average ECB reference rate, and may round only if the rounded amount is unlikely to breach the euro threshold. That can require periodic adjustment ([EBA Q&A 2018_4040](https://www.eba.europa.eu/single-rule-book-qa/qna/view/publicId/2018_4040)). So "30" in SEK, PLN or DKK is a number that changes over time. Second, the UK now has its own figures (£25 / £85 per Stripe's docs), so "EEA + UK" is not one ruleset.

---

### 2. Finding the risks: SFDIPOT on an exemption flow

James Bach's [Heuristic Test Strategy Model (v6.3, Satisfice)](https://www.satisfice.com/?p=13) lists *product factors* as guidewords: Structure, Function, Data, Interfaces, Platform, Operations, Time. Use them to generate questions about this feature, not as a checklist to tick. Here is how they apply:

| Guideword | Question it prompts here | Concrete test idea |
|---|---|---|
| **Structure** | Which component decides to request an exemption: our code, the PSP's engine, or both? | Find out whether our "request low-value" flag *overrides* the PSP's own optimisation or competes with it. Get the actual request payload for a €29 order. |
| **Function** | What happens after a soft decline? | Simulate 1A/65. Expected: a 3DS challenge is shown in-session and the order is created once. Check for a *second* authorization attempt without authentication data, a duplicate order, or a stuck "pending" state (see Day 7). |
| **Data** | What amount is compared against the threshold? | Basket €31 with a €2 voucher, so €29 charged. Also: totals with shipping added after the decision, and a SEK basket near the converted limit. Is the check made on the *final authorized* amount in the *charge* currency? |
| **Interfaces** | What does the customer see when the issuer steps up unexpectedly? | A challenge that appears inside a "one-click" UI built on the assumption of no challenge. Check mobile webview redirects, popup blockers, and returning to the app after a bank-app approval. |
| **Platform** | Does sandbox behaviour match production? | Sandbox issuers follow scripts: a magic card number always says "exempt OK". That checks our reaction to a verdict, not the verdict itself (see section 3). |
| **Operations** | How do real customers use this? | Five quick €8 top-ups in a gaming wallet, so the sixth is stepped up. Or a customer who paid at three other shops this morning, so *our first* payment is stepped up. Both are normal behaviour, not edge cases. |
| **Time** | What expires? | 3DS sessions time out. Cart reservations (Day 15) may expire while the customer is in their bank app. Renewals (MITs) run months after the original authentication, and sometimes the card has been replaced since then. |

The **Time** row and the MIT setup usually expose the expensive bug. If the card was saved *without* proper initial authentication, every renewal months later can come back soft-declined, and the customer isn't present to complete a challenge. Release testing won't catch this, because nothing renews during the test cycle.

---

### 3. The oracle problem: what can a green test actually tell you?

A useful habit: for each check, write what it can and cannot detect.

- **It can detect:** whether we send the right exemption indicator, whether we handle a 1A/65 by stepping up, whether we avoid duplicate orders, and whether the UI survives a challenge it didn't expect.
- **It cannot detect:** how often real issuers accept our exemption requests, whether our PSP's TRA ceiling is actually €250 for us this quarter (it depends on fraud rates), or what the extra fraud liability costs us.

The second list is not a testing failure. It is information that only **production observation** can give. So your test strategy should include something that isn't a test case: a dashboard or query that splits outcomes by *exemption requested × issuer response × final outcome × card country*. If step-up rates for one issuer country jump after a release, you have learned something no sandbox could show. Agree on this before go-live, or "measure it later" will never happen.

---

### 4. The soft skill: replace "it works" with a claim you can defend

In a Ministry of Testing talk, [*The Rapid Software Testing Guide to What You Meant to Say*](https://www.ministryoftesting.com/testbash-talks/the-rapid-software-testing-guide-to-what-you-meant-to-say-michael-bolton), Michael Bolton names "It works!" as one of the phrases testers say without meaning it. The phrase can mislead clients *and* the tester who says it. Here, "it works" makes a product owner believe something false: that small payments will now be frictionless.

A more precise status update to the PO looks like this:

> "Our checkout now **requests** low-value and TRA exemptions, and in the sandbox it correctly handles both an issuer approval and an issuer 'authentication required' response by switching to 3DS without creating duplicate orders. What we **can't** know before launch is how often real issuers will accept the request. Each issuer tracks the cardholder's history with other merchants, so some €10 payments will still be challenged and that's expected behaviour. Two decisions are yours: (1) approved exemptions move fraud liability back to us. Is the conversion gain worth that for every category, including gift cards? (2) Can we agree on the acceptance and step-up dashboard as a launch criterion, so we judge this with real numbers in two weeks?"

This update states what was tested and what was observed. It names the boundary of the evidence, explains why that boundary exists, and turns a hidden trade-off into a decision with an owner. You are not blocking the release. You are making sure the PO isn't guessing (Day 17's theme, applied).

**When a developer pushes back** ("the PSP handles all that, it's not our problem"), don't argue about whose responsibility it is. Ask for an observation instead: "Can we look at one real soft-decline response from the PSP in staging and trace what our code does with it?" Either it shows you're right, or you learn something. Both outcomes beat a debate.

---

### 5. Practical challenge (45 minutes)

Pick any flow you test that depends on a **third party's verdict**: card issuer, fraud engine, KYC provider, sports-data feed confirming a result, ad exchange, grid operator. Then:

1. **Map who decides.** List each decision in the flow and mark whether *we* make it or *they* do. For each "they", write what information they have that we don't (like the issuer's cross-merchant counter).
2. **Run SFDIPOT on one "they" decision.** Write at least one test idea per guideword. At least two must involve **Time**.
3. **Split your evidence.** Make two columns: "Our checks can show…" and "Only production can show…". For every item in the second column, name the signal, the query or dashboard, and who looks at it in week one.
4. **Rewrite your last "it works" or "done" status** as the four-part update above: tested and observed, what we can't know and why, the trade-off, the decision owner.

**Payments stretch:** Design a test for this scenario. A subscription card was saved with a frictionless 3DS result. The renewal 30 days later is an MIT, and the issuer returns code 65. What *should* happen, given the customer isn't in session? What does your system actually do? Who gets told: the customer, support, finance? If you can't answer the last question, you've found the bug.

---

### Sources

- James Bach, Satisfice: [Heuristic Test Strategy Model v6.3](https://www.satisfice.com/?p=13)
- Michael Bolton, Ministry of Testing: [The Rapid Software Testing Guide to What You Meant to Say](https://www.ministryoftesting.com/testbash-talks/the-rapid-software-testing-guide-to-what-you-meant-to-say-michael-bolton)
- European Banking Authority: [Q&A 2018_4040, converting EUR SCA thresholds into other currencies](https://www.eba.europa.eu/single-rule-book-qa/qna/view/publicId/2018_4040)
- Osborne Clarke: [PSD2: The EBA's standards on strong customer authentication](https://www.osborneclarke.com/insights/psd2-the-ebas-standards-on-strong-customer-authentication-where-are-we-now)
- Stripe Docs: [Strong Customer Authentication exemptions](https://docs.stripe.com/payments/3d-secure/strong-customer-authentication-exemptions) (vendor documentation; used for issuer discretion, liability shift and TRA thresholds)
- Checkout.com: [How and when to retry SCA-related soft-declined transactions](https://www.checkout.com/resources/blog/how-and-when-to-retry-sca-related-soft-declined-transactions) and [Automated SCA soft-decline retry docs](https://www.checkout.com/docs/risk-management/3d-secure/automated-sca-soft-decline-retry) (vendor sources; used only for response-code handling, not product claims)
