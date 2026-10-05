# QA Thinking — Day 21

## Testing a Forecast: Why "The Number Looks Wrong" Doesn't Work When There's No Ground Truth Yet

Most of the systems you test produce an answer you can check against something: a total you can recompute, a status you can look up, a balance you can reconcile. Forecasting systems don't give you that luxury. A wind farm's generation forecast for 2 p.m. tomorrow isn't verifiable until 2 p.m. tomorrow — and even then, weather is stochastic enough that one bad prediction doesn't prove the model is broken. Today's domain is energy forecasting and curtailment, and the testing problem it raises — how do you evaluate a system whose correctness is probabilistic by design — shows up in fraud scoring, pricing engines, and recommendation systems too.

### The domain: curtailment and why forecast accuracy is money

Curtailment is when a grid operator orders a wind or solar generator to reduce output below what the weather would otherwise allow — usually because transmission is congested or supply exceeds demand ([NREL, "What Is Power System Curtailment?"](https://docs.nrel.gov/docs/fy25osti/90517.pdf)). Whether the generator gets paid for that lost production depends entirely on contract terms: power purchase agreements split curtailment into *compensable* (buyer pays for the energy the asset couldn't deliver) and *non-compensable* (emergency conditions, interconnection limits, maintenance — no payment).

Forecasts drive both sides of this. Grid operators use generation forecasts to decide who to curtail and when. Asset owners and traders use the same forecasts to bid into markets and to argue, after the fact, whether a curtailment order was justified by actual conditions. A forecasting error isn't a cosmetic bug — it shifts money between the utility, the generator, and the market, and it can trigger a curtailment instruction that didn't need to happen.

### The testing problem: your oracle is a distribution, not a value

If the system emits a single number ("forecast: 42 MW at 14:00"), you have no outcome to compare it to until 14:00, and even then one sample tells you almost nothing about whether the model is good — weather has irreducible variance. This is the oracle problem James Bach and Michael Bolton describe in [FEW HICCUPPS](https://developsense.com/blog/2012/07/few-hiccupps): you rarely have a perfect "expected result," so you fall back on heuristic consistency oracles — checking the system against itself, its history, comparable products, and its stated purpose, rather than against one ground-truth figure.

Applied to a forecasting system, that reframes what you test:

- **Internal consistency** — most real forecasting APIs emit percentile bands (P10/P50/P90). Test that P10 ≤ P50 ≤ P90 holds at every horizon and every refresh, not just at launch. A model update or a unit conversion bug can quietly invert this without any single number looking "wrong."
- **Consistency with history** — does the forecast evolve smoothly as the delivery hour approaches (updates should generally tighten, not whipsaw), or does a stale cache mean the 6-hour-ahead forecast and the 1-hour-ahead forecast contradict each other when they're served from different pipelines?
- **Consistency with comparable products** — if you have a secondary forecast source (vendor feed vs. internal model), divergence beyond a known tolerance band is a signal worth routing to someone, even without knowing which one is "right" yet.
- **Consistency with purpose** — does a forecast change actually propagate into the downstream curtailment-instruction and settlement calculation correctly, with the right timezone and interval alignment? This is where real money bugs hide: a forecast can be numerically fine and still cause a wrong curtailment order because of an off-by-one interval in dispatch logic.

### The soft-skill angle: reporting a problem you can't prove with one data point

When you find something off in a probabilistic system, "this forecast looks wrong" is weak evidence and invites dismissal ("that's just normal variance"). Evidence-based reporting here means switching from single-instance claims to calibration claims: show the pattern across many forecasts (e.g., P90 was exceeded far more than 10% of the time over the last N days — a calibration failure, not bad luck), or show a structural violation (P10 > P50 on three separate runs) that doesn't depend on actuals at all. The first kind of evidence takes patience to gather; the second kind you can produce immediately and it's much harder to argue with. Knowing which one you have changes how confidently you can push the bug.

### Exercise

Pick a probabilistic or scored system you work with — a forecast, a fraud/risk score, a pricing or ranking engine. Write three consistency-oracle checks for it (internal, historical, purpose) that don't require knowing the "correct" answer. Then write one sentence describing what evidence you'd gather to report a problem *before* ground truth is available.

**Sources used:**
- NREL, [What Is Power System Curtailment?](https://docs.nrel.gov/docs/fy25osti/90517.pdf)
- Michael Bolton / James Bach, DevelopSense, [FEW HICCUPPS](https://developsense.com/blog/2012/07/few-hiccupps)
