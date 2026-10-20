# QA Interview Q&A — Day 17

## Question: In bug triage, you report that a customer can be charged twice if the payment call times out and they tap "Pay" again. The developer says, "That's maybe 1 in 500 checkouts, and support can refund it. Low priority." You have no authority over the backlog. What do you say?

## Answer

### What the question tests

The question tests whether you can turn "I found a bug" into "here is what the decision-makers need to know." It also tests whether you can do that without claiming a power you don't have. Saying "it's critical, we can't ship" is the weak answer. Saying "fine, it's your call" and dropping it is also weak.

### Step 1: Take the objection seriously and test it

The developer has made three claims: the bug is rare, support can refund it, and so it's low priority. Each claim might be true. I would not argue about priority first. I would check the claims, because the evidence decides the argument.

**"1 in 500."** I would ask where that number comes from. It might be a guess, or it might be the rate at which payment calls time out. The real exposure is the product of several things:
- How often the payment call times out or returns an ambiguous result.
- How often the user retries after that.
- How often the retry creates a second charge instead of being deduplicated.

I can get these from payment-provider logs, gateway latency percentiles, and checkout funnel analytics. Retries cluster in bad conditions: mobile networks, a provider incident, a sale-day load spike. A bug that is 1 in 500 on a normal day can be 1 in 20 during an incident. Averages hide that.

**"Support can refund it."** I would ask what a refund actually involves:
- Who notices the duplicate charge, and how long does it take?
- Does the customer's bank show a pending authorization for days?
- Does a refund return the money quickly, or does it take days to appear on a statement?
- Does the customer see two orders? Do they get two confirmation emails, and does the warehouse ship two parcels?
- What does reconciliation look like for finance?

I'd also check whether support has a way to find these cases at all. If the only detection is a customer complaint, the real cost is the unreported ones, and we have no count of those.

**"Low priority."** Priority is a business decision about cost, risk, and sequencing. My job is to make sure the decision rests on accurate facts. I can help show that the bug can happen and what it costs, but I don't decide the ranking.

### Step 2: Do the research before the meeting

Before triage I would spend an hour on the evidence:

- **A reliable repro.** I'd force the timeout in a test environment, for example with a proxy that delays or drops the response, and confirm that the second tap produces a second charge. I'd note whether the client sends an idempotency key and whether the server reuses it on retry. Payment providers document this pattern. Stripe's docs say a repeated request with the same idempotency key returns the saved result instead of performing the operation twice. So a double charge here suggests the key is missing, regenerated per attempt, or not applied to this call. That is a hypothesis for the developer to check, not a verdict from me.
- **The cheapest route to the bug.** Fewer steps means fewer objections. I'd record the minimal sequence, and note whether double-tapping, the browser back button, or an app resume triggers it.
- **Variations.** Does it happen on web only, or on the app too? Only with certain payment methods? Is there a time window after which it stops reproducing (for example, a 24-hour key expiry)?
- **Real-world signal.** I'd search support tickets for "charged twice" and "double charge". A handful of past tickets turns a theoretical risk into a known one.
- **Consequences.** I'd list who is hurt and how: the customer, support, finance, the seller in a marketplace (who may be paid twice and have to refund), and the company's standing with its payment provider.

### Step 3: What I'd say in the meeting

I'd keep it short and avoid words like "critical" or "blocker."

> "I want to make sure we're deciding with the same facts. I can reproduce it in four steps by delaying the gateway response and tapping Pay again; here's the recording. I don't know the real frequency. 1 in 500 may be right on a normal day, but retries bunch up when the provider is slow, so I'd like to check the timeout rate from the gateway logs. The consequence isn't only a refund: the customer is out the money for days, two orders may reach the warehouse, and we only find out if the customer complains. Whether this outranks the other items is your call and the product owner's. What I'd ask is that we either schedule it with an owner, or record explicitly that we're accepting the risk, with a trigger for revisiting it, such as the timeout rate crossing some level."

That statement does several things. It reports what I observed. It separates what I know from what I'm guessing. It names the consequences and the people they affect. It leaves the decision with the people who own it. And it asks for a visible outcome, either a fix or an explicit acceptance, rather than the bug quietly aging in the backlog.

### Step 4: Navigating the disagreement

If the developer still says no, I would not escalate on my own, and I would not go around them. I'd ask: "What would change your mind? Is it a number, a customer example, or a cheaper fix?" That turns the disagreement into a shared investigation. Often the real objection is cost. If the fix is "send the idempotency key and handle the duplicate response," which may be a small change, the priority conversation changes completely. I might also suggest a cheaper mitigation: disable the button after the first tap, or add monitoring and an alert on duplicate charges per customer in a short window. That gives the team a way to detect the problem even if the fix waits.

If the decision is still "not now," I'd make sure it is recorded in the ticket with the reasoning, and add the risk to the release notes or the known-issues list. If the product owner or a manager made that call with the facts in front of them, then it was a legitimate decision. My job was to make it an informed one.

### Weak answers and assumptions

- **"Severity is high because money is involved."** This is a slogan. It names no mechanism, no frequency, and no consequence the listener can check.
- **"I'd refuse to sign off."** You don't have that authority, and using it as a threat burns credibility you'll need for the next bug.
- **Accepting "rare" without checking.** Rarity is a measurement, not an opinion. Also, "rare" for one customer can be common across a large customer base.
- **Treating the developer as an obstacle.** They may know something you don't, such as an upstream deduplication layer. Ask.
- **Writing a bug report that only says "double charge happens."** A good report says what happened, how to reproduce it, why it's a problem, and why it matters. The "why it matters" part is the one testers most often skip.
- **Inflating the impact.** If I overstate once, my next report gets discounted. Credibility is the tester's main asset in triage.

### Follow-up questions

1. The developer reports that the server-side idempotency check does work, and the double charge only appears when the customer's session expires between the two taps. Does that change your argument? What would you check?
2. The fix is two days of work and the release is tomorrow. What options besides "fix now" or "ship as is" can you put on the table?

## Sources

- James Bach and Michael Bolton, [Rapid Testing Guide to Making Good Bug Reports (Satisfice)](https://www.satisfice.com/download/rapid-testing-guide-to-making-good-bug-reports). Search results described it as saying a report should cover the problem, how it was encountered, why it is a problem, and why it matters. I used that structure for the repro and consequence sections. I could only see the download landing page, not the full PDF, so I relied on those summaries.
- Cem Kaner's bug advocacy approach, as described in [Bug Advocacy on Leanpub](https://leanpub.com/bugadvocacy). This book is by Rahul Parwal and Khushboo Rajpurohit and is based on Kaner and Bach's Bug Advocacy course. I used it for the idea that a report should motivate action and answer objections such as "it's rare". It is a secondary source, not Kaner's own writing.
- Stripe, [Idempotent requests](https://docs.stripe.com/api/idempotent_requests). This is primary documentation for the claim that retries with the same idempotency key return the saved result, and that keys can be pruned after 24 hours. It supports my hypothesis about where a duplicate charge could come from.
- Michael Bolton, [DevelopSense](https://developsense.com/?p=3894) (search result). Search snippets associated the Rapid Software Testing definition of a bug with "something that bugs somebody who matters". This supports focusing on who is affected rather than on abstract severity. I did not open this page directly, so treat it as a pointer.
