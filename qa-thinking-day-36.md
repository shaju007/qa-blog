# QA Thinking — Day 36

## Testing Consent Signals in Ad Tech: A Consent String Is a Record With a Birth Date, Not a Yes/No Flag

Suppose you work on a bidder at a DSP, or on an SSP that forwards bid requests into real-time bidding. Every European bid request carries a TC string (the IAB TCF consent string) in `gdpr_consent` or the OpenRTB equivalent. Your service decodes it and makes a decision: bid with personalised ads, bid contextually, or drop the request.

Most consent test suites look the same. Someone generates a dozen strings ("all consent", "no consent", "purpose 1 only") and checks that the decision function returns the right answer for each. Everything passes.

These suites miss something. A TC string records what was shown to one person, on one day, under one version of the rules, using one version of the vendor list. You make your decision months later, under rules that may have changed since. Today's lesson covers how to test that time gap and how to talk about it with the privacy counsel who owns the rules.

---

### 1. A short domain primer

Here is what you need before the testing makes sense:

- **CMP (Consent Management Platform):** shows the consent UI on the publisher's site and writes the TC string. CMPs usually run in the user's browser.
- **TC string:** a base64url-encoded bit structure. The core segment holds purpose consents, legitimate-interest (LI) signals, per-vendor bits, the CMP ID, the version of the vendor list used, and the `Created`/`LastUpdated` timestamps. Optional or newly mandatory segments follow, separated by dots.
- **GVL (Global Vendor List):** the registry of vendors and the purposes and legal bases each one declares. It is versioned. The spec requires CMPs to use the *latest* GVL when they show the UI, and requires vendors to interpret a string using *the GVL version encoded in that string*, not today's list.
- **Purposes vs. special purposes:** purposes (store/access information on a device, personalised ads, measurement, and so on) need a legal basis, either consent or LI. Special purposes (such as security and fraud prevention, or technically delivering an ad) don't depend on the user's choice in the same way. A vendor still has to have been disclosed to the user before it can rely on them.
- **The 2.2 change:** since TCF v2.2 (May 2023), LI is no longer an allowed basis for the purposes behind personalised ad and content profiles.
- **The 2.3 change:** this is today's topic. The `disclosedVendors` segment used to be optional and is now mandatory. IAB Europe made the change to remove ambiguity about how LI and special-purpose disclosure were represented. The rule has a date in it. Strings **created before 1 March 2026** without the segment stay valid "until they progressively get replaced". Strings **created after the deadline** without it are invalid. Vendors check their own bit in `disclosedVendors` (1 = disclosed, 0 = not disclosed) to decide whether they can process data for special purposes.

The tester's reading of that rule: one string can be valid or invalid depending on when it was created. Seven months after the deadline, both kinds of string are still arriving in your traffic.

---

### 2. Use HTSM to find what the example-based suite misses

James Bach's [Heuristic Test Strategy Model](https://www.satisfice.com/download/heuristic-test-strategy-model) is a checklist of guidewords for test strategy. Version 6.3 puts extra emphasis on state-based testing and boundaries. Three of its Product Factors are useful here.

**Data, and its lifecycle.** A TC string is created, stored in a cookie or local storage, re-sent on each request, sometimes updated, and eventually replaced. Ask what happens at each stage:

- *Creation:* which CMP wrote it, and on which GVL version?
- *Persistence:* how old is the string you received today? (Many teams don't log this.)
- *Transformation:* did a macro, a URL-encoding step, or a proxy change it? Truncation and `+`/`/` vs `-`/`_` handling are old bugs in base64url systems.
- *Replacement:* when a user returns, does the CMP rewrite the string with the new segment, or keep re-sending the old one?

**Time.** HTSM's Time factor covers timing, timeouts, and the passage of time. Every relevant timing question applies here:

- **Day-level timestamps.** The spec says `Created` and `LastUpdated` now carry the same day-level value. "Created before 1 March 2026" is therefore a comparison of whole UTC days. Test the last day before the cut-off, the cut-off day, and the day after. Check whether your code compares against midnight UTC or midnight in your server's zone. A Hamburg server on CET treats the boundary an hour off unless someone thought about it.
- **Who wrote the clock.** CMPs usually run in the browser, so `Created` may come from the user's device clock. Ask your team how the decision function treats a string without `disclosedVendors` whose `Created` date is in February 2026 when it first appears in your logs this week. What about a `Created` date in the future? This is a question for the team. I'm not claiming a known exploit.
- **Version drift.** The string says "GVL version N". Your service caches GVL version N+40. If you evaluate the vendor's declared purposes against today's list, the code is simpler and wrong. Vendors change their declarations between versions, so the encoded version is the oracle.

**Interfaces.** The same string reaches you through different paths: OpenRTB fields, URL macros, a server-side wrapper, an app SDK. Test the decision once per path. A string that decodes correctly in the JSON body can arrive truncated in a GET macro.

---

### 3. Design the tests as a decision table, not a list of examples

Model the rule explicitly. These are the conditions:

| Condition | Values worth testing |
|---|---|
| `Created` day | before 2026-03-01 / 2026-03-01 / after / future-dated |
| `disclosedVendors` segment | absent / present / present but malformed |
| Our bit in `disclosedVendors` | 1 / 0 / our ID beyond the encoded range |
| Our basis for purpose X in the encoded GVL | consent / LI / not declared |
| User signal for purpose X | consent=1 / consent=0 / LI objection |
| Special purposes declared by us | yes / no |

You don't need every combination. You do need every row where the rule's outcome changes. These are the rows I would write first, because each one corresponds to a real failure mode:

1. **Legacy string, no segment, created February 2026, full consent.** Expected: valid. A bidder that "upgraded to 2.3" by rejecting every string without the segment silently drops legitimate traffic. Nobody files a bug about bids that never happen.
2. **Same string, but `Created` = 2026-03-01.** Expected: invalid. Note that this is about whether the string is *valid*, which is a separate question from what your business does with an invalid one.
3. **Segment present, our disclosure bit = 0, we declare a special purpose.** Expected: we can't rely on the special purpose. This is the case 2.3 was written for.
4. **Our vendor ID is higher than the maximum encoded in a range-encoded segment.** A naive decoder throws, returns `true`, or returns `undefined`. Each of those leads to a different business outcome.
5. **The encoded GVL version shows us declaring LI for a purpose; today's GVL shows consent only (or the reverse).** Expected: follow the encoded version. This test exists to catch someone "simplifying" the cache.

Get oracles from more than one place. The spec is one. An **independent decoder** is another: an open-source TCF library, or the decoding function in a data-platform SQL engine such as AWS Clean Rooms' `consent_tcf_v2_decode`. If your decoder and an independent one disagree on a string, that's worth investigating even when your test is green. A sample of **real production strings**, bucketed by `Created` month, is a third. It tells you which rows of your table actually occur in traffic.

---

### 4. Observability shows how exposed you are

Add one dimension to your existing metrics: **the share of incoming strings with no `disclosedVendors` segment, broken down by `Created` month.**

- If that share is still large for strings created months before the deadline, many users haven't been re-prompted. Your legacy-validity branch is load-bearing code, not dead code.
- If strings without the segment carry recent `Created` dates, some publisher's CMP never migrated. That's a supply-side partner conversation, not a bug in your bidder.
- If the decision outcome ("bid personalised / contextual / drop") shifted sharply around 1 March 2026 and nobody can explain why, that is your most important test result, and no test case produced it.

---

### 5. The soft-skill part: turn privacy counsel's rules into decisions someone owns

Testers who meet consent rules tend to fall into one of two traps. One is acting as a junior lawyer ("I think this is non-compliant"). The other is staying silent because "legal owns that." Neither helps.

What helps is translation. Counsel thinks in legal bases and obligations. Engineers think in branches. You can show both groups the same table.

**Bring cells, not opinions.** Don't say "I'm worried about legacy strings." Say this instead:

> "Row 2 in this table: string without `disclosedVendors`, created 1 March or later. The spec calls it invalid. Our code currently drops the request entirely. The alternative is to bid contextually, with no personal data processing. Which of those do you want? I'm not asking whether the string is valid. I'm asking what we do with an invalid one."

**Make the asymmetry visible.** In consent logic, both failure modes are quiet. Over-blocking shows up as lower fill rate, which someone will blame on the market. Under-blocking shows up much later, in an audit or complaint. Neither one throws an error. Say this out loud, because stakeholders tend to assume "no alerts" means "no problem."

**Get an owner for every ambiguous cell.** For each row where the spec is clear, the code should follow the spec, and you test it. For each row where the spec leaves a choice to the business (what to do with an invalid string, how to treat a future-dated `Created`, whether to trust a CMP known to be misconfigured), write down who made the decision and when. This gives you an oracle for future regressions. It also protects you when someone later asks why the bidder behaved the way it did.

**Report uncertainty precisely.** "Consent handling is tested" is not a test report. This is:

> "We verified the 2.3 validity rule at the 1 March boundary for OpenRTB and GET-macro paths. We haven't verified app-SDK traffic because we have no captured strings from it. 31% of today's strings lack the segment, almost all created before March. One publisher is still writing segmentless strings dated this month. Ad Ops has the list."

The 31% is an example figure. Use your own number. The structure is the point: what was covered, what wasn't and why, and what production data shows.

---

### Practical challenge (45–60 minutes)

1. **Build the table.** Using the conditions in section 3, write the minimum decision table that covers every change in outcome for one purpose your product relies on (for example, personalised ad selection) and one special purpose. Mark each cell **Spec-defined** or **Business choice**.
2. **Generate five strings** for rows 1–5 above using an open-source TCF encoder. Decode each one with a *different* library and compare the results. Write down any disagreement, even a cosmetic one.
3. **Pull a production sample** (or ask the data team for one): 10,000 recent strings, bucketed by `Created` month and by segment presence. Write one paragraph on what the distribution says about how much traffic depends on the legacy rule.
4. **Draft the message to counsel.** Five sentences maximum, covering the "Business choice" cells, each phrased as a decision with an owner. Write no legal opinions of your own.

Stretch goal: find out where your CMP's `Created` value comes from (browser or server) and write the one test you would add because of the answer.

---

### Sources

- James Bach, Satisfice — [Heuristic Test Strategy Model v6.3](https://www.satisfice.com/download/heuristic-test-strategy-model): Product Factors (Data, Time, Interfaces) and the 6.3 emphasis on state and boundaries, applied here to the consent-string lifecycle.
- Cem Kaner — [The Oracle Problem and the Teaching of Software Testing](https://kaner.com/?p=190): background on why the spec alone is not enough of an oracle and why to triangulate with independent decoders and production data.
- IAB Europe — [All you need to know about the transition to TCF v2.3](https://iabeurope.eu/all-you-need-to-know-about-the-transition-to-tcf-v2-3/): the mandatory `disclosedVendors` segment, the 28 Feb / 1 March 2026 cut-off, validity of legacy strings, and vendors' bit check for special purposes.
- IAB Tech Lab — [Consent string and vendor list formats v2 (GitHub spec)](https://github.com/InteractiveAdvertisingBureau/GDPR-Transparency-and-Consent-Framework/blob/master/TCFv2/IAB%20Tech%20Lab%20-%20Consent%20string%20and%20vendor%20list%20formats%20v2.md): day-level `Created`/`LastUpdated`, the definition of the `disclosedVendors` segment, and the rule to interpret strings using the encoded GVL version.
- Consently — [How the IAB TCF Works: TC Strings, Vendors, Purposes](https://consently.net/blog/how-iab-tcf-works) (vendor blog, used only for the primer on string transport via `__tcfapi`, bid requests, and the `gdpr_consent` macro, and for the v2.2 removal of LI for purposes 3–6; checked against the IAB spec).
- AWS — [`consent_tcf_v2_decode` (Clean Rooms SQL reference)](https://docs.aws.amazon.com/clean-rooms/latest/sql-reference/consent_tcf_v2_decode.html): an example of an independent decoder to use as a comparison oracle.
