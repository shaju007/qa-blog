# QA Thinking — Day 34

## "Works as Designed" Is Not the End of the Conversation: Testing Black Week Price Reductions When Every Team Is Technically Right

Today is 26 October. In 2026, Black Friday falls on 27 November, and many German shops start "Black Week" on Monday 23 November. That date matters for testers right now. Under EU price-indication rules, a price-reduction claim is measured against the lowest price the shop charged in the 30 days before the reduction. For a reduction that starts on 23 November, those 30 days begin on 24 October. Any price you set this week is already part of the baseline for the Black Week claim.

Today's lesson combines e-commerce domain knowledge with a hard soft skill: what to do when you find something worrying and every person you show it to is correct about their own part.

---

### The conversation you will probably have

You are testing the Black Week campaign for a Hamburg-based electronics and lifestyle shop. You notice this on a product page:

> ~~€99.99~~ **€59.99** — **−40%**

You check the price history. From 9 to 12 November, during a Singles' Day promotion, the same headphones were sold at **€69.99**.

You raise it with the developer: *"The strikethrough uses the `compare_at_price` field. Merchandising sets that field. The code does what the ticket says. Works as designed."*

You raise it with the product owner: *"Merchandising owns prices. It's not a bug in our feature."*

Both of them are right. The code matches the spec, and the PO doesn't own prices. But the shop is about to tell thousands of customers they are saving 40%, when the saving against the legally relevant reference price is about 14%.

A weak tester argues about whether this is "a bug" and loses. A strong tester sees that nobody disagrees about the facts. The disagreement is about which rule applies and who gets to decide, so the tester moves the conversation to that question.

---

### The core idea: maybe a bug, definitely an issue

Michael Bolton separates bugs from issues in ["You've Got Issues"](https://developsense.com/blog/2011/01/youve-got-issues) (DevelopSense). A **bug** is anything about the product that threatens its value to people who matter. An **issue** is anything that threatens the value of the project, and especially the testing: anything that gives problems "more time or more opportunities to hide." One of his examples is behaviour the spec is silent or ambiguous about. His verdict is that maybe you have a bug, but you certainly have an issue. He also says that if you're unsure something is a bug, you can report it as an issue.

This is very useful in a "works as designed" standoff. You stop trying to prove the developer wrong. Instead you report something nobody can reasonably dispute:

> "A rule that carries legal and reputational risk is currently decided by a free-text field. I can't find evidence that anyone who owns that risk has seen this case."

You haven't accused anyone, and you don't need a spec to back you up. You've made a gap in decision-making visible, and that is squarely part of a tester's job.

---

### Domain primer: how promotions actually work in e-commerce

Promotion engines look simple from the shop front. Behind them is a lot of business logic owned by different teams, and that ownership split is where the risk sits.

**Why promotions exist.** A discount trades margin for something else: conversion, clearing stock, winning customers, or average order value (that's the reason for "€15 off orders over €120"). Merchandising sets prices, marketing designs campaigns, finance cares about margin and VAT, legal cares about how prices are presented, and engineering builds the engine. A promotion bug usually shows up where two of these teams hand over to each other.

**Vocabulary you need:**

| Term | What it means | Why testers care |
|---|---|---|
| **List / regular price** | The normal selling price | Often isn't stored as history, only as the current value |
| **Compare-at / strikethrough price** | The crossed-out "was" price on the page | Often a manually entered field with no validation |
| **Prior price (Article 6a)** | The *lowest* price the trader charged in the ≥30 days before the reduction | The legally relevant reference in the EU. It's calculated, not entered by hand |
| **Product / order / shipping discount** | The level a discount applies to: line item, cart subtotal, or delivery | The order they're applied in changes the result |
| **Combinability / exclusivity** | Which discounts may stack | Usually a setting on each discount, so combinations multiply fast |
| **Threshold** | "Over €120" conditions | Must be re-checked after returns |
| **Allocation (proration)** | Splitting an order-level discount across the lines | Determines refunds and the VAT split across tax rates |
| **Progressive reduction** | A discount that deepens over the campaign | Has its own reference-price rule (see below) |
| **Individual / personalised offer** | A code meant for one customer | Exempt from the German rule. Is it still individual once it leaks onto a voucher site? |
| **Gift card vs coupon** | A gift card is a *payment method*. A coupon is a *price reduction* | Mixing them up breaks tax and refund paths |

**Engines differ, and the documentation describes the engine, not the business.** Shopify's [combining-discounts documentation](https://help.shopify.com/manual/discounts/discount-combinations) says product discounts are applied first, then order discounts to the reduced subtotal, then shipping. Multiple percentage order discounts are each calculated on the original subtotal, and a percentage order discount is applied before a fixed-amount one. That tells you what the platform will do. It doesn't tell you whether marketing designed the campaign with that behaviour in mind. Vendor docs are a good oracle for "is the engine behaving as documented?" and no help at all for "is this what we meant?"

---

### The rule behind the strikethrough

Here is the chain, from primary sources:

1. **Article 6a of the Price Indication Directive 98/6/EC** (added by the Omnibus Directive 2019/2161) says any announcement of a price reduction must show the prior price, defined as the lowest price the trader applied in a period of at least 30 days before the reduction. Member states may set different rules for goods that spoil quickly, for products on the market less than 30 days, and for progressively increasing reductions. ([EUR-Lex consolidated text](https://eur-lex.europa.eu/eli/dir/1998/6/2022-05-28/eng))
2. **CJEU, Case C-330/23 (Aldi Süd), September 2024.** Aldi's brochure showed bananas at €1.29 next to a struck-through €1.69, while the lowest price in the previous 30 days was €1.29. The Court held that the reduction itself, whether shown as a percentage or as a claim that the price is advantageous, must be based on the 30-day lowest price. Showing that price somewhere in the ad is not enough. ([Court press release](https://curia.europa.eu/jcms/upload/docs/application/pdf/2024-09/cp240152en.pdf); [Lewis Silkin analysis](https://www.lewissilkin.com/insights/2024/09/30/more-on-pricing-and-discount-claims-cjeu-clarifies-basis-for-calculating-reducti-102jkhq))
3. **Germany, § 11 PAngV** puts this into national law. It has a carve-out for **uninterrupted** stepwise reductions: the reference can stay the lowest price before the first step. It also exempts **individual** price reductions and reductions on goods at imminent risk of spoiling, if that is made transparent. ([§ 11 PAngV](https://www.gesetze-im-internet.de/pangv_2022/__11.html))

For the headphones: €59.99 against a prior price of €69.99 is a reduction of about **14%**, not 40%.

You are not the shop's lawyer, and you shouldn't act like one. Your job is to turn the legal text into **testable conditions** and **questions only an owner can answer**:

- **Testable:** Does the system store price history per SKU? Does it calculate the 30-day minimum? Does the displayed percentage use that minimum?
- **Owner questions:** Is an app-only price a "price applied by the trader"? Is a newsletter code still "individual" after it's been posted on a coupon site? We sell in Austria and the Netherlands too. Did either country use the member-state options differently?

---

### The disagreement playbook: find the layer where people actually disagree

Most "is it a bug?" arguments drag on because people are arguing on different levels. Split the problem into four layers:

| Layer | Question | In this case |
|---|---|---|
| **Observation** | What did we see? | Nobody disputes it: €99.99 struck through, −40%, and €69.99 in the price log |
| **Rule** | Which oracle applies? | The developer uses the ticket. You're pointing at the law and the CJEU ruling. *Both are valid oracles, and they conflict.* |
| **Owner** | Who has the authority to decide? | Not the developer, and not the PO alone. Probably compliance/legal together with merchandising |
| **Consequence** | What happens if we're wrong, and who pays? | Consumer-association warning letters (in Germany, *Abmahnungen*), cease-and-desist demands, and a "fake Black Friday discounts" story in the press |

"Works as designed" is true at the Rule layer. "Not our bug" is a statement at the Owner layer. Neither one answers anything at the Consequence layer. So stop arguing about the Rule and say:

> "I agree the code matches the ticket. I'm not asking you to change anything yet. I think the ticket never had to deal with the 30-day rule, and the people who own that risk haven't seen this case. Can we work out together who decides, before 23 November?"

The other person loses nothing by agreeing, which is what makes this influence without authority rather than escalation.

### Turn the bug report into a decision request

A bug report asks someone to fix something. A decision request asks someone to choose. In this situation the second gets a better response:

> **Title:** Decision needed by 13 Nov: should Black Week strikethrough prices be checked against the 30-day lowest price?
>
> **Observation:** 412 of 3,180 Black Week SKUs show a "−X%" claim larger than the reduction against their lowest price since 24 Oct (query + CSV attached). Example: headphones SKU 88231 claims −40%, about −14% against the Singles' Day price of €69.99.
>
> **Why it might matter:** CJEU C-330/23 (Sept 2024) and § 11 PAngV base reduction claims on the 30-day lowest price.
>
> **What I don't know:** whether app-only and member prices count, and how our AT/NL storefronts are affected.
>
> **Options:**
> A) Accept as is (owner signs off on the risk).
> B) Fix the 412 SKUs manually before launch (merchandising, about 1 day).
> C) Admin warning when compare-at > 30-day low (engineering, small).
> D) Calculate the strikethrough from price history (engineering, larger; needs reliable history).
>
> **My recommendation:** B now, C before launch, D on the backlog.

Note the evidence. You're not saying "this might be illegal." You're saying "here is the query, here are 412 SKUs, here is the gap for each one." Running that query is cheap testing that produces a lot of value, and it's usually what changes the PO's mind. (The figures here are illustrative. In your own shop, run the query before you make any claim.)

Note also the **deadline**. Prices set from 24 October onward fall inside the Black Week window, so the decision has a real expiry date. Putting it in the title is an honest way to create urgency.

---

### Test ideas that come from the domain, not from the ticket

**Reference-price logic**
- A SKU with a short promotion inside the window → the claim must be based on the promo price.
- A SKU whose only promo ended **31 days** before the reduction → outside the window. Check the boundary in both directions.
- **Variant-level history:** black headphones were on sale, white ones weren't. Is history stored per SKU or per parent product?
- A **progressive reduction** (Mon €79.99 → Wed €69.99 → Fri €59.99): the reference should stay the pre-campaign lowest price. Now have a nightly feed import reset the price to €99.99 for six hours on Thursday. Is the run interrupted? Who decides that, and does the system even record the blip?
- A product **launched 10 days ago**: what does the system do with less than 30 days of history?
- **No history stored at all:** this is the most important issue. If the shop doesn't keep price history, it can neither comply nor be tested. That's Bolton's issue category in its plainest form.

**Stacking, allocation and returns**
- An order-level discount on a basket with **mixed VAT rates** (19% headphones + 7% book). Allocation decides how much of the discount reduces each tax base. Check the method with finance and confirm the invoice matches it.
- **Rounding** when €10 is split across three lines: which line gets the extra cent, and is it the same on invoice, refund and export?
- A **partial return that drops the basket below the threshold.** Does the refund keep the proportional share of the discount, or claw back the whole discount? Both are legitimate policies, but the T&Cs, the customer-service screen and the credit note must all agree.
- A **gift card plus a coupon** on the same order, then a return. Does the gift card portion go back to the card, and does the coupon get "reused"?
- A **personal code** applied by 9,000 different accounts in one hour. Is it still an individual offer, or has it effectively become public?

---

### Practical challenge (45 minutes)

**Scenario data.** A winter jacket, standard VAT (19%).

| Date | Price |
|---|---|
| until 29 Oct | €149 |
| 30 Oct – 2 Nov ("Autumn Weekend") | €119 |
| 3 Nov – 22 Nov | €149 |
| 23 Nov (Black Week starts) | €99, shown as ~~€149~~ −34% |
| 26 Nov | €89 |
| 27 Nov | €79 |
| night of 25 Nov | feed import sets €149 for 6 hours, then back to €99 |

**Tasks:**

1. Work out the prior price for the 23 November reduction, and the reduction percentage measured against it.
2. Decide whether the 27 November claim can use the same reference. Write down the **one question** that must go to an owner instead of being answered by you.
3. A customer buys the jacket at €99 plus a €30 book (7% VAT), using "€15 off orders over €120." Calculate the proportional discount allocation per line. Then calculate the book's refund under (A) proportional retention and (B) threshold claw-back.
4. Write a decision request of at most eight lines, using the four layers (Observation, Rule, Owner, Consequence) and offering at least three options with costs.
5. **Soft-skill rehearsal:** write the opening sentence you'd say to a developer who has just told you "works as designed." It should agree with something true before it asks for anything.

<details>
<parameter name="summary">Check your numbers</parameter>

1. Window 24 Oct – 22 Nov. Lowest price **€119**. Reduction from €119 to €99 is about **16.8%**, so the "−34%" claim (measured against €149) is the Aldi pattern.
2. The reference can stay €119 only if the run of reductions was **uninterrupted** (§ 11(2) PAngV). Owner question: *"Does a six-hour feed glitch back to €149 count as an interruption, and do we treat it as a defect to be corrected in the price log?"* Notice that your test result now depends on whether the price log records six-hour changes at all.
3. Basket €129. Jacket share 15 × 99/129 ≈ **€11.51**, book share ≈ **€3.49** (total €15.00). Book refund: (A) €30 − €3.49 = **€26.51**; (B) the remaining €99 no longer meets the threshold, so €30 − €15 = **€15.00**. If the T&Cs and the credit note can't tell you which policy applies, that is your finding.

</details>

---

### What to take into work tomorrow

- When someone says "works as designed," ask **whose** design, and whether the person who carries the consequence ever saw it.
- Find the layer where people actually disagree. Facts are rarely disputed. Usually it's the oracle or the ownership.
- If you can't prove it's a bug, report it as an issue. Making gaps in decisions visible is your job.
- Bring a query, a count and a deadline. Opinions start arguments; evidence gets decisions made.
- Domain knowledge is what turns an ordinary "UI shows strikethrough" check into a question about the 30-day window, variant-level history and interrupted reductions.

---

### Sources

- Michael Bolton, ["You've Got Issues"](https://developsense.com/blog/2011/01/youve-got-issues), DevelopSense
- Court of Justice of the EU, [Press release on Case C-330/23, Aldi Süd](https://curia.europa.eu/jcms/upload/docs/application/pdf/2024-09/cp240152en.pdf) (September 2024)
- Lewis Silkin, ["More on pricing and discount claims: CJEU clarifies basis for calculating reductions"](https://www.lewissilkin.com/insights/2024/09/30/more-on-pricing-and-discount-claims-cjeu-clarifies-basis-for-calculating-reducti-102jkhq)
- [Directive 98/6/EC, consolidated text incl. Article 6a](https://eur-lex.europa.eu/eli/dir/1998/6/2022-05-28/eng), EUR-Lex
- [§ 11 Preisangabenverordnung (PAngV)](https://www.gesetze-im-internet.de/pangv_2022/__11.html), gesetze-im-internet.de
- Shopify Help Center, [Combining discounts](https://help.shopify.com/manual/discounts/discount-combinations) (used as an example of documented engine behaviour, not as an authority on business intent)
