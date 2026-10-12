# QA Thinking — Day 25

## "We Did Some Exploratory Testing" Isn't Evidence Yet: Session-Based Testing of Smart-Meter Outage Detection

Picture a release review for a utility's outage platform. A new version of the integration between the smart-meter network and the Outage Management System (OMS) ships before storm season. Someone asks, "How was it tested?" The answer is: "Automated regression is green, and QA did exploratory testing. It looks good."

Nobody in the room can tell what that second sentence covers. It might mean six focused hours on the riskiest event sequences. It might mean forty minutes of clicking around a dashboard between other tickets. The tester may have done excellent work, but if it can't be inspected, it can't support a release decision.

Today's lesson is about making exploratory testing **accountable without turning it into scripts**. The tool is Session-Based Test Management (SBTM). The domain is electricity outage detection, where timing, partial information and "who said power is back?" decide whether a crew leaves a street that is still dark.

---

## 1. The domain: how a utility learns that your power is out

You need a working model of the system before you can write a decent charter.

**The chain of systems:**

- **Smart meter (AMI endpoint).** Each meter has a small stored-energy reserve. When supply drops, it tries to send a high-priority **"last gasp"** message. When power returns, it sends a **power-restoration** message (sometimes called "first breath").
- **Head-End System (HES).** Collects messages from the meter communication network, which is often an RF mesh. It forwards events to the Meter Data Management System (MDMS) and/or the OMS.
- **OMS / ADMS.** Uses a **connectivity model** (meter → service transformer → fuse → feeder → substation) to infer where the fault is. Several last gasps under one transformer suggest a transformer outage. Last gasps spread across several transformers on one fuse suggest the fuse operated. This is **outage prediction**.
- **Meter ping (on-demand read).** Operators can query a meter to check whether it is energized. Responses are near-real-time, not instant.
- **Downstream consumers:** crew dispatch, customer notifications ("We're aware of an outage in your area" / "Power is restored"), and the reliability reports sent to regulators.

**Reliability metrics.** These matter because they turn outage records into money and regulatory exposure:

- IEEE 1366 separates **sustained** interruptions (longer than 5 minutes) from **momentary** ones (5 minutes or less).
- **SAIFI** (how often the average customer is interrupted) and **SAIDI** (minutes interrupted per average customer) count sustained events. **CAIDI** is average restoration time. **MAIFI** counts momentaries.
- **Major Event Days** can be excluded from the headline metrics. IEEE 1366 uses a statistical threshold (the "2.5 beta" method), but regulators and utilities vary in how they apply exclusions.

So a timestamp error can move a customer interruption from "momentary" to "sustained." That changes reported SAIDI. That's a business consequence, not just a cosmetic bug.

**Failure modes that matter (and that scripted happy-path checks rarely reach):**

| Failure mode | Why it happens | Business consequence |
|---|---|---|
| **Missing last gasps in big events** | Many meters transmit at once; messages collide on the mesh before the meter's stored energy runs out. A 2008 industry article reported collisions can block a large share of last gasps in a large system, while noting prediction can still work with partial reporting. | Under-predicted outage scope. Wrong device suspected. |
| **False outages** | Meter removed or exchanged, tampering, planned disconnects, a single customer's main breaker | Crews dispatched for nothing. Noisy operator queues. |
| **Nested outages** | Feeder restored, but one transformer or service is still out underneath it | Crew leaves. Event closed. Customers still dark and told power is back. |
| **Momentary misclassification** | Restoration messages arrive late or out of order. The system uses *received* time instead of *event* time. | Wrong SAIDI/SAIFI vs MAIFI. Spurious customer notifications. |
| **Connectivity model errors** | Meter mapped to the wrong transformer in GIS | Prediction rolls up to the wrong device. Crew sent to the wrong location. |
| **Event storms** | Thousands of events per minute during a storm | OMS backlog. Operators see stale state at the moment it matters most. |

Two field reports give a sense of scale. ComEd ran simulated outages on a few thousand meters in its AMI deployment. They saw full reception for single-service outages and reported that over 90% of restoration messages arrived within five minutes ([Birkmeier & Johnson, 2012](https://www.renewableenergyworld.com/power-grid/outage-management/what-comeds-outage-testing-revealed-about-its-ami-network/)).

Put that next to the IEEE threshold. **Restoration delivery latency and the momentary/sustained boundary are both on the order of five minutes.** That kind of coincidence is where bugs live. If any component classifies an interruption by when messages *arrived*, a 3-minute blip can be recorded as an 8-minute sustained outage. No requirement document will point you there. You find it by understanding the domain and exploring.

On the operational side, Exelon reportedly used meter pings to cancel more than 1,200 trouble calls during a single thunderstorm. The same article names nested outages as a key area where verification by meter read reduces repeat dispatches ([Ketchledge, 2008](https://www.renewableenergyworld.com/power-grid/outage-management/enhancing-outage-management-with-ami/)). These numbers are old and come from consultant/utility sources. Use them to calibrate *which risks exist*, not as performance targets for your system.

---

## 2. SBTM: the structure, and what each piece is actually for

James and Jonathan Bach developed SBTM at Hewlett-Packard. They framed it as **activity-based** test management, an alternative to managing testing by counting artifacts. Their argument is that managing by artifacts damages testing craft and tester morale ([Satisfice: Session-Based Test Management](https://www.satisfice.com/download/session-based-test-management)). The building blocks:

1. **Charter.** The mission for one session. One common shape is *Explore <target> with <resources> to discover <information>*.
2. **Session.** An uninterrupted, time-boxed block (roughly 60–120 minutes), dedicated to one charter.
3. **Session sheet.** Charter, areas covered, test notes, bugs, **issues** (anything that blocked or slowed the testing), data files, and a time breakdown.
4. **Time breakdown.** Roughly: **T** = test design and execution, **B** = bug investigation and reporting, **S** = setup. Also **on-charter vs. opportunity**: time spent on things outside the charter that looked important.
5. **Debrief.** A short conversation with a lead or peer soon after the session. It's often structured as **PROOF**: Past, Results, Outlook, Obstacles, Feelings.

Each piece does a different job, and teams that copy only the template miss most of them:

- **The charter is a scoping negotiation.** Writing it forces you to say which risk you're spending this hour on, and therefore which risks you're not.
- **The time breakdown measures testability, not productivity.** If a session is 50% setup, the team doesn't have a lazy tester. It has an environment problem. That figure is evidence you can take to the engineering manager.
- **Opportunity time is a signal.** If testers keep drifting off-charter into the same area, your risk map is wrong.
- **The debrief is where the testing becomes evidence.** It's also where coaching, scope correction and the next charter decision happen.

Ministry of Testing's debrief exercise puts it well: the debrief balances the personal nature of exploratory testing. Treat it as storytelling from your notes. Ask whether the charter was achieved, whether you went off-charter, and what you found, both good and bad ([Winteringham, Ministry of Testing Club](https://club.ministryoftesting.com/t/activity-5-3-debrief-your-exploratory-testing-session/31964)).

---

## 3. Applying it: charters for the AMI → OMS release

**Weak charters** (each one fails in a different way):

- *"Test outage management."* No target, no information goal. You could stop after five minutes or after five days.
- *"Verify last gasp creates an outage event."* That's a check. Automate it and move on.
- *"Explore everything about restoration."* Too big for one session. The debrief would be meaningless.

**Stronger charters**, each tied to a failure mode from the table:

1. **Momentary boundary**
   *Explore interruption classification with the HES event simulator, injecting outage/restore pairs of 4–6 minutes with realistic delivery delays and out-of-order arrival, to discover whether classification uses meter event time or receipt time, and what happens at exactly 5:00.*

2. **Nested outages**
   *Explore restoration handling using a fixture with a feeder outage plus one transformer still out underneath it, to discover whether the OMS closes the parent event, what the operator sees, and whether customers under the dead transformer get a "power restored" message.*

3. **Partial reporting under load**
   *Explore outage prediction with 5–30% of last gasps delivered for a fuse-level outage, at storm-like event rates, to discover when prediction rolls up to the wrong device or stays at the transformer level.*

4. **False positives**
   *Explore last-gasp handling for meters in states "removed," "exchange in progress," "remotely disconnected for non-payment" and "planned outage," to discover which ones still create customer-facing outage events or notifications.*

Notice what each charter names: **a target, a resource, and an information goal tied to a business consequence**. Notice what none of them contain: steps. The steps come from your judgment during the session.

**A filled-in session sheet (condensed):**

```
CHARTER   #1 Momentary boundary (classification: event time vs receipt time)
TESTER    A. Rivera     DURATION  90 min (normal)
AREAS     OMS | Interruption classification | HES simulator | Notifications
TIME      T 40% | B 20% | S 40% | Opportunity 10% of total
NOTES     - Sim supports delay injection only per-batch, not per-message -> could
            not test interleaved out-of-order restores within one transformer
          - 4:30 outage, restore delivered +2:00 late -> classified SUSTAINED
            (duration computed from HES receipt time, not meter timestamp)
          - Exactly 5:00 -> momentary (boundary is <=, matches IEEE text) - OK
          - Opportunity: customer SMS "outage detected" sent at +60s, before the
            momentary/sustained decision; then "power restored" 3 min later
BUGS      OMS-2231 Duration uses receipt time; momentary blips become sustained
ISSUES    - Simulator can't set per-meter clock skew (big testability gap)
          - No access to reliability-report export in test env -> couldn't
            confirm downstream SAIDI impact; inferred from event record only
```

Look at **S 40%**. That number tells you something important. The simulator's limits are blocking the riskiest tests, and that's a finding you should report. Also look at the honest **ISSUES** line: the SAIDI impact is *inferred*, not observed. Keep that distinction. It protects your credibility later.

---

## 4. Running the debrief: the soft-skill half of SBTM

Many debriefs fail because they're a status ritual ("Any bugs? Okay, next."). A good debrief is a short, curious interview. If you're the lead, your job is to ask questions that help the tester find what they didn't notice. Grading the session isn't the point.

**Questions that consistently pay off** (mapped loosely to PROOF):

- **Past:** "Walk me through the most interesting five minutes." (This gets the story, not just the summary.)
- **Results:** "What would you be comfortable saying works, and on what basis?" Listen for coverage claims stated more strongly than the notes support.
- **Outlook:** "If you had one more session on this charter, what would you do first?" "Is this charter done, or did it just run out of time?"
- **Obstacles:** "40% setup. What exactly ate the time? Who could fix that?" Turn every obstacle into either a request with an owner, or an explicitly accepted gap.
- **Feelings:** "Anything that felt off but you couldn't pin down?" Unease that can't be put into words yet often turns into tomorrow's charter. In this domain it might be "the operator map seemed slow to update during the burst."

**The tester's half of the skill:** say what you *didn't* cover before anyone asks. "I couldn't test per-meter clock skew, so I don't know how we handle a meter whose clock drifted 3 minutes." This sounds like admitting weakness. It's actually what makes the rest of your report believable. A tester who volunteers their limits gets trusted on their claims.

**Handling the inevitable pushback.** Suppose a developer joins the debrief and says: "Receipt time is fine; 90% of restores arrive within five minutes anyway."

Don't argue about the 90%. Move the conversation to consequences: "Agreed for most events. The 10% that arrive late are exactly the ones near the boundary, and each misclassified blip adds sustained minutes to SAIDI and sends customers two contradictory texts. Can we look at whether the meter timestamp is available in the payload? If it is, the fix may be small."

You've accepted their data, reframed the risk in business terms, and suggested a path forward. That's evidence-based disagreement.

---

## 5. Reporting upward: aggregate sessions, not hours

At release review, replace "QA did exploratory testing" with a short coverage-by-risk view built from session sheets:

| Risk area | Sessions | Key findings | Confidence | Known gaps |
|---|---|---|---|---|
| Momentary/sustained classification | 2 | OMS-2231 (receipt-time duration) | Low until fixed | Per-meter clock skew untestable |
| Nested outage restoration | 2 | Parent closes correctly; child "restored" SMS sent wrongly (OMS-2236) | Medium | Only 1 topology tested |
| Partial last-gasp reporting | 1 | Prediction holds down to ~10% delivery in our fixture | Medium | No realistic storm rate in test env |
| False positives (meter states) | 1 | Remote-disconnect meters create outages (OMS-2240) | Medium | Planned-outage state not seeded |

This answers three questions in one artifact. What's the status of the product? How did we test it? How much should you trust that testing? Bach and Bolton teach this in Rapid Software Testing as the three strands of the testing story. The table also turns your obstacles into decisions management can actually make: "Fund simulator clock skew, or accept that risk in writing."

**Traps to avoid:**

- **Sessions as a quota.** "Each tester does 4 sessions/day" brings back the artifact-counting SBTM was meant to replace.
- **Using the time breakdown against people.** If high B time or high S time gets punished, people stop recording it honestly, and you lose your best testability signal.
- **Debriefs that are skipped "because we're busy."** That's exactly when scope drifts and untested assumptions pile up.

---

## Practical Challenge

**Part A: Domain puzzle (15 minutes).** One transformer, T-88, serves 120 meters. Your test fixture produces:

- 14:02:10–14:02:14: last gasps received from 37 meters (meter timestamps 14:02:09–14:02:11).
- 14:05:40: crew closes a fuse upstream; OMS logs "device restored" at 14:05:42.
- 14:06:50–14:09:30: restoration messages arrive from 101 meters, all with meter timestamps between 14:05:41 and 14:05:44.
- 19 meters never send a restoration message. Pings at 14:12 show 15 energized and 4 not responding.

Answer:

1. Using meter timestamps, is this momentary or sustained for the 101 meters? What would a receipt-time implementation conclude?
2. Of the four non-responding meters, list at least three explanations, including at least one nested-outage explanation. What single next action would tell them apart fastest?
3. What should customers under those four meters be told right now, and who decides?

*(Hint for 1: about 3.5 minutes of interruption by meter time, so momentary. Receipt time stretches it to 4:40–7:20, so some meters could be pushed over the 5-minute line.)*

**Part B: Work application (one week).**

1. Pick the riskiest area of something you're testing now. Write **three charters** in the *target / resources / information* shape. Each must name a business consequence.
2. Run **one** 60–90 minute session. Fill in a session sheet with an honest time breakdown and an ISSUES section.
3. Ask a developer or your lead for a **15-minute PROOF debrief**. Use at least two of the questions from Section 4. Afterwards, write down one thing the debrief surfaced that you wouldn't have reported on your own.
4. If setup time was above ~30%, turn it into a concrete testability request with an owner and an estimated benefit. Bring it to your next refinement.

---

## Sources

- James Bach & Jonathan Bach, *Session-Based Test Management*, Satisfice: https://www.satisfice.com/download/session-based-test-management
- Mark Winteringham, "Activity 5.3 – Debrief your exploratory testing session," Ministry of Testing Club: https://club.ministryoftesting.com/t/activity-5-3-debrief-your-exploratory-testing-session/31964
- Jeffry Birkmeier & Carolyn Johnson (ComEd), "What ComEd's Outage Testing Revealed About its AMI Network," Renewable Energy World (2012): https://www.renewableenergyworld.com/power-grid/outage-management/what-comeds-outage-testing-revealed-about-its-ami-network/
- James Ketchledge, "Enhancing Outage Management with AMI," Renewable Energy World (2008): https://www.renewableenergyworld.com/power-grid/outage-management/enhancing-outage-management-with-ami/
- David Shadle, "Understanding Distribution Reliability Metrics," T&D World (2021): https://tdworld.com/overhead-distribution/article/21157348/understanding-distribution-reliability-metrics
- Southern California Edison, 2015 Annual Reliability Report (IEEE 1366 momentary/sustained and Major Event Day methodology in practice): https://files.cpuc.ca.gov/egy_Reliability_GO165Reports/ReliabilityRpts/2015/SCE_2015_%20Annual_Reliability_Report.pdf
