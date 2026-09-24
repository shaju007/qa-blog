# QA Thinking — Day 6

## SaaS Authorization Testing: Hiding the Button Is Not Security

Imagine you are testing a SaaS e-commerce platform.

Two companies use the same platform:

    Tenant A = FashionStore
    Tenant B = BikeShop

Each company has users:

    Owner
    Admin
    Support Agent
    Viewer

You log in as a **Viewer** for FashionStore.

The UI correctly hides the **Delete product** button.

You might conclude:

> “Permission works.”

Now open DevTools and send the API request manually:

    DELETE /api/products/8291
    Authorization: Bearer <viewer-token>

The server responds:

    200 OK

The product disappears.

The UI behaved correctly.

The system did not.

This is one of the most important ideas to understand when testing SaaS applications:

> **Authorization is a server-side business rule, not a UI feature.**

OWASP explicitly distinguishes authentication—establishing who someone is—from authorization—deciding whether that person is allowed to perform a particular action. It also recommends validating permissions on every request rather than relying on client-side controls. [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html?utm_source=chatgpt.com)

Today we will go further than simply testing “admin vs normal user.”

We are going to build a model for testing **roles, resources, tenants, APIs and data isolation**.

------------------------------------------------------------------------

## First: authentication and authorization are different problems

Consider:

    Login successful

That tells us:

> We believe this person is Shohidur.

It does **not** tell us:

> Shohidur is allowed to delete Product 8291.

Authentication answers:

    Who are you?

Authorization answers:

    What are you allowed to do?

A system can have perfect authentication while having terrible authorization.

For example:

    User logs in correctly ✓

    User accesses another customer's invoice ✗

The authentication system worked.

The authorization system failed.

OWASP's current API Security Top 10 still puts **Broken Object Level Authorization (BOLA)** at API1:2023. The risk occurs when an API receives an object identifier and fails to verify whether the authenticated user is actually allowed to access that specific object. [OWASP Foundation+1](https://owasp.org/projects/api-security-project?utm_source=chatgpt.com)

This is why an API test such as:

    GET /orders/123
    → 200

tells you almost nothing about authorization.

The interesting test is often:

    User A:
    GET /orders/123
    → 200

    User B:
    GET /orders/123
    → ?

------------------------------------------------------------------------

# Add SaaS multitenancy and the problem becomes more interesting

A **tenant** is usually a customer organization using a shared SaaS platform.

Imagine your platform hosts 5,000 merchants.

Conceptually:

    SaaS Platform
          |
          +--- Tenant A: FashionStore
          |
          +--- Tenant B: BikeShop
          |
          +--- Tenant C: CoffeeStore

Those tenants may share:

    application servers
    databases
    message queues
    caches
    monitoring
    APIs

while still expecting their data to remain separated.

Microsoft's current Azure multitenancy architecture guidance describes tenant isolation as a spectrum rather than a simple yes/no property. A system might share compute but separate databases, or share databases while enforcing tenant separation in application logic. It specifically warns that shared infrastructure requires careful treatment of both **tenant identity and user identity** during authorization. [Microsoft Learn](https://learn.microsoft.com/en-us/azure/architecture/guide/multitenant/considerations/tenancy-models?utm_source=chatgpt.com)

That creates a testing mission much larger than:

> “Can an admin access the admin page?”

You need to ask:

> **Can one customer ever see, change, delete, influence or degrade another customer's data or service?**

------------------------------------------------------------------------

# Think beyond roles

Many teams model permissions like this:

| Feature        | Owner | Admin | Viewer |
|----------------|-------|-------|--------|
| View products  | ✓     | ✓     | ✓      |
| Edit product   | ✓     | ✓     | ✗      |
| Delete product | ✓     | ✓     | ✗      |
| View invoices  | ✓     | ✓     | ✓      |
| Manage users   | ✓     | ✗     | ✗      |

This is useful.

OWASP's authorization-testing guidance even recommends formalizing authorization rules in a matrix so that combinations of roles and capabilities can be automatically evaluated. [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Testing_Automation_Cheat_Sheet.html?utm_source=chatgpt.com)

But a role matrix alone can still miss serious bugs.

Suppose an Admin is allowed to:

    GET /products/{id}

The matrix says:

    Admin → View Product ✓

So this works:

    GET /products/1001

Product `1001` belongs to FashionStore.

Fine.

Now FashionStore's admin changes the request:

    GET /products/7839

Product `7839` belongs to BikeShop.

If the API returns the product, your **role authorization is correct** but your **tenant authorization is broken**.

The tester needs another dimension.

------------------------------------------------------------------------

# A stronger model: Subject × Tenant × Resource × Action × State

When you test authorization, think:

    WHO
    is trying to do

    WHAT
    to

    WHICH RESOURCE
    belonging to

    WHICH TENANT

    under

    WHICH CONDITIONS

For example:

    Subject:
    FashionStore Admin

    Tenant:
    FashionStore

    Resource:
    Product 1001

    Action:
    UPDATE

    State:
    Active product

Expected:

    ALLOW

Now change only one variable:

    Subject:
    FashionStore Admin

    Tenant:
    BikeShop

    Resource:
    Product 7839

    Action:
    UPDATE

Expected:

    DENY

That small change can uncover an extremely serious vulnerability.

James Bach's Heuristic Test Strategy Model encourages testers to reason about product factors, states, boundaries, interactions and quality criteria rather than simply running predefined scripts. The current HTSM explicitly puts additional emphasis on state-based testing and boundaries. [Satisfice](https://www.satisfice.com/download/heuristic-test-strategy-model?utm_source=chatgpt.com)

Authorization testing becomes much stronger when you use that mindset.

You're not checking a permission checkbox.

You're systematically changing the conditions around an authorization decision.

------------------------------------------------------------------------

# The dangerous assumption: “The ID is impossible to guess”

Suppose product IDs look like this:

    product_7f924d8b-bb31-4c19

A developer might say:

> “Nobody can guess another customer's UUID.”

That is not an authorization mechanism.

The user might obtain the ID from:

    logs
    browser history
    email
    analytics
    API response
    shared link
    support ticket
    JavaScript
    another endpoint

Even if the ID is impossible to guess, access must still be denied if the user is unauthorized.

OWASP makes exactly this point: random or unpredictable IDs can make attacks harder, but they do not replace object-level authorization checks. Every function accessing an object using client-controlled input should verify the user's permission for that object. [OWASP API Security Top 10+1](https://api-security.owasp.org/editions/2023/en/0xa1-broken-object-level-authorization/?utm_source=chatgpt.com)

So when testing:

    GET /shops/9f82d/orders

don't ask only:

> “Can I guess another shop ID?”

Ask:

> **“What happens if I already know a valid ID belonging to another tenant?”**

That's a much better test.

------------------------------------------------------------------------

# Here's a realistic e-commerce SaaS bug

Imagine your platform contains merchant revenue dashboards.

FashionStore requests:

    GET /shops/fashion-store/revenue

Response:

    {
      "revenue": 83291,
      "orders": 3412
    }

Change the path:

    GET /shops/bike-shop/revenue

And the server returns BikeShop's figures.

The user is authenticated.

The endpoint is legitimate.

The request syntax is valid.

The authorization is wrong.

OWASP actually uses a remarkably similar e-commerce scenario in its BOLA documentation: an e-commerce platform exposes shop revenue data, and changing the shop identifier allows access to other merchants' revenue information. [OWASP API Security Top 10](https://api-security.owasp.org/editions/2023/en/0xa1-broken-object-level-authorization/?utm_source=chatgpt.com)

Notice why a traditional happy-path automated test would never find this.

Your test probably says:

    GET ownRevenue
    expect(status).toBe(200)

And it passes forever.

The valuable test is adversarial:

    GET anotherTenantRevenue
    expect(status).toBe(403)

or whatever secure behavior your API contract defines.

Good security testing often involves testing **what must never work**.

------------------------------------------------------------------------

# Test read, write, delete and side effects separately

Suppose the API correctly prevents:

    GET /tenant-B/customer/55

Excellent.

But what about:

    PUT /tenant-B/customer/55

Or:

    DELETE /tenant-B/customer/55

Or:

    POST /tenant-B/customer/55/refund

Or:

    POST /tenant-B/customer/55/send-email

Authorization is rarely one check.

The user may have permission to **view** an object but not **modify** it.

This creates two important privilege-escalation directions.

**Horizontal privilege escalation** means accessing something belonging to another user or peer-level tenant.

    FashionStore → BikeShop data

**Vertical privilege escalation** means gaining functionality reserved for a more powerful role.

    Viewer → Admin function

Both deserve testing.

------------------------------------------------------------------------

# The API response itself can leak data

There is another subtle authorization problem.

Suppose a support agent is allowed to see:

    {
      "orderId": 8192,
      "status": "paid",
      "customerName": "Anna"
    }

But the backend serializes the entire database entity:

    {
      "orderId": 8192,
      "status": "paid",
      "customerName": "Anna",
      "paymentToken": "...",
      "fraudScore": 0.81,
      "internalNotes": "...",
      "wholesaleMargin": 0.37
    }

The screen displays only:

    orderId
    status
    customerName

So your Playwright test looks perfect.

But anyone looking at the network request can see the rest.

OWASP calls this **Broken Object Property Level Authorization**. An API can correctly authorize access to an object while still exposing object properties that the user should not be allowed to read or modify. [OWASP API Security Top 10](https://api-security.owasp.org/editions/2023/en/0xa3-broken-object-property-level-authorization/?utm_source=chatgpt.com)

This is why API inspection should accompany UI testing.

Don't ask only:

> “What does the user see?”

Also ask:

> **“What did the server send?”**

------------------------------------------------------------------------

# Now reverse the problem: hidden writable properties

Imagine the legitimate request is:

    {
      "name": "Winter Jacket",
      "price": 99
    }

You modify it:

    {
      "name": "Winter Jacket",
      "price": 99,
      "tenantId": "bike-shop",
      "isApproved": true,
      "commissionRate": 0
    }

If the backend blindly maps request fields to its internal object, you may be able to modify properties that were never shown in the UI.

Again:

    UI safe
    API unsafe

OWASP warns specifically about this kind of property-level authorization failure and recommends allowing changes only to fields the client is actually permitted to modify. [OWASP API Security Top 10](https://api-security.owasp.org/editions/2023/en/0xa3-broken-object-property-level-authorization/?utm_source=chatgpt.com)

This is one reason experienced API testers frequently manipulate requests rather than simply replaying what the frontend sends.

------------------------------------------------------------------------

# Authorization changes when the product evolves

Here's where quality engineering enters.

Imagine originally you have:

    Owner
    Viewer

Then the business adds:

    Admin
    Support
    Accountant
    Marketing Manager
    External Agency

Then features grow:

    products
    orders
    customers
    refunds
    billing
    users
    analytics
    campaigns
    API keys

Then restrictions appear:

    Support can refund ≤ €50
    Manager can refund ≤ €500
    Owner has no limit

Now permissions are not a simple role matrix anymore.

They're business logic.

OWASP notes that authorization failures often appear as products evolve because new or modified features are introduced without thoroughly reconsidering their authorization implications. Its automation guidance therefore recommends testing the authorization model as part of each release. [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Testing_Automation_Cheat_Sheet.html?utm_source=chatgpt.com)

This is exactly why authorization regression deserves automation.

------------------------------------------------------------------------

# But don't automate it only through the UI

Suppose you have:

    8 roles
    ×
    40 features
    ×
    4 CRUD actions

That's potentially:

    1,280 combinations

Trying to drive all of those through Playwright would likely become slow and expensive.

A better layered approach might be:

    Most authorization rules
    → API/integration tests

    Critical workflows
    → UI tests

    Complex/adversarial behavior
    → exploratory/security testing

Ministry of Testing's Playwright guidance demonstrates using separate authenticated storage states for multiple roles and explicitly notes the importance of role-based testing when users have different authorization levels. [MoTaverse](https://www.ministryoftesting.com/insights/simple-playwright-authentication-recipes-a-cookbook-for-software-testers?utm_source=chatgpt.com)

That technique can be useful for the UI layer.

But the primary authorization enforcement still belongs below the UI.

You want confidence that:

    Viewer cannot DELETE

whether the request originates from:

    browser
    mobile app
    curl
    Postman
    automation
    custom script

OWASP's guidance is clear that permissions should be enforced server-side and validated on every request. [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html?utm_source=chatgpt.com)

------------------------------------------------------------------------

# A useful automated test pattern

Suppose your authorization model says:

    Viewer → read products
    Admin → read/write products
    Owner → read/write/delete products

Instead of individual hard-coded tests everywhere, represent the rules as data:

    const permissions = [
      { role: "viewer", action: "read", allowed: true },
      { role: "viewer", action: "update", allowed: false },
      { role: "viewer", action: "delete", allowed: false },

      { role: "admin", action: "read", allowed: true },
      { role: "admin", action: "update", allowed: true },
      { role: "admin", action: "delete", allowed: false },

      { role: "owner", action: "read", allowed: true },
      { role: "owner", action: "update", allowed: true },
      { role: "owner", action: "delete", allowed: true }
    ];

Then the same test engine can evaluate combinations.

But don't stop there.

Add tenant variation:

    own tenant
    other tenant

Now your authorization matrix becomes dramatically more valuable.

You can even introduce resource state:

    active order
    cancelled order
    refunded order

Because perhaps an admin is normally allowed to refund—but not when an order is already fully refunded.

That's **authorization + domain state**.

------------------------------------------------------------------------

# “403” does not automatically mean the feature is secure

Suppose:

    DELETE /tenant-B/product/5

returns:

    403 Forbidden

Great.

But investigate the side effects.

Did the product still disappear?

Did a message enter a queue?

Did the inventory service receive an update?

Did an audit record get created incorrectly?

Did a webhook fire?

Security tests should often check:

    response
    AND
    resulting state

not merely the HTTP status.

This connects to a broader tester habit:

> **Never confuse the response with the outcome.**

A service can return:

    403

after performing part of the operation.

That's still a serious defect.

------------------------------------------------------------------------

# Multitenancy introduces performance isolation too

Tenant isolation isn't only about secrecy.

Imagine BikeShop imports:

    5 million products

The database query consumes most shared resources.

FashionStore's checkout suddenly goes from:

    200 ms

to:

    8 seconds

BikeShop never accessed FashionStore's data.

But BikeShop affected FashionStore's service quality.

This is known as a **noisy neighbor** problem.

Microsoft's multitenancy guidance explicitly warns that shared infrastructure can produce this type of performance interference between tenants. [Microsoft Learn+1](https://learn.microsoft.com/en-us/azure/architecture/guide/multitenant/considerations/tenancy-models?utm_source=chatgpt.com)

So your tenant-testing model can include:

    Data isolation
    Security isolation
    Performance isolation
    Operational isolation

That gives you much richer test ideas.

For example:

    Tenant A generates heavy reporting workload
    ↓
    Measure Tenant B checkout latency

That's not a traditional functional test.

It may nevertheless reveal a very important SaaS quality problem.

------------------------------------------------------------------------

# Observability must understand tenants

Imagine production reports:

    500 errors increased 300%

You investigate.

Every failure comes from one tenant performing a massive catalog import.

Your global dashboard makes the whole platform look unhealthy.

A useful multi-tenant system often needs telemetry dimensions like:

    tenant_id
    feature
    role
    operation
    request outcome
    authorization decision

But be careful: observability itself can become a cross-tenant leakage risk if logs contain sensitive customer information or if tenant dashboards aren't properly isolated.

Microsoft even treats monitoring/telemetry isolation as its own architectural decision for multitenant systems. [Microsoft Learn](https://learn.microsoft.com/en-us/azure/architecture/guide/multitenant/service/application-insights?utm_source=chatgpt.com)

Once again, domain architecture changes what good testing looks like.

------------------------------------------------------------------------

# The tester's soft skill: don't ask “Who is allowed?” only once

Suppose the PO says:

> “Admins can refund orders.”

Most testers will record:

    Admin → refund ✓

But a strong tester asks for examples.

You might ask:

> “Any refund amount?”

The PO says:

> “Up to €500.”

You ask:

> “Per transaction or total refunded amount?”

Now the developer becomes interested.

PO says:

> “Total.”

Then:

> “Can an admin refund €400 and later another €400?”

Now everyone realizes the requirement is incomplete.

The important skill here isn't “finding an edge case.”

It is **turning a vague permission into an executable business rule**.

Instead of confronting the PO with:

> “The authorization requirement is incomplete.”

say:

> “I see two interpretations. If an admin refunds €400 today and another €200 tomorrow, should the second refund be rejected because the order has exceeded the €500 admin limit?”

Now the team can reason about something concrete.

This is the same communication principle we've been building throughout this series:

    uncertainty
    → example
    → discussion
    → shared rule
    → test

QA becomes useful before the bug exists.

------------------------------------------------------------------------

# One sentence that should trigger your tester brain

Whenever you hear:

> “Only admins can do that.”

your brain should immediately expand it into:

    Who counts as admin?

    Which tenant?

    Which object?

    Which action?

    Which object state?

    Which API?

    Which UI?

    Which background process?

    What happens after role changes?

    What happens to existing sessions?

    What if the resource belongs to another tenant?

You don't need to fire all of those questions at the team.

Remember our previous lesson: strong testers don't ask every possible question.

They identify the questions with the most risk.

------------------------------------------------------------------------

# Test role changes, not just stable roles

Here's an especially good exploratory scenario.

User begins as:

    Admin

They log in.

Then the Owner changes them to:

    Viewer

The Admin already has:

    browser session
    JWT
    open page
    cached data

What happens?

Can they continue editing products for another hour?

Does the token retain old permissions until expiration?

Do existing WebSocket connections retain privileges?

Does the UI update?

Does the API reject the next request?

This is a **state-transition test**.

The stable states may both work perfectly:

    Admin works ✓
    Viewer works ✓

The bug lives in:

    Admin → Viewer

James Bach's current HTSM emphasis on state transitions and boundaries is very useful here: transitions frequently expose behavior that static state testing misses. [Satisfice](https://www.satisfice.com/download/heuristic-test-strategy-model?utm_source=chatgpt.com)

------------------------------------------------------------------------

# A practical authorization test strategy

For a SaaS product, I would frame the testing around this model:

    IDENTITY
    Who is making the request?

    TENANT
    Which customer context are they operating in?

    ROLE / ATTRIBUTES
    What privileges should they have?

    RESOURCE
    Which object is being accessed?

    ACTION
    Read / create / update / delete / execute?

    STATE
    What state is the resource or account in?

    CHANNEL
    UI / API / background service / import / webhook?

    RESULT
    Was the request correctly allowed or denied?

    SIDE EFFECT
    Did anything change that shouldn't have?

    TRACE
    Can we understand the decision from logs/audit data?

You could use this model in:

    exploratory testing
    API testing
    test design
    automation
    security reviews
    refinement discussions

It's reusable.

------------------------------------------------------------------------

# Today's exercise

You're testing a SaaS e-commerce platform.

There are two tenants:

    Tenant A: FashionStore
    Tenant B: ElectronicsShop

FashionStore has:

    Alice = Owner
    Bob = Support Agent

The business rule says:

> Support agents may view orders and refund orders up to €50.

You observe:

    POST /orders/712/refund

    {
      "amount": 40
    }

works for Bob.

Good.

Now design your investigation around the authorization model.

Think about:

    €49.99
    €50
    €50.01

    two refunds of €40

    an order belonging to ElectronicsShop

    a cancelled order

    a fully refunded order

    changing Bob from Support → Viewer while logged in

    calling the API directly

    adding unexpected properties to the request

But don't turn this into a giant checklist.

Your task is to choose the **three highest-risk experiments** and explain why they deserve attention first.

For example, I would strongly consider testing:

    Bob refunds ElectronicsShop order

because cross-tenant access could expose or modify another paying customer's data.

I would also investigate:

    €40 + €40 on the same order

because the phrase “up to €50” may hide an ambiguous cumulative business rule.

And I would test:

    direct API request after role downgrade

because UI changes may not revoke existing server-side authorization.

Notice what we're practicing.

Not:

> “How many permission test cases can I invent?”

But:

> **Which authorization failures would cause the most serious business damage, and what experiments best expose them?**

That is risk-based testing.

That is security thinking.

And in SaaS systems, it is core quality engineering—not a separate activity that belongs only to a penetration-testing team.

For further study, OWASP's Authorization Cheat Sheet is exceptionally useful because it connects authorization architecture directly with testing: least privilege, deny-by-default, permission checks on every request, object-level access and automated authorization regression. The BOLA chapter is particularly relevant for API-heavy SaaS platforms, while James Bach's HTSM is useful for expanding your strategy beyond roles into states, interactions and boundaries. [OWASP Cheat Sheet Series+2OWASP API Security Top 10+2](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html?utm_source=chatgpt.com)

[OWASP — Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html?utm_source=chatgpt.com)

[OWASP — API1:2023 Broken Object Level Authorization](https://api-security.owasp.org/editions/2023/en/0xa1-broken-object-level-authorization/?utm_source=chatgpt.com)

[OWASP — Authorization Testing Automation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Testing_Automation_Cheat_Sheet.html?utm_source=chatgpt.com)

[James Bach — Heuristic Test Strategy Model](https://www.satisfice.com/download/heuristic-test-strategy-model?utm_source=chatgpt.com)

[Microsoft — Multitenant SaaS tenancy and isolation models](https://learn.microsoft.com/en-us/azure/architecture/guide/multitenant/considerations/tenancy-models?utm_source=chatgpt.com)

[Ministry of Testing — Playwright authentication recipes for multiple roles](https://www.ministryoftesting.com/insights/simple-playwright-authentication-recipes-a-cookbook-for-software-testers?utm_source=chatgpt.com)
