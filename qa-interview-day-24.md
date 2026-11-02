# QA Interview Q&A — Day 24

## Question: Your product owner says, "You find all the edge cases anyway. From next sprint, can you just write the acceptance criteria?" Do you say yes?

**Scenario:** You test the customer portal for an energy supplier in Hamburg. The next story is called **"Move out online."** A customer enters their move-out date and a final meter reading, and the system ends the contract and triggers a final bill. The product owner (PO) works across three teams and can't keep up. Their acceptance criteria (AC) for this story have three lines. In the last two refinements, your questions led to most of the AC being rewritten. At the end of today's refinement, the PO makes the offer above in front of the team.

## Answer

**Short version:** I'd say yes to drafting the examples and questions. I'd say no to deciding the rules. The PO's offer comes from a real capacity problem, and I want to help fix it. But if I quietly accept, the tester ends up making product decisions and then testing against their own assumptions.

### 1. Why the offer is tempting, and where the trap is

It's flattering, and it looks efficient. I'm already finding the gaps, so why not write them down myself?

The problem is that most of the "edge cases" in this story aren't really testing questions. They're business decisions:

- **The final reading is lower than the last reading.** It could be a typo, a meter that was swapped, a meter that rolled over, or fraud. Do we reject it, accept it, flag it for review, or estimate a reading instead?
- **The move-out date is six weeks in the past.** Do we accept it? Who pays for the energy used in between: the customer, the landlord, or the next tenant?
- **Two people share the contract and only one moves out.** Does the contract end, or does it pass to the other person?
- **The customer moves within our supply area.** Do we end the contract or move it to the new address? That's a retention decision as much as a technical one.
- **The customer has a smart meter on a dynamic tariff.** Do we need a manual reading at all, and what happens if it conflicts with the meter data?
- **The customer has overpaid their monthly instalments.** When and how do we refund them?

Each of these affects money, customer experience, support workload, and possibly regulation. If I write "Reject readings lower than the previous reading" as an acceptance criterion, I've just set company policy. Then I test against it, so my opinion becomes the only standard the feature is checked against. Nobody independent is left to question the rule, because the person who would have questioned it wrote it.

There's also an accountability issue. Michael Bolton makes the point that testers don't control scope, schedule, or code, so they can't assure quality. They provide information so the people who do hold authority can decide. If a wrong rule causes a wave of disputed final bills, "QA wrote the AC" is a bad place for the team to be. It's also unfair to me, because I never had the authority to make that call.

### 2. What's actually true about the role

A weak answer is "No, the Scrum Guide says the PO writes the AC." It doesn't say that. The Scrum Guide lets the PO delegate backlog work to others, but the PO remains accountable. So delegating the drafting is legitimate. Delegating the decisions without saying so is the part to avoid, because then the PO is accountable for choices they never actually made.

### 3. What I'd propose instead

I'd split what the PO is asking for into three kinds of work. That's also how I can save them time:

| Kind of question | Example | Who decides |
|---|---|---|
| Robustness and implementation | Submitting twice, session timeout mid-form, a reading with a decimal comma, an API timeout to the billing system | Dev and QA settle it in the team. The PO doesn't need to see it. |
| Business behavior | Lower reading, move date in the past, shared contract, moving within the supply area | The PO decides, using options we prepare. |
| Legal or regulatory | Deadlines for final bills, rules on estimated readings, data retention after the contract ends | The PO sends it to billing or compliance. Neither QA nor the PO should guess. |

Then I'd run it as **example mapping** (rules, examples, and open questions, on cards or in a ticket template). Before refinement, I draft:

- **Proposed rules**, each labelled *PROPOSED*, with two or three options and what each option costs ("Reject = more support calls; Flag = a back-office queue someone must own").
- **Concrete examples** for each rule: "Last reading 48,210 kWh; customer enters 4,821. Expected: ?"
- **Open questions** that I can't answer and shouldn't.

The PO's job then drops from "write the AC" to "answer six questions in 20 minutes." A rule only becomes an acceptance criterion once the PO has decided it.

### 4. What I'd say in the meeting

> "I'm glad to take on more of the drafting, because I can see you're stretched. Here's what I'd suggest. Before refinement, I'll bring a draft with examples and the open questions. Anything purely technical, the devs and I will sort out without you. But some of these, like what we do with a reading that's lower than the last one, are business decisions that affect customers and billing. I don't think I should be making them, and I'd be testing my own assumptions. Could you give us 20 minutes per story to decide the open questions, and could we try this for two sprints and see if it actually saves you time?"

This acknowledges the PO's problem. It also takes on real work and draws a clear line without lecturing anyone. And it ends with a trial that can be measured, not a debate about roles.

### 5. Evidence I'd collect

- **Where past gaps came from.** For the last few sprints, how many AC changes came from questions raised in refinement, and how many escaped bugs were "the spec never said" compared with "the code was wrong"? If most gaps are business rules, the PO's time is the bottleneck, and that's worth raising with whoever manages their workload.
- **Whether the PO actually reads the drafts.** If they start approving my drafts within minutes without reading them, the delegation has turned into rubber-stamping. A practical safeguard is that the PO has to answer the open questions explicitly. Approving the whole draft isn't enough.
- **How long questions stay open.** If questions sit unanswered until the sprint starts, the problem isn't who writes the AC. The PO doesn't have enough capacity, and that's a conversation for the PO's manager, not something QA can fix.

### 6. Tradeoffs and when "yes" is fine

In a small team, a tester with deep domain knowledge (say, someone who worked in billing operations) might reasonably draft nearly final AC. That's fine if the PO explicitly reviews and owns them. The real question isn't who types the AC. It's whether **the person accountable for the product made the business decisions knowingly.** It's also worth asking what I'd stop doing. If drafting AC takes half a day per story, exploratory testing time goes down, and the team should know that's the trade.

### Common weak answers

- **"Yes, quality is my job."** This mixes up finding information with deciding policy, and it gives up independence.
- **"No, it's not my role."** It's technically defensible but unhelpful. It ignores the PO's real problem and damages the relationship.
- **Assuming every edge case needs the PO.** Sending timeouts and input validation to the PO wastes the scarce time you're trying to protect.
- **Treating Given/When/Then as the goal.** Well-formatted AC that encode the wrong business rule are still wrong.

### Follow-up questions

1. Two sprints in, the PO approves all your proposed rules without changing a word. Is that a success or a warning sign, and how would you tell?
2. A compliance specialist says the lower-reading rule you proposed conflicts with how final readings must be handled. The story is already in development. Who do you tell first, and what do you say?

## Sources

- [Michael Bolton, "Testers: Get Out of the Quality Assurance Business" (DevelopSense)](https://developsense.com/blog/2010/05/testers-get-out-of-the-quality-assurance-business). This is the basis for the authority argument: testers inform, and the people with authority over scope and release decide. It's why QA shouldn't quietly set business rules.
- [Ministry of Testing glossary: Three Amigos](https://www.ministryoftesting.com/software-testing-glossary/three-amigos). It frames AC as a shared product of business, development, and testing perspectives, which supports drafting together while the business owns the decisions.
- [Cucumber, "Example Mapping"](https://www.cucumber.io/docs/bdd/example-mapping). This is the source for the rules, examples, and questions structure in the answer, especially capturing unanswered questions on red cards instead of guessing.
- [The Scrum Guide (2020)](https://scrumguides.org/scrum-guide.html). It says the PO "may delegate the responsibility to others. Regardless, the Product Owner remains accountable." That corrects the weak answer that Scrum forbids anyone else from writing AC.
