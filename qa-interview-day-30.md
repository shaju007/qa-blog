# QA Interview Q&A — Day 30

## Question: "It's straight OCPP — if we follow the spec, the bill is correct." You've just moved from e-commerce testing to a public EV-charging network in Germany. What do you test first?

**The scenario:** The story in this sprint reads: *"Invoice charging sessions from the charger's meter readings: energy = `meterStop − meterStart`, multiplied by the tariff's price per kWh. Applies to app and ad hoc card sessions."* Your fleet uses chargers from several manufacturers, all speaking OCPP 1.6J. The developer says: "It's straight OCPP 1.6. Our charger simulator tests are green. Follow the spec and we're done." You have never stood next to a charger. Refinement is on Tuesday.

---

## Answer

### What the interviewer is really testing

They don't expect you to know OCPP. They want to see three things:

1. **Can you learn a new domain quickly and in the right order?** Start where money, law and physical hardware meet the software.
2. **Do you know that a spec is one oracle among several?** It isn't the definition of correct.
3. **Can you raise regulatory and billing risk without pretending to be the compliance officer?**

A strong answer starts like this: *"The developer is partly right. The OCPP spec tells us what messages a charger sends. It doesn't tell us whether the invoice is fair, whether it's lawful in Germany, or what real chargers in our fleet actually send. I'd use the spec as one input, and I'd spend my first week finding the others."*

### Why "follow the spec" isn't enough

Michael Bolton describes an oracle as a way of recognising a problem. Oracles are fallible and depend on context. A spec can be ambiguous, incomplete or contradictory, and when the product and the spec disagree, the fault might be in either one ([DevelopSense](https://developsense.com/?p=1237)). Here the spec is a weak oracle for the question that matters, which is whether the customer was billed correctly, for three reasons:

- **OCPP covers the protocol, not the business outcome.** `StopTransaction` must carry `transactionId`, `timestamp` and `meterStop`. `idTag`, `reason` and `transactionData` are optional ([OCPP 1.6 message reference](https://ocpp.hexdocs.pm/ocpp/v1_6/message/stop_transaction.html)). Nothing in that message says which tariff applies or what goes on the invoice.
- **German calibration law (Eichrecht) adds an oracle the spec doesn't contain.** Public charging is expected to bill from a calibrated meter. Drivers can check the digitally signed meter values against their invoice using transparency software maintained by the S.A.F.E. association, which uses the open OCMF data format ([electrive on S.A.F.E.](https://www.electrive.net/2019/05/12/eichrecht-initiative-s-a-f-e-organisiert-sich-als-verein/)). If our formula uses one number and the signed record shows another, a customer can prove we're wrong.
- **The EU's charging regulation (AFIR) adds another one.** For recharging points of 50 kW or more deployed from 13 April 2024, the ad hoc price has to be based on price per kWh, and it has to be shown at the station ([European Commission AFIR Q&A](https://transport.ec.europa.eu/transport-themes/clean-transport/alternative-fuels-sustainable-mobility-europe/alternative-fuels-infrastructure/questions-and-answers-regulation-deployment-alternative-fuels-infrastructure-eu-20231804_en)). So "the price on the screen equals the price on the invoice" is a regulatory check, not just a UX nicety.

The simulator being green tells you the backend handles messages that match the spec. It tells you nothing about real chargers, offline periods, retries or the law.

### Week one: how I'd learn the domain

I'd use James Bach's Heuristic Test Strategy Model as a checklist so I don't only test what's easy to see. Its project-element and quality-criteria prompts push me to ask *who knows things* and *what counts as a problem here* ([Satisfice HTSM](https://www.satisfice.com/download/heuristic-test-strategy-model)). In practice:

- **Charge a car myself** on two different charger models with the app, then with a payment card. Compare what the display, the app, the receipt and the invoice say about kWh, price and time.
- **Read a day of real OCPP logs** from production, anonymised, for the three most common charger models. Simulators follow the spec. Real firmware has quirks.
- **Ask support for the top 20 billing complaints** from the past six months. Customers have already found the risks I'm about to guess at.
- **Find the compliance owner.** Usually that's someone in operations or legal who owns Eichrecht conformity. Ask: "What exactly must match the signed value, and who has decided that?"
- **Talk to a field technician.** Ask what happens when a charger loses mobile signal, reboots or gets a meter replaced.

### What carries over from e-commerce, and what doesn't

**Carries over:** idempotency, double charges, rounding, the price shown versus the price charged, refunds and disputes.

**Doesn't carry over:** in a shop the customer *chooses* what they buy. Here the quantity is *measured* by a device that may be offline. The session ends asynchronously and might be reported hours later. The measurement itself is regulated.

### The risks I'd put in front of the team

| Risk | Why it's real | How I'd test it |
|---|---|---|
| **Duplicate invoice on retried `StopTransaction`** | If the backend doesn't reply with `StopTransaction.conf`, the charger sends the same message again ([Ampcontrol OCPP guide](https://www.ampcontrol.io/ocpp-guide/how-to-stop-a-charging-session-with-stoptransaction)). | Process the stop, then drop or delay the reply. Replay the message. Expect exactly one invoice. |
| **Offline sessions arriving late** | With `AllowOfflineTxForUnknownId` set to true, a charger can accept unknown or cached ID tags while disconnected ([Enelion white paper](https://service-support-enelion.happyfox.com/kb/article/72-white-paper-charging-using-an-ocpp-connected-charger-while-disconnected-from-the-server)). Start and stop then arrive together after reconnection. | Session reported 6 hours late. Tariff changed in between. Card blocked in between. Charger clock wrong. Which price and which customer is correct? |
| **Session never closes** | Power loss or a reboot can mean the stop arrives with `PowerLoss`/`Reboot` as the reason, or very late, or never. | Does an open session keep building occupancy fees? Is there a timeout and a manual-review path? |
| **Unit mix-ups** | `meterStart`/`meterStop` are in Wh. Sampled meter values carry their own unit, which can be kWh. | Use a charger profile that reports kWh in `MeterValues`. Look for a 1,000× error, or a mismatch between the two numbers. |
| **Meter reset or replacement** | After a hardware swap, `meterStop` can be lower than `meterStart`. | Expect the session to be flagged for review, not a negative invoice or a silent zero. |
| **Invoice ≠ signed value** | The customer can verify the signed record independently. | For every charger model, the kWh on the invoice must equal the kWh in the signed OCMF record, with no rounding before comparison. Check that the signed data actually reaches the customer. |
| **Displayed price ≠ billed price** | AFIR requires the ad hoc price to be shown at the station. | Ad hoc card session at a ≥50 kW charger. Change the price during the session. Compare the display, the receipt and the invoice. |

### When the oracles disagree

This is where domain judgment shows. A vendor's Eichrecht guide says time-based fees aren't permitted ([AMPECO](https://www.ampeco.com/de/blog/eichrecht-das-deutsche-kalibrierungsgesetz-dos-und-donts/)). The Commission's AFIR Q&A says a per-minute occupancy fee *is* allowed to discourage long occupancy, as long as it's proportionate. It also notes that charging that fee from the start of the session looks problematic ([EC Q&A](https://transport.ec.europa.eu/transport-themes/clean-transport/alternative-fuels-sustainable-mobility-europe/alternative-fuels-infrastructure/questions-and-answers-regulation-deployment-alternative-fuels-infrastructure-eu-20231804_en)).

Both can be true in some reading. A secondary source may simplify, and the details may depend on how time is measured and shown on the invoice. **It isn't my job to settle that in a test case. It is my job to notice it and route it to the person who owns the decision.** If our tariff model includes an idle fee, that question goes in the ticket and gets a named owner before release.

### What I'd say in Tuesday's refinement

> "I think the formula is right for the normal case, and the simulator tests are worth keeping. I see three gaps that aren't about the spec. First, retries and offline sessions: chargers resend stops and report late sessions, so I'd like a check that we never invoice one session twice, and a decision on which tariff applies to a session reported hours late. Second, Eichrecht: customers can check the signed meter value against our invoice, so I'd like confirmation from [compliance owner] about exactly what has to match, and a test against the signed data for each charger model. Third, the idle fee: I've found sources that seem to disagree about time-based fees. I'm not qualified to decide that, so can we get a ruling before we turn it on?
>
> Could someone give me a production log export for our three most common models? I'd like to check how often stops arrive more than an hour late before we size this."

This doesn't block anything or overrule anyone. It names gaps, asks for evidence and puts decisions with the people who own them.

### Evidence that would change my mind, in either direction

- How often stops arrive more than an hour after their `timestamp`, and how often a transaction ID is seen twice.
- The fleet split by model and firmware. Five models on one firmware is a different risk from forty variants.
- Disputes and chargebacks tagged "charged twice" or "wrong kWh."
- Whether the backend stores the signed OCMF record and its unsigned `meterStop` separately, and whether they've ever differed.

If late stops are rare, deduplication already exists and compliance has signed off the comparison rules, my plan shrinks to a few targeted checks. That's a good result, not a wasted week.

### Weak answers interviewers hear

- **"I'd read the OCPP spec end to end first."** It's thorough, but slow and aimed at the wrong question. The spec won't tell you about German law or your fleet's firmware.
- **"I'd automate tests for all the message types."** That's more coverage of the oracle you already have.
- **"I'd tell them it's not Eichrecht-compliant."** You don't know that yet, and you don't have the authority to say it. Ask the owner.
- **"I'd need domain training before I can test."** Learning *is* testing here. Your first questions are your first test results.
- **Treating the e-commerce checklist as complete.** You'd test double charges but miss measurement, offline operation and regulation.

---

### Follow-up questions

1. **A customer disputes an invoice: the app shows 41.2 kWh, but the transparency software shows 40.9 kWh for the same session. Which number is right, and what do you do in the next hour?** (Good answers: treat the signed value as the strong oracle. Find where the 0.3 kWh came from, such as a different source field, rounding or a later meter value. Check whether other sessions from the same model are affected. Involve the compliance owner before support issues a correction.)
2. **You have no lab full of chargers. How would you test offline and late-arriving sessions?** (Good answers: a configurable simulator that replays real anonymised logs, including reordered and duplicated messages. One or two physical chargers whose network you can cut. A production query for late stops as an ongoing monitor rather than a one-off test.)

---

## Sources

- [Michael Bolton, "In which the conversation about heuristics and oracles continues…" (DevelopSense)](https://developsense.com/?p=1237): defines an oracle as a fallible, context-dependent way of recognising a problem, and notes that specs can be ambiguous, incomplete or contradictory. This is the basis for treating "follow the spec" as one oracle among several, and for flagging conflicts instead of settling them.
- [James Bach, Heuristic Test Strategy Model v6.3 (Satisfice)](https://www.satisfice.com/download/heuristic-test-strategy-model): guideword heuristics across project elements, product factors, quality criteria and techniques. I used it here as the structure for learning a new domain quickly and covering more than the easy-to-see parts.
- [OCPP 1.6 StopTransaction message reference (hexdocs)](https://ocpp.hexdocs.pm/ocpp/v1_6/message/stop_transaction.html): required and optional fields of `StopTransaction`. Used to show what the protocol does and doesn't guarantee for billing.
- [Ampcontrol, "How to stop a charging session with stopTransaction"](https://www.ampcontrol.io/ocpp-guide/how-to-stop-a-charging-session-with-stoptransaction): says `meterStop` is in Wh and that a missing `StopTransaction.conf` makes the charger resend. That's the basis for the duplicate-invoice risk.
- [Enelion white paper on charging while disconnected from the server](https://service-support-enelion.happyfox.com/kb/article/72-white-paper-charging-using-an-ocpp-connected-charger-while-disconnected-from-the-server): explains `AllowOfflineTxForUnknownId` and the local authorisation cache. That's the basis for the offline and late-session risks.
- [European Commission, AFIR (EU) 2023/1804 Questions and Answers](https://transport.ec.europa.eu/transport-themes/clean-transport/alternative-fuels-sustainable-mobility-europe/alternative-fuels-infrastructure/questions-and-answers-regulation-deployment-alternative-fuels-infrastructure-eu-20231804_en): per-kWh ad hoc pricing and price display at ≥50 kW points deployed from 13 April 2024, and the conditions for occupancy fees. Primary regulatory guidance; full legal text at [EUR-Lex](https://eur-lex.europa.eu/eli/reg/2023/1804).
- [electrive, "Eichrecht: Initiative S.A.F.E. organisiert sich als Verein"](https://www.electrive.net/2019/05/12/eichrecht-initiative-s-a-f-e-organisiert-sich-als-verein/): background on the S.A.F.E. transparency software and the OCMF format that let drivers check signed meter values against invoices.
- [AMPECO, "Eichrecht: dos and don'ts"](https://www.ampeco.com/de/blog/eichrecht-das-deutsche-kalibrierungsgesetz-dos-und-donts/): a vendor's practitioner summary of Eichrecht obligations. It's used deliberately as the secondary source whose "no time-based fees" claim seems to conflict with the Commission's guidance. That shows why such questions go to a compliance owner, not into a test case.
