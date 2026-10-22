# QA Thinking — Day 33

## Testing a League Table: The Same Tie-Break Rules Give a Different Answer Depending on When You Ask

Ranking looks like the easiest part of a sports-data platform. You add up points, sort, and break ties. Teams don't usually lose trust in the data because of a wrong score. They lose it when two teams on identical records come out in an order that a fan, a broadcaster or a betting trader can't explain. Ranking rules belong to the competition organizer, are different in each competition, change between seasons, and some of them **depend on whether the competition is still in progress.**

Today's lesson uses the UEFA Champions League league phase as a worked example. It shows how to test a business rule that includes a time condition, how to dig into a "cosmetic" ranking glitch until you know what it really is, and how to ask product and editorial people the questions they should have answered already.

---

### 1. How standings work on a sports-data platform

**Who consumes the table, and what they need from it:**

| Consumer | What they use | What a wrong order costs them |
|---|---|---|
| Media apps and websites | Live table, qualification-zone colors | Public embarrassment and screenshots on social media |
| Broadcasters | On-screen graphics during live matches | An on-air correction |
| Betting and trading | Markets such as "finish in top 8" or "group winner" | Settlement disputes and money paid out wrongly |
| Fantasy and editorial tools | "Projected" positions | Wrong narratives and user complaints |

**Terms worth knowing:**

- **Ranking criteria / tiebreakers:** the ordered list of rules applied after points. The order matters as much as the rules themselves.
- **Head-to-head vs. overall criteria:** many domestic leagues compare tied teams on their matches against each other before goal difference. Others use goal difference first. A Swiss-style league phase, where each club plays 8 different opponents out of 36, can't use head-to-head reliably, because tied teams may never have played each other.
- **Provisional vs. final standings:** some regulations rank differently while matches are still left to play.
- **Equal ranking:** two teams officially share a position. How you *display* that ("=3", "3", or "3 and 4") is a product decision, not a sorting detail.
- **Corrections:** awarded matches, amended scores, points deductions and disciplinary updates can change a table that was already "final" and already used to settle markets.
- **Qualification zones:** in this format, places 1–8 go straight to the round of 16, 9–24 go to a knockout play-off, and 25–36 are eliminated. That makes the boundaries between 8th and 9th, and between 24th and 25th, the most expensive places to get wrong.

**Worked example (2025/26 league phase):** after points, teams are ranked by:
1. goal difference
2. goals scored
3. away goals scored
4. wins
5. away wins

*While the league phase is in progress, only criteria 1–5 apply.* Teams still tied after those are ranked equal and listed alphabetically. Five more criteria apply only after the final matchday:

6. points of league-phase opponents
7. opponents' collective goal difference
8. opponents' collective goals scored
9. disciplinary points
10. UEFA club coefficient

Check this against the current season's official regulations before you rely on it. Rules change between seasons, and it is now 2026/27. I'm citing a secondary summary below because the UEFA regulations page I tried returned a 404.

The key point: **the same ten criteria give two different algorithms, chosen by a status flag.** That flag is the riskiest thing in the feature.

---

### 2. Where the bugs are

Use James Bach's Heuristic Test Strategy Model (HTSM) product factors as prompts, not as a checklist:

**Time**
- What decides "in progress" vs. "final"? Is it the last match kicking off, the last match ending, the official result being confirmed, or an editor clicking a button?
- On the final matchday all 18 matches kick off at once. During those matches, only criteria 1–5 should apply. If the system switches to "final" mode when the *first* match ends, or when the data feed sends a "matchday complete" event early, criteria 6–10 will quietly reorder teams while other matches are still being played.
- A correction arrives after the table is final. Does the system recalculate in final mode, and does it tell consumers who already settled markets on the old table?

**Data**
- Ties are not rare early in the season. **Uncorner the corner case:** after matchday 1, two teams that each won 1–0 at home are equal on all of criteria 1–5. That's an everyday situation. So "equal ranking, alphabetical" is a main path that needs testing, not an edge case.
- Alphabetical by *which* name? The official name, the short name or the localized name? "Atlético", "Bayern München" and "Club Brugge" sort differently depending on language, accents and article prefixes. Will the German app and the English app show a different order for an officially equal pair?
- Criterion 6 depends on *other teams'* results. One late correction in a match your team didn't play can move your team.

**Operations**
- Who reads equal ranks as an ordering? A trading system that takes "position 8" from a list index will treat alphabetical order as a real ranking.

**Interfaces**
- Do the feed, the API and the rendered graphics all use the same ranking engine, or does a front end re-sort locally with a simpler rule? Compare each consumer surface against the others, not only against the spec.

---

### 3. Following up on a "cosmetic" bug

Suppose you see this on matchday 3: two teams with identical records show as 11 and 12 rather than both as 11, with the team listed first not first alphabetically. The developer says it's cosmetic and offers to fix the display.

Cem Kaner's follow-up testing approach (BBST Bug Advocacy) is to find out whether a minor-looking failure points to something more serious before you report it. He suggests varying four things:

- **Vary your behavior:** recalculate the table again. Ingest the same results in a different order. Does the order of the two teams change? If it does, the ranking isn't deterministic, which is worse than a wrong label.
- **Vary options and settings:** switch the competition config to a domestic league with head-to-head rules. Does the same pair behave correctly there? If so, the bug is probably in how the "in progress" mode is selected, not in sorting.
- **Vary the data:** build a pair tied on 1–5 that differs on criterion 6. If the "wrong" order matches criterion 6, the system is applying final-phase rules during the phase. That isn't cosmetic. It means "top 8" badges, projections and maybe market inputs are using rules that don't apply yet.
- **Vary the environment:** compare the API, the web widget and the broadcaster feed. Do they disagree with each other?

Kaner also suggests checking whether the bug is new (did it start with the season-config migration?) and searching for related reports (has anyone in support seen "wrong order" tickets?).

The report that comes out of this isn't "tie displayed incorrectly." It says something like:

> **During the league phase, the ranking engine applies post-phase criteria (6–10) to teams tied on 1–5.** Reproduced with a constructed pair tied on 1–5 and different on criterion 6: the order follows criterion 6 every time, in API and widget. Real impact today: [N] tied pairs in the live table after matchday 3, including positions 8/9. Consumers affected: the qualification-zone badge and the `position` field in the trading feed. Not yet known: whether the final-matchday switch to post-phase mode happens at the correct moment.

Each claim in that report points to evidence. The part that isn't known yet is stated as a question, not hidden.

---

### 4. Soft skills: ask the questions nobody owns yet

Ranking rules sit between teams. Engineering implements them, editorial or data operations interpret them, and the commercial side sells them. Many tie-break defects are really **interpretation decisions that no one was assigned.** Bring these to refinement or to the product owner, and say who should answer:

1. *Which regulation version and clause is our source of truth, and who confirms we've interpreted it correctly?* (Usually data editorial, not engineering.)
2. *What exactly makes the table "final"?* Name the event, the source, and whether a person can override it.
3. *How do we show equal ranking in each surface and locale?* And which name do we sort alphabetically by?
4. *If our table differs from the organizer's official table, which one do consumers see, and who is alerted?*
5. *After a correction to a final table, what do we owe consumers who already used the old one?*

When someone says "just sort it like everyone else does," don't argue about who's right. Ask for a decision, with the cost of each choice stated: *"If we show equal teams as 11 and 12, the trading feed reads them as a strict order. Is that acceptable, or do we add an explicit `rankShared` flag?"* Your job is to make sure the person deciding knows what they're deciding.

---

### 5. Automation strategy

Exploration finds the risks. Checks keep the risks you've already found under control:

- **Clause-driven fixtures:** for each criterion, keep one small fixture where that criterion alone separates two teams, in both "in progress" and "final" mode. Twenty fixtures cover the whole rule set and point straight to the clause that failed.
- **Invariants:**
  - The order in which results are ingested doesn't change the table.
  - Recalculating twice gives the same table.
  - During the phase, no pair tied on 1–5 is ever ranked strictly.
  - A team with more points is never ranked below one with fewer.
- **Checking the mode switch:** replay a recorded final matchday with staggered result events, and check exactly when the mode changes.
- **Production comparison:** after each matchday, compare your table with the organizer's official table and alert on any difference in position at the zone boundaries (8/9, 24/25).

---

### Practical challenge (45–60 minutes)

Choose one competition your platform covers, or use the league-phase rules above.

1. **Find the time conditions:** list every rule that depends on competition status, matchday or correction state. For each, write down what *your* system uses to decide that status.
2. **Build three tie scenarios:**
   - an everyday tie (like matchday 1)
   - a tie decided only by a final-phase criterion
   - a three-way tie where breaking one tie changes the remaining pair (for head-to-head leagues, find out whether criteria restart for the remaining teams)

   Write down the expected table for each by hand, from the regulation text.
3. **Do one round of follow-up testing:** take any ranking difference you find and apply Kaner's four variations. Rewrite the finding so it states the actual consumer impact.
4. **Write five questions** for your product owner or data editors, each with a named owner and a proposed default answer.

Done well, the result is a one-page note that a product owner could act on today.

---

### Sources

- James Bach, Satisfice: [Heuristic Test Strategy Model (v6.3)](https://www.satisfice.com/download/heuristic-test-strategy-model). Used for the product-factor prompts (time, data, operations, interfaces).
- Cem Kaner: [Follow-Up Testing in the BBST Bug Advocacy Course](https://kaner.com/?p=290). Source of the four variation categories and "uncorner the corner case."
- [2025–26 UEFA Champions League league phase: tiebreakers (Wikipedia, summarizing UEFA regulations)](https://en.wikipedia.org/wiki/2025%E2%80%9326_UEFA_Champions_League_league_phase). Secondary source; check against the current official UEFA regulations before using it as a test oracle.
