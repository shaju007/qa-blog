# QA Interview Q&A — Day 16

## Question: A designer shares a clickable prototype of the new seller-onboarding flow for your marketplace and says, "Any feedback before I hand off to dev on Thursday?" You have 45 minutes. What do you do with it?

## Answer

**The short version:** I wouldn't review the prototype for bugs. I'd use it to find what the prototype doesn't show. A clickable prototype is a model of the happy path built with clean data, English labels, a fast network and a user who never makes mistakes. Most of what will hurt us later is missing from it. Thursday is cheap, because changing a Figma frame costs minutes and changing shipped behaviour costs a sprint.

### The scenario

Say onboarding has five screens: business details, identity verification, bank account for payouts, tax information, and a "You're live!" confirmation. It looks clean and the designer has tested it with five users, who liked it.

### What I'd do in the 45 minutes

**1. Ask what the prototype is for (3 min).**
I'd ask the designer: "What decisions have you already made, and where do you want to be challenged?" If the layout and tone are settled and they're unsure about the error handling, I'll spend my time there. It also shows I'm not trying to reopen their decisions.

**2. Walk the flow looking for missing states, not wrong pixels (20 min).**
I'd use Michael Bolton's questions as a frame: what are we building, for whom, what could go wrong, and how would we know. Applied to this flow:

- **Failure states.** What does the user see if identity verification is "pending review" for two days, or rejected? Is there a path back, or a dead end? Can they save and resume?
- **Interruption and re-entry.** If the user closes the tab on step 3 and returns on their phone a week later, where do they land? What happens to half-entered data?
- **Real data.** Long German company names ("Müller & Söhne Gesellschaft für …"), names with apostrophes or non-Latin characters, IBANs with spaces, VAT IDs in different national formats. Do the fields, truncation, labels and validation messages cope?
- **Who isn't in the prototype.** Sellers who are sole traders versus companies, sellers in countries where a step doesn't apply, and sellers who made an error and need to edit a submitted field.
- **Keyboard and assistive technology.** Is the focus order visible in the design? Are the error messages tied to fields, not just colored red? Are the tap targets large enough on mobile? WCAG 2.2 added criteria that are easy to miss in a mockup, such as Target Size (Minimum, 24×24 CSS px) and Focus Not Obscured, for example when a sticky "Continue" bar covers the focused field. These are cheap to fix in design and annoying to retrofit.
- **The system's side.** The bank step probably depends on a third-party verification provider. What does the UI do when that provider is slow or down? Can the design say "we'll email you" instead of spinning forever?
- **Observability.** Where would we see that 40% of sellers drop off at step 3? Is the funnel instrumented, and can we tell "abandoned" from "failed"? That's a design-adjacent question because it affects which states exist.

**3. Sort my notes into three kinds (10 min).**
- *Questions*: "What should happen when…?" I don't know the answer, and neither may anyone else yet.
- *Risks with a concrete example*: "If the sole trader has no company name, step 1 blocks them. Here's the field."
- *Observations about consistency*: "The error pattern on step 2 differs from step 4."

I'd keep these separate so the designer isn't handed a list of 30 "issues" and can see what's blocking versus what's polish.

**4. Close the loop (10 min).**
I'd share the notes in the designer's own space (the Figma file's comments, or a short doc), not in a ticket they have to triage. I'd agree on which gaps need a design answer before Thursday and which can become stories with acceptance criteria. I'd offer to pair on the error-state frames and to review them again after the handoff.

### What I'd say aloud

> "I'm not signing off on the design. I'm trying to find the states we haven't drawn yet. I've found six, and three of them I think need your call before Thursday: rejected verification, resume-later, and the provider timeout. The rest I'd turn into acceptance criteria. Where do you disagree?"

I don't have authority over design decisions, so I frame things as questions and evidence and let the designer and product owner decide. The designer knows things I don't, such as research findings and brand constraints, and some gaps may be deliberate (for example, "we'll handle rejection by email in v1").

### Trade-offs

- **Depth versus the deadline.** In 45 minutes I can't cover everything. I'd prioritize flows where failure costs money or trust, here identity and payout details, over cosmetic variants.
- **Early feedback versus noise.** Raising 40 small items makes me less useful than raising 5 that matter. If the designer is nervous or the team is under pressure, I'd lead with the top three.
- **Design completeness versus learning.** Not every state must be designed up front. Sometimes it's better to build the happy path and discover real error behaviour from the provider's sandbox. I'd say which is which.

### Evidence I'd look for

- Support tickets or drop-off data from the current onboarding flow, which show where sellers actually fail.
- The provider's documented statuses and error codes (do they match the states in the prototype?).
- The usability test notes: were participants given realistic data, or the designer's sample names?
- Whether the design system already has patterns for error, empty, loading and disabled states that this prototype should reuse.

### Weak answers and assumptions

- **"I'd wait for the build and test it."** This throws away the cheapest point at which to find problems.
- **"I'd check that it matches the requirements."** Prototypes and requirements share the same blind spots.
- **Giving only visual feedback** ("this button should be bigger") without raising behaviour, data or failure modes.
- **Treating it as a gate**: "I'll approve it once the states are added." You have no authority for this, and it turns collaboration into policing.
- **Assuming designers don't care about edge cases.** Most do, but they rarely have the system knowledge to see which edges exist. QA can supply that.

### Follow-up questions

1. The designer replies, "Edge cases are for later; we need to validate the main idea with users first." How do you respond, and what would you accept as a reasonable compromise?
2. During the build, the developer implements a rejection state differently from the designer's later frames. Who decides what ships, and what's your role?

## Sources

- Michael Bolton, DevelopSense, ["Four (and More) Questions for Testers to Ask"](https://developsense.com/?p=1568). I used the question set (what are we building, for whom, what could go wrong, how would we know) and the extra prompts about missing things and people we aren't building for, as the frame for reviewing a prototype.
- Ministry of Testing, ["99-Second Introduction: What is the Relationship Between the Tester and the UX Designer?"](https://www.ministryoftesting.com/media-sessions/99-second-introduction-what-is-the-relationship-between-the-tester-and-the-ux-designer). I used it only to confirm that testers and UX designers working together is an established practice. The session itself is members-only, so I couldn't read it and have not relied on its content.
- W3C WAI, ["What's New in WCAG 2.2"](https://w3.org/WAI/standards-guidelines/wcag/new-in-22/). I used it for the Target Size (Minimum, 2.5.8) and Focus Not Obscured (Minimum, 2.4.11) criteria, which are easy to miss in static or prototype designs and cheaper to fix before handoff.
