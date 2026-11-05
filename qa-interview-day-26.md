# QA Interview Q&A — Day 26

## Question: Two days before release, your designer files 47 "design QA" tickets against the redesigned live match centre. In triage, the engineering lead says: "QA, can you close the cosmetic ones so we can ship?" What do you do?

**Context:** You test a sports-data app. The redesigned match-centre screen shows live scores, the match clock, goal and card events, and lineups. It ships Thursday, and the club partners' marketing has been timed around that date. On Tuesday afternoon the designer finally got time on staging and went through every screen against Figma. The next morning the backlog has 47 new tickets, all labelled `design-qa`, with no priorities set.

## Answer

### The short answer

No, I won't bulk-close them. I don't own the design intent and I don't own the release decision, so neither "cosmetic" nor "close" is my call to make alone. What I can offer is to make those 47 tickets something the team can decide on within about an hour. I'll sit with the designer, sort the tickets by what they do to users, and bring back a short list. Calling something "cosmetic" is a severity judgment, not a category, and in a live-score product many visual details carry the data itself.

### Why "close the cosmetic ones" is the wrong instruction

The lead's request assumes the tickets split cleanly into "functional" and "looks". On a match centre they usually don't. When I read 47 tickets like these, I'd expect some of the following to be hiding among the spacing complaints:

- **The losing team's score is in a muted grey on dark mode.** The ticket says "wrong grey token." The real problem is that the score, the most important number on the screen, may fall below the 4.5:1 contrast WCAG asks for normal text. Users in sunlight, or with low vision, may misread it.
- **The stoppage-time clock truncates.** "90+4'" shows as "90+". That's a data-display defect, not a styling one.
- **Long team names collide.** "Borussia Mönchengladbach" truncates to "Borussia M…". The designer filed it as "ellipsis looks ugly." In a fixtures list that also has Borussia Dortmund, users can't tell which match they're looking at.
- **The red-card icon is 16×16 px.** It opens the player sheet and sits right next to the substitution icon. The ticket says "icon misaligned by 2px." The bigger issue is that the target is probably too small. WCAG 2.2 SC 2.5.8 (Level AA) asks for 24×24 CSS px unless the spacing exception applies. If your organisation targets AA, that's a conformance question, not polish.
- **There's no design for a disallowed goal.** The ticket reads "VAR state doesn't match Figma." It can't match, because Figma has no such state. The developer improvised, and the goal stays visually highlighted after it has been overturned. This is a missing requirement found by design review.
- **Then the genuinely cosmetic ones:** 12px gaps where the spec says 16px, an icon corner radius, a slightly different shade of the brand green on one tab.

Michael Bolton's FEW HICCUPPS oracles help me explain this in triage. A design ticket can point at several different kinds of inconsistency:

- **Claims:** it doesn't match the Figma file.
- **Product:** it's inconsistent with the rest of the app.
- **Image:** it's inconsistent with the brand the club partners are paying to see.
- **Purpose:** it gets in the way of what users came for, which is knowing the score right now.
- **Statutes and standards:** it misses accessibility requirements.

A pure "Claims" mismatch is often cheap to defer. A "Purpose" or "Statutes" problem is not, whatever the ticket title says.

### What I do in the next hour

1. **Book 45 minutes with the designer, plus one developer if possible.** I don't triage their tickets without them. They know what each ticket was about. I know how the screen behaves with real data, odd states and assistive tech.
2. **Cluster before rating.** In my experience, 47 tickets rarely mean 47 problems. Twenty of them might come from one wrong spacing token or one component that wasn't updated. If so, that's one fix with a large visible payoff, and the developer can tell us how big it is. I'd make this the first thing the engineering lead hears.
3. **Sort by user impact using a shared scale.** Nielsen Norman Group's severity model is useful here. It weighs frequency, impact, persistence and market impact, and it warns that one evaluator's severity rating is unreliable. That backs up rating together rather than letting any one person (me, the designer or the lead) label things "cosmetic." I'd use three buckets:
   - **A: Changes what users understand or can do.** Misread data, unreachable controls, missing states, accessibility conformance.
   - **B: Visible inconsistency on high-traffic or partner-branded surfaces.** The Image oracle; the team has to decide whether that's acceptable for launch.
   - **C: Polish.** Real, but the user experience is the same either way.
4. **Gather evidence for bucket A, not opinions.** I'd collect:
   - Screenshots from real devices, with dark mode, 200% text size and the German locale switched on.
   - Real-world fixture data: extra time, penalty shoot-outs, postponed and abandoned matches, overturned goals, long team names.
   - A contrast ratio measured from the rendered screen, not taken from Figma.
   - Traffic data showing which screens matter. Lineups get a fraction of the views the live scoreboard gets.
5. **Agree with the designer what to propose, then write it down.** Bucket A becomes candidate release blockers with clear repro steps. Bucket B gets a recommendation either way. Bucket C moves to a named follow-up release with an owner. Nothing gets closed. Closing tells the designer their review was noise, and it destroys the record we need afterwards.

### What I'd say in triage

> "We didn't close anything. Sarah and I went through all 47 tickets. Twenty-three come from one spacing token, and Dev says that's about a two-hour fix. Five tickets change what users see or can do: the stoppage-time clock truncates, the losing score may fail contrast on dark mode, the red-card target is 16px next to another control, long team names become ambiguous, and an overturned goal stays highlighted. We'd recommend fixing those five before Thursday. We have screenshots and the fixture data that reproduces each one. Six tickets are brand inconsistencies on the partner-branded header. That's Product's call, and Sarah has a view on it. The remaining thirteen are polish, and we've moved them to the next sprint with her agreement. The release decision is yours. Here's what you'd be shipping with if we defer each group."

This keeps me in my role. I describe the risk, I bring evidence, and I make a recommendation. I don't claim authority I don't have. It also doesn't let me quietly speak for the designer: the six brand tickets go to the product owner with both views stated.

### What I'd raise after release

Forty-seven tickets two days before release is a scheduling symptom, not a design-team problem. The designer reviewed the product only once it was finished, against static mocks, using demo data. I'd suggest:

- **Design review per pull request,** on preview builds or component stories, while changes are still cheap.
- **Stress fixtures in the design file:** long names, "90+12'", a 7–6 score after penalties, a disallowed goal. Missing states then show up in refinement instead of on staging.
- **Visual regression for drift only.** Snapshot tests catch unintended changes after a baseline is approved. They don't tell you whether the baseline was right, so they don't replace the designer's review.

### Weak answers interviewers hear

- **"Sure, I'll close the cosmetic ones."** This treats a ticket's title as its severity and takes over a decision that belongs to the designer and the product owner.
- **"All 47 are bugs, so we can't ship."** This is gatekeeping without prioritising, and it burns credibility with the lead.
- **"Design issues aren't QA's job."** In a data product, the display is where data defects become visible to users.
- **"We'll catch it with visual regression tests."** They detect change, not correctness.
- **Triaging the designer's tickets without the designer.** You lose their intent and their trust in the same move.

### Follow-up questions

1. *The designer insists all 47 tickets are blockers because "the partners signed off on these exact screens." How do you respond?* Treat the partner sign-off as a Claims oracle with real commercial weight. Ask which differences the partner would actually notice, and escalate that question to the product owner, who owns the partner relationship. Don't argue about it as a testing matter.
2. *After release, a club complains about the brand-green mismatch you'd put in bucket B. What do you take from that?* That the Image and market-impact factors were underweighted. Adjust how you rate partner-branded surfaces next time, not just this ticket.

## Sources

- [Michael Bolton, "FEW HICCUPPS" (DevelopSense)](https://developsense.com/blog/2012/07/few-hiccupps): defines the Claims, Image, Product, Purpose and Statutes oracles used above to show that a "design" ticket can be a brand, consistency or standards problem, not just a mismatch with Figma.
- [Nielsen Norman Group, "Severity Ratings for Usability Problems"](https://www.nngroup.com/articles/how-to-rate-the-severity-of-usability-problems/): the frequency, impact, persistence and market-impact factors, the 0–4 scale where "cosmetic" is just one rating, and the warning that one evaluator's severity rating is unreliable. Together these support sorting the tickets jointly with the designer rather than having anyone label them alone.
- [W3C, Understanding WCAG 2.2 SC 2.5.8 Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html): the Level AA 24×24 CSS px minimum and its spacing exception, behind the red-card icon example.
