# QA Thinking — Day 29

## Testing Time-Zone Rule Changes: Your Fixture List Is Right Today and Wrong on November 1

Today is 16 October 2026. In the next three weeks, several clock changes land on a sports-data platform at once:

- **25 October:** the EU and UK fall back at 01:00 UTC. In Hamburg the hour from 02:00 to 03:00 happens twice, so that local day has 25 hours.
- **25 October to 1 November:** Europe has fallen back and the US has not. For one week the UK is 4 hours ahead of US Eastern instead of 5, and Germany is 5 hours ahead instead of 6.
- **1 November:** the US falls back. Three Canadian jurisdictions don't. British Columbia moved to permanent UTC−07 (tzdata 2026b), Alberta to permanent UTC−06, which the province now calls "Alberta Time (ABT)" (tzdata 2026c), and the Northwest Territories also stay on −06 (tzdata 2026d, released 11 September).
- Morocco already moved to permanent UTC on 20 September (2026c).

For a sports platform, an Edmonton or Calgary home game in November is now the riskiest kind of fixture you have. If any component in the chain is running time-zone data from before July 2026, it will think 19:00 local is 02:00 UTC, when it is actually 01:00 UTC. Your app then shows the wrong start time, and your betting markets may suspend an hour late.

Time-zone rule changes don't happen often, so there's usually no test for them. That's why they're worth a full lesson.

---

## 1. Time is part of the product, not a field

James Bach's **Heuristic Test Strategy Model** lists *Time* as its own product element, next to structure, function, data, interfaces, platform and operations. It means more than "the timestamp field": when input arrives, when output is produced, the delays between them, the pace of events, and what happens when things overlap. The HTSM's working definition of quality, "value to some person who matters at some time", applies literally here. A fixture time that was correct when the league published the schedule in summer can be wrong by the time the puck drops.

The HTSM also gives you a second way to look at this: **platform**. Time-zone rules aren't your code. They're data maintained by the IANA tz project and copied into many places, each updated on its own schedule:

| Where tz rules live | Who updates them | How to see the version |
|---|---|---|
| OS / container base image | Image rebuild, `tzdata` package | `zdump -v -c 2026,2027 America/Edmonton` |
| JVM (ships its own tz data) | JDK update or Oracle's TZUpdater | `ZoneRulesProvider.getVersions("America/Edmonton").lastKey()` |
| Node.js (uses ICU's tz data) | Node release | `process.versions.tz` |
| Python `zoneinfo` | System tz data, or the `tzdata` PyPI package | `tzdata.IANA_VERSION` |
| Database | DB build and config (PostgreSQL may bundle its own) | Compare `AT TIME ZONE` output with the app |
| Browsers / mobile OS | OS vendor's release cadence; users may not update | Test on real devices |

The useful question isn't "do we handle time zones?" It's **"how many independent copies of the rules do we run, and do they agree?"** When two components disagree about one fixture, you've found a bug, and you didn't need a spec to know it.

One detail to notice: the tz maintainers modeled BC's and Alberta's changes as taking effect on 1 November 2026 at 02:00, even though the legal changes happened earlier. They did this to work around a CLDR limitation. Even your reference data contains judgment calls, so read the release notes; don't just bump the version.

---

## 2. Domain primer: how time flows through a sports-data platform

A fixture goes through these stages, and each one depends on the clock:

1. **Scheduled.** The league or a data provider publishes kickoff (KO) or puck-drop times. Usually these are venue-local times ("19:00 at Rogers Place"), converted to UTC somewhere upstream.
2. **Pre-match.** Odds are published, push notifications are queued ("starts in 30 minutes"), broadcast program guides (EPG) are exported, and **fantasy lineup locks** are calculated from the earliest kickoff in the round.
3. **Start.** Pre-match markets must suspend at the *actual* start. Bets accepted after the event begins are called **past-posting**. It's an integrity and financial risk, not a cosmetic one.
4. **In-play and settlement.** Settlement uses event timestamps from the feed. Reports group results by "match day."

Business rules that depend on the clock:

- The *scheduled* time decides when users are told the event starts. The *actual* start decides when markets close. If the scheduled time is an hour off, any automation that relies on it as a fallback is also an hour off.
- Fantasy deadlines are fairness rules. Lock an hour late and some users can change their lineup after kickoff, and they'll complain publicly.
- Partners such as broadcasters, affiliates and B2B feed customers consume your times and redisplay them under *their own* tz data.

**The core model: every event has three clocks plus one version.**

- **Instant:** the UTC moment. You need it for sorting, suspension and settlement.
- **Venue intent:** "19:00 in Edmonton." This is what the league actually promised.
- **Viewer wall clock:** what a fan in Hamburg or Seattle sees.
- **Rules version:** the tz data used to convert intent into an instant.

Simon Willison's article on [storing times for human events](https://simonwillison.net/2024/Nov/27/storing-times-for-human-events/) explains why storing only UTC is risky for future events. If you keep only the instant and the rules change, you can't tell which stored instants are now wrong. You need the original intent and location so you can recompute. His historical example is the 2005 US Energy Policy Act, after which Microsoft had to ship a tool to repair Exchange calendar entries. For you, the testing question is: **for future fixtures, does our system store the venue intent, or only a UTC value computed under rules we no longer trust?**

---

## 3. Failure modes worth a session this week

Each one comes with a concrete test idea.

**A. A stale copy of the rules in one component.** The API (JVM, updated) says 01:00Z. The push-notification worker (old Node base image) calculates "starts in 30 min" from 02:00Z.
*Test:* pick one November Edmonton fixture and follow it through every output: API, web, iOS, Android, push text, EPG export, market-suspension schedule and fantasy lock. Write them in one table. Any disagreement is a finding.

**B. UTC computed under old rules and frozen.** Fixtures imported in August were converted to UTC with pre-2026c data. They're stored "correctly" under the old rules and are now an hour off.
*Test:* query future fixtures in `America/Vancouver`, `America/Edmonton` and `America/Inuvik` after 1 November. Recompute UTC from venue-local time using current tz data and diff. If the system never stored venue-local time, that's your headline risk: the data can't be repaired from inside your system.

**C. Zone aliasing and hard-coded offsets.** Code that maps Vancouver to `America/Los_Angeles` "because they're both Pacific", or a config value like `ET_OFFSET = -5`. From 1 November, Vancouver and Seattle are on different offsets for the first time.
*Test:* search config and code for literal offsets, zone abbreviations and alias tables. Then check any Vancouver–Seattle fixture in the viewer's time zone on both sides of the border.

**D. The one-week transatlantic gap.** A Premier League match at 15:00 UK time on 31 October is 11:00 Eastern, not 10:00.
*Test:* use a controllable clock (an injected `Clock`, not the system clock) and render fixtures dated 26–31 October for US viewers. Also check marketing copy and scheduled social posts that were written by hand with "10am ET".

**E. The 25-hour day.** On 25 October in Hamburg, local times from 02:00 to 02:59 occur twice.
*Test:* do cron jobs scheduled in local time at 02:30 (odds snapshots, settlement batches, report exports) run twice, once, or not at all? Do "daily" trading reports keyed by local date expect 24 hourly buckets? Do log lines in local time without an offset become ambiguous during that hour?

**F. Labels that confuse users.** Alberta's government says "ABT". The tz data for the Northwest Territories uses "CST". Your UI might show "MST", "CST", "−06" or "ABT".
*Test:* look at what the UI actually shows for these zones after 1 November, then ask the product owner which label fans will recognize. This is a product decision, not a technical one.

**G. Devices you don't control.** If the client formats times using the *device's* tz rules, users who haven't updated their OS will see wrong times even if your servers are perfect.
*Test:* compare server-formatted times with client-formatted ones on an older device or emulator image. If formatting happens on the client, decide deliberately whether to send a pre-formatted venue-local string as well.

---

## 4. The soft skill: asking "which clock?" without crying wolf

Testers lose credibility on time bugs in two ways: saying nothing, or sending an alarming "all our times might be wrong!" message to a channel. The Ministry of Testing Club thread [*How to learn about time zones and testing time zones?*](https://club.ministryoftesting.com/t/how-to-learn-about-time-zones-and-testing-time-zones/82354) is useful because the answers treat time zones as **business rules**, not a mysterious technical area. Mirek Długosz's answer distinguishes wall-clock time from monotonic instants, and storage from display. He points out the risk that stored instants become wrong when zone definitions change. That's the framing you should take into the conversation.

**Questions for the product owner** (about intent):
- When the league says 19:00, is our promise "19:00 at the venue" or a fixed UTC instant?
- Which time zone label should Alberta fans see after 1 November?
- If a fixture time changes because of a rules update, do we notify users, partners, or nobody?

**Questions for developers** (about mechanism):
- Where do we convert venue-local time to UTC: at import, at render, or both?
- Which tz data version does each service run, and who owns updating it?
- Can we recompute stored UTC values from the original intent?

**Explaining the risk to the trading or product lead.** Be specific, bounded and tied to evidence:

> "Our push-worker image ships tz data from 2025. For fixtures in Alberta, BC and the Northwest Territories after 1 November, it calculates start times one hour late. I've confirmed this for one Edmonton game (table attached). Impact: 'starts soon' notifications an hour late, and if the scheduled time is used as a fallback for market suspension, there's a past-posting exposure. I haven't yet checked the EPG export or fantasy locks. I need two hours for that. Proposed fix: rebuild the image with current tzdata, and run a one-off recompute-and-diff for future fixtures in these zones."

This message separates what you've confirmed from what you haven't checked yet. It names the business consequence (past-posting, missed notifications) rather than "timezone bug". It also asks for a small, time-limited piece of work before a hard deadline. That's negotiating with evidence. You're not asking for a freeze; you're asking for two hours.

---

## 5. Applying this to other domains

The model of three clocks plus a rules version carries over to other domains:
- **Energy:** a 25-hour local day has 100 quarter-hour intervals, not 96. Daily totals, time-of-use tariff windows and settlement files keyed by local date all need checking.
- **Ad tech:** daily budgets in the advertiser's time zone. A 25-hour day can overspend a "daily" cap, and a rules change moves the reset time.
- **SaaS and payments:** billing anchors at local midnight, payout cut-off times, and "end of trial" emails. Any business rule written as "by 23:59 local" depends on someone else's copy of the tz rules.

---

## Practical challenge (45–60 minutes, do it before 25 October)

1. **Inventory (15 min).** List every service, job and client in one fixture's path, from ingest to API, push, EPG, fantasy lock and market suspension. For each, record where its tz rules come from and the version, using the commands in section 1.
2. **One fixture, every output (20 min).** Pick a real November home game in Edmonton or Calgary and a Vancouver–Seattle fixture if you have one. Use a controllable clock or a staging environment to collect the start time from every output into one table. Mark disagreements.
3. **Data diff (10 min).** Write the query that recomputes UTC from venue-local time for future fixtures in the four affected zones, and count how many rows differ. If venue-local time isn't stored, write that down. It's your most important finding.
4. **Risk note (10 min).** Write a five-sentence message to the product owner in the format from section 4: what you saw, the impact in business terms, what you haven't checked, and one small action with a deadline.

**Stretch goal:** find a job scheduled at a local time between 02:00 and 03:00 Europe/Berlin and find out what it will do on 25 October. Don't guess; read the scheduler's documentation or test it with a shifted clock.

---

## Sources

- James Bach, [Heuristic Test Strategy Model (v6.3), Satisfice](https://www.satisfice.com/download/heuristic-test-strategy-model): *Time* and *Platform* as product elements, and the definition of quality used above. A PDF copy is also hosted at [DevelopSense](https://developsense.com/htsm).
- Ministry of Testing Club, [How to learn about time zones and testing time zones?](https://club.ministryoftesting.com/t/how-to-learn-about-time-zones-and-testing-time-zones/82354): wall-clock vs. monotonic time, storage vs. display, and the risk of changing zone definitions.
- Simon Willison, [Storing times for human events](https://simonwillison.net/2024/Nov/27/storing-times-for-human-events/): store user intent and location, and derive UTC.
- IANA, [Time Zone Database Release 2026d](https://www.iana.org/time-zones/releases/2026d): the Northwest Territories stay on −06 from 1 November 2026.
- IANA tz-announce, [2026c announcement (July 2026 archive)](https://lists.iana.org/hyperkitty/list/tz-announce@iana.org/2026/7/): Alberta on permanent −06, Morocco on permanent UTC, and the urgency note for downstream testing.
- IANA tz-announce, [2026b release](https://lists.iana.org/hyperkitty/list/tz-announce@iana.org/thread/VX2Z3CBO6KHTYZNBBKFFWM7ZCI6TVCXP/): British Columbia on permanent −07, and why the change is modeled on 1 November because of CLDR.
- Government of Alberta, [Alberta's new time system (ABT)](https://www.alberta.ca/albertas-new-time-system-abt): the official name, UTC−6, effective November 2026.
- Universal Time Date, [Daylight Saving Time 2026: When Clocks Change in Every Major Country](https://www.universaltimedate.com/articles/daylight-saving-time-2026-when-clocks-change): EU change on 25 October at 01:00 UTC, US change on 1 November, and the week-long transatlantic gap.
