# QA Thinking — Day 22

## Testing Subscription Lifecycles: Your Suite Checks One Moment, but Customers Stay Subscribed for a Year

Most SaaS billing test suites I've seen check one thing very well: *create a subscription, pay, see `active`, see the feature unlocked.* That's a single moment.

Customers don't stay in that moment. They start a trial, forget about it, get charged, upgrade halfway through the month, have their card expire, get dunning emails, update their card on day 12, downgrade, cancel "at period end," and change their mind. The expensive bugs in subscription software show up in the **transitions between moments**. Those transitions are spread over weeks and months, and a 3-minute CI run never sees them.

Today's lesson combines three things: domain knowledge about SaaS subscription billing, an automation strategy based on James Bach and Michael Bolton's view of tools, and a time-related risk that is 19 days away for anyone working from Hamburg.

---

## 1. Domain primer: what's actually going on in subscription billing

You need this vocabulary before you can test the domain:

| Term | What it means | Why a tester cares |
|---|---|---|
| **Plan / price** | What the customer pays for, and how often (e.g., €49/month Team) | Price changes don't apply retroactively, so old and new customers can be on different terms |
| **Billing cycle anchor** | The date each period renews | Anchors on the 29th–31st cause trouble in short months |
| **Proration** | Credit or charge for a mid-cycle plan change | Finance reconciles every cent of this |
| **Trial** | A free period before the first charge | What happens at trial end with *no* payment method? |
| **Dunning** | Retrying failed payments and reminding the customer | This is where involuntary churn happens, and also where people get free access |
| **Entitlement** | What the customer is *allowed to use* right now | Lives in *your* app, not in the payment provider |
| **Cancel at period end** | Cancellation that takes effect at renewal | Reactivating before the end is a classic edge case |

The key structural point: **there are two state machines, and bugs live in the gap between them.**

- The **billing state** belongs to the provider: the subscription is `trialing`, `active`, `past_due`, `unpaid`, `canceled`, etc.
- The **entitlement state** belongs to your app: can this customer export reports right now?

Your app connects the two, usually through webhooks. Stripe's [subscription lifecycle docs](https://docs.stripe.com/billing/subscriptions/overview) show that the mapping is less obvious than people assume:

- `active` **doesn't mean every invoice is paid.** With the default "latest invoice" status resolution, older open invoices don't stop a subscription from being `active`.
- A first payment that fails puts the subscription in `incomplete`, and the customer has **23 hours** to pay before it becomes `incomplete_expired`.
- `past_due` **doesn't guarantee another retry.** What happens after the last retry (`canceled`, `unpaid`, or staying `past_due`) is a **dashboard setting**, not code.
- With delayed-confirmation methods like bank debits, a subscription can go straight to `active`. If the payment fails later, the invoice is voided, **but the subscription stays `active`.**

That last one is important for a German business, where SEPA Direct Debit is common. If your entitlement logic says "`active` means grant access," you may be giving a paid product to someone whose payment bounced days ago, and nothing in your green test suite would show it.

**The tester's question isn't "does the status change correctly?"** It's: *"For each billing state, what has the business decided the customer can do, and does our code implement that decision or just an accident of our webhook handler?"*

---

## 2. The automation trap: building a longer checklist

The common way to "automate subscription testing" is to write more end-to-end scripts: one for trial, one for upgrade, one for cancellation. Each runs in seconds and checks a few statuses. The suite grows, the dashboard stays green, and the gap between the two state machines is still untested.

Bach and Bolton's paper [*A Context-Driven Approach to Automation in Testing*](https://developsense.com/blog/2016/01/a-context-driven-approach-to-automation-in-testing) gives the right reframing. **Checking** is algorithmic verification of a specific expectation, and machines can do it. **Testing** is learning about the product through exploration, experiment, and judgment, and it can't be handed to a machine. Their argument isn't anti-tool. It's that tools amplify whatever the person using them is doing. In Bach's [*We. Use. Tools.*](https://www.satisfice.com/blog/archives/1598) he lists logging, coverage analysis, and homemade utilities as tools in service of testing, not substitutes for it.

Applied to subscriptions, this gives you a sharper strategy. **The most valuable tool here isn't a test runner. It's a time machine.**

Stripe's [test clocks](https://docs.stripe.com/billing/testing/test-clocks) (and similar features in other billing providers, or an injectable clock in your own code) let you create a customer at a frozen time and move it forward. You can reach the trial end, renewal, failed payment, and retries in minutes. The usual way to use this is "automate the lifecycle scenarios." The better way, following Bach and Bolton, is:

1. **Use the time machine for exploration first.** Run a session where you move a customer through six months of life and **watch everything**: webhooks received, entitlement changes, emails sent, invoice PDFs, the admin UI, finance exports. You're learning what the system does, not confirming what you expected.
2. **Turn the stable, high-value, clearly-specified parts into checks.** Proration amounts, the state→entitlement mapping, "no access after `unpaid`." These are deterministic rules with a clear oracle.
3. **Keep the judgment-heavy parts with people.** Does this dunning sequence make sense to a customer? Is it reasonable that someone who upgraded on day 29 gets charged twice in 48 hours? A script can't decide that.

---

## 3. Know your time machine's blind spots

This is where testers add value that "write more scripts" never will. **Every tool distorts reality somewhere. Find where before you trust a green run.** From Stripe's [advanced test clock docs](https://docs.stripe.com/billing/testing/test-clocks/api-advanced-usage):

- **You can only advance about two billing intervals at a time.** On a monthly plan, that means two months per step. A "simulate a full year" helper has to step through it, and each step is a point where webhooks pile up.
- **Advancing takes a few seconds and is asynchronous.** The clock goes through `advancing` before `ready`. A check that does `advance(); sleep(2); assertInvoicePaid()` will become a flaky test. Wait for `test_helpers.test_clock.ready` or poll the clock's status.
- **Limits: 3 customers per clock, 3 subscriptions per customer, auto-deletion after 30 days.** You can't use this for load testing, and long-lived "golden" fixtures will disappear.
- **List endpoints leave out test-clock objects unless you filter for them.** `GET /v1/invoices` won't return invoices generated by a test clock unless you query by customer, subscription, or clock. Consider your nightly revenue reconciliation job: it lists invoices, finds none of your simulated ones, finds no discrepancies, and **passes.** That's a false oracle: a check that can't fail.
- **Bank-debit collection isn't attempted during the advance.** The docs give `us_bank_account` as the example: after advancing, the subscription stays `active` and the failure arrives later through `invoice.payment_failed`. Before you trust a "renewal with failed SEPA debit" scenario, confirm whether your payment method behaves the same way. Otherwise you're testing a timeline that doesn't exist in production.
- **Rate limits apply in frozen time.** Many API calls against a frozen subscription all count at the same instant. The docs suggest advancing a few minutes between bursts.

### The two-clocks problem

This is the most important one, and no vendor doc will say it plainly for you. **The test clock only moves the provider's time. Your application still runs in real time.**

Advance the provider to March 2027 and your entitlement service, which compares `current_period_end` against its own `now()`, still thinks it's October 2026. Your scheduled "trial ends in 3 days" email job runs on the server's clock, not the provider's. You end up with a world where Stripe is in the future and your code is in the past. Results from that world can look completely plausible and be completely wrong.

To test lifecycles properly, **your own system needs a controllable clock too.** That's a testability request you take to the developers, framed as a risk: *"Right now we can only verify renewal behavior in production, at the speed of real time."*

---

## 4. A lifecycle risk catalog you can use tomorrow

Use these as charters for time-compressed exploratory sessions, not as test cases to copy.

**Trial end**
- Trial ends with no payment method: `paused`, `canceled`, or something else? Does the entitlement match? Can the customer resume cleanly?
- Stripe sends `customer.subscription.trial_will_end` **3 days** before trial end. Does your reminder email go out once, to the right person, with the right date in *their* time zone?

**Mid-cycle change**
- Stripe's docs show a €50→€100 upgrade on Jan 16 as −25 / +50, giving a next invoice of 125. That's an *illustrative* half-month. Work it out independently: Jan 16 leaves 16 of 31 days, so −25.81 / +51.61 and a next invoice of about **125.80**. If finance's spreadsheet uses "days ÷ 30" and the provider prorates by exact elapsed time, you'll get cent-level differences that reconciliation flags every month. **Your oracle needs a documented proration formula, not a feeling.**
- Downgrade mid-cycle: credit balance, refund, or nothing? That's a business decision. Find out who made it.

**Dunning**
- Renewal fails → `past_due` → retries. Does the customer keep access during retries? Was that **decided** or **inherited**?
- The customer updates their card on day 12 of dunning. Does the open invoice get paid, does access return immediately, and does the dunning sequence stop?
- After the final retry: does your app react to the *configured* final state, or does it hard-code `canceled`?

**Calendar edges** (Noah Sussman's [*Falsehoods programmers believe about time*](https://infiniteundo.com/post/25326999628/falsehoods-programmers-believe-about-time) is a great idea generator here)
- Monthly anchor on Jan 31. What is the February renewal date, and what does *your* invoice email, account page, and "next billing date" widget say? All three must agree.
- A customer signs up at 23:30 in Hamburg on the last day of a month. Which month is that in UTC, and which month does the finance export assign it to?

**The DST week, which is coming up soon**
- Central Europe falls back on **Sunday, 25 October 2026**. The US falls back on **Sunday, 1 November 2026**. For that one week, Hamburg is 5 hours ahead of New York instead of 6.
- In Hamburg, 25 October has **25 hours**, and local times from 02:00 to 02:59 happen twice. If you bill usage per day (API calls, seats, kWh in an energy SaaS), is that day's usage aggregated over 25 hours, double-counted, or cut off?
- "Send the renewal reminder at 09:00 customer-local time": does it fire once, at the right time, for a US customer during that week?
- A Ministry of Testing [Club thread on time-zone testing](https://club.ministryoftesting.com/t/how-to-learn-about-time-zones-and-testing-time-zones/82354) makes a point worth using: a user's language and location are bad proxies for their time zone. When a user sets a time-zone preference, check **every** surface it should affect: web, email, mobile push, PDF invoices. Inconsistency between surfaces is the bug that's most likely to slip through.

---

## 5. Deciding what becomes a check

A simple test for each candidate:

| Question | If yes, lean toward… |
|---|---|
| Is the rule written down and agreed (e.g., proration formula, "no access when `unpaid`")? | Automated check |
| Is the oracle deterministic (a number, a state, an entitlement flag)? | Automated check |
| Would a regression cost money or trust quietly, before anyone notices? | Automated check, plus monitoring in production |
| Is the right behavior still unclear, or a matter of taste or customer experience? | Human exploration, then a conversation |
| Does it depend on event ordering, bursts, or timing you don't fully understand yet? | **Explore first.** Encode each bug you find as a check afterwards |

The last row matters most. When you jump two months at once, a burst of webhooks arrives together: `invoice.created`, `invoice.finalized`, `invoice.paid`, `customer.subscription.updated`, sometimes out of order and sometimes retried. That's a realistic stress test of your event handling that you get almost for free. **Don't script it before you've watched it.**

---

## 6. The conversation: questions that turn accidents into decisions

You'll find that much of the behavior is unspecified: access during `past_due`, downgrade refunds, the final dunning state. Don't file these as bugs. They aren't bugs yet. They're **undecided business rules that the code decided by default.**

Take them to the product owner and someone from finance together, framed like this:

> "When a renewal fails, our app currently keeps full access for the whole retry period, which is up to [N] days under our current settings. As far as I can tell, nobody chose that. It's how the webhook handler happens to work. Is that the policy we want? If so, I'll turn it into a check so it can't change by accident. If not, what should happen on day 1, day 7, and after the last retry?"

This works for three reasons:
- **It's based on evidence**: you saw it in a time-compressed session, so you're not speculating.
- **It gives the decision to the people who own it**: product and finance, not QA.
- **It offers something concrete in return**: a protecting check once the rule is decided.

You're not arguing about whether it's a bug. You're making sure someone with authority is deciding, not guessing.

---

## 🧪 Today's challenge

**Scenario:** A Hamburg-based B2B SaaS sells **Team (€49/month)** and **Business (€99/month)** plans, with a **14-day trial**, card and SEPA Direct Debit, and usage-based add-ons aggregated daily. A customer starts a trial on **Saturday 17 October 2026 at 23:40 Berlin time** with SEPA as their payment method.

1. **Draw the timeline** from trial start to the second renewal. Mark every point where time, money, or access changes, including the **25 October DST change** inside the trial and the **31 October / 1 November** month boundary. What is the trial end date in Berlin time? What is it in UTC?
2. **Write a 60-minute exploratory charter** that uses a time-machine tool (test clocks or your own injectable clock) to explore this customer's first 70 days. List at least six things you'll *observe*, beyond the subscription status.
3. **Name two blind spots** where your simulation might differ from production. Hint: think about SEPA collection timing and the two-clocks problem.
4. **Sort your findings:** pick three behaviors that should become automated checks and two that should stay in human exploration. Give one sentence of reasoning for each.
5. **Draft one message** to the PO and finance about an undecided rule you'd expect to find (e.g., access while a SEPA debit is pending or after it bounces). Use the "decided or inherited?" framing.

**Stretch:** Work out the prorated invoice if the customer upgrades from Team to Business on 16 November at 10:00 Berlin time. Then write down the *assumptions* your calculation depends on (proration granularity, time zone of the period boundary, rounding). Those assumptions are your real test ideas.

---

## Sources

- James Bach & Michael Bolton: [A Context-Driven Approach to Automation in Testing](https://developsense.com/blog/2016/01/a-context-driven-approach-to-automation-in-testing) (DevelopSense)
- James Bach: [We. Use. Tools.](https://www.satisfice.com/blog/archives/1598) (Satisfice)
- Ministry of Testing Club: [How to learn about time zones and testing time zones?](https://club.ministryoftesting.com/t/how-to-learn-about-time-zones-and-testing-time-zones/82354)
- Stripe Docs: [How subscriptions work: lifecycle and statuses](https://docs.stripe.com/billing/subscriptions/overview)
- Stripe Docs: [Test clocks](https://docs.stripe.com/billing/testing/test-clocks) and [API and advanced usage, including limitations](https://docs.stripe.com/billing/testing/test-clocks/api-advanced-usage)
- Noah Sussman: [Falsehoods programmers believe about time](https://infiniteundo.com/post/25326999628/falsehoods-programmers-believe-about-time)
