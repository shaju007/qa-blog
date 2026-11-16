# QA Thinking — Day 44

## An Amount Is Not a Number: Domain-Testing Multi-Currency Payments When Your Two Payment Providers Disagree About Decimals

### The situation

Your Hamburg SaaS platform has always processed payments through one PSP (payment service provider). This quarter the team adds a second one for failover and better local acceptance in Asia-Pacific. A routing layer now decides, per payment, which PSP gets it. The developer says: "The amount logic didn't change. We already send amounts in minor units, so it's just a different HTTP client."

That sentence describes a risk. Today's lesson is about seeing it, modelling it and testing it with **domain testing**, Cem Kaner's generalized form of equivalence-class and boundary analysis. You'll also learn to explain the risk to a product owner who hears "decimals" and assumes it was handled long ago.

---

### Domain primer: what "minor units" really means

Most payment APIs don't accept `10.99`. They want an integer in the currency's **minor unit**, so 10.99 EUR is sent as `1099`. Stripe's documentation states that all API requests expect `amount` in the currency's minor unit: `1000` charges 10 USD, and `10` charges 10 JPY, because JPY has no minor unit.

To convert, you need each currency's **exponent**, the number of decimal places. **ISO 4217** is the standard most teams treat as the source. Its list is maintained by SIX on behalf of ISO and records each currency's minor-unit relationship. Most currencies are 1/100, and some, such as the Bahraini dinar, are 1/1000.

The domain rule that catches teams out is this: **ISO 4217 is not the oracle for what a PSP expects.** Each PSP publishes its own table, and the tables disagree.

- **Adyen's currency-codes page** says that for CLP, CVE, IDR and ISK "the ISO 4217 standard has a different number of decimals than shown in our currency codes table", and that "when submitting amounts in minor units, the decimals in the table on this page are leading." Adyen lists IDR at 0 decimals and ISK and CLP at 2.
- **Stripe** treats IDR as two-decimal. Its non-card maximum is "9,999,999,999.99 IDR (`999999999999`)" and its minimum charge is 0.50 IDR. For ISK, Stripe says the króna "transitioned to a zero-decimal currency, but backward compatibility requires you to represent it as a two-decimal value, where the decimal amount is always `00`". UGX gets the same treatment, so 5 ISK or 5 UGX is sent as `500`, and fractions are rejected.
- Stripe also has currencies whose rules change by **operation**. HUF and TWD can be charged with two decimals, but Stripe treats them as zero-decimal **for payouts**, so manual payout amounts must be divisible by 100. A HUF 10.45 balance can't be paid out in full.

Now take one business fact: *the customer owes 10,000 IDR*.

| System | Exponent it expects | Correct `amount` |
|---|---|---|
| Your catalog / ledger | whatever you configured | `10000.00` or `10000`? |
| Stripe | 2 | `1000000` |
| Adyen | 0 | `10000` |

If the routing layer uses one shared `toMinorUnits()` with one exponent table, one of these PSPs gets the wrong number. Send `1000000` to Adyen and you **charge the customer 100× too much**. Send `10000` to Stripe and you charge 100 IDR. That's a 100× undercharge, and it may fall below the minimum and be declined, which then shows up as a "payment failure spike in Indonesia" rather than as a currency bug.

Neither PSP is wrong, and neither is your ISO table. The failure is in the mapping between them, which is the kind of thing a test suite designed around "the amount logic" won't see.

---

### The testing idea: model the variable you can't see

Kaner, Padmanabhan and Hoffman's *Domain Testing Workbook* uses a term borrowed from financial analysis: the **notional variable**. In Kaner's description, it "reflects the tester's 'notion' of what is in the code", and "the model won't be perfect. That exact variable is probably not in the code." Kaner also describes exploratory testing as a way of "refining the modeling of the notional variables."

That fits here. The code has an `amount: Long` field, but your notional variable is richer:

> **ChargeableAmount** = (value, currency, *exponent as understood by system X*, operation, rounding history)

Once you model it that way, the important dimensions show up: **which system's exponent**, and **which operation** (charge, partial refund, payout, report). The integer field hides all of that.

Kaner and Padmanabhan's earlier domain-testing papers define equivalence in a **risk-based** way: two tests are equivalent *relative to a potential error*. So don't partition currencies by geography or popularity. Partition them by the error you're hunting.

**Risk: "the exponent used in conversion doesn't match what the receiving system expects"**

| Class | Examples | Why it's a separate class |
|---|---|---|
| ISO, Stripe and Adyen all agree on 2 | EUR, USD, GBP | Baseline. One representative is enough for *this* risk. |
| All agree on 0 | JPY | Catches a hard-coded ×100 |
| All agree on 3 | KWD, BHD (verify per PSP) | Catches ×100 assumptions and 3-decimal rounding |
| **PSPs disagree with each other** | IDR | Catches a single shared table across PSPs |
| **PSP disagrees with ISO** | ISK, CLP, CVE (Adyen) | Catches an "ISO is the truth" config |
| Legacy representation (value must end in `00`) | ISK, UGX at Stripe | Catches correct-exponent-but-invalid-value cases |
| Exponent changes by operation | HUF, TWD payouts at Stripe | Catches "charge works, payout fails" |

That's seven classes. A suite that tests EUR, USD and GBP has run three tests and covered **one** of them.

Swap the risk and the partition changes. For "minimum charge after conversion", Stripe says charges converted into the settlement currency "must meet the equivalent minimum of the settlement currency". Then JPY and EUR may be in the same class, and what matters is how close the converted value sits to the settlement currency's minimum. Re-partition for each risk. Don't reuse one partition for every risk.

---

### Boundaries worth testing

Once you have classes, look for the edges each currency and PSP actually has:

1. **Minimum charge.** Test at, just below and just above the minimum in the *settlement* currency after conversion, not only in the presentment currency. A 50 JPY charge settled in EUR is a different test from a 50 JPY charge settled in JPY.
2. **Maximum digits.** Stripe documents limits by digit count. Card payments go up to 12 digits, Cartes Bancaires to 10, American Express "in most currencies" to 9, and non-card methods to 8 except IDR, COP and INR. With a two-decimal IDR representation, a large B2B invoice uses up digits quickly. Test a value that fits Adyen's 0-decimal form but overflows once multiplied for Stripe.
3. **Divisibility.** ISK and UGX at Stripe must end in `00`. What does your system do with an ISK price after a 15% discount, a proration or tax? Stripe documents its own behaviour for UGX invoices: it rounds to the nearest amount divisible by 100 and credits or debits the difference to the customer balance. Does your **own** checkout do something equivalent, or does the request fail at payment time?
4. **Partial refunds.** Refund one of three items on a 3-decimal KWD order that had an order-level discount. Do the item refunds add up to the captured amount? Can rounding leave a last refund of 1 fils more than remains capturable?
5. **Payout remainders.** HUF 10.45 can't be paid out in full manually. Where does the 0.45 go, and does the marketplace seller's balance screen say so?

---

### Follow the amount, not the request

The conversion to minor units doesn't happen once. Every boundary between systems either applies an exponent or reverses one:

**Price in catalog → cart & tax → PSP request (×10ⁿ for PSP A or B) → PSP webhook (÷10ⁿ) → ledger → refund request (×10ⁿ again) → settlement report (÷10ⁿ) → payout → accounting export**

The outbound request gets most of the testing attention, but the **inbound** direction is just as risky. If the IDR webhook from Adyen says `10000` and your handler divides by 100 because "all webhooks are in cents", your ledger records 100 IDR as received. Nobody sees a decline. Reconciliation finds it three weeks later, if at all.

A practical heuristic: **for every currency class, push one order through the whole chain and assert the same business amount at every hop.** Use one end-to-end trace per class, not hundreds of request-level checks.

---

### What to automate (and what not to)

- **A table-drift check.** Keep your per-PSP exponent configuration as data. Write a scheduled check that compares it to each PSP's published currency table (or its API, if one exists) and fails on any difference. This is cheap and catches the case where a PSP changes a currency.
- **Round-trip properties per PSP.** For random values in each class: `fromMinor_PSP(toMinor_PSP(x)) == x`, plus "every request amount for ISK at Stripe is divisible by 100". Property-based tests suit this, because the invariant is clear and the input space is large.
- **Don't** automate a hand-written list of 135 currencies with expected values copied from a doc. That just copies the table, and when the doc changes your oracle silently goes out of date.
- **Keep for exploration:** what customers see. The amount on the checkout page, on the 3-D Secure challenge screen, on the bank statement descriptor and on the invoice PDF should all describe the same money. Explore that with real sandbox payments in one zero-decimal and one disputed-exponent currency.

---

### The soft-skills half: making "decimals" sound like money

If you say "IDR exponents differ between PSPs" in refinement, you'll get nods and no action. You haven't described a consequence yet. Three moves help.

**1. Ask a question that has an owner, not one that has an answer.**
Weak: "Did we handle zero-decimal currencies?" (Answer: "Yes.")
Strong: "When Adyen's table and ISO disagree, which one does our routing layer use, and who gets told if Adyen changes it?" This puts the oracle problem on the table. It often shows that the answer is "a constant someone copied in 2021".

**2. Bring a three-column table, not an opinion.**
Put the IDR row from above in the ticket: business amount, what PSP A needs, what PSP B needs, and what our shared helper produces. Developers argue with assertions but rarely with their own function's output next to the vendor's documentation. That's evidence-based feedback: you're showing a mismatch, not passing judgement on someone's code.

**3. State the risk in business terms, with its direction.**
Overcharging and undercharging are different risks with different owners:
> "If IDR payments routed to Adyen use our current conversion, Indonesian customers are charged 100× the price. That means chargebacks, refunds and a possible scheme or regulator complaint. If they're routed to Stripe with Adyen's exponent, we collect 1% of the price, or get declined below the minimum. Finance owns the first. Growth will see the second as a conversion drop. Routing goes live to IDR on [date]. I'd like either per-PSP exponent tables or IDR excluded from the router until they exist."

That paragraph gives a consequence, an owner, a deadline and a choice between two concrete options. The product owner can decide without knowing what an exponent is.

---

### Practical challenge (45–60 minutes)

Pick a money flow you test at work: checkout, subscription invoice, marketplace payout or refund. If you have none, use the two-PSP scenario above.

1. **Write the notional variable.** List every dimension of "the amount" your system carries implicitly: currency, exponent per downstream system, operation, rounding steps applied so far, settlement currency.
2. **Choose two risks** (for example "exponent mismatch" and "rounding residue after partial refunds"). Build a separate partition table for each, with risk-based classes, one representative per class, and the boundary values.
3. **Check your oracle.** For three currencies in your system, look up the exponent in ISO 4217 and in *each* PSP's current documentation. Record every disagreement and where in your code that decision is made.
4. **Trace one order** in your riskiest class through every hop (request, webhook, ledger, refund, report). Note at which hop the amount could change without anyone noticing.
5. **Write the five-sentence risk statement** in the format above, as if routing goes live next week.

**Stretch:** Find out whether your team has *ever* been told about a PSP changing a currency's decimals or limits. If nobody knows how that information would reach you, that's a test finding about your observability and your vendor process.

---

### Key takeaways

- An amount in minor units means nothing without knowing **which system's exponent** it uses. ISO 4217 is a reference. Each PSP's own table is the oracle for that PSP.
- Partition currencies **by the error you're hunting**, not by geography or traffic. Three popular currencies can cover only one risk class.
- Exponents are applied in both directions. **Webhooks, refunds, payouts and reports** carry the same risk as the charge request, and they fail silently.
- When you raise it, show the mismatch in a table, name the **direction** of the money error, and give the decision-maker two concrete options.

---

### Sources

- Cem Kaner, ["New Book: The Domain Testing Workbook"](https://kaner.com/?p=363) on kaner.com: notional variables, the 18-step domain-analysis schema, and exploratory testing as refining the model.
- Cem Kaner & Sowmya Padmanabhan, [domain testing paper (PDF)](https://kaner.com/pdfs/kanerPadmanabhanDomainTesting.pdf) and [CSEET domain testing slides (PDF)](https://kaner.com/pdfs/domain_testing_cseet.pdf): risk-based equivalence and boundary tables.
- Stripe Docs, ["Supported currencies"](https://docs.stripe.com/currencies?locale=en-GB): minor units; ISK, UGX, HUF and TWD special cases; minimum and maximum charge amounts.
- Adyen Docs, ["Currency codes"](https://docs.adyen.com/development-resources/currency-codes): per-currency decimals and the note that Adyen's table is "leading" where it differs from ISO 4217 (CLP, CVE, IDR, ISK).
- ISO, ["ISO 4217 Currency codes"](https://committee.iso.org/iso-4217-currency-codes.html): the standard and its maintenance by SIX.
