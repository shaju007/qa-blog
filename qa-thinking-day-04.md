# QA Thinking — Day 4

## Testing Live Sports Data: When the “Correct” Answer Keeps Changing

Imagine you are testing a football platform.

At **20:14:03**, your system receives:

    Goal — Home Team
    Score: 1–0

The website immediately displays **1–0**.

Three seconds later another event arrives:

    VAR review started

Thirty seconds later:

    VAR review finished
    Decision: no goal
    Score: 0–0

Was your application wrong when it displayed 1–0?

Not necessarily.

This is a very different testing problem from something like:

    2 + 2 = 4

In live sports systems, the state of the world can change while your software is processing it. A good sports-platform tester therefore needs to understand **events, time, state, corrections, missing data and recovery**, not merely verify that an API returned `200 OK`.

Today we'll use this to learn an important general testing skill:

> **Testing systems in which truth evolves over time.**

------------------------------------------------------------------------

## First understand the domain

A simplified sports-data platform might look like this:

    Football match
          ↓
    Data collector / sports-data provider
          ↓
    Live event feed
          ↓
    Your ingestion service
          ↓
    Event processing
          ↓
    Database / cache
          ↓
    API
          ↓
    Web / mobile / broadcast application

A goal happens on the field.

Someone or something records it.

The sports-data provider distributes it.

Your system receives it.

Your backend transforms it.

The UI eventually displays it.

Already you should see something important.

There isn't one system to test.

There is a **chain of information**.

And every arrow represents a possible failure.

Real sports-data APIs illustrate this well. Sportradar, for example, offers continuously updated live timelines as well as push feeds. Its soccer timeline data can update roughly in real time, while the provider explicitly warns that some timestamps represent when an event was **created or updated in its system**, not necessarily the exact moment the event occurred on the pitch. [Getting Started+1](https://developer.sportradar.com/soccer/reference/soccer-sport-event-timeline?utm_source=chatgpt.com)

That distinction should immediately interest a tester.

------------------------------------------------------------------------

# Event time ≠ processing time

Suppose the goal actually happens at:

    20:14:00

The data provider records it at:

    20:14:02

Your ingestion service receives it at:

    20:14:03

Your backend processes it at:

    20:14:04

Your user's browser displays it at:

    20:14:05

Which one is **the timestamp**?

There might be four legitimate timestamps.

That creates several different questions:

    When did the real-world event happen?

    When did our provider know about it?

    When did we receive it?

    When did our customer see it?

Those questions lead to completely different performance tests.

If a requirement says:

> “Goals must appear within 3 seconds.”

Three seconds from **what**?

From the kick?

From provider publication?

From receipt by your infrastructure?

From processing?

Without answering that question, a QA engineer cannot meaningfully test the SLA.

This is why domain understanding and requirement analysis are inseparable.

------------------------------------------------------------------------

# Test the event stream, not just individual events

A beginner might test this API response:

    {
      "type": "goal",
      "team": "home",
      "score": "1-0"
    }

and verify that the UI shows:

    1–0

Useful.

But the much more interesting problems happen between events.

Consider this sequence:

    Event 1001 → match_started
    Event 1002 → yellow_card
    Event 1003 → goal
    Event 1004 → substitution

What if your application receives:

    1001
    1002
    1004

and never receives `1003`?

Now the event-processing code may be perfectly correct.

The system state is still wrong.

So a strong tester thinks about **sequence integrity**, not just payload correctness.

------------------------------------------------------------------------

# The disconnected-client problem

Real live-data systems make this particularly interesting.

Sportradar's current push-feed documentation explicitly states that the push connection is **not a stateful session**. If the client disconnects, previously transmitted events aren't magically replayed. Their recommended recovery model is to reconnect and use a corresponding REST endpoint to retrieve what was missed. [Getting Started+1](https://developer.sportradar.com/soccer/docs/soccer-ig-push?utm_source=chatgpt.com)

That gives you an excellent testing scenario.

Imagine:

    72:01 Goal A
    72:12 Yellow card
    72:30 Network connection breaks

    --- your system receives nothing ---

    73:05 Goal B
    73:30 Substitution

    73:45 connection restored

What should your platform do?

Simply reconnecting isn't enough.

If it starts consuming new events from 73:45 onwards, its model of the match may permanently miss **Goal B**.

So your architecture needs some recovery mechanism.

Perhaps:

    Push disconnect
          ↓
    Detect connection failure
          ↓
    Reconnect
          ↓
    Fetch authoritative timeline through REST
          ↓
    Compare known event IDs
          ↓
    Insert missing events
          ↓
    Resume streaming

Now your testing mission becomes much richer.

You aren't testing:

> “Can WebSocket reconnect?”

You're testing:

> **“Can the application reconstruct correct match state after losing part of reality?”**

That is a much stronger test mission.

------------------------------------------------------------------------

# Now introduce duplicates

Recovery mechanisms create another risk.

Suppose your database already contains:

    1001
    1002
    1003

The REST recovery request returns:

    1001
    1002
    1003
    1004
    1005

A naïve implementation inserts all five.

Now you have:

    Goal
    Goal

Perhaps the score becomes:

    2–0

instead of:

    1–0

So you need to investigate **idempotency**.

A useful question for the developer might be:

> “What uniquely identifies an event when we replay or recover the feed?”

Maybe it is:

    event_id

Maybe:

    match_id + event_id

Maybe events themselves can later change while retaining the same identifier.

That last possibility creates another testing dimension.

------------------------------------------------------------------------

# Corrections are normal, not necessarily defects

Sports data doesn't become permanently correct the instant it enters the feed.

Providers may correct information later.

Sportradar's own update guidance notes that match data can continue to change after a match ends and recommends consuming update feeds to capture post-match changes. [Getting Started+1](https://developer.sportradar.com/soccer/docs/soccer-ig-update-frequencies?utm_source=chatgpt.com)

Consider this event:

    {
      "event_id": 4512,
      "type": "goal",
      "player": "Player A"
    }

Ten minutes later:

    {
      "event_id": 4512,
      "type": "own_goal",
      "player": "Player B"
    }

What should your system do?

If you treat every incoming message as a new event:

    Goal Player A
    Own goal Player B

you may now have two goals.

If you treat `event_id = 4512` as the identity of the event:

    old version → replace with corrected version

you retain one event.

Now think beyond the match timeline.

That event may already have affected:

    player statistics
    team statistics
    match commentary
    leaderboards
    push notifications
    analytics
    fantasy scoring
    historical reports

Changing one event may require recalculating all of them.

This is where understanding **business consequences** becomes much more important than simply validating JSON.

------------------------------------------------------------------------

# A useful testing model: Missing, Duplicate, Late, Reordered, Corrected

When you're testing any event-driven system, keep five failure shapes in your head:

| Event problem | Example                                                  |
|---------------|----------------------------------------------------------|
| Missing       | Goal never arrives                                       |
| Duplicate     | Same goal processed twice                                |
| Late          | Goal arrives 20 seconds later                            |
| Reordered     | Goal arrives before the event that logically preceded it |
| Corrected     | Goal later becomes no-goal                               |

This model isn't limited to sports.

The same thinking applies to:

    payment events
    order events
    shipment updates
    advertising impressions
    IoT events
    notifications
    analytics pipelines

That's why learning sports-domain testing makes you a better general QA engineer.

------------------------------------------------------------------------

# Now add partial data coverage

Another subtle domain problem is **coverage**.

Not every competition necessarily provides the same depth or speed of data.

Sportradar explicitly documents different coverage levels and warns that lower-tier matches may not receive live updates. Applications are expected to inspect coverage information before assuming live event data is available. [Getting Started+1](https://developer.sportradar.com/soccer/docs/soccer-ig-live-match-retrieval?utm_source=chatgpt.com)

Imagine your UI says:

    Match starting...

    0–0

and stays there for 90 minutes.

Is your platform broken?

Maybe.

Or perhaps that match doesn't have live coverage and results are added after completion.

The user doesn't care about your API architecture.

They simply see:

> “This app doesn't update.”

That creates an important product question:

**Should the interface distinguish “0–0 live” from “live score unavailable”?**

A tester with domain knowledge may discover that product issue.

A tester who merely verifies the API may not.

------------------------------------------------------------------------

# This is where testing oracles become powerful

Michael Bolton and James Bach use the idea of **oracles** as ways of recognizing possible problems. Bolton's FEW HICCUPPS framework emphasizes inconsistencies with things such as history, claims, comparable products, user desires, purpose and the product itself. [DevelopSense+1](https://developsense.com/blog/2012/07/few-hiccupps?utm_source=chatgpt.com)

This is very useful for live sports testing.

Suppose:

    Timeline:
    Goal — Team A

    Scoreboard:
    0–0

No detailed requirements document is needed to become suspicious.

The product is **inconsistent with itself**.

Suppose your marketing says:

> “Live scores in real time.”

But users routinely see updates 45 seconds later.

That's inconsistent with a **claim** and perhaps with user expectations.

Suppose yesterday's completed match shows:

    Team A 2–1 Team B

while the historical results page says:

    Team A 1–1 Team B

That's an inconsistency with the product's own history/state.

Bolton's point is valuable here: credible testing involves explaining **why** an observation looks problematic instead of merely saying “it looks wrong.” [DevelopSense+1](https://developsense.com/blog/2023/03/consistency-within-product?utm_source=chatgpt.com)

------------------------------------------------------------------------

# A particularly interesting sports case: VAR

VAR makes a fantastic testing domain because reality itself is revised.

Conceptually:

    Goal occurs
         ↓
    Goal reported
         ↓
    Score becomes 1–0
         ↓
    VAR review
         ↓
    Decision overturned
         ↓
    Score becomes 0–0

A simplistic automated test might fail because it expected:

    score should never decrease

Yet in football, the score *can* legitimately decrease after a goal is overturned.

That means your test assumption—not necessarily the software—is wrong.

Domain knowledge changes the oracle.

Sportradar's API has explicit event modeling around VAR review and outcomes, and its 2026 change log shows that those schemas themselves have evolved: new VAR descriptions were added in May 2026, while a previously introduced `decision` field was later removed in June 2026 in favor of using descriptive values. [Getting Started+1](https://developer.sportradar.com/sportradar-updates/changelog/soccer-apis-increased-var-support?utm_source=chatgpt.com)

That gives us another valuable QA lesson.

------------------------------------------------------------------------

# Your external API is part of your risk surface

Imagine your application contains:

    if (event.decision === "overturned") {
       cancelGoal();
    }

Everything passes today.

Then your data provider removes `decision`.

What happens?

Perhaps:

    undefined

No exception.

No failed request.

No obvious monitoring alarm.

Your application simply stops correcting some VAR events.

That's a dangerous integration failure because everything may remain **technically healthy**.

    HTTP 200 ✓
    CPU normal ✓
    service running ✓
    no exceptions ✓

    football data wrong ✗

This is exactly why observability for business behaviour matters.

You might monitor technical metrics such as:

    request failures
    latency
    CPU
    memory
    queue depth

but also domain metrics such as:

    matches with inconsistent score/timeline
    unknown event types
    events missing required semantic fields
    number of feed corrections
    recovery events after disconnect
    provider events rejected by parser

That is much closer to quality engineering.

------------------------------------------------------------------------

# Don't ask only: “Did the service stay up?”

Imagine the sports platform survived an entire Champions League evening with:

    99.99% uptime

Excellent?

Maybe.

Suppose it displayed the wrong score during the deciding match for four minutes.

The service was available.

The product still failed at perhaps the most important moment of the evening.

This is why James Bach's risk-oriented perspective is useful. In one of his testing exercises he describes testing in terms of meaningful risk rather than assuming every possible test deserves attention. [Satisfice](https://www.satisfice.com/testing-challenge?utm_source=chatgpt.com)

For a live sports product, one useful risk question is:

> **Which failures would make users stop trusting our match data?**

That question may guide your testing much better than:

> “How many API test cases do we have?”

------------------------------------------------------------------------

# Soft skill: “The feed was five seconds late” is not a useful bug report

Imagine you tell your PO:

> “Live events are delayed.”

The PO asks:

> “How bad?”

You reply:

> “Sometimes five seconds.”

Still not enough information.

A stronger QA engineer investigates and communicates context:

> During five sampled live matches, goal updates reached our ingestion service roughly one second after the provider update, but appeared in the web client four to seven seconds later. The delay seems to occur between our event processor and client update layer. Other event types were usually below two seconds. Because goals are one of the most time-sensitive interactions in the live experience, I think we should investigate that path before the next high-traffic event.

Notice the structure:

    Observation
    → evidence
    → localization
    → business context
    → risk

You aren't saying:

> “Critical!!!”

You're helping people make a decision.

That is exactly the kind of communication skill that separates QA influence from QA policing.

------------------------------------------------------------------------

# How I would test this system

I would not begin with 200 scripted cases.

I would begin by building a **model of the event lifecycle**:

    Event occurs
       ↓
    Provider captures it
       ↓
    Provider publishes it
       ↓
    We receive it
       ↓
    We validate it
       ↓
    We process it
       ↓
    We persist state
       ↓
    We publish state
       ↓
    User sees state

Then I would deliberately introduce turbulence at the boundaries.

For example:

    disconnect
    duplicate
    delay
    correction
    bad payload
    unknown event type
    provider schema change
    reordered event
    partial coverage
    cache delay
    consumer restart

Each experiment tells you something about the system.

That's far closer to exploratory, risk-based engineering than blindly converting acceptance criteria into automated cases.

------------------------------------------------------------------------

# An important automation idea: replay real matches

Live sports testing has a practical problem.

You don't want to wait until Saturday afternoon for a real football match every time you need to test your integration.

Recorded event streams are therefore extremely useful.

Interestingly, Sportradar introduced soccer simulation/replay support in 2026 specifically so integrations can replay recorded matches against REST and push feeds. [Getting Started](https://developer.sportradar.com/sportradar-updates/changelog/soccer-apis-simulations?utm_source=chatgpt.com)

Even if your provider doesn't offer that feature, the architecture idea is worth learning.

Record something like:

    match.jsonl

    EVENT 1
    EVENT 2
    EVENT 3
    ...
    EVENT 583

Then your automated environment can replay it:

    normal speed
    2× speed
    10× speed
    with event 40 removed
    with event 60 duplicated
    with events 70/71 reversed
    with a 20-second connection loss

Now you have a powerful test harness.

You're no longer only checking examples.

You're **simulating reality and manipulating it**.

That is an excellent quality-engineering pattern.

------------------------------------------------------------------------

# Today's exercise

You are testing a live football system.

Your application receives:

    18:04:01 — Goal Team A — event 501
    18:04:03 — Score A 1–0 B

    18:07:12 — connection lost

    18:07:18 — Yellow card Team B — event 502
    18:07:32 — Goal Team B — event 503

    18:07:45 — connection restored

    18:07:46 — Goal Team B — event 503
    18:07:47 — Substitution Team A — event 504

    18:08:10 — REST recovery returns:
    501
    502
    503
    504

Don't immediately write automation.

Think like a quality engineer.

Your final displayed score should presumably become:

    1–1

But ask yourself:

**How do we detect that event 502 was missed?**

**How do we avoid processing event 503 twice?**

**How do we reconcile push and REST data?**

**Does event order matter?**

**What happens if REST contains a corrected version of 501?**

**How would we know recovery failed without looking manually at the UI?**

Then design **three experiments** that would give you the most confidence in the recovery mechanism.

That is today's real skill.

Not:

> “Can I write an API assertion?”

But:

> **“Can I model how information can become wrong, and design experiments that expose those failures?”**

That thinking transfers directly from sports systems to payments, e-commerce, SaaS integrations and ad-tech event pipelines.

For deeper reading, Michael Bolton's FEW HICCUPPS article is worth keeping as a reusable testing tool, while Sportradar's Push Feed documentation is a surprisingly good real-world example of why testers need to reason about state, recovery and missing events rather than endpoints in isolation. [DevelopSense+1](https://developsense.com/blog/2012/07/few-hiccupps?utm_source=chatgpt.com)

[Michael Bolton — FEW HICCUPPS testing oracles](https://developsense.com/blog/2012/07/few-hiccupps?utm_source=chatgpt.com)  
[Sportradar — Soccer Push Feeds and recovery behaviour](https://developer.sportradar.com/soccer/docs/soccer-ig-push?utm_source=chatgpt.com)  
[Sportradar — Live Match Updates](https://developer.sportradar.com/soccer/docs/soccer-ig-live-match-retrieval?utm_source=chatgpt.com)  
[Sportradar — 2026 Soccer API change log](https://developer.sportradar.com/soccer/reference/soccer-change-log?utm_source=chatgpt.com)
