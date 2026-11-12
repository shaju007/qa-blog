# QA Thinking — Day 42

## "How Long Will Testing Take?" Is a Negotiation: Estimating a §14a Grid-Dimming Release Without Making a Promise You Can't Keep

It's Thursday afternoon in Hamburg. Your product owner messages you:

> "The grid operator wants to start the §14a pilot on December 1. Dev says the dimming feature is code-complete Monday. How long will testing take? I need a number for the steering call tomorrow."

There are two easy ways to get this wrong. You can say "two weeks," and that becomes a promise that December 1 is safe. Or you can say "it depends," which is true and tells them nothing, so the PO will stop asking you next time.

Today's lesson is a third option: **treat the estimate as a negotiation over what information decision-makers will have, and by when.** The domain is German controllable-device dimming under §14a EnWG. In this domain a "done" that turns out wrong can mean a family's heat pump gets starved in January.

---

## Part 1: The domain you're estimating for

You can't estimate testing on a domain you don't understand, because the domain is where the risks are. Here's the minimum you need.

### The business deal

Since 1 January 2024, new heat pumps, private wallboxes, AC units and batteries with more than 4.2 kW connection power in Germany are "controllable consumption devices" (*steuerbare Verbrauchseinrichtungen*). The deal works like this:

- **The grid operator (VNB)** may temporarily *reduce* the power the device draws when the low-voltage grid is at risk of overload. It may reduce power, but it may not switch the device off.
- **The customer** gets lower network fees in return. They pick a module: a flat annual reduction (Module 1), a 40% cut on the per-kWh network fee with a separate meter (Module 2), or, from April 2025, time-variable network fees combined with Module 1 (Module 3).
- **The grid operator also can't refuse to connect** a new device by citing grid capacity.

### The rules your system has to respect

From the Bundesnetzagentur's §14a pages:

| Rule | What it means for testing |
|---|---|
| Dimming may go down to **4.2 kW**, not below | The floor is a hard oracle. Under-delivery hurts the customer. |
| Heat pumps/AC **> 11 kW**: minimum = connection power × **0.4** scaling factor | A second formula, with a boundary at 11 kW |
| With an **energy management system (EMS)**, the operator sets *one aggregate limit* for all devices, scaled by a **simultaneity factor** that depends on how many devices there are. The customer's EMS splits it between devices. | Aggregation logic and how the split is distributed both need testing |
| Power from the customer's own PV or battery **does not count against the limit** | Your oracle is *grid draw at the connection point*, not device consumption |
| Normally, control must be based on a **real-time network state assessment** and must end as soon as the grid situation allows | You have to test that dimming gets *lifted*, not just applied |
| Interim "preventive" control: max **2 hours/day**, max **24 months** per grid area from first use, only until end of 2028 | Time-window and duration limits have to be enforced and recorded |
| Since 1 March 2025, operators **publish control actions** in a standardised format | Your execution records become evidence that outsiders will read |

VDE FNN has published implementation recommendations: EEBUS as the minimum digital interface to devices, minimum requirements for documenting control commands, parameters for gradually lifting control measures, and a maximum response time between detecting grid state and dimming.

### Where it breaks

Follow one dim command from start to finish: grid operator → smart meter gateway → control box (*Steuerbox*) → customer EMS → EEBUS → wallbox or heat pump → measured grid draw → documentation → network-fee billing. These are the typical failure modes along that path:

- **Acknowledged but not obeyed.** The wallbox confirms the EEBUS limit but only applies it at the start of the *next* charging session. It keeps drawing 11 kW. Every log line says "success."
- **The floor gets violated through aggregation.** The EMS applies 4.2 kW as the *total* for heat pump plus wallbox instead of using the aggregate formula. The heat pump gets starved.
- **The wrong oracle.** A test asserts "device consumption ≤ limit." Because PV covers part of the load, grid draw is fine while the device's own number looks "too high." The result is false alarms, or worse, the team learns to ignore the check.
- **The dimming never gets lifted.** The release command is lost, the gateway reboots mid-window, or communication drops. Nobody notices because "dimmed" looks like a quiet, healthy state.
- **The evidence doesn't match reality.** The documented control action says 14:00–15:00, but the device was actually limited until 15:40. That record goes into published reports.
- **Billing doesn't match controllability.** The customer gets the Module 2 discount while their device was never actually controllable, or the other way round.

Notice that every item here needs **real hardware or real meter data** to observe. That fact will shape your whole estimate.

---

## Part 2: Why "how long?" is the wrong question, and what to answer instead

Michael Bolton argues in [How Long Will the Testing Take?](https://developsense.com/blog/2018/04/how-long-will-the-testing-take) that the person asking usually means something else: *when will I know enough about the product to decide whether to ship?* Testing doesn't end at a finish line. It ends when decision-makers are satisfied they know enough. In his words, "satisfaction is a feeling, not a finish line."

In [Project Estimation and Black Swans, Part 5](https://developsense.com/blog/2010/10/project-estimation-and-black-swans-part-5-test-estimation), he takes apart estimation by counting test cases. A "step" can take five seconds or half a day. He suggests replacing "estimate the testing phase" with **negotiating and refining the test strategy within the project**, and doing capacity planning in time-boxed sessions.

In [Why Is Testing Taking So Long? (Part 2)](https://developsense.com/blog/2009/11/what-does-testing-take-so-long-part-2), he shows the effect that wrecks most estimates. In his model, a clean test takes 2 minutes, a test that finds a bug costs 8 more minutes to investigate and report, and each fix costs 6 minutes to verify. Over the same two days, a buggy module got about **20% of the coverage** of a clean one. **The product's quality determines how fast you can test it.** Any estimate that doesn't say this out loud is hiding an assumption that the code is good.

So don't answer with a duration. Answer with **a menu of information-by-date options, each listing its assumptions and blind spots.**

---

## Part 3: Building the negotiation, step by step

### Step 1: Turn the question into decisions

Before you size anything, ask the PO two questions:

1. "What decision gets made on December 1? Is it 'connect 20 pilot households' or 'enable for all Module-2 customers'?"
2. "Who else has to be satisfied: the grid operator, our metering point operator, customer service?"

In our scenario, the answers are: a pilot with ~20 households, one wallbox model, plus heat pumps from two vendors, and the grid operator wants a test protocol. That already cuts the scope a lot. Many estimates go wrong because the tester assumes full rollout when the decision is actually a pilot.

### Step 2: Size the *project*, not just the product

Use the Project Environment part of James Bach's [Heuristic Test Strategy Model](https://www.satisfice.com/download/heuristic-test-strategy-model) (Mission, Information, Developer Relations, Test Team, Equipment & Tools, Schedule, Test Items, Deliverables) to find the constraints that will actually decide the date. Product complexity usually isn't the main one:

- **Equipment & Tools:** There's one real gateway and control box in the lab, shared with the firmware team, available to you only in the mornings. *This is your bottleneck. No amount of effort from the testers can change it.*
- **Test Items:** The wallbox firmware with the EEBUS fix arrives on November 20, not Monday.
- **Information:** Which simultaneity factors does the grid operator use? Is the FNN response-time requirement part of the pilot acceptance criteria?
- **Deliverables:** The grid operator wants a protocol. That's documentation work, which takes sessions too.

### Step 3: Count capacity in sessions, then subtract the bug tax

Working days from Mon 16 Nov to Fri 27 Nov: **10**. Testers: **2**. Sessions per day (90 min each): **3**.

| | Sessions |
|---|---|
| Nominal: 2 × 10 × 3 | 60 |
| Minus meetings, environment setup, protocol writing | −18 |
| **Available** | **42** |
| Held back for investigation and fix verification (the "bug tax") | −12 |
| **Available for new coverage** | **30** |

Of those 30, real-hardware sessions are capped by lab mornings: about 1 per day → **≤ 10**.

Now set what the risks need against that capacity:

| Risk area | Sessions | Needs real hardware? |
|---|---|---|
| A. Floor/limit calculation: single device, >11 kW heat pump at 0.4, EMS aggregate | 6 | No (simulator + API) |
| B. End-to-end: command → device → *measured grid draw*, PV on/off | 10 | **Yes** |
| C. Lifting, comms loss, gateway reboot, overlapping commands, 2h/day preventive cap | 7 | Partly (4) |
| D. Execution documentation matches measured reality | 4 | Partly (2) |
| E. Network-fee module ↔ controllability status in billing | 6 | No |
| F. Customer app messaging during dimming | 2 | No |
| **Total** | **35** | **16 on hardware** |

There are two gaps: 35 > 30 overall, and 16 > 10 on hardware. **This table is your negotiating position.** It isn't a complaint. It's a visible model the PO can argue with.

### Step 4: Offer options, each with what you'll know and what you won't

> **Option 1: Pilot Dec 1, narrow scope.**
> Covered: A, B for one wallbox model and one heat pump vendor, C core paths (lift, comms loss), D.
> *Not known on Dec 1:* second heat pump vendor on real hardware; billing (E). Pilot households go on Module 1 only, so a billing error costs at most a correction to a flat amount.
> *Condition:* wallbox firmware arrives by Nov 20.
>
> **Option 2: Pilot Dec 1, full scope.**
> Only credible if we get the lab all day (firmware team moves to afternoons) *and* the first week finds few floor violations. I'd rather not promise this.
>
> **Option 3: Pilot Dec 1 for wallbox households only; heat pump households join Dec 15.**
> Heat pumps carry the higher customer-harm risk in December (heating). This option buys hardware time where the harm is greatest.

Every option is honest about what it leaves unknown. Making that explicit is the point.

### Step 5: Name the tripwires up front

Agree now on the signals that will reopen the estimate, so a re-plan later doesn't look like an excuse:

- More than **3 floor or aggregation bugs** in the first 5 sessions of area A → coverage will drop the way Bolton's model predicts. We re-plan on Nov 20, not Nov 30.
- Firmware later than **Nov 20** → Option 1 slides day for day, or wallbox households drop out of the pilot.
- **Any** case where measured grid draw differs from the documented control window by more than the agreed tolerance → stop-the-line conversation, because that record is published.

---

## Part 4: Handling the pushback

**"Just give me one number."**
"If the code is in decent shape and the firmware lands on the 20th: ready for a narrow pilot on Dec 1. If either of those fails, I'll tell you by the 20th, not the 30th. One number would hide the two things most likely to move it."

**"Dev says it's simple, just a limit value."**
Don't argue about complexity. Give an example: "Agreed, setting the value is simple. What I need to see is the wallbox that accepts the value and keeps drawing 11 kW until the next session. Our logs would say 'success.' I can only see that on real hardware with meter readings, and the lab gives me one morning a day."

**"Can't you automate it to go faster?"**
"Area A, yes. I'll write API checks for the formulas and boundaries (4.2 kW, 11 kW, 0.4, number of devices), and they'll keep paying off. B and C depend on physical devices and timing. The bottleneck there is lab time, not typing."

**"Skip the documentation part, it's paperwork."**
"Those records get published as control actions. If they say we dimmed for one hour and the meter says 100 minutes, that's not a paperwork problem. It's evidence against us."

The pattern behind all four answers: **move the conversation from your effort to their risk.** You aren't defending your time. You're making sure the decision on December 1 is made knowingly.

---

## Part 5: A one-paragraph estimate you can actually send

> **Testing for §14a pilot: estimate as of Thu 12 Nov**
> For a 20-household pilot on Dec 1 I recommend Option 1: wallbox + one heat pump vendor tested end-to-end on real hardware, measured against grid draw, including lifting and comms loss; billing restricted to Module 1. The bottleneck is lab time (one morning per day), not tester effort. Assumes wallbox firmware by Nov 20 and a reasonable bug rate in the limit calculation. I'll report against both on Nov 20. Not covered by Dec 1: second heat pump vendor on hardware, Module 2/3 billing. Full model and options: [link].

It fits in a Slack message, and it leaves the decision with the people who own it.

---

## Today's challenge (45 minutes)

Pick a feature your team is about to ship, or use the §14a scenario.

1. **Write down the decision** the release date serves, in one sentence, and who has to be satisfied.
2. **Run the eight Project Environment guidewords** from the HTSM over it and find your *non-tester* bottleneck (hardware, data, a third party, an approver).
3. **Do the session arithmetic:** nominal → available → minus bug tax → coverage sessions. Then list risk areas with session needs. Find the gap.
4. **Write three options.** Each states what will be *known* and what will be *unknown* on the date.
5. **Write two tripwires** with a number and a date.
6. **Bonus (domain):** For §14a, design the oracle for this case: heat pump 12 kW plus wallbox 11 kW behind one EMS, PV producing 3 kW, dim command active. What exactly do you measure, where, and against which limit? (Hint: which formula applies to the heat pump, and does the PV count?) Leave the simultaneity factor as a named parameter instead of guessing it, and write down who you'd ask for the real value.

If you do steps 1–5 for a real release, send the paragraph from Part 5 to your PO before they ask. Then note how the conversation changes.

---

## Sources

- Michael Bolton, DevelopSense: [How Long Will the Testing Take?](https://developsense.com/blog/2018/04/how-long-will-the-testing-take)
- Michael Bolton, DevelopSense: [Project Estimation and Black Swans (Part 5): Test Estimation](https://developsense.com/blog/2010/10/project-estimation-and-black-swans-part-5-test-estimation)
- Michael Bolton, DevelopSense: [Why Is Testing Taking So Long? (Part 2)](https://developsense.com/blog/2009/11/what-does-testing-take-so-long-part-2)
- James Bach, Satisfice: [Heuristic Test Strategy Model](https://www.satisfice.com/download/heuristic-test-strategy-model)
- Bundesnetzagentur: [Steuerbare Verbrauchseinrichtungen (§14a EnWG) overview](https://www.bundesnetzagentur.de/DE/Vportal/Energie/SteuerbareVBE/start.html)
- Bundesnetzagentur: [Integration von steuerbaren Verbrauchseinrichtungen (details: minimum power, 0.4 factor, preventive control limits)](https://bundesnetzagentur.de/DE/Vportal/Energie/SteuerbareVBE/artikel.html?nn=877500)
- Bundesnetzagentur: [Mitteilung Nr. 6 zum Beschluss BK6-22-300](https://www.bundesnetzagentur.de/DE/Beschlusskammern/1_GZ/BK6-GZ/2022/BK6-22-300/Mitteilung/Mitteilung_06/Mitteilung_Nr_06.html)
- VDE FNN: [Empfehlungen zur massengeschäftstauglichen Umsetzung der netzorientierten Steuerung](https://www.vde.com/de/fnn/aktuelles/vde-fnn-empfehlungen-foerdern-die-massengeschaeftstaugliche-umsetzung-der-netzorientierten-steuerung)
