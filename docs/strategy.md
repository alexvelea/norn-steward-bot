# Current strategy and implementation work

> Historical experiment commands marked `retired-harness:` are archival evidence, not executable commands. Use the single-version sandbox runner documented in docs/reviews.md for new runs.


## Current balance baseline

The server balance at d4fadb0 uses production 80/min at level 1 and 14/min at level 0,
unchanged 1.165 growth, halved building/unit base times, and milli-tick training with speedBase
0.94. Use live options and [unit budgets](unit-stats.md), not old experiment throughput figures.
Policy targets and allocation thresholds are not retuned by this contract sync. Dated comparisons
below record historical rules and must not be reinterpreted as measurements under this balance.

## Current policy: hardcoded early game and sustainable military budget

Capital producers can grow to 25, including conquest funding fallback and Hall projections.
The shared producer-20 attack, defender-target and growth transitions remain unchanged.

After a capture, proactively expand capital storage to fit the next live Envoy cost (priority 96),
unless an Envoy is already owned or queued. Do not wait for overflow or admit a mission before
capacity is complete. The fresh-target round-end guard remains in force. Per-wave dispatch
deadlines use current target loyalty from reports or assessments, otherwise landed hits and
regeneration; they do not restart at 100 after each wave.

During conquest preparation, economic cities fund the capital's missing Envoy bill.
Keep 1000 of each resource rather than the ordinary 4000/next-build reserve, and
allocate the deficit richest available surplus first. Ship with ordinary Markets and
available merchants; grow Markets toward at most 13 merchants at priority 96 and
ship at 95. Subtract already in-flight and journalled shipments, respect capital
storage, standing orders and council timing, and stop when funded or an Envoy is
owned/queued. Admission remains unchanged and counts only already in-flight trades.

The capital grows producers to 5, then toward 8; after producers 8 it raises Great Hall toward 5
and continues production growth. Its fixed early military order is Lumberyard 14, Quarry 14, Mine
12 → Barracks 1 → Wall 5 → Hall 10 → Barracks 5 → producers 15. Pikemen training starts at
Barracks 1 and runs in parallel until the early goal of 200 home Pikemen. The capital never
proposes a Cellar; economic cities keep their existing Cellar behavior.

After producers 15 and 200 home Pikemen (`earlyGoalMet`), the capital starts the Scout path
(Smithy 1, Stable 1). Barracks is capped at 5, and Raiders train from Barracks 5. Conquest then
needs Smithy 10 → Market 5 → Court; Hall 10 and Barracks 5 are already complete. Economic-city
military and producer behavior remains unchanged. Historical scripts import archived baselines
explicitly.

The capital's own Pikemen target is 200 before producer 20, then
`max(200, 3 × strongest economic-city stationed Pikemen)`. With active defender requests,
train toward `max(own target, 250) + sum(all active city requests)`: at least 250 retained
plus every request. With no requests, keep the own target. Sending each request requires
250 Pikemen left at home; a request for 250 therefore needs at least 500 before sending.

Recruit only when each resource's full-time troop demand consumes at most 80% of its gross
production, and the full cohort is currently funded. Reserve at least 20% income for construction.
This is a transparent initial planning allowance, not optimised economic theory. Use net income
after the training reserve for production coverage, resource funding waits and storage forecasting;
retain gross marginal production for payback gains and the lifetime production ledger. Display
phase, target/reserved troop burn and net construction income in the advisor view.

Do not confuse a remaining stockpile with sustainable troop income. Build deficient production
when the sustained mix cannot be funded. Further military technology must support its intended
training throughput, rather than consume the money needed for current troops. Existing accepted
work remains tracked; existing higher building levels are not undone. Keep the producer-20 ceiling,
round-end payback, population buffer, one President, parallel server queues and durable retries.

A historical matched fresh-world comparison of the superseded 2026-11-16 policy used the
pre-change 61d2d2a baseline and phased candidate,
seed 73430, no house bots, identical 1000/1000/1000 initial stocks and ordinary server actions.
The 2400-tick prototype comparison reached all producers >=10 at tick 1218 versus 1954
for the baseline. It finished at 87 Pikemen/28 Shieldmen, Barracks 3 and producers 12/12/10,
versus baseline 19 Pikemen/8 Shieldmen/10 Raiders, Barracks 8 and producers 12/11/10.
Net stock and retained assets differ; this is a peaceful flow comparison, not combat validation.
The final implementation additionally exposes the net budget and uses it for storage projections.
The comparison verifies every candidate troop submission starts after all three
producers reach 10, with exact 3:1 cohort metadata and no Raider submissions. Private receipts:
`/var/lib/norm-steward-review/owner-phased-economy-20261116/`. Reproduce with
`STEWARD_BASELINE_COMMIT=61d2d2a STEWARD_REVIEW_RUN=<private-review-subdirectory> node --import tsx retired-harness:experiment-phased-economy.ts`.

Next reviews should measure full-round delivered troops, production and retained assets, resource
spending shares and idle queues under the current early-game policy. Seed military throughput tests
at the 14/14/12 producer gate and Barracks 1 with income sufficient for the live Barracks speed and the
construction allowance. Threat response, opportunity cost and the 20% allowance remain to evaluate.

## Queue continuity and bounded Raider funding (2026-11-17)

The owner requests one construction successor below ten real seconds of remaining work. The
executor uses live world speed, keeps at most one waiting successor and refreshes before writes.
Paid levels are considered only for building selection; current stock, population and server
prerequisite blockers remain authoritative. Reaching a queued milestone must not buy an extra
level (Hall 10 is the early-game target, not Hall 11). Uncertain append retries retain their IDs.

The initial conquest implementation incorrectly reserved the entire 140-Raider escort in one
purchase, preventing affordable Smithy construction. Fund Raiders in roughly one-minute batches
at Barracks 5, capped by the remaining escort goal. While a batch trains, the President may fund
construction. This preserves the total escort target without treating it as one upfront bill.

## Owner correction: incoming attacks do not suspend conquest (2026-11-17)

An incoming-attack guard previously suppressed every origin proposal, including construction.
Live decisions showed Quarry 15 confirmed at tick 3676, then no build until Hall 6 at tick 3730,
immediately after the incoming command resolved. That left about 27 real seconds of idle building.
The owner explicitly prefers offensive Raiders away from home rather than held for defence.
Incoming attacks therefore no longer block conquest entry, home construction/training, or an
otherwise eligible Raider/Envoy expedition. The 150-home-Pikeman requirement, neutral-target and
battle checks, deadlines, external-order checks and durable idempotency remain in force.
Regression tests cover Hall eligibility, phase entry, and an incoming attack appearing during
pre-submission revalidation while dispatch still leaves Pikemen and Shieldmen at home.

## Hybrid opening and gameplay-led research (2026-11-16 owner direction)

Keep sustainable 3Pi1Sh recruitment from producer minimum 10. Delay discretionary Walls until
Lumberyard, Quarry and Iron Mine each reach 13; then retain the existing garrison/value, funding,
queue and round-time checks. This is a construction opportunity-cost gate, not an emergency
threat-response policy. It does not cancel previously accepted construction.

The owner's matched two-hour peaceful comparisons found that removing Walls at the existing
military start preserved 627 versus 637 infantry while increasing production by 16.5%. Delaying
military to producer 13 instead reached 485 infantry and another 10.4% production gain. These
measurements motivated retaining the earlier army while delaying fortification. They do not prove
survival against an attacker. The new hybrid was deployed with owner approval after matched
first-hour private evidence under rules version 3; the owner waived the remaining two-hour comparison.
Both policies began training at tick 1441 (24:01). The baseline first submitted a Wall at tick 1728
(28:48), with producers 12/11/10; the hybrid waited until tick 3142 (52:22), with producers 15/14/13.
These verify the gate, not full-round economic superiority or combat survival. Remaining simulation
was stopped and all registered private worlds deleted. Do not restart the waived comparison.
Historical version-2 outcome numbers above are context, not directly comparable to version 3.
Raw owner evidence: `/var/lib/norm-steward-review/experiments/army-no-walls-comparison-20261116T175413Z/`.

Reviews should ask a gameplay question, state a hypothesis, compare representative timelines,
and explain the tradeoff before editing policy. Long simulations now run in a persistent private
experiment worker outside the 15-minute Codex budget. A negative result can complete research;
implementation tasks remain subject to exact tested-code evidence, checks and deployment gates.
Next measure: observe the approved hybrid in the next live world, including production, delivered
troops, Wall timing, spending and building-queue occupancy. Future comparisons must use the new server balance; the historical measurements below predate it. The Farm deadline and Farm runway guards are deployed (`3977d0d`, then `d054552`).
Population-runway research and delivery are complete. Gameplay execution preference remains unchanged.

## Conquest transition: verified for activation (2026-11-17)

The owner requested a transition after 150 home Pikemen and producer minimum 15:
finish the paid defensive cohort, then divert routine growth/defence spending to Hall 13,
Barracks 10, Smithy 10, Market 5, Court, one bounded Raider escort and one reusable Envoy.
This describes the original 2026-11-17 release; the current opening replaces those Hall 13 and
Barracks 10 requirements with Hall 10 and Barracks 5.
The integrated candidate uses the existing President and durable executor. It retains existing
buildings and troops; it does not remove live fortifications or cancel accepted work.
Research `conquest-transition-economics` supports this bounded peaceful capture objective.
Delivery `conquest-transition-gameplay-delivery` was verified and deployed as `1a8965c`.
The evidence below describes that original release; the incoming-attack correction above is newer.

The falsifiable hypothesis was capture before tick 10800 while retaining at least 150 home
Pikemen and the paid Shieldmen. Completed worker job `20261117T063645Z-a27f75` tested the exact
candidate against deployed `d054552`: fresh matched seed-73430 owner-only worlds, rules v3,
1000 of each initial resource, no enemies and 600-tick checkpoints. Both policies planned with
status `running` while their private clocks were paused. Both reached common tick **6784
(113:04)**; candidate's fourth attack captured the neutral town and ended the world by owning
two of four villages. Baseline captured nothing. This measures peaceful feasibility and its
opportunity cost; it cannot measure survival or post-capture growth.

| Metric at tick 6784 | Continuous defence | Conquest transition |
|---|---:|---:|
| Home Pikemen / Shieldmen | 569 / 189 | 153 / 51 |
| Away Raiders | 0 | 108 |
| Origin producers timber / stone / iron | 18 / 17 / 15 | 15 / 15 / 15 |
| Origin production/minute, timber / stone / iron | 1502.31 / 1289.53 / 950.13 | 950.13 / 950.13 / 950.13 |
| Origin stock total (rounded) | 41179 | 23925 |
| Non-Wall construction / Wall / training spend | 118441 / 12537 / 79680 | 136320 / 0 / 60065 |
| Construction busy / idle ticks | 5378 / 1406 | 4376 / 2408 |
| Barracks busy / idle ticks after first training | 5115 / 228 | 1937 / 3406 |
| Farm / Wall | 13 / 13 | 11 / 0 |

Both start training at 1441. Candidate reaches producer minimum 15 at 3673 versus 6400;
Court completes at 6039, Envoy at 6189, attacks arrive at 6274, 6444, 6614 and 6784.
Capture consumes the Envoy; 32 of the initial 140 Raiders are lost. Baseline has paid Mine 16
and training still queued at the endpoint: spending and occupied ticks include accepted work,
while completed levels and delivered troops exclude it. Candidate Barracks idleness is the
measured diversion to conquest. Resource spending and construction time are separate costs.

The candidate retains **554 fewer home infantry**, buys no Wall, and has 23.8% lower origin
production and 41.9% lower origin stocks at capture. The acquired town adds 6302.25 timber,
6302.25 stone, 6537 iron and 438.05 total production/minute; account production remains 12.1%
lower. Acquired stocks and battle loot are assets, never credited as produced income. At the
clean precombat tick 6000, retained production is 3.1% lower and stocks 27.3% lower. Retained
production means exact stocks plus paid costs minus initial stocks, excluding overflow;
buildings and troops remain separate assets. No threshold optimality or survival claim follows.

All 363 ordinary actions succeeded and both worlds were deleted. All actions and checkpoints
match the earlier research job `20261117T050825Z-398f24`. The current policy fingerprint is
`a541964b6dc59c562594049b6b84a9f2fd980f7c968a155e42cba291c8a48f8a`;
at that verification, all 32 source files byte-matched the immutable tested snapshot, and fresh live rules are
still v3. Typecheck, all 219 tests, the web build and diff checks pass. No policy was edited
after that comparison. Wrapper push, activation and health gates still apply.

Delivery verifies journal-before-write, paused restart, terminal capture, an applied response
lost in transport, unapplied 429 retry with the same ID, expiry, changed epoch, fresh target
ownership/home defence, external orders, incoming attacks, scheduled actions and per-action
rejection. Failed battles or vanished accepted commands stop the plan without replacement
attackers. A separate real-server replay of 138 paid actions exactly reproduced the captured
endpoint and tested the Controller cycle omitted by the worker. Authoritative target ownership
stays `captured` when the final report or response is missing, while attribution stays unknown;
the old candidate recorded `stopped`. Both failure cases preserve a pause and make zero
post-capture writes. The ordinary matching-report path confirms its full battle detail.

Read-only receipt/source audit and per-resource spending, Farm timing and checkpoint accounting:
`/var/lib/norm-steward-review/runs/20261117T073022Z/conquest-delivery-assessment.json`.
Worker comparison:
`/var/lib/norm-steward-review/experiments/jobs/20261117T063645Z-a27f75/comparison.json`.
Lifecycle evidence:
`/var/lib/norm-steward-review/runs/20261117T063001Z/conquest-lifecycle.json`.
The earlier scripted prototype remains in [the conquest experiment](experiments/conquest-opening.md).

Next compare defined matched hostile pressure: the 554-infantry gap and absent new Walls are
the largest unresolved cost. Latest live evidence has no incoming attack; that snapshot does
not establish safety. A recruitment funding guard could address part of 184 previously measured
funding-only idle ticks (effort 5); retuning the unoptimised 20% construction allowance has broader,
unmeasured effects (effort 8). Threat research (effort 8) takes priority by consequence and
missing evidence. Any later policy edit requires a new matched comparison before activation.

## Verified recruitment-Farm deadline (2026-11-17)

The `saved-farm-deadline` guard was deployed as `3977d0d` after its exact-source worker comparison
and late-round regression. A Farm bought solely for
recruitment must leave time for the full minute-long 3Pi1Sh cohort and 60 useful ticks,
including its live construction funding/cooldown boundary and existing Barracks work.
The old check allowed only one 3:1 bundle, even when the cohort contains multiple bundles.
Basic population-buffer expansion remains independent of this recruitment-only gate.

A fresh matched owner-only regression against deployed hybrid `2ec95b6`, under rules v3,
starts at tick 10696 of 10800 with 54 free population slots and an already-paid training
queue. The full President/executor bought Farm 3 in the baseline, spending 76 timber /
68 stone / 51 iron and occupying construction for 16 ticks. The candidate bought nothing
and finished with exactly those additional stocks; both delivered 17 Pikemen. Production
was identical; the baseline instead retained 42 additional population capacity. Both
preserved a paused restart and both worlds were deleted. This measures avoided unusable
recruitment capacity, not combat value or a whole-economy gain. Reproduce with
`STEWARD_BASELINE_COMMIT=2ec95b6 node --import tsx retired-harness:experiment-recruitment-farm-window.ts`
in a managed review run. Results, receipts and the assessment are under
`/var/lib/norm-steward-review/runs/20261116T230021Z/`. Earlier prototype evidence remains
under `runs/20261116T173021Z`; its interrupted fresh-world prefixes are not completed comparisons.

The completed matched worker job is
`/var/lib/norm-steward-review/experiments/jobs/20261116T230158Z-c3ddc0/comparison.json`:
seed 73430, no enemies, 7200 ticks with 600-tick checkpoints in a standard 10800-tick world.
All 13 checkpoints match. Both finish with 526 Pikemen / 174 Shieldmen, producers 19/18/17,
Farm 13 and Wall 12; production and exact final stocks match. Each spends 155837 resources
on non-Wall construction, 9815 on Walls and 73455 on training. Construction occupies 6010
ticks and is idle for 1190; paid Barracks queues occupy 4722 ticks. All 219 policy actions
succeed in each world, and both worlds are deleted. The deployed guard matched the worker
fingerprint; worker and fresh live rules were version 3. Required checks passed (200 tests).

The opening result is neutral. Combined with the late-round saving of 195 resources and
16 otherwise unusable construction ticks, it supports this narrow guard, not a whole-round
economic or survival gain. Baseline's additional 42 population capacity is the measured
tradeoff; the candidate's freed construction time stays idle. The guard is deployed;
gameplay pause remains unchanged.
Assessment and reproducible receipt/source audit:
`/var/lib/norm-steward-review/runs/20261117T000021Z/farm-deadline-assessment.json`.

## Completed recruitment population runway research (2026-11-17)

Research task: `hybrid-recruitment-idle-economics`. An owner-only server replay of all 219
paid actions matched the previous experiment at all 13 checkpoints through tick 7200.
After recruitment starts at 1441, the 1037 idle ticks comprise 848 population-blocked ticks,
184 funding-only ticks and 5 ready-but-not-yet-executed ticks. Population and funding overlap
for 55 of the 848 ticks; these categories prioritize population and do not promise that all
848 ticks can be recovered. The initial 1441 economy-only ticks are excluded.

Long producer and Wall builds sometimes occupy construction before a Farm becomes necessary.
For example, Lumberyard 19 runs 6464–6672; Barracks becomes population-blocked at 6510,
and Farm 13 only finishes at 6770. This suggests anticipating capacity before committing
construction time, rather than tightening a cadence responsible for only five ticks here.
Further funding protection addresses a smaller measured cause and competes with growth.

The saved candidate offers a Farm through the existing President when its selected build
plus a subsequent Farm would exhaust population reserved for future whole cohorts. It uses
live build durations, paid training completion and population already booked by accepted work;
it preserves sustainable income, external-order and whole-cohort/use-deadline checks.
Earlier Farm spending and queue use can delay production and fortification. More troops also
consume resources. This candidate was deployed as `d054552` after its separate gameplay review.

A matched paid-prefix test at ticks 4266–4866 supports the mechanism: candidate delivers
89 infantry versus 67, with zero Barracks idle ticks versus 151. Final production matches;
retained timber production is 5.7 lower. Training spends 2490 additional resources, Farm
finishes at 11 versus 10, Storehouse at 7 versus 8, and Wall 10 starts 56 ticks later.
Both worlds are deleted. This ten-minute result cannot establish full-round superiority.

The completed matched peaceful worker comparison against deployed `3977d0d` supports the
continuous-defence hypothesis: seed 73430, rules v3, a full 10800-tick private round and 19
600-tick checkpoints. Both start training at 1441; the candidate never trails in delivered
infantry at a checkpoint. Server action costs and queue intervals give these final results:

| Metric | Baseline | Earlier Farm candidate |
|---|---:|---:|
| Delivered Pikemen / Shieldmen | 900 / 300 | 999 / 333 |
| Barracks busy ticks | 8100 | 8991 |
| Barracks idle ticks after training starts | 1259 | 368 |
| Construction busy / idle ticks | 8322 / 2478 | 8299 / 2501 |
| Training resource spend | 124500 | 138195 |
| Non-Wall construction / Wall spend | 193904 / 20289 | 193175 / 20289 |
| Final stock total | 250847 | 203400 |
| Retained production total | 586542.1 | 552060.4 |
| Final production total per game minute | 4830.8 | 4789.9 |
| Final Farm / Wall / Storehouse | 15 / 15 / 18 | 16 / 15 / 17 |

The 11% extra infantry costs 5.9% retained production and 18.9% final stocks; final production
is 0.85% lower. Final timber/stone production falls 14.2% each while iron rises 35.7%; resource
totals do not imply equal strategic value. Retained production is final milli-stocks plus paid
spending minus initial stocks, excluding overflow; it is separate from army and buildings.
Idle time includes the final recruitment/use-window tail, and is not a full-round attribution
of population blockers. The initial 1441 economy-only ticks are excluded from Barracks idle.

The first Wall submission moves from 3142 to 3413; at minute 60, Walls are 6 versus 3, though
both finish at 15. All producers reach 15 at 5507 versus 6400, a 893-tick delay relevant to
the owner's future expansion phase. Both tested policies continue defensive recruitment and
omit that phase. Earlier Farms support the measured continuous-defence objective; conquest
needs a matched comparison of its own. No survival or combat benefit was measured.

Research is complete with `supports-change`. Gameplay delivery review
(`farm-runway-gameplay-delivery`) verified the unchanged President/executor integration and added
regressions for journal-before-write, paused restart/reconciliation, fresh external orders,
income/population changes and per-action rejection. The implementation was deployed as `d054552`; no reviewer live writes or preference changes
were needed. That deployed policy matched the tested candidate; the new conquest prototype
requires its own comparison.
The completed conquest comparison above measures the owner-requested expansion and its opportunity
cost; separate gameplay delivery is next. Extra funding protection has less measured upside
(184 funding-only ticks in the prior two-hour replay) and competes with growth.
All 313 baseline and 334 candidate actions succeeded; both worlds were deleted. Source,
receipt and fresh-rules audits, per-resource accounting and checkpoints:
`/var/lib/norm-steward-review/runs/20261117T020001Z/farm-runway-full-round-assessment.json`.
Worker evidence:
`/var/lib/norm-steward-review/experiments/jobs/20261117T003859Z-ad4d13/comparison.json`.
Earlier bottleneck attribution and the focused mechanism test remain under
`/var/lib/norm-steward-review/runs/20261117T003007Z/`.

## Scouting during paid construction (2026-11-16)

Scouts already at home may travel while construction and recruitment continue, provided every
paid construction item has a valid completion tick at or before Scout arrival. Standing orders
still defer dispatch. Raids retain their empty-construction-queue check and revalidate current
production/storage before spending intelligence. This uses the existing President and durable
executor; it adds no troop purchases or starter quotas.

The matched seed-73421 comparison used producers 11/10/10, Barracks 5, Smithy 5 and an existing
paid force (the live Stable prerequisite chain requires these higher military levels). Full-time
3Pi1Sh left 26.8%/32.2%/44.8% timber/stone/iron income for construction. Both worlds had the same
paid Storehouse upgrade and 6-Pikeman/2-Shieldman queue. With one-second decisions until dispatch, the candidate
dispatched at tick 6600 and received a successful report at 6728; baseline waited until 6610 and
received its report at 6738. Policy action spending was zero for both. Final resources, buildings,
population and troops were identical. Both preserved a paused restart and reconciled their reports.
All three worlds, including the initial fixture correction, were deleted.

Reproduce with `node --import tsx retired-harness:experiment-scout-construction.ts` in a managed review run.
The default baseline is `82bce40`; `STEWARD_BASELINE_COMMIT` can select it explicitly. Raw results,
current-code broker receipts and the initial fixture's failed comparison are under
`/var/lib/norm-steward-review/runs/20261116T160016Z/`. This establishes ten ticks less command/report
latency with existing forces. It does not measure combat gain or full-round allocation; the latter
remains the next measurement under the phased economy.

Older experiments and superseded policies are preserved in [Strategy history](strategy-history.md).
