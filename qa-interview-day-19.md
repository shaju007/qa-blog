# QA Interview Q&A — Day 19

## Question: Your new checkout theme scores 96 Performance, 100 Accessibility and 100 Best Practices in Lighthouse CI. Marketing wants to tell merchants it is "fast, accessible and secure — EAA-ready." Can QA sign off on that sentence?

**Context:** You work on a SaaS shop platform. Thousands of merchants run their storefronts on your themes, and many of them sell to consumers in Germany and elsewhere in the EU. The new checkout theme goes to all merchants on 10 November, ahead of Black Friday (27 November). Lighthouse runs in CI against a demo shop on every merge, and the scores are visible on a dashboard. The product marketing manager wants the sentence in the merchant newsletter, and the product owner asks you in planning: "The numbers are green. Any reason we can't say this?"

## Answer

### The short answer

Not as written. Each of the four claims in that sentence promises more than three Lighthouse scores can show. "EAA-ready" is also a legal claim, so neither QA nor marketing can approve it on its own.

A good answer does not stop at "no." QA's job here is to:

- explain what the scores do and do not show,
- find out what can be shown before the newsletter goes out, and
- help the team write a sentence that is true.

This is not a turf fight with marketing. If merchants get a claim that turns out to be false, they inherit the risk: an accessibility complaint, a slow checkout on Black Friday.

### How an experienced tester reasons through it

The useful frame is Bach and Bolton's distinction between **checking** and **testing**. Checking is the mechanical verification of specific statements about a product. Testing is learning about the product by experiencing it, exploring it and experimenting with it. Lighthouse is a good checking tool. The newsletter sentence makes claims that need testing. So for each claim, ask: *what did the tool actually observe, and what would have to be true for the sentence to hold?*

**1. "Fast"**

What Lighthouse measured:
- one page load,
- of one demo shop,
- with a cold cache,
- on a simulated mid-tier phone over a throttled connection,
- with no real user interacting.

That makes it a lab measurement. Google's guidance on lab vs. field data says field data reflects what real users experience, and lab data is for diagnosis. Interaction to Next Paint (INP) depends on real interactions at the moment users make them, so a lab load test cannot really measure it.

What the score leaves out:

- **Merchant content.** Real merchants add tracking pixels, chat widgets, review apps, large hero images and 40-item carts. The demo shop has none of these.
- **The slow parts of a checkout are interactions, not the first load.** Examples: address autocomplete, changing the shipping method so totals recalculate, applying a voucher, the payment-provider iframe, the 3-D Secure redirect.
- **Capacity.** "Fast" in a Black Friday newsletter will be read as "fast under Black Friday traffic." Lighthouse measures one browser. It says nothing about the backend at 20× normal load.

**2. "Accessible" (100 in Lighthouse)**

- Lighthouse's own scoring docs say the score is a weighted average of automated pass/fail audits, and manual audits don't affect the score.
- In GOV.UK's audit of 10 automated tools, the team built a page with 143 known barriers. The best tool found 41% of them, and 29% were missed by every tool.
- Ady Stokes makes the same point in his Ministry of Testing talk: these tools don't understand context.

In practice, a perfect score can coexist with a checkout that a screen-reader user cannot finish.

WCAG 2.2 AA (the version most EU guidance now points to) added criteria that hit checkouts directly, and automated tools mostly can't judge them:

- **2.4.11 Focus Not Obscured:** a sticky order summary or the cookie banner can cover the focused field.
- **2.5.8 Target Size (Minimum):** small quantity steppers or "remove item" icons on mobile.
- **3.3.7 Redundant Entry:** does "billing same as shipping" really avoid asking for the address again?
- **3.3.8 Accessible Authentication (Minimum):** login, one-time-password and CAPTCHA steps, including whatever bot protection was added at checkout.

Also check whether error messages are announced, and how session timeouts behave.

**3. "Secure"**

Best Practices is a hygiene category: HTTPS, console errors, deprecated APIs, and an evaluation of whether the Content Security Policy (CSP) could be bypassed. Even that CSP check judges the policy, not your code. None of it tests:

- whether one merchant's admin can see another merchant's orders,
- how sessions behave across the payment redirect,
- whether prices and vouchers are checked on the server.

QA should not claim "secure" at all. That word belongs to the security team, and usually to no marketing copy.

**4. "EAA-ready"**

Since 28 June 2025, the European Accessibility Act (Germany's version is the Barrierefreiheitsstärkungsgesetz, or BFSG) covers consumer e-commerce. The obligation sits with the **merchant** as the service provider. Your platform supplies part of what they need.

Practitioner and legal guidance points to EN 301 549 / WCAG AA as the benchmark, and German accessibility statements are expected to list known non-conformances. That has two consequences:

- A blanket "EAA-ready" could mislead merchants into thinking they have nothing to do. Their alt text, product descriptions and third-party apps are still theirs.
- The wording needs legal or your accessibility owner, not a QA thumbs-up.

### What evidence to seek before the newsletter (realistically, in a few days)

**Performance**
- Real-user data from pilot merchants already on the new theme: field Core Web Vitals (LCP, INP, CLS) at the 75th percentile, compared with the old theme on similar shops.
- Run Lighthouse and a trace against a "heavy" reference shop: real third-party apps, a large cart, high-resolution images.
- Profile the checkout interactions (shipping change, voucher, address autocomplete) on a real low-end Android phone, not only in emulation.
- Ask the platform team whether there are load-test results for checkout at peak traffic. If there are none, the newsletter should not imply anything about Black Friday.

**Accessibility (a time-boxed pass, not a full audit)**
- Keyboard only: complete a purchase end to end, including the payment iframe and the 3DS challenge.
- NVDA with Chrome or Firefox, and VoiceOver on iOS Safari: can you complete a purchase, and are errors and total updates announced?
- 200% zoom and 320 px reflow.
- Walk through the four WCAG 2.2 criteria above.
- Note which barriers live in components you don't control (the payment provider's fields, issuer 3DS pages). Those belong in the statement, not in a "fixed" column.

**Security**
- Ask security what has been reviewed for this release: a threat model, a pentest, the multi-tenant authorization tests. Report their answer as theirs.

### What to say in the meeting

> "The Lighthouse scores are good news, and we should keep them as a CI tripwire. But they measure a demo shop loading once in a lab with automated rules. They don't tell us real merchants' checkouts are fast, that a screen-reader user can finish a purchase, or anything meaningful about security. I'd suggest we either narrow the sentence to what we've shown, or give me until Thursday for a focused check on real-user performance data and a manual accessibility pass. 'Secure' and 'EAA-ready' I'd route to security and legal. EAA obligations sit with merchants, and we don't want to give them a reason to skip their own part."

Then offer a replacement sentence, for example:

> "The new checkout theme was built and tested against WCAG 2.2 AA, including keyboard and screen-reader testing, and loads faster than the previous theme in our tests on real merchant shops. See our accessibility notes for known limitations and what you need to check in your own content."

Every clause of that should be backed by evidence you can show.

You don't hold the pen on the newsletter. You do decide what QA puts its name to. Write down what you verified, what you didn't, and who owns the remaining claims, and send it to the product owner and marketing manager. That turns your concern into a decision someone else can make knowingly.

### Common weak answers

- **"100 is 100 — sign it off."** This treats a check as if it were a test, and an automated subset as if it were conformance.
- **"Lighthouse is useless; ignore it."** It's also wrong. Lab scores in CI are a cheap regression tripwire. They just don't support a public claim.
- **"QA blocks the newsletter."** You can't block it, and you shouldn't try. Offer better wording and a short evidence plan.
- **Running a full WCAG audit before saying anything.** That's disproportionate to the decision. Time-box the work and name what is still unknown.
- **Leaving out the platform/merchant split.** On a multi-tenant SaaS platform, most real accessibility and performance problems come from content and add-ons you don't control.

## Follow-up questions

1. **"Should we make the Lighthouse CI gate stricter, say fail below 95?"**
   Gate on specific metric budgets and specific failed audits, not on the overall score. A score threshold can hide a regression that is offset by an improvement elsewhere, and lab variance causes flaky failures. Pair the gate with field monitoring on real merchant traffic, which is where real problems show up.

2. **"A competitor's newsletter says 'fully WCAG compliant.' Why can't we?"**
   Because our claim reaches thousands of merchants who are each legally responsible for their own service. If the claim is wrong, they take the complaints, not us. A specific, evidenced claim that lists its limitations ages better than a broad one, and it gives merchants something they can actually use in their own accessibility statement.

## Sources

- James Bach & Michael Bolton, [Testing and Checking Refined (Satisfice)](https://www.satisfice.com/blog/archives/856). Defines checking as the mechanical verification of propositions and testing as learning through exploring and experimenting. This is the frame for why a green tool score can't support a broad product claim.
- Michael Bolton, [Checking is Inside Testing (DevelopSense)](https://developsense.com/blog/2025/04/checking-is-inside-testing). Treats checking as part of testing, not a replacement for it. This supports keeping Lighthouse as a CI tripwire while adding human testing.
- Ady Stokes, [Tools to help you with accessibility testing (Ministry of Testing)](https://www.ministryoftesting.com/media-sessions/tools-to-help-you-with-accessibility-testing). A practitioner demo of WAVE, Lighthouse and IBM's checker. Its point that automated tools lack context and need human judgment underpins the manual accessibility pass.
- Chrome for Developers, [Lighthouse accessibility scoring](https://developer.chrome.com/docs/lighthouse/accessibility/scoring). Primary documentation: the score is a weighted average of automated pass/fail audits, and manual audits don't affect it.
- GOV.UK Accessibility Blog, [What we found when we tested tools on the world's least-accessible webpage](https://accessibility.blog.gov.uk/2017/02/24/what-we-found-when-we-tested-tools-on-the-worlds-least-accessible-webpage/). Source of the 143-barrier, 41%-best-tool and 29%-undetected figures.
- web.dev, [Why lab and field data can be different](https://web.dev/articles/lab-and-field-data-differences). Explains cold vs. warm cache, why INP depends on real interactions, and why field data should come first. This underpins the "fast" critique.
- Chrome for Developers, [Ensure CSP is effective against XSS attacks](https://developer.chrome.com/docs/lighthouse/best-practices/csp-xss). Shows the Best Practices category judges the strength of a CSP policy, not whether the application is secure.
- W3C WAI, [What's New in WCAG 2.2](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/). Primary source for 2.4.11, 2.5.8, 3.3.7 and 3.3.8 used in the checkout walkthrough.
- Noerr, [Accessibility in e-commerce: new obligations for online shop operators starting from June 2025](https://www.noerr.com/en/insights/accessibility-in-e-commerce-new-obligations-for-online-shop-operators-starting-from-june-2025), and Bird & Bird, [Germany: Ready for the EAA?](https://www.twobirds.com/en/insights/2025/germany/germany-ready-for-the-eaa-european-accessibility-act-implementation-entering-into-force-on-28-june-2). Legal-practitioner context showing that EAA/BFSG obligations apply to online shop operators from 28 June 2025. This is why "EAA-ready" is a legal claim that goes to legal, not QA.
