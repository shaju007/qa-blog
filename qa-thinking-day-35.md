# QA Thinking — Day 35

## Follow One Kilowatt-Hour: How to Learn an Unfamiliar Domain by Asking Questions That Expose Risk (EV Charging Roaming)

Imagine you've just joined a team building the backend for a public EV charging network. In week one you'll hear a lot of new terms: CPO, eMSP, OCPP, OCPI, CDR, hub, Eichrecht, signed meter values. The usual move is to ask "can someone explain how this works?" Someone then gives you a 40-minute architecture walkthrough, and at the end you know the names of the boxes but still can't see where it breaks.

This lesson covers two skills together:

1. **Domain knowledge.** How public EV charging roaming works, and where its money and trust problems live.
2. **Asking questions as a testing technique.** How to learn a domain quickly by asking questions that are really risk probes, and how to ask them so the experts want to answer instead of feeling audited.

---

### Part 1: The domain in five minutes

This is roughly what happens when someone in Hamburg plugs in at a station run by one company and pays through an app from another:

| Role / term | What it means | Why a tester cares |
|---|---|---|
| **CPO** (Charge Point Operator) | Owns and runs the stations and the backend they talk to | Owns the meter data and creates the billing record |
| **eMSP** (e-Mobility Service Provider) | The app or card the driver has a contract with | Owns the customer relationship and sends the invoice |
| **Hub** | A clearing platform between many CPOs and eMSPs | One more hop that can be late, out of date, or duplicate a message |
| **OCPP** | Protocol between the **station** and the **CPO backend** (StartTransaction, MeterValues, StopTransaction) | Stations go offline, queue messages, and send them late |
| **OCPI** | Protocol between **CPO and eMSP** (Locations, Tariffs, Tokens, Sessions, CDRs) | This is where two companies have to agree about money |
| **Session** | The live, changing view of a charge in progress | Shows what's happening now. Not used for billing. |
| **CDR** (Charge Detail Record) | The final record of a completed session that billing is based on | **Can't be changed once it has been sent.** Corrections go out as a separate *credit CDR*. |
| **Tariff** | Pricing built from parts: energy (kWh), time, parking time, flat fee, with restrictions and step sizes | Bugs hide in how these parts combine |
| **Eichrecht** | German calibration law: measured energy has to be accurate and **verifiable by the customer** | The invoice has to match cryptographically signed meter readings |

Three facts change how you test this domain:

- **The CDR is the only record billing uses, and it can't be changed after sending.** AMPECO's OCPI guide says a CDR "cannot be changed or replaced once sent to the eMSP"; corrections are made with a credit CDR. A wrong CDR therefore can't be patched. It has to be undone with a compensating record, which is the same pattern as accounting reversals.
- **Under Eichrecht, the customer is part of your test team.** The station's calibrated meter signs the start and end readings, timestamps, the identification token and a transaction ID. The station must display its public key on site. The customer gets transparency software to check the invoice against the signed values (E-Mobility Simplified's deep dive; S.A.F.E. transparency tooling). Any mismatch between your invoice and the signed data can be found by anyone with a phone camera and a free tool.
- **Stations go offline, and offline is designed behaviour, not an edge case.** In OCPP 1.6, a station can authorise from a local cache, and the `AllowOfflineTxForUnknownId` setting controls whether it starts charging for a token it doesn't recognise. Transaction messages are queued and delivered when the station reconnects. Each of those is a business decision that looks like a technical setting.

---

### Part 2: The technique: follow one unit of value through every hand-off

To learn a domain fast, pick **the smallest unit of value** and follow it from creation to the customer's bank statement. In e-commerce that's an order line. In ad tech it's an impression. Here it's **one kilowatt-hour**.

At each hand-off, ask the same four questions:

1. **Who owns the truth here?** Which system's number counts if two disagree?
2. **What if this arrives late, twice, or never?**
3. **What can't be undone after this point?**
4. **Who would notice first if it were wrong, and how?**

This is a working version of Michael Bolton's two big questions for testing: *"Is there a problem here?"* and *"Are you okay with all this?"* ([DevelopSense, "Two Big Questions"](https://developsense.com/blog/2013/11/very-short-blog-posts-8-two-big-questions)). The four questions help you find problems at each hand-off. The second big question is for later, once you have a risk list to show stakeholders (Part 4).

Here is the kWh journey with the questions applied. The **bold** items are where the risks are.

| Hop | What happens | Question that exposes risk | Testing idea |
|---|---|---|---|
| Meter → station | Calibrated meter signs start and end readings | *What can't be undone?* The signed values are fixed from this point on. | Check that every CDR's energy matches the difference between the signed start and end readings, with documented rounding |
| Station → CPO (OCPP) | StartTransaction, MeterValues, StopTransaction | *What if it arrives late?* **The station was offline for 3 hours and StopTransaction arrives after the session has already been timed out** | Simulate an offline period: start a session, cut connectivity, stop charging, reconnect. Does the backend create a second "ghost" session, or close the timed-out one using the station's timestamp? |
| Station local auth | Token checked against the local cache | *Who owns the truth?* **The cache says the token is valid, but the eMSP blocked it yesterday** | Block a token in the eMSP, keep the station offline, charge. Who pays for that energy? Is that written down in the roaming contract? |
| CPO → eMSP (OCPI Sessions) | Live session updates sent to the driver's app | *Who would notice?* The driver, if the app says "charging" after they've unplugged | Compare the session status the app shows with the station's state during and after an offline period |
| CPO → eMSP (Tariffs) | Price parts sent | *What if it's stale?* **The CPO changed its tariff at 00:00 and the eMSP cached the old one** | A session that runs past a tariff change: which tariff applies, the one at start or split by time? Does the eMSP's invoice agree with the CDR's cost? |
| CPO → eMSP (CDR) | Final billing record | *What if it arrives twice?* *What can't be undone?* | Resend the same CDR. Is it idempotent at the eMSP? Correct a wrong CDR: does the credit CDR reference the original, and does the customer see a clean net amount instead of two confusing lines? |
| eMSP → driver | Invoice plus verification note | *Who would notice?* **The driver, using transparency software** | Take a real invoice and verify it the way a driver would, with the public key from the station label and the signed data. Does it pass? |

A worked example of how the bold items combine:

> A driver plugs in at 22:40. The station loses its mobile connection at 23:10. The driver unplugs at 01:30 and goes home. The station reconnects at 02:15 and sends a queued StopTransaction. Meanwhile the CPO backend timed out the session at 01:10, after two hours with no meter values, and sent a CDR with **an energy value estimated from the last MeterValues update**. Then the real stop arrives.

Now there are two questions, and both are about decisions rather than code. First: is a CDR built from estimated energy allowed at all under Eichrecht, where the invoice must match the signed readings? Second: since that first CDR can't be changed, what does the correction look like to the customer, and to the eMSP's revenue reports? If you don't know the answers, that's fine. What matters is that you now know *who* to ask: the CPO's metrology or compliance owner and the eMSP's billing owner. That's more useful than knowing which microservice to read.

---

### Part 3: How to ask so experts keep answering

Domain experts get tired of questions fast if the questions sound like exam questions or accusations. Patterns that work:

- **Ask about what you'd observe, not about how it's built.** Instead of "How does the timeout work?", ask "If a station drops offline for three hours mid-charge, what would I see in the backend, the app, and the CDR?" They can answer from experience, and the gaps in their answer are your test ideas.
- **Say what you think, then ask them to correct you.** "My understanding is that the CDR is final once sent and corrections go out as a credit CDR. Is that right for our hub too?" Experts correct confidently. They're less keen to explain from scratch.
- **Keep a glossary of disagreements, not just a glossary.** If billing says "session" means the OCPI Session object and the station-firmware team says "session" means the OCPP transaction, write down both meanings. Every term two teams use differently is a likely integration bug.
- **Ask "who else should I ask?"** at the end of every conversation. In multi-party domains, the person who owns the risk is often on another team or at another company.
- **Say why you're asking.** "I'm asking because if this is wrong, the driver can prove it with the transparency tool and we can't take back the CDR." A question with a stake attached gets prioritised. Without the stake, it can sound like trivia.

---

### Part 4: Turn your questions into "Are you okay with all this?"

After a week of following the kWh, you'll have a list of open questions. Most of them are **unmade decisions** that nobody owns, not bugs. Present them as decisions, not as findings:

> **Open decisions in offline charging (need an owner):**
> 1. When a station is offline and a blocked token charges from the local cache, who pays for that energy? *(Today: not specified. Exposure: depends on how long stations stay offline and how many blocked tokens are still cached. I can pull station-offline durations from the logs to size it.)*
> 2. Can we ever send a CDR based on estimated energy? *(Compliance risk under Eichrecht. Needs the metrology owner.)*
> 3. When a session runs past a tariff change, which tariff applies, and does the eMSP calculate it the same way? *(Shows up as invoice ≠ CDR. Drivers can see it.)*

That's the second big question in practice: you're not saying "this is broken". You're asking whether the people responsible are okay with these risks as they stand. Sometimes they are, and that's a legitimate answer. Your job is to make sure it's a decision and not something nobody looked at.

---

### Practical challenge (45–60 minutes)

Use a domain from your own product. If you don't have one, use EV charging.

1. **Pick the unit of value.** One kWh, one payout, one ad impression, one usage event.
2. **Draw its journey** as a numbered list of hand-offs, at least 5. For each hop, write which system or company owns it.
3. **Apply the four questions** at every hop: who owns the truth, late/twice/never, what can't be undone, who notices first. Aim for 12+ questions.
4. **Sort the questions** into three groups: *(a)* answerable by reading docs or specs, *(b)* answerable only by a person (write down who), *(c)* nobody owns the answer, so it's an unmade decision.
5. **Rewrite your top two group-(c) items** in the "open decision" format from Part 4: the decision, current state, exposure, and what you'd measure to size it.
6. **Bonus, EV-specific:** find a public charging invoice (yours or a colleague's) that includes signed data, and verify it with the S.A.F.E. transparency software against the public key printed on the station. Note every step where an ordinary driver would give up. Each of those is a usability and trust risk.

What a strong answer looks like: most of your questions should be about **timing, ownership and irreversibility**, not about field validation. If most of yours are "what if the value is null?", go back to step 3.

---

### Sources

- Michael Bolton, ["Very Short Blog Posts (8): Two Big Questions"](https://developsense.com/blog/2013/11/very-short-blog-posts-8-two-big-questions), DevelopSense: "Is there a problem here?" / "Are you okay with all this?" as the core questions of testing
- Simon Tomes, ["What Essential Questions Should Testers Ask?"](https://www.ministryoftesting.com/newsletter/what-essential-questions-should-testers-ask), Ministry of Testing
- AMPECO, ["The Complete OCPI Guide"](https://www.ampeco.com/guides/the-complete-ocpi-guide/): CPO/eMSP/hub roles, tariff parts, CDR immutability and credit CDRs (vendor guide; checked against the open OCPI specification, available via [OCPI 2.2 spec download](https://emobilitysimplified.com/2019/10/download-ocpi-22-official.html))
- E-Mobility Simplified, ["Eichrecht Implementation – Deep Dive into German Measurement and Calibration Law"](https://www.emobilitysimplified.com/2022/03/eichrecht-implementation-deep-dive-into.html): signed start/end readings, public key display, invoice and CDR contents, CPO storage duties
- Open Charge Alliance, ["Signed Meter Values" (v1.0)](https://openchargealliance.org/wp-content/uploads/2025/05/signed_meter_values-v10-1.pdf): how signed meter data is carried in OCPP
- GreenFlux, ["Charge Station Configuration"](https://greenflux.helpkit.so/13d17d68194280c7bed4d86435b26298): offline authorisation, local authorisation cache, `AllowOfflineTxForUnknownId`
- Ampcontrol, ["How to stop a charging session with StopTransaction"](https://www.ampcontrol.io/ocpp-guide/how-to-stop-a-charging-session-with-stoptransaction): what StopTransaction carries for billing

*Note: Eichrecht details here come from practitioner and vendor sources. Before you treat any of them as a pass/fail rule, confirm the exact obligations with your compliance or metrology owner.*
