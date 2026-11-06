# QA Thinking — Day 41

## Switching Sports-Data Providers: A Diff Is a Question, Not a Bug. Testing a Historical Stats Migration

Your company runs a football stats and fantasy platform. Leadership has signed with a new data provider. The plan has three steps: map every team, player, competition and match to the new provider's IDs, backfill ten seasons of historical player stats from the new feed, then switch the live feed over before the January transfer window.

The migration ticket has one acceptance criterion: **"Historical stats parity with the current provider."**

The first dry run comes back. Row counts match within 0.4%, and the developer spot-checked 50 famous players and they "look right." Then you run a full diff between old and new stats and get 38,000 differing values.

Both readings are useless as they stand. "Counts match" hides wrong data, and "38,000 diffs" is noise nobody can act on. Today's lesson is about what sits between them: **sort every difference by its cause, give each cause its own oracle and its own owner, and turn the result into decisions a product owner can make.**

---

## 1. The domain in five minutes: what you're actually migrating

If you haven't worked with sports data, these are the parts that matter for testing:

- **Event data is collected under proprietary rules.** Providers log on-pitch actions (passes, shots, tackles) under their own *event definitions*. They are not universal facts. Opta's public definitions say an assist is the final touch from a teammate before a goal. They also say **no assist is given for own goals, direct free-kick goals, direct corner goals, or penalties** (unless the taker passes instead of shooting). A shot cleared off the line by a defender counts as a **shot on target**, not a blocked shot ([Opta Analyst, stats definitions](https://theanalyst.com/articles/opta-football-stats-definitions)). Another vendor can draw those lines differently and be just as correct by its own rules. Academic work on vendor data says the same: assist definitions differ across vendors such as Opta, Wyscout and Sportec ([Sports Engineering, Springer](https://link.springer.com/article/10.1007/s12283-025-00533-4)).
- **Every provider has its own IDs.** One player has a different ID at every provider. Sportradar uses IDs like `sr:player:12345` and `sr:competitor:44`. Their documentation says player IDs "will not change once created". It also documents **Player Merge Mappings** and **Competitor Merge Mappings** for consolidated duplicates, and says match IDs can change for postponed matches or accidental duplicates ([Sportradar ID handling](https://developer.sportradar.com/soccer/docs/soccer-ig-id-handling)). Treat the stability claim as conditional: it holds except where the provider has documented exceptions.
- **Cross-provider matching is fuzzy by necessity.** US Soccer's open-source Glass Onion tool shows how much fuzziness the job needs. Its steps include team-name cosine similarity with a 75% threshold, shifting match dates by **±3 days** for time-zone and scheduling differences, matching players on name similarity plus jersey numbers, and allowing **birth dates off by ±1 day or with day and month swapped** ([American Soccer Analysis, Jan 2026](https://www.americansocceranalysis.com/home/2026/1/25/introducing-glass-onion-by-us-soccer-an-identifier-synchronization-tool)). Each of those relaxations exists because real data needed it, so each one also marks a place where real data breaks.

This changes the meaning of "parity." The old and new numbers will never match exactly, because the providers count differently. The real question is which differences your users and your business can accept.

---

## 2. Why "counts match + sample looks right" is a weak oracle

Cem Kaner's essay [*The Oracle Problem and the Teaching of Software Testing*](https://kaner.com/?p=190) helps here in two ways.

First, every oracle is incomplete, and leaning on one produces **misses** (you conclude it passed when it failed) and **false alarms** (you conclude it failed when it worked). The row-count check produces misses: if two different players are mapped onto one ID, the counts can still balance. The raw diff produces false alarms: thousands of correct definitional differences look like defects.

Second, Kaner distinguishes two kinds of oracle:

- The Bach/Bolton consistency heuristics (history, claims, comparable products, user desires and so on) are strong for *evaluating and explaining* a problem once you've seen it. They are weak for *designing* automated checks.
- Doug Hoffman's specific oracle types (constraint, statistical, inverse, reference program, business model and others) are things you can program.

A migration needs both. Use Hoffman-style oracles to process 38,000 diffs automatically. Use consistency heuristics to explain the few that matter to a product owner. The rest of this lesson does exactly that.

---

## 3. Sort each difference into one of three buckets before calling anything a bug

Every difference between old and new data comes from one of three causes. They need different evidence and different owners:

| Bucket | What it is | Example | Who decides |
|---|---|---|---|
| **A. Identity error** | The wrong real-world entity is linked | Two players called "Danilo" collapsed into one ID; a 2016/17 match linked to the replayed fixture after a postponement | Engineering. This is a defect. |
| **B. Definition difference** | Same entity, same event, counted under different rules | A last-man goal-line block is "shot on target" at Provider A and "blocked shot" at Provider B; an assist from a deflected cross awarded by one and not the other | Product. Accept it, annotate it, or freeze history. |
| **C. Transformation defect** | Your own pipeline changed the data | Minutes played truncated at 90 so stoppage time is lost; a season boundary assigned in UTC so a late-May fixture lands in the next season; a split-season league folded into one | Engineering. This is a defect. |

The key point is that **buckets A and C can't be filed as definition differences, and bucket B can't be filed as a bug.** Most failed migrations fail on this sorting. Either real identity errors get waved through as "vendor differences," or the team burns two sprints "fixing" definitional gaps that no amount of code will close.

Before you report anything, add a `cause` column to your diff output.

---

## 4. Turn the sorting into programmable oracles

These are Hoffman's oracle types from Kaner's list, applied to this migration. Each one separates buckets without anyone eyeballing 38,000 rows.

**Constraint oracles (catch bucket A and C directly)**
- A player can't appear for both teams in the same match.
- A player can't take part in two matches that overlap in time.
- Minutes played per player must be at least 0 and no more than match length plus extra time.
- A player with a recorded birth date shouldn't be 13 or 52 in a senior first-team match. If you see that, look for the day/month swap Glass Onion tolerates.

**Invariants that hold whatever the provider's definitions**
- The final score is official. So *team goals from Provider B = official final score* for every match, whatever B's definitions are. **Attribution** can legitimately differ (a deflected shot could be a goal for the shooter or an own goal for the defender), but **totals** can't. A total mismatch is bucket A or C. An attribution mismatch with matching totals is probably bucket B.
- Appearances per match should be at most 11 starters plus the competition's substitution limit. Remember that limits changed over the ten seasons, so the rule itself needs a date.

**Inverse oracle (catches bucket A)**
- Round-trip every ID: old → new → old. The mapping must be one-to-one. If two old IDs map to one new ID, either two players were merged by mistake or the provider merged a real duplicate, and you need to know which. If one old ID maps to two new IDs, a player's career is now split in two.

**Statistical oracle (separates bucket B from A)**
- A definitional difference is *systematic*. If Provider B awards about 6% fewer assists, that ratio should be roughly stable across players, teams and seasons. Plot new/old per player-season. Bucket B forms a tight cloud. **Bucket A shows up as outliers**: one player whose assists triple and another whose drop to zero is the classic sign of two careers being swapped.
- Watch for steps over time. If the ratio jumps in one season, check whether a provider changed its own definitions or collection method that year. That's still bucket B, but the product owner needs to hear about it.

**Business-model oracle (shows impact)**
- Recalculate last season's fantasy points from the new data. You don't need every number to match. You need to know which *user-visible outcomes* change: league winners, weekly prizes, a player's "season record" badge. That turns "diffs" into "consequences."

---

## 5. Test where the matcher bends

Every tolerance in a fuzzy matcher marks a risk area. Use the matcher's design as your test-idea generator:

- **Name similarity threshold →** players with very similar names: family members at the same club, common names like "Danilo" or "Rodri" across clubs, transliterated names (Cyrillic, Arabic, Korean), players who changed their registered name.
- **±1 day / day-month swap on birth dates →** two players with the same surname born on 03/04 and 04/03 respectively. Specifically search for pairs that a lenient match could join.
- **±3 day match-date window →** postponed or rearranged fixtures, especially when the original and rescheduled matches are close together, and cup replays (where the competition still has them) between the same two teams.
- **Team name similarity →** renamed clubs, reserve and B teams ("Borussia Dortmund" vs "Borussia Dortmund II"), and women's and men's teams that share a name.
- **Competition structure →** formats that changed within your ten-season window. The Champions League moved from group stage to a single league phase in 2024/25. Check how each provider models "group" and "stage" across that change.

Don't sample "50 famous players." Famous players are the easiest to match. **Sample from places where the matcher was least sure**: ask engineering for the match-confidence score per entity and test the lowest decile. If the pipeline doesn't produce confidence scores, raise that as a testability gap before cutover.

---

## 6. The mapping table keeps changing after cutover

The migration ticket treats ID mapping as a one-time step. Sportradar's documentation shows otherwise: merges and postponement-driven match ID changes keep happening after go-live. So you also need checks after cutover:

- **Merge after cutover:** the provider merges two player IDs into one. Does your platform consume the merge mapping, re-point history, and keep both fantasy squads that held the old IDs? Or does one squad suddenly contain a player who "doesn't exist"?
- **Postponed fixture:** the match ID changes. Do lineups, predictions, and notifications attached to the old ID move over, or are they orphaned?
- **Detect drift:** a scheduled reconciliation that reruns the inverse-oracle round trip and alerts on new many-to-one mappings. In this domain that check belongs in production.

---

## 7. The soft skill: turn 38,000 diffs into three decisions

This is where the technical work turns into influence. The product owner wrote "parity." They don't want a spreadsheet. They want to know whether they can launch and what users will notice.

**Ask questions that reveal the real requirement**, before giving any results:

1. "When a user looks at a player's career page after cutover, should past seasons show the *old* provider's numbers frozen, or be restated in the *new* provider's definitions?"
2. "If a past fantasy season's winner would change under restated data, do we restate it, annotate it, or never recalculate closed seasons?"
3. "Does our contract let us keep showing the old provider's historical data after the contract ends?" Ask this one, don't assume. It often decides question 1 for you, and it's a question for legal or partnerships, not engineering.
4. "Which numbers do we publish as editorial facts (articles, social posts, 'club record' claims), where a restatement could embarrass us publicly?"

**Then report the buckets, not the diff count.** An example status note:

> **Historical stats migration: dry run 2 findings**
>
> **Blocking (engineering, bucket A):** 214 player IDs map many-to-one. At least 9 are confirmed different people merged together (e.g., two players with the same surname and swapped birth day/month). Career totals for those players are wrong in both directions. The full list is attached with the evidence (DOB, club, jersey per match).
>
> **Blocking (engineering, bucket C):** Late-May fixtures in 4 leagues are assigned to the following season because of a UTC season-boundary rule. Affects about 1,100 player-season rows.
>
> **Decision needed (product, bucket B):** Under the new provider's definitions, assists are about 5–7% lower on average across all ten seasons. The difference is systematic, not random (distribution attached). If we restate history, 3 past fantasy-season podiums change and 2 published "club record" articles would no longer match our own stats pages. Options: restate, freeze old history, or restate with a "definitions changed" note. I recommend deciding this before we fix the bucket A/C items, because the choice changes which validation we run next.
>
> **Not yet tested:** behaviour after cutover when a provider merges player IDs. There's no merge in the sandbox feed, so we need a fixture or a mock.

Notice what this note does. It **separates "we are wrong" from "they count differently,"** so developers aren't blamed for vendor definitions and vendor definitions don't get mislabeled as bugs. It **puts numbers on user-visible consequences**, which carries more weight than a diff count. It **names the decision and its owner** instead of leaving "parity" ambiguous. And it **says what wasn't tested.**

**If you hear "Just make the numbers match"**, don't argue for purity. Explain what it would take: matching the old numbers means rebuilding the old provider's definitions on top of the new provider's raw events. Some differences (like how a deflection was judged) aren't in the raw data at all. Ask: "Is it worth a reimplementation project to keep numbers that exist for continuity, or is a visible 'stats provider changed in 2026' note cheaper?" Your job is to make the trade-off visible. The product owner owns the choice.

---

## 8. Practical challenge (30–40 minutes)

Here are eight differences from a migration dry run. For each one: (a) put it in bucket A, B, or C, (b) name the oracle that would have caught it automatically, and (c) say who owns the next step.

1. A striker's 2019/20 goal count is the same, but assists drop from 9 to 7. Two of the old assists were on goals from direct free kicks.
2. A team's total goals in one match are 3 with the new provider, but the official final score was 2–1 to them, so they scored 2.
3. A midfielder shows 112 minutes played in a 90-minute league match with no extra time.
4. Two academy players with the same surname now share one ID. Their birth dates are 03-04-2004 and 04-03-2004.
5. Shots on target are about 2% higher across every season. A spot check finds goal-line clearances counted as on target.
6. A cup tie postponed by storm warnings appears twice in the season: once on the original date with no events, once on the rescheduled date with full events.
7. Career appearances for a long-serving defender drop by 38 after cutover. All the missing matches are from one season with his previous club.
8. A fantasy league's 2023/24 champion changes when points are recalculated, even though no bucket A or C issues touch that league's players.

Then write a status note of **no more than 120 words** for the product owner covering items 4, 5 and 8 only, in the "blocking / decision needed / not yet tested" format above.

**What a strong answer shows:** You notice that item 7 could be bucket A (a split career: a second ID holds those 38 matches) *or* bucket C (a season-to-competition join dropped one league), and you propose the inverse oracle to tell them apart instead of guessing. You treat item 8 as a decision about consequences, not a defect. And you resist calling item 1 a bug: under Opta-style rules, assists aren't awarded on direct free-kick goals, so the new number may be the *correct* one under the new definitions.

**Stretch:** Your team's own data almost certainly includes at least one entity that two systems identify differently, such as customers in CRM vs billing, or sites in the asset register vs metering. Pick one, list the fuzzy matching rules people actually use to link them, and write one inverse-oracle check that would catch a many-to-one mapping.

---

## Takeaway

A migration diff isn't a list of bugs. It's a list of questions, and each one has a cause: wrong identity, different definitions, or your own transformation. Programmable oracles (constraints, inverses, statistical distributions, provider-independent invariants like official scores) let you sort thousands of differences without guessing. Consistency heuristics then help you explain the few that matter. Your most valuable output is not "parity: pass/fail" but **"here's what's wrong and engineering is fixing it, here's what's merely different and you need to decide, and here's what we couldn't test yet."**

---

### Sources

- Cem Kaner, [*The Oracle Problem and the Teaching of Software Testing*](https://kaner.com/?p=190): oracle incompleteness, misses vs false alarms, Hoffman's programmable oracle types vs consistency heuristics
- Konstantin Sakhchinskiy, Ministry of Testing, [*When your data moves house: Practical testing tips for clean data migrations*](https://www.ministryoftesting.com/insights/when-your-data-moves-house-practical-testing-tips-for-clean-data-migrations), and the [community discussion thread](https://club.ministryoftesting.com/t/what-are-your-go-to-methods-for-achieving-seamless-data-migration/76956): phased, risk-first migration and running legacy and new systems in parallel
- Michael Bolton, DevelopSense, [*Oracles* (PDF)](https://developsense.com/resource/Oracles.pdf): oracles as heuristic, fallible, and sometimes contradictory
- Opta Analyst / Stats Perform, [*Opta football stats definitions*](https://theanalyst.com/articles/opta-football-stats-definitions): assist exclusions, shot-on-target vs blocked-shot rules
- Sportradar Developer Portal, [*Soccer ID handling*](https://developer.sportradar.com/soccer/docs/soccer-ig-id-handling): ID stability claims, merge mappings, postponed-match ID changes
- Akshay Easwaran / US Soccer, via American Soccer Analysis, [*Introducing Glass Onion*](https://www.americansocceranalysis.com/home/2026/1/25/introducing-glass-onion-by-us-soccer-an-identifier-synchronization-tool): cross-provider matching rules and tolerances
- [Sports Engineering (Springer), vendor event-definition differences](https://link.springer.com/article/10.1007/s12283-025-00533-4): assist definitions differ across data vendors (abstract-level finding; the full text is behind a login)
