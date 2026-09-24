# QA Thinking — Day 15

## Overselling Isn't a Bug in the Code — It's a Bug in the Timeline

Most functional test cases for "add to cart" and "checkout" are written as if time doesn't exist. Step 1: check stock. Step 2: reserve stock. Step 3: charge card. Step 4: confirm order. Each step passes in isolation, in a single-threaded mental model, and the ticket gets closed.

But e-commerce systems don't run one customer at a time. During a flash sale, a restock drop, or just a popular product on a normal Tuesday, dozens of "last item in stock" journeys can be executing concurrently. The bug isn't in any single request — it's in the *gap* between the moment stock is checked and the moment stock is decremented. If two requests both read "1 in stock" before either one writes back "0 in stock," you've sold the same unit twice. Nobody wrote broken code; they wrote code that's correct for one customer and wrong for two customers at the same instant.

This matters for testers specifically because sequential, happy-path scripts are structurally incapable of finding this class of bug. You need a different mental model, not just more test cases.

### The gap you're actually testing

Break the "buy" flow into its real states, not its UI steps:

- **Available** → stock exists and is unclaimed
- **Reserved** → a customer has started checkout and stock is provisionally held
- **Committed** → payment succeeded and the reservation became a real sale
- **Released** → the reservation expired or the customer abandoned checkout, stock returns to available

The dangerous question isn't "does the stock count go down when I buy something?" It's: **what happens to a unit that is simultaneously "reserved" by two different carts before either one commits?** Good implementations answer this with atomic check-and-decrement, database row locking (`SELECT ... FOR UPDATE`), or a reservation system with TTL expiry so a unit can never be both sold and available at once. Weak implementations answer it with "check stock, then separately update stock" — two operations that look atomic in a diagram but aren't atomic in the database. One recent write-up on this exact failure mode is worth reading closely for the mechanics: [Preventing Overselling: Inventory Locks Under Concurrent Checkouts](https://dev.to/iurii_rogulia/preventing-overselling-inventory-locks-under-concurrent-checkouts-3m7e). It's engineering-focused, but as a tester you should be reading it for the *interleavings*, not the code — where exactly can two requests land between read and write.

For a broader technique on designing tests that deliberately force these interleavings instead of hoping to catch them by luck, see [Race Condition Testing: Interleavings That Reproduce Shared-State Bugs](https://qaskills.sh/blog/concurrency-testing-race-conditions-guide) — it frames the core skill correctly: you're not looking for a flaky bug, you're constructing the specific ordering that reproduces a real one, reliably, on demand.

### How to actually test for it (without a chaos engineering team)

You don't need distributed systems expertise to start finding these bugs. You need to stop testing serially.

Michael Bolton's [FEW HICCUPPS](https://developsense.com/blog/2012/07/few-hiccupps) offers a useful way to decide whether the result is actually a problem: compare the product's behavior with its claims, purpose, and other parts of the system. Ask the Product Owner whether backorders are allowed. If they are not, compare successful orders and active reservations with sellable inventory; two successful *add-to-cart* responses alone do not prove overselling.

1. **Set stock to exactly 1**, then fire two (or ten) concurrent add-to-cart-and-checkout requests at the same SKU. A simple script with parallel HTTP calls, or a tool like JMeter/k6 with a synchronized start, is enough. Count how many succeeded. If more than 1 order succeeds when backorders are forbidden, investigate where inventory was reserved.
2. **Test the abandonment path under load.** What happens to a reservation when a user closes the tab mid-checkout? Does it expire and release stock, or does it silently hold inventory hostage until a background job cleans it up an hour later? That's a real, common failure mode that looks like "we're out of stock" when the warehouse is actually full.
3. **Test the boundary, not the middle.** Stock = 1 with 2 concurrent buyers is the interesting case. Stock = 1000 with 2 buyers tells you nothing.
4. **Ask engineering directly: "is check-and-decrement atomic, or two separate operations?"** This is a design question, not an implementation detail, and it's a legitimate thing for a tester to ask in refinement — before the race condition exists in production. If the answer is "we check the count, then update it in a separate call," that's a risk to flag before a single test is run.

### The business framing that gets this prioritized

Engineers will sometimes deprioritize this as an edge case ("how often does that really happen?"). Reframe it in terms a product owner or business stakeholder immediately understands: overselling during your highest-traffic moment — a flash sale, a limited drop, a restock announcement — creates the worst possible customer experience (charged for something you don't get), damages trust exactly when you have the most new customers watching, and generates support/refund cost proportional to how well the campaign worked. The failure rate scales *with success*, which is precisely why it's easy to miss in normal-load testing and expensive to discover in production.

### Challenge

Pick a "add to cart" or checkout flow you test regularly (or a demo e-commerce app if you don't have write access to a real one). Set inventory to exactly 1 for a test SKU, then fire 5 concurrent checkout requests using a script or a load tool with a synchronized start. Record: how many succeeded, what the final stock count shows, and whether the system's response to the "losing" requests is honest (a clear "no longer available") or misleading (a fake success that fails later). Write down the specific line of the system — is check-and-reserve atomic or two steps — that you'd now ask an engineer to confirm.

**Sources:**
- [Michael Bolton — FEW HICCUPPS](https://developsense.com/blog/2012/07/few-hiccupps)
- [Preventing Overselling: Inventory Locks Under Concurrent Checkouts – dev.to](https://dev.to/iurii_rogulia/preventing-overselling-inventory-locks-under-concurrent-checkouts-3m7e)
- [Race Condition Testing: Interleavings That Reproduce Shared-State Bugs – QASkills.sh](https://qaskills.sh/blog/concurrency-testing-race-conditions-guide)
