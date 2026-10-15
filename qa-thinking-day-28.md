# QA Thinking — Day 28

## Testing Outbound Webhooks: Your Feature Runs on a Server You Can't See

Here is a common release note on a B2B SaaS platform: *"Webhooks shipped. Integration tests green. We POST the event, get a `200`, done."*

Say the product is a field-service SaaS. Technicians close jobs in the app, and the platform sends `job.completed`, `invoice.issued` and `invoice.voided` events to each customer's ERP. Those ERPs belong to the customers. They might be a mid-sized plumbing company's SAP instance, a homegrown PHP script, or an iPaaS connector someone set up in 2021 and nobody has touched since.

The feature isn't "we send a POST." The feature is **a promise about delivery over time, made to systems you don't control and can't watch directly.** Your green test checked one delivery to a receiver that behaved perfectly. Customers will hit thousands of deliveries to receivers that time out, redirect, return `500` during their own deploys, deduplicate badly, or vanish for four days.

Today's lesson has three parts:

1. The domain: what a webhook delivery promise actually contains.
2. Choosing oracles when the outcome happens somewhere you can't look. This applies Michael Bolton's consistency heuristics.
3. Observability as a test deliverable. If you can't see delivery, you can't test it, and support can't help customers either.

---

## 1. Domain primer: the delivery contract nobody wrote down

Webhook senders make the same handful of decisions, and each one is a business rule with its own failure modes. Mature providers document theirs, so you can compare yours against them.

| Decision | Example of a documented answer | Why it matters to the receiver |
|---|---|---|
| **Delivery semantics** | Stripe: endpoints "might occasionally receive the same event more than once"; log processed event IDs and skip repeats. | Receivers must be idempotent, and your event IDs must actually stay stable. |
| **Ordering** | Stripe doesn't guarantee events arrive in the order they were generated. Its `created` timestamp is in seconds, so distinct events can share one. Don't use it for ordering or dedup. | `invoice.voided` can arrive before `invoice.issued`. What does the ERP do then? |
| **Retries** | Stripe retries for up to three days with exponential backoff in live mode. GitHub "does not automatically redeliver failed webhook deliveries." | Two respected providers made opposite choices, so neither is "the standard." Your docs have to say which one you made. |
| **What counts as success** | Standard Webhooks: only `2xx`. Stripe treats `3xx` redirects as failures. | A receiver's `301` to a new URL is a silent failure, not a delivery. |
| **Timeouts** | The Standard Webhooks spec recommends 15–30 s. Stripe tells receivers to return `2xx` *before* complex logic. | A slow receiver that *did* process the event gets marked failed and retried, which causes duplicates. |
| **Authenticity and replay** | HMAC-SHA256 signature over timestamp plus raw body. Stripe's libraries default to a 5-minute tolerance and warn that a tolerance of `0` disables the recency check. | Any re-serialization between signing and sending breaks every delivery. |
| **Secret rotation** | Stripe can keep the old secret alive for up to 24 h and sends one signature per active secret. Standard Webhooks sends multiple signatures space-delimited. | A rotation can break receivers that only parse the first signature. |
| **Persistent failure** | Standard Webhooks: notify the consumer and consider disabling the endpoint. | Disabling an endpoint is a business event. A customer's invoicing silently stops. |

Two subtleties are worth knowing because they make good bugs:

- **Identity across retries.** In Standard Webhooks, `webhook-id` stays the same across retries but `webhook-timestamp` changes on each attempt. Stripe also generates a new signature and timestamp for each retry. So the signature has to be computed **per attempt**. A sender that caches the signature from attempt 1 and sends a fresh timestamp on attempt 2 works on the first try and fails on every retry. That bug only appears after a receiver has already had trouble, which is the worst time for it.
- **"Same event" isn't always "same ID."** Stripe notes that in some cases two separate Event objects are generated, and recommends deduplicating on the object ID plus the event type. Ask your team: when *we* replay from the outbox after an incident, do we resend the old event IDs or mint new ones? If we mint new ones, we break every customer who followed our own dedup advice.

---

## 2. Oracles when you can't see the outcome

Your real question is "did the customer's system end up in the right state?" You usually can't observe that directly. In Michael Bolton's terms, an **oracle** is a way to recognize a problem. His FEW HICCUPPS list of consistency heuristics is a good way to find oracles when there's no obvious expected result. He also warns that oracle principles are "fallible and context-dependent; to be applied, not followed." An inconsistency tells you where to look. It doesn't prove a bug.

Here's how several of the heuristics apply to webhooks:

- **Claims.** What does your public webhook doc promise? Often it promises nothing about ordering, retries or disabling, and that's your first finding. A missing claim is a problem, because customers will infer a guarantee and build on it.
- **Comparable products.** Stripe retries for three days and GitHub doesn't retry at all. Comparing them doesn't tell you which one is right. It shows that **this is a product decision that someone has to own**, so you can ask the PM who made it.
- **Statutes and standards.** The Standard Webhooks spec gives you an external yardstick for header names, signature scheme, ID stability and timeouts. If you deviate from it, you should be able to explain why.
- **Purpose.** Customers use `invoice.issued` to post receivables in their ERP. A duplicate there isn't cosmetic, because it can mean a double-posted invoice in someone's books. Purpose turns "a duplicate delivery" into a business risk.
- **Product (internal consistency).** Compare the delivery log, the customer-facing "Recent deliveries" UI, and the retry scheduler. If the UI says "Delivered" while the log shows attempt 3 timed out, one of them is lying.
- **History.** Did the old polling API return voided invoices? If so, customers moving to webhooks will expect `invoice.voided` to exist and arrive.
- **Explainability.** When delivery behaves strangely, can anyone on the team explain *why* from the data you keep? If not, you have an observability problem as well as a functional one, which leads to part 3.

**Applying this at work:** before writing a single test, turn the hidden promises into an explicit claims list and take it to the PM and the docs owner. "Here are the eight decisions in the table above. For each one: what do we promise, what do we actually do, and who decided?" That conversation usually finds more risk than the first week of testing. It also turns your oracles from opinions into agreed claims.

---

## 3. Observability as part of what you test

Parveen Khan's Thoughtworks piece on why observability matters for testers suggests starting with plain questions: are logs available and structured, which alerts and dashboards are needed after deployment, and does tracing cover the whole flow across services? Rob Meaney's TestBash talk makes the matching point: failure in production is inevitable, so **detection and recovery** deserve the same design attention as prevention.

For webhooks, that's very concrete. Your tests can't see the receiver, but your **delivery log** can see every exchange with it. Treat that log as a test oracle, and test the log itself as a feature.

A minimal useful delivery-attempt record looks like this:

```
event_id | delivery_id | tenant_id | endpoint_id | attempt_no | scheduled_at | sent_at
http_status | latency_ms | response_body_snippet | error_class (timeout/TLS/DNS/redirect/4xx/5xx)
signing_key_id | payload_sha256 | next_retry_at | final_state
```

Each field supports a specific check:

- `payload_sha256` lets you prove the bytes you signed are the bytes you sent.
- `signing_key_id` lets you debug rotation-window failures.
- `attempt_no` plus `next_retry_at` let you check the backoff curve against the documented schedule, without waiting three days in real time.
- `error_class` lets support say "your TLS certificate chain is incomplete" instead of "it failed."

The metrics that matter:

- **Age of the oldest undelivered event, per tenant.** This is the customer's real experience. A global success rate of 99.7% can hide one tenant whose invoices have been stuck for 40 hours.
- **Retry queue depth and dispatch lag.** These watch for noisy neighbours.
- **Endpoints auto-disabled today,** and whether each tenant was notified.

**The observability test charter:** *"Pick a real tenant and invoice from staging. Using only our tools, answer within 5 minutes: did we send it, how many times, what did their server say, what will happen next, and can I safely resend it?"* If you can't, write that up as a bug with the same seriousness as a functional defect. Support will be asked exactly this question the first week after launch.

---

## Test ideas, ordered by risk

**Delivery and retries**
- Receiver returns `500` three times, then `200`. Verify the schedule, the *stable* event ID, and a *fresh* timestamp and signature on every attempt.
- Receiver processes the event but responds after the timeout. Verify the duplicate is the same `event_id`, so receiver-side dedup works.
- Receiver returns `301`/`302`. Does the system count this as a failure, and does the UI explain why?
- Receiver is down for longer than the retry window. What's the final state? Is the tenant notified? Can they replay? Does the replay keep the original IDs?

**Ordering and stale snapshots**
- Issue and then void an invoice within the same second, with jitter injected in the dispatcher. Deliver the void first. Does your docs' advice ("fetch the current object from the API") actually work, meaning the API returns the voided state right away?
- Retry a *snapshot* payload on day 3. It still says `status: open` while the invoice was paid on day 1. Is that documented? Should these events be thin (ID only) instead?

**Signing**
- Put a gzip/proxy/JSON-pretty-printing middleware between signer and sender. Check whether any layer re-serializes the payload.
- Rotate the secret mid-retry. Do both signatures appear? Does the old one disappear after the window?
- Check non-ASCII payloads (customer names like "Müller Haustechnik GmbH") against an independent verifier, such as one of the Standard Webhooks reference libraries. Encoding mismatches in signing come up repeatedly.

**Multi-tenant fairness and security**
- One tenant's endpoint sleeps for 29 s on every request. Do other tenants' deliveries slow down? That would be head-of-line blocking in a shared queue.
- **SSRF:** register `http://169.254.169.254/latest/meta-data/`, `http://localhost:8080/admin`, a public hostname that resolves to `10.x.x.x`, and a public URL that redirects to an internal one. OWASP's SSRF Prevention Cheat Sheet lists custom webhooks among SSRF contexts. It recommends deny-listing private and metadata ranges, disabling redirect-following, and validating the *resolved* IP to defeat DNS rebinding. A webhook feature is a user-controlled outbound HTTP client running inside your network, so test it as one.

---

## The soft-skill part: explaining a risk nobody has hit yet

The hardest part of this work is that every failure above happens *later*, at *someone else's company*. In refinement you'll hear: "We'll handle retries if customers complain."

Don't argue about whether bugs exist. Make the cost of deciding later concrete:

> "Right now we haven't decided whether retries keep the event ID. If we ship with new IDs per retry and change it later, every customer who built dedup on our ID has to change their integration. That makes it a breaking API change. If we decide now, it costs a one-line decision and a doc sentence. I'm not asking for more testing time. I'm asking for someone to own these eight decisions before the docs go public."

This works because it:
- frames the issue as **reversibility**, not quality. Public API semantics are expensive to change once customers depend on them.
- makes the request small and clear: a decision owner, not a delay.
- uses comparable products as evidence of choice rather than authority. "Stripe retries for three days and GitHub doesn't retry. Both are legitimate, and we need to pick one and say so."

---

## Challenge (45–60 minutes)

Use a webhook-sending feature at your company. If you don't have one, use any async integration, such as an event bus consumer, an export to a partner SFTP, or a callback to a payment provider.

1. **Claims audit (15 min).** Fill in the eight-row table from part 1 for your system with three columns: *documented claim*, *actual behaviour (how you know)*, *decision owner*. Count the cells where you wrote "unknown."
2. **Oracle check (10 min).** For two of the unknowns, name which FEW HICCUPPS heuristic would reveal a problem, and what observation you'd need.
3. **The 5-minute question (15 min).** Pick one real event from a test environment and try to answer: *sent? how many times? receiver's response? next action? safe to resend?* using only production-grade tools. Not the database, not a developer's laptop. Write down every point where you got stuck.
4. **Write the one-paragraph risk note** for your PM, in the style of the soft-skill section. It should name one decision, its reversibility cost, and the owner you're asking for.

**Stretch:** write one automated check that fails if the signature on attempt 2 was computed with attempt 1's timestamp. Because it targets a bug that only appears on retries, it's worth more than the ten happy-path tests you already have.

---

## Sources

- Michael Bolton (DevelopSense), [FEW HICCUPPS](https://developsense.com/blog/2012/07/few-hiccupps): consistency heuristics for recognizing problems, and the warning that oracles are fallible.
- Parveen Khan (Thoughtworks), [Why observability matters for testers](https://www.thoughtworks.com/insights/blog/observability/why-observability-matters-testers)
- Rob Meaney, [Observability: Unlearn Guessing, Reduce Stressing and Learn to Embrace Reality](https://ministryoftesting.com/testbash-sessions/observability-unlearn-guessing-reduce-stressing-and-learn-to-embrace-reality-rob-meaney) (Ministry of Testing, TestBash)
- Stripe Docs, [Receive Stripe events in your webhook endpoint](https://docs.stripe.com/webhooks): duplicates, ordering, 3-day retries, raw-body signing, 5-minute tolerance, secret rotation.
- GitHub Docs, [Handling failed webhook deliveries](https://docs.github.com/en/webhooks/using-webhooks/handling-failed-webhook-deliveries): no automatic redelivery.
- [Standard Webhooks specification](https://github.com/standard-webhooks/standard-webhooks/blob/main/spec/standard-webhooks.md): ID stable across retries, per-attempt timestamp, 2xx-only success, 15–30 s timeout guidance, disabling and notification.
- OWASP, [Server-Side Request Forgery Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html): webhooks as an SSRF context, deny-listing internal ranges, redirects, and DNS rebinding.
