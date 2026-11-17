# QA Thinking — Day 45

## Testing Live Score Announcements: A Screen Reader User Can't Glance Away, So Every Update You Push Is an Interruption

It's Saturday, 15:30. Your sports platform's "Live Conference" view shows nine matches at once. Sighted users look at the page whenever something catches their eye. A screen reader user can't do that. They hear whatever the page announces, in whatever order, at whatever rate it decides.

The team says the feature is accessible. Score cells have `aria-live`, axe reports no violations, and a developer heard VoiceOver say "2" when they triggered a goal locally.

All of that can be true and the feature can still fail its users. A screen reader user following nine matches might hear the possession figure for match 4 while a goal in match 7 sits in the queue behind it. Or they might hear "2" with no team, match or minute attached. Or a VAR overturn might never be announced, so they believe a score that no longer exists.

Today's lesson is about testing announcement behaviour as a product decision about **where the user's attention goes**, not as an ARIA attribute to tick off. It also covers how to turn your discomfort while listening to a feature into evidence a team will act on.

---

### 1. Domain primer: what actually changes on a live match page

To design announcements you first need to know which updates the page receives. A typical live match centre gets a normalized event stream. Upstream it comes from a data provider, whose data collectors log events in the stadium. The platform pushes it to clients over WebSocket or SSE. The updates fall into classes with very different urgency:

| Update class | Examples | Frequency | Does the user need to hear it now? |
|---|---|---|---|
| **Clock ticks** | Match minute, stoppage time | Every second | Almost never. They can ask for it. |
| **Running stats** | Possession %, shots, xG | Every few seconds | No. Pull on demand. |
| **Key events** | Goal, red card, penalty awarded | A few per match | Yes, for the matches the user follows |
| **Minor events** | Yellow card, substitution, corner | Dozens per match | Usually in a log the user can read |
| **Corrections** | VAR overturns a goal, goal reattributed to another scorer, event deleted | Rare but critical | Yes. Otherwise the user's mental model is wrong. |
| **State transitions** | Kick-off, HT, FT, suspended, abandoned | A few per match | Yes, often |
| **Odds/markets** (betting products) | Price changes, market suspended | Constant | The price change, no. The suspension, possibly. |

Domain failure modes you should already be thinking about:

- **Bursts.** Goal, VAR check, VAR decision, yellow card and a double substitution can all arrive within about 90 seconds.
- **Concurrency.** On a Saturday afternoon, matches in parallel kick off at the same time, so their key events cluster.
- **Reconnect catch-up.** The socket drops for 40 seconds, the client resyncs, and twelve stored events arrive at once.
- **Corrections arrive as diffs.** The score goes from 2–1 to 1–1, and a naive implementation announces "1", which tells the user nothing.

---

### 2. The oracles: two WCAG criteria help, but they don't decide this for you

Two WCAG 2.2 criteria are your **reference oracles**. You can point a team at them, but each one only goes so far.

**SC 4.1.3 Status Messages (AA).** Status messages that don't take focus must be programmatically determinable, so assistive tech can announce them without moving focus. The W3C Understanding document covers several points that matter here:
- It explicitly warns that live regions can make an application "chatty".
- It lists `role="alert"` / `aria-live="assertive"` on content that isn't important and time-sensitive as a failure.
- It recommends marking up the **whole** string ("3 items"), not only the number that changed.
- It names `role="log"` (ARIA23) for sequential updates, which is close to what a live ticker is.

**SC 2.2.2 Pause, Stop, Hide (A).** Some auto-updating information starts automatically and is presented in parallel with other content. For that content the user needs a way to pause, stop or hide it, **or control the frequency of updates**, unless the updating is essential. The W3C's stock-ticker example is useful here. Pausing holds the current state. Resuming shows that the data is delayed. A separate control jumps to the latest value. That maps closely onto a live score ticker.

Expect someone to say: "Real-time is essential to live scores, so 2.2.2 doesn't apply." Ask a question back instead of arguing. The W3C defines "essential" as something that can't be removed without changing the information *and* that can't be achieved in a conforming way. A frequency control or a "key events only" mode is clearly achievable, so the exemption looks weak. That's a judgement for your accessibility specialist or legal team, not a ruling from you. Your job is to make sure someone actually decides it.

Even full conformance doesn't answer the important question: **can a screen reader user follow three matches during a busy ten minutes?** To answer that you need to test with assistive technology.

---

### 3. Why `aria-live="assertive"` is a request, not a guarantee

Developers often fix "the goal wasn't announced quickly enough" by switching the region to `assertive`. Adrian Roselli's [Live Region Support](https://adrianroselli.com/2026/01/live-region-support.html) results show why that fix proves little. In his testing with recent versions:

- **JAWS + Chrome, Narrator + Edge and Orca + Firefox** treated all regions as polite.
- **NVDA 2024.1 and later** treated both polite and assertive regions as polite. Only `role="alert"` behaved assertively, interrupting and then re-reading the interrupted content.
- **VoiceOver on macOS** let assertive regions interrupt and *stop* reading.
- **No hidden live region announced in any combination tested**, whether hidden with `hidden`, `aria-hidden` or `display:none`.
- Some results changed between minor browser versions. A pattern that JAWS announced with Chrome 143 failed with Chrome 144.

What this means for your test design:

1. **"Assertive" can't be your only mechanism for urgency.** On several common pairings it behaves the same as polite. Urgency has to come from **reducing competing noise**: don't announce clock ticks and possession at all. Wording and ordering matter more than the politeness level.
2. **Hidden tab panels are a real risk in this domain.** If match 7 is in a collapsed accordion or an inactive tab, its live region may never announce. Ask whether the product intends that. Should a user who follows match 7 hear its goal even when its panel is collapsed? That's a requirements question, so take it to refinement.
3. **Your AT/browser matrix is part of the test plan,** and it needs retesting when browsers update. Pick pairings from your own analytics or user research, not from habit.

---

### 4. From "this feels awful" to a bug report a team will act on

Michael Bolton's [Oracles from the Inside Out, Part 4](https://developsense.com/blog/2015/09/oracles-from-the-inside-out-part-4-from-experience-to-inference) describes recognising a problem as a progression:

**experience** (a private, tacit feeling) → **inference** (an explicit inconsistency you can state) → **reference** (a shared artifact others can point to) → **conference** (getting the problem understood by the people who decide)

Listening to a live ticker with a screen reader is a strong source of experience-level oracles. You'll feel overwhelmed, lost or confused. Bolton's point is that the feeling isn't the bug report. It's the signal to do more work. Here's what that work looks like in this feature:

**Experience:** "I couldn't keep up. I'm not even sure what the score is in the Hamburg match."

**Inference:** Name the inconsistency, using a heuristic from Bolton's [FEW HICCUPPS](https://developsense.com/blog/2012/07/few-hiccupps) list:
- *Inconsistent with purpose:* the view exists so users can follow key events across matches, and key events were drowned out by stats updates.
- *Inconsistent with the product itself:* the visual UI shows "1–1 (goal disallowed, VAR)", but the only announcement was "1".
- *Inconsistent with comparable products:* a radio Konferenz broadcast cuts to a goal and states the score and the minute.

**Reference:** Attach things others can inspect:
- A screen recording with audio of NVDA + Firefox while you replay a recorded feed of minutes 66–70.
- An announcement count: "During this 4-minute window: 38 announcements, 31 of them possession or shot counters. The disallowed goal was announced as '1' with no context."
- The relevant 4.1.3 passages on chattiness and whole-string markup.

**Conference:** Write for the decision-maker, not for the person who wrote the ARIA:

> **Risk:** A screen reader user following the conference view can believe a score that has been overturned. In a replay of Saturday's 66–70' window, the VAR overturn was announced as "1" with no match or team, after 31 stat-counter announcements in the same window. On the betting product this means a user may make decisions on a stale score.
> **Evidence:** recording, announcement log, feed replay file attached.
> **Decision needed:** which update classes are announced at all, and what a correction must say. Proposed policy attached.

Notice what this report leaves out. It doesn't say "fails WCAG". It doesn't say "use assertive". And it doesn't hand over a solution as the only option. You're bringing the team a risk and a decision, consistent with bug advocacy (Day 2) and influence without authority (Day 17).

---

### 5. Test design: charters for an announcement system

Run these as exploratory sessions with a screen reader. Don't run them only in DevTools.

First you need testability. Ask for two things:

1. **Feed replay.** A recorded event stream (anonymised production data or a synthetic busy window) that you can replay at 1× or compressed speed.
2. **An announcer service with a log.** If every announcement goes through one client-side function that writes to the live region and also emits `{timestamp, matchId, class, text}` to a debug log, you can measure what the page *tried* to say. What the AT actually spoke is a separate question, and you answer that by listening.

**Charter ideas:**

- **Burst:** Replay goal → VAR check → VAR overturn → yellow → two subs within 90s. Does the user end with the correct score in their head? Is the correction announced as a correction ("Goal disallowed after VAR review. Hamburg 1, St. Pauli 1, 69th minute") or as a bare number?
- **Concurrency:** Two goals in different matches within 3 seconds. Are both announced? Does each one identify its match? Does the second interrupt the first on VoiceOver?
- **Reconnect flood:** Kill the socket for 60s mid-burst, then reconnect. Does the client replay twelve stale announcements, or summarise ("While you were disconnected: 2 goals, Hamburg 2–1 …")? Stale announcements presented as new are a correctness bug, not only a usability one.
- **Interaction collision:** Tab through a bet slip or settings form while events arrive. Does an announcement interrupt a form field label? Does the user lose their place?
- **Pause / frequency control (2.2.2):** Pause, let three events happen, then resume. Is the user told that the data is delayed? Is there a "jump to latest" option? Does resume replay everything or summarise?
- **Collapsed and hidden panels:** Follow a match whose panel is collapsed. Compare what the product *intends* with what the live region does. Roselli's results predict silence.
- **State edges:** Match suspended (weather), abandoned, result later corrected after FT, postponed before kick-off. Each of these needs words, not only a CSS class.
- **Language and formatting:** Does "2:1" get read as a time ("two one" or "two colon one")? Does "67'" get read as "67 apostrophe"? Do screen readers on a German-language page pronounce English team names sensibly?

**What to automate and what not to:**

| Automate (cheap, stable, catches regressions) | Keep human (no oracle without a listener) |
|---|---|
| Live region containers exist in the DOM at page load, before any update | Whether the speech is understandable during a burst |
| Announcement log: counts per class per minute stay within policy (e.g. 0 clock/stats announcements by default) | Interruption and queue behaviour per AT/browser pairing |
| Announcement text for corrections matches a template that includes match, teams, score and minute | Whether the user's mental model of the score is right at the end |
| No `role="alert"`/assertive on non-urgent classes, as a lint/unit rule | Whether the policy itself is the right product decision |

The automated checks guard the **policy**. Human sessions test whether the **policy works for people**.

---

### 6. The conversation that makes this stick

The deliverable that matters most isn't a bug. It's an **announcement policy** agreed in refinement, written as acceptance criteria. You'll probably facilitate it, because nobody else is looking at the whole picture:

- **Product owner:** Which update classes matter to which users? Does a user following one match want different behaviour from a user on the nine-match view?
- **Developers:** Is there a single announcer service? Can we log and throttle there?
- **Data/feed team:** How do corrections arrive: as new events, as deletions, or as silent replacements? A correction you can't detect, you can't announce.
- **Accessibility specialist and, ideally, screen reader users:** Real users will show you things your own listening won't. A tester using a screen reader for a day is not the same as someone who uses one every day. Say this plainly in your report, and push for real-user sessions on high-traffic features.

Asking questions works better than accusing. "What should a user who follows match 7 hear when its panel is collapsed?" gets a design discussion. "Your live regions are broken" gets defensiveness.

---

### Practical challenge (45–60 minutes)

Here's a four-minute feed excerpt from the conference view. Assume a stats update every 5 seconds per match.

```
67:12  M1  GOAL         Hamburg 2–1 St. Pauli (Scorer: #9)
67:40  M1  VAR_CHECK    possible offside
68:02  M4  GOAL         Bremen 1–0 Freiburg
68:55  M1  VAR_DECISION goal disallowed → 1–1
69:10  M1  YELLOW       St. Pauli #5
69:30  M4  SUB x2       Bremen
70:05  M1  EVENT_EDIT   67:12 goal event deleted (provider correction)
```

1. **Count.** Suppose every update, stats included, announces for the two matches shown. How many announcements happen in this window? Write the number down. It's your opening line of evidence.
2. **Write the policy.** For each update class, decide: announce now, log only, or on demand. Write the exact announcement text for the 68:55 overturn and the 70:05 edit. Should 70:05 be announced at all? Justify it in one sentence from the user's point of view.
3. **Write three charters** from section 5 for this excerpt, each with a target AT/browser pairing and a specific way the feature could fail.
4. **Write the conference-level report** in under 120 words, using Bolton's progression. Include one inconsistency you can name, one reference artifact, and the decision you need from the PO.
5. **Stretch:** Turn on NVDA (free) or VoiceOver on any live-score site you can reach. Listen for five minutes during a live match. Note one moment where you felt lost, then write down the inference: which inconsistency caused it?

---

### Sources

- W3C, [Understanding SC 4.1.3: Status Messages (WCAG 2.2)](https://www.w3.org/WAI/WCAG22/Understanding/status-messages): definitions, the "chatty" warning, whole-string guidance, the `role="log"`/ARIA23 technique.
- W3C, [Understanding SC 2.2.2: Pause, Stop, Hide (WCAG 2.2)](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide): auto-updating content, frequency control, the stock-ticker example, the "essential" exception.
- Adrian Roselli, [Live Region Support](https://adrianroselli.com/2026/01/live-region-support.html) (January 2026, with later updates): live region behaviour across screen reader and browser pairings.
- Michael Bolton (DevelopSense), [Oracles from the Inside Out, Part 4: From Experience to Inference](https://developsense.com/blog/2015/09/oracles-from-the-inside-out-part-4-from-experience-to-inference): moving from a tacit feeling to a shared, explicit problem statement.
- Michael Bolton (DevelopSense), [FEW HICCUPPS](https://developsense.com/blog/2012/07/few-hiccupps): consistency heuristics for naming the inconsistency.
