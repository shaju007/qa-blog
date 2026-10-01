# QA Thinking — Day 20

## Testability Isn't a Tester's Virtue — It's a Property You Have to Negotiate For

Most testers treat testability as something that just happens to you: either the system is easy to test or it isn't, and you adapt. Michael Bolton's framing is sharper than that. In [Deeper Testing (3): Testability](https://developsense.com/blog/2017/09/deeper-testing-3-testability), he breaks testability into dimensions you can actually act on — epistemic testability (can you learn what you need to know?), value-related testability (do you understand what the product is for, well enough to judge it?), and project-related testability (is the project organized to support exploration, experimentation, and learning?). The key move is treating low testability as a risk to raise, not a constraint to silently absorb. If you can't observe or control something, that's not a testing limitation to work around quietly — it's a finding, and it belongs in the same conversation as any other risk.

Today's domain is energy forecasting and curtailment — a good stress test for this idea, because the system genuinely resists observation.

### The domain: why curtailment forecasting is hard to test

Grid operators dispatch power based on forecasts of how much wind and solar will be generated in the next hours. When the forecast says a region will produce more than the grid can absorb or transmit, the operator curtails — instructs generators to produce less than they could, discarding usable renewable energy. In Europe in 2026, curtailment has become routine rather than exceptional, because transmission build-out lags behind renewable capacity additions, and most reinforcement projects won't land until 2027–2028 ([Renewable Energy Trends in Europe 2026](https://www.delfos.energy/blog-posts/renewable-energy-trends-in-europe-for-2026)). When the forecast is wrong in the other direction — actual generation falls short — the operator has to fill the gap fast, usually with gas peakers, and the generator can be hit with an imbalance penalty for the shortfall ([Solar forecast errors: economic impact and mitigation strategies](https://openweather.co.uk/blog/post/solar-forecast-errors-economic-impact-and-mitigation-strategies)).

So a forecasting/curtailment platform has two failure modes with opposite financial consequences: over-forecast → unnecessary curtailment (lost clean energy, lost revenue for the generator), under-forecast → imbalance penalties and emergency fossil dispatch. A testing effort that only checks "does the number match the weather model" misses both business risks entirely.

### Applying testability as a lens, not a checklist

Here's where Bolton's framing earns its keep. Ask, for a curtailment system, three concrete questions instead of one vague one:

**Observability** — Can you see why a forecast changed? If the forecast output moves from 420MW to 310MW between runs, can you trace it to a specific input (updated wind speed model, a sensor dropout, a changed topology constraint) or does it come back as an opaque number from a model you can't interrogate? Ministry of Testing's framing of observability is useful here: [monitoring tells you something changed; observability tells you why](https://www.ministryoftesting.com/software-testing-glossary/observability). A system that can only tell you *that* a curtailment order was issued, not *which input drove it*, is low-observability — and that's a testability gap worth escalating, because it also means operators can't debug a bad decision after the fact.

**Controllability** — Can you force the specific input combinations that matter: a forecast with high uncertainty, a sudden sensor dropout mid-window, a transmission constraint changing while a forecast is in flight? If the only way to test is "wait for real weather," you don't have a testable system — you have a system you can only observe, never interrogate. That's a project-level testability problem, and it's a legitimate thing to push back on during planning, not just something to work around by waiting for favorable weather.

**Value-related testability** — Do you actually understand the asymmetry in the business? A 10% over-forecast and a 10% under-forecast are not equally bad; one wastes clean energy, the other triggers penalties and emergency fossil generation. If your test cases treat both directions as symmetric error, you're testing precision, not testing what the business cares about.

### Concrete testing ideas this produces

- Build a harness that can replay or synthesize edge-case input sequences (sudden cloud cover, sensor gaps, conflicting weather feeds) instead of relying on live weather to produce coverage.
- Test that every curtailment decision carries enough logged context (which forecast, which inputs, which constraint triggered it) to be explained after the fact — this is an observability requirement, not a logging nice-to-have.
- Separately test over-forecast and under-forecast scenarios against their actual cost models, not against a single "accuracy %" metric. A system can hit 90% average accuracy while being systematically biased in the expensive direction.
- When forecasting is AI/ML-based, ask what happens when the model is confident and wrong — does downstream curtailment logic have any way to express or act on uncertainty, or does it treat a 51%-confidence prediction the same as a 99%-confidence one?

### The transferable move

This isn't really an energy-sector lesson. The same three questions — can I see why, can I force the conditions, do I understand what's actually valuable here — apply to any system where you're tempted to test the happy path because the edge cases are hard to produce. When you hit that wall, the Bolton move is: don't silently route around it. Say explicitly, "I can't test X because I can't observe/control Y," and let the team decide whether that's an acceptable risk or a gap to fix.

### Exercise

Pick a system you test where you've quietly avoided a scenario because it was hard to set up (a race condition, a third-party failure mode, a rare data combination). Write one sentence naming which testability dimension is missing — observability, controllability, or your own understanding of its value — and bring it to your team as a stated risk this week instead of continuing to work around it.

**Sources:**
- [Michael Bolton, "Deeper Testing (3): Testability" — DevelopSense](https://developsense.com/blog/2017/09/deeper-testing-3-testability)
- [Ministry of Testing — Observability glossary entry](https://www.ministryoftesting.com/software-testing-glossary/observability)
- [Renewable Energy Trends in Europe 2026 — Delfos Energy](https://www.delfos.energy/blog-posts/renewable-energy-trends-in-europe-for-2026)
- [Solar forecast errors: economic impact and mitigation strategies — OpenWeather](https://openweather.co.uk/blog/post/solar-forecast-errors-economic-impact-and-mitigation-strategies)
