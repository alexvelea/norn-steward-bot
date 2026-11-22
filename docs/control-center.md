# Personal control center: first iteration

> Historical experiment commands marked `retired-harness:` are archival evidence, not executable commands. Use the single-version sandbox runner documented in docs/reviews.md for new runs.

This process is a client of the existing game. It contains no authoritative simulation, game clock, game account
store or game persistence. The private file is local client configuration and execution bookkeeping.
No LLM, model key, prompt or inference service participates in economic decisions.

## Current phased economy and recruitment policy

Recurring conquest capacity is proactive: once captured cities exist, the capital expands its
Storehouse at priority 96 if the next live Envoy cost would not fit and no Envoy is owned or queued.
It does not wait for overflow. Admission still waits for completed capacity and checks fresh-target
funding, training, travel and a 60-tick end margin. Each later wave instead forecasts remaining
capture time from target loyalty: the latest battle report or target assessment, then landed hits
minus regeneration as fallback. Already-landed hits are not reset to 100 loyalty.

The capital opens by growing producers to 5, then toward 8; after producers 8 it raises the
Great Hall toward 5 and continues production growth. Its military opening is fixed: Lumberyard
14, Quarry 14, Mine 14 unlock Barracks 1; Wall 5 follows before any further military building;
then Hall 10, Barracks 5, and all three producers to 15. The capital never proposes a Cellar.
Pikemen training starts from Barracks 1 and continues alongside this sequence until 200 are home.
Economic cities retain their Cellar policy and never train troops.

After the early goal (producers 15 plus 200 home Pikemen), the Scout path builds Smithy 1 and
Stable 1, subject to live building requirements. Barracks stops at level 5. **Conquest → Raider
force** trains toward 150 Raiders, counting home, away and queued troops; losses are retrained.
A first conquest requires the remaining Smithy 10, Market 5 and Court infrastructure; Hall 10
and Barracks 5 are already part of the opening. The capital keeps at least 200 Pikemen at home;
after producer 20 its target is `max(200, 3 × strongest economic-city stationed Pikemen)`.
Each economic city with Wall 10 targets `max(250, floor(capital home Pikemen / 3))` stationed
Pikemen and requests a top-up only below 80% of that target. The capital fulfils requests only
when at least 250 Pikemen will remain at home after sending that request. With active requests,
the training target is `max(own target, 250) + sum(all active city requests)`; without requests,
it remains the own target. A request for 250 therefore requires at least 500 before sending.

Keep 20 Scouts at the capital per owned city, counting home and queued. Wall-10 economic cities
request 20 stationed Scouts; the capital fulfils them from its home reserve. Stable 1 is only for
Scouts. Economic-city producers stop at level 10 until Wall 10 is complete, then can grow to 25.
Economic cities build only Wall 10 as a military building; the capital never builds Walls above
level 10.

For each resource, full-time Pikeman training demand must be <=80% of gross production: at least
20% of income remains for construction. One complete minute-long Pikeman batch must also be
affordable and fit the population reserve. This headroom is an explicit policy setting, not a
proven optimum.

The advisor page shows phase, gross income/min, target troop burn/min, reserved burn/min and net
income left for construction. Producer coverage forecasts and Storehouse forecasts use income
remaining after reserved training. Producer payback uses that net income for funding waits but
keeps the actual gross marginal output for the upgrade's return; soldier spending does not make a
producer magically less productive. The total-production ledger remains gross.

If sustainable funding is missing, the resource producers needed to restore it outrank routine
Pikeman recruitment. Recruitment waits rather than spending down a stockpile on an unsustainable
flow. Existing buildings and troops are preserved; this policy only changes new proposals.
Capital producer upgrades use a level-25 ceiling and retain the round-end payback test.

For sustainable defensive recruitment, the President also considers population runway before
committing to another building. If that build followed by a Farm would leave too few slots for
future whole minute-long Pikeman batches plus the usual population buffer, it offers the Farm first at
score 95. Live construction durations, action intervals and the paid Barracks queue determine
the runway; accepted work already counts in population used. Standing build or training orders,
occupied construction, unsustainable income and other hard blockers prevent this promotion.
The Farm must still leave time for a complete batch and 60 useful ticks. The existing executor
reranks on fresh state before writing and preserves the persisted operator pause.

A prior peaceful full-round simulation of a retired infantry composition delivered 11% more
infantry at a cost of 5.9% less retained production and later fortification/producer-15 readiness.
That is historical evidence; the current Pikemen-only and Raider targets have not been measured
against survival outcomes.

## Advisor contract and President

`src/advisors/types.ts` defines a small synchronous interface: evaluate live state and rules, return
proposals. Each proposal names its advisor, village, action, target level, importance (0–100),
reason, per-resource requirements, blockers, affordability tick, and ready/waiting/queued/not-needed status.
The Economic and Military Advisors are registered with the same President.
The President is a sorted filter, not a planner. It submits at most one build, training batch or
conquest command per one-second cycle.
The single executor journals one in-flight write at a time and tracks accepted operations in independent
per-village construction and per-training-building queues. Construction, Barracks and Stable work
can overlap. Training queues remain occupied until their work completes. Construction may accept
one successor when its sole running item has strictly less than ten **real** seconds remaining
(`remaining ticks / world speed`). A waiting successor prevents any third item. Fresh server state
is checked again before payment; unknown writes and standing orders still block competing work.
Build-only forecasts account for the paid level and remaining wait without unlocking training or
spending projected income. Durations stay conservative across queued Hall upgrades.

Automated scouting and raid advisors and dispatchers have been removed. Manual map commands and
public battle/scouting reports remain available independently of bot planning.

The Economic Advisor considers Great Hall, lumberyard, quarry, mine, storehouse, cellar and farm.
The server's build options determine cost, prerequisites, affordability and next level. The live
rules tables determine hall time savings (excluding the hall upgrade itself and maxed buildings); no game rule is changed in this repository.

Scores are deterministic integers:

| Candidate | Importance policy |
|---|---|
| Farm | 100 if no free population; 95 for the max(50, 20% of capacity) buffer, the next Pikeman batch, or sustainable recruitment runway before another selected build; otherwise not-needed (20) |
| Storehouse | 90–99 **only** if current stock + production over min(300, remaining round ticks) exceeds capacity for any resource; otherwise not-needed (25) |
| Cellar | 80 **only** if protection per resource is below the largest 60-tick production amount (one minute); otherwise not-needed (25) |
| First Barracks | 79 when unlocked and usable, below capacity/protection and ahead of discretionary Hall/production investment (ties prefer Barracks); no further military levels |
| Military development | 88 for Wall 5, 90 for Hall 10, 76 for later military steps; 79 for Barracks 1/Hall prerequisites |
| Capital Pikemen | 75 below `max(own target, 250) + sum(all active city requests)` when requests exist, otherwise the own target; 50 for a minute-long batch after producer 20 when the target is met |
| Economic-city defender request | 80 when stationed Pikemen are below 80% of target; capital sends only with 250 retained plus the full request |
| Raiders | 72 to train toward 150 owned, counting home + away + queued; attacks need at least 100 at home and take every home Raider |
| Scouts | 60 to maintain 20 at the capital per city owned, counting home + queued; Stable 1 is only for Scouts |
| Walls | Capital 84 only when marginal Wall benefit beats one Pikeman; never above 10. Economic-city Wall 10 is 75 after producers reach 10 |
| Resource producer | Below level 5: 85 minus production rank (83–85), ahead of Cellar/Hall/starter military but below necessary capacity. From level 5: 60/50/40 by coverage; 80–82 for a Pikeman-resource shortage. Capital ceiling 25; economic cities 10 before Wall 10 and 25 after |

90–100 = capacity, 70–89 = opening production/protection/construction speed/military spending, 40–69 = production. Lower scores are
informational and never executed. Not-needed proposals remain visible at the bottom. Ties use
village ID then building ID. Population used includes reserved construction and training.

For each resource, producer coverage is `(current inventory + production over 180 ticks) / sum of
that resource's costs for the next lumberyard, quarry and mine upgrades`. Maxed producers are
excluded from the cost basket. The lowest coverage wins, so an apparently abundant resource can
still be most scarce relative to what production upgrades actually consume. Rates use live
per-tick milli-resource values; these horizons are game time (ticks), not browser wall time.
The displayed 3-/5-minute capacity forecasts ignore speculative future spending or uncompleted
production upgrades. The Hall comparison below separately estimates a bounded sequence.
Equality at a capacity target does not trigger an upgrade.

## Balance and fractional training

The snapshot is rules version 3, with Smithy capped at level 10. The Controller validates
the fetched `/rules` version against the selected world's `rulesVersion`, not a hardcoded
client version, and invalidates its rules cache when that world version changes.

Use live production, build options and training options for every forecast. The local balance snapshot
uses production 80/min at level 1 and 14/min at level 0, halved building and unit base times, and
training speedBase 0.94. Training durations and queue completion estimates can be fractional ticks
with three-decimal precision, including less than one tick per unit. Count units and population as
integers, but never truncate or reject fractional training durations. Full-time demand is cost divided
by that duration; the existing construction allowance and policy thresholds are unchanged.

## Great Hall payback

`src/advisors/hall.ts` makes a bounded client-side projection: at most 24 useful upgrades within
7,200 game ticks, capped by the remaining round time. It does not submit or persist a build plan.
First construct a baseline sequence using the existing priorities: required farm/storage/cellar,
then the producer with the lowest projected supply/cost coverage. Recompute costs and coverage
after each hypothetical completion; do not assume three levels of every producer will be built.

Compare that exact sequence with building **one** Hall level first. Both paths start from live
per-resource stock and production. They wait for each individual resource, spend costs at the
start, cap accumulated stock at storage, update production only on completion, and account for
population, prerequisites, capacity upgrades and Council action intervals. The first next-level
cost/population requirement comes from live options; future levels and durations use live tables.
Hall-first includes its own build duration and resource cost, including delays that cost causes
for subsequent upgrades. Production multipliers observed in live state are held constant.

Recommend the Hall only if the net completion-time saving is at least the largest of **20 ticks,
10% of the Hall's build duration, and 2% of baseline completion time**. The margin avoids acting on
small estimates and polling jitter. A positive comparison receives 70–79 based on the percentage
of baseline time saved; urgent farm/storage and required protection still outrank it. The reason
shows the sequence, both completion times, resource waits and net saving. An infeasible Hall path,
maxed-out economy, short round horizon or resource starvation does not create a Hall recommendation.
Existing construction/standing orders defer the comparison until they finish. Incoming attacks
within 300 ticks defer Hall spending. The projected path rechecks resource, population, storage
and building prerequisites at each step instead of reusing stale next-level blockers after a
hypothetical capacity upgrade. Next-level Hall-gated unlocks are listed when other requirements
are already met; they get no arbitrary bonus without a concrete military plan.

This is a short-term estimate, not an engine or a search for the global optimum. It compares the
same work to make the opportunity cost explicit; resource changes can cause the real sequence to
change on the next evaluation. Other villages, future troop orders, trades, attacks, new bonuses
and exact executor polling delays are not projected. The single authoritative executor still
refreshes and reranks against live state before every write; it never blindly executes this sequence.

## Total production

The service persists estimated gross production for the current account/server/world/epoch.
It starts with the earliest available server history sample, then integrates live aggregate village
rates between evaluations. Rate changes use the average of adjacent observations. This is an
estimate: historical samples are sparse, downtime can hide rate changes, and overflow is included.
Spending and looting never decrease or inflate this counter. It is not an exact lifetime total or
net inventory change. Repeated observations at the same tick add nothing; restarts preserve totals.
A different account/world/epoch or backwards game clock starts a new ledger. The UI labels the
estimate and its tick range, and shows each village's inventory, projected supply and cost coverage.

## Allocation and waiting

The Military Advisor builds Barracks 1 only in the capital, then the Wall 5 → Hall 10 → Barracks 5
opening. After producers 15 and 200 home Pikemen, it follows the Smithy 1 and Stable 1 Scout path.
Stable 1 is for Scouts only. After Barracks 5 and Smithy 2, the capital trains toward its conquest
target of 150 Raiders; the capital's home-Pikeman and Scout targets use home plus queued counts as
specified above. Live training options determine costs, batch limits, duration and population.
The population buffer stays at max(50, 20% of capacity); external orders, busy queues,
unavailable options and round-end timing prevent submission. Barracks growth is proposed at
importance 65 when queued and needed Pikeman/Raider training exceeds 600 ticks.

- Affordability is per village. Resources are never pooled or automatically traded.
- Existing construction blocks additional advisor builds in that village. The first iteration keeps
  queues shallow rather than paying in advance for a long speculative plan. Existing queued levels
  are displayed as queued, not proposed again.
- Standing build orders block advisor construction in that village. The operator must choose which
  economic controller to run; this application never silently removes existing orders.
- The highest **needed** proposal in a village owns its budget, including score-40–60 production.
  If it only lacks resources, save until it is affordable; never spend on lower-ranked filler.
  If it has another blocker, wait and show that blocker rather than diverting its budget. Another
  village can still spend independently. This simple policy may stall on an impossible prerequisite
  (for example a producer bill larger than storage even though the five-minute storage target fits);
  it reports the constraint rather than overriding the explicit capacity policy.
- Council cooldown, ended rounds, missing prerequisites and full queues are explicit waiting states.
- Decisions are short-term heuristics, not ROI-optimal planning. Broader troop composition and market exchanges are not modelled yet. Manual orders and other clients can still consume resources.

## Execution and recovery

Only the persistent local Node service evaluates and executes. Browsers poll a read-only snapshot;
refreshing, multiple tabs and closing the browser do not create or stop executors. The loopback
executor lease (port 8790) prevents a second production process from starting, even at another HTTP
port, and is released by the OS after crashes. Do not override this port for another live executor.

Economic execution starts automatically for a fresh valid configuration. Its execution preference
is persisted; service restarts and Settings edits preserve an operator pause.
There is no browser execution toggle or prerequisite acknowledgement. The internal pause API remains
available for diagnostics; authentication failures and an expired uncertain idempotency window pause
submissions and show the actual error. Accepted construction continues in the game.

The persistent executor automatically joins the **selected** running world when `/state` reports
`NOT_IN_WORLD`, including after a round reset, or when state contains zero villages. It does not
join other world IDs, paused/ended worlds, or join while diagnostic execution is paused. The
upstream `/join` endpoint is idempotent: a retry returns existing holdings rather than founding a
second village. Each attempt checks fresh state first, respects rate-limit backoff and records
submission/confirmation in recent decisions. After joining it rereads state/rules; normal epoch
reconciliation discards obsolete pending economic requests before spending. Closing the browser
has no effect on joining. No additional browser executor or join loop is introduced.

Before POST, read state/rules again and rerank. A manual build inserted after the first evaluation
therefore stops or changes the selection. The remote engine remains the final arbiter; another
independent client can still act between revalidation and submission. There is no cross-client
resource reservation or atomic expected-level check in the upstream API.

The bot architecture is split under `src/bot/`: declarative plan and projection,
runner, allocation, mission and commitment strategy, execution journal, persistence, and
diagnostics. The Controller remains the HTTP facade. The control store uses version 2; startup
migrates legacy state and writes a private mode-0600 backup. Unsupported versions require recovery
and block execution rather than being overwritten. Automated scouting and raid bot behavior has
been removed; manual commands and reports are not part of the bot proposal loop.

Journal the exact action/clientId before POST. Never change its ID on an uncertain retry. A fresh
queue or changed level after an uncertain result suppresses replay without falsely claiming which
actor caused it. Expired idempotency windows pause automatic mode; inspect game activity before
resolving uncertain operations. A changed world epoch or account drops stale requests. On a 429,
respect Retry-After; per-action errors inside a 200 are rejected outcomes, not successes.

The history distinguishes recommendation, prepared (request ID journalled), submitted (API attempted), accepted, confirmed, rejected, uncertain,
waiting and cancelled. Accepted means queued. Construction is confirmed when fresh state reached the accepted level after
its queue item disappeared. Training is confirmed when its accepted batch disappears and owned
troops (home plus away) reach the pre-order count plus batch count. Missing troops are recorded as
cancellation/possible losses, not false confirmation. Uncertain training retries retain the exact
count and ID; observed troop or queue changes suppress replay without claiming attribution.
The last 100 decisions and any pending request survive restarts in `control.json` (mode 0600).

## Bounded first-conquest transition

The live conquest transition uses the same President and durable executor. Its first mission
can start at the early producer gate and Barracks 5, with no home-Pikeman entry condition,
in parallel with the opening's 200-Pikeman goal. It preserves
the garrison and funds Smithy 10, Market 5 and Court, shown under **Early game → Conquest enabled**.
Hall 10 and Barracks 5 remain opening goals. **Conquest → First conquest** tracks the first
capture as a one-shot milestone; later conquest missions are tracked under **Next cities**.

**Conquest capacity prerequisite.** While preparing conquest, the advisor can propose an ordinary
paid Farm or Storehouse upgrade at score 96 so a specific build (such as Smithy 10, Market 5 or
Court) or Raider/Envoy batch can fit. It proposes a Farm when free population is below the
action's population cost plus a buffer of `max(50, ceil(20% of the population limit))`.
It proposes a Storehouse if any one resource cost exceeds the storage limit, not merely
the resources currently on hand. The population check comes first, but a Farm whose own cost
exceeds storage can require a Storehouse first. This is separate from routine Farm and Storehouse
upkeep, and “No need this cycle” means there was no prerequisite proposal for this evaluation.

The conquest advisor prepares a Raider escort of 150 or the simulated requirement if higher,
in approximately minute-long batches once Barracks 5 is ready, plus one Envoy,
retaining home infantry. At four ticks per Raider, each full batch contains
16 Raiders (64 game seconds); the last batch is capped at the remaining escort count. An occupied
Barracks queue releases the construction budget instead of reserving the whole escort cost.
It targets an unowned town and rechecks ownership and the server battle simulation before
each attack, allowing at most six waves with the surviving Envoy and escort; a wave needs at least 100 Raiders at home and takes every Raider at home. Incoming attacks
do not pause home construction, training, phase entry or an eligible Raider/Envoy dispatch.
The 150-Pikeman home-defence requirement still applies; the offensive escort is allowed to leave
while the origin is threatened. External orders and scheduled actions defer transition spending. No live experimental loop
or separate resource allocator exists.

Progress is persisted under server/account/world/epoch scope, independently of the operator
pause. Accepted attacks await their matching battle details; fresh owned-village state marks
capture, including after a round-ending victory. A failed battle, lost Envoy, changed target
ownership or vanished accepted command stops the plan. An uncertain applied send suppresses
replay; an unchanged unapplied request keeps its exact action ID, and expiry pauses execution.
Authoritative target ownership remains captured even without the final response or report;
the journal explicitly leaves the missing request or battle attribution unknown.
Paused restarts reconcile accepted work without submitting new actions.

The matched private result demonstrates peaceful capture at 113:04, with substantially less
home defence and lower production than continuous recruitment. It does not establish survival
against a hostile player. See [strategy](strategy.md) for measured costs and verification status.

## Other clients and operator agent

Do not run another client on this account alongside automatic mode.
Independent processes can compete even if the browser is closed. A client running on another
machine cannot be detected reliably. Current
server standing build orders are detected and block this advisor per village.
Manual gameplay remains available. Its writes use normal API limits and appear in the game's
activity stream; the President revalidates on the next cycle. Ad hoc operator instructions are in
[OPERATOR.md](OPERATOR.md); that agent must not launch another economic loop.

## Site gate and local control credentials

A separate high-entropy site token gates all app pages, static assets, control routes and game
transports. Only the token form is public. The service loads its digest, issues an opaque secure
cookie, and never logs or embeds the token. See README.md for generation, storage and rotation.
This does not change or replace the upstream game API key.

## Local control API and credentials

`POST /control/session` authenticates the configured player key and issues an HttpOnly,
SameSite=Strict session cookie. Settings/key/state endpoints are private. Mutations reject foreign
Origin headers. No key is embedded in assets or ordinary snapshots; Settings reveals it only on
an explicit authenticated POST. Existing browser key storage is preserved for compatibility.
The game proxy uses the configured server/key, including the WebSocket hello, so browser tabs do
not accidentally switch the service's account by forwarding an old Authorization header.

- GET /control/state: masked settings, advisor status, recommendations and journal.
- PUT /control/settings: origin, player key (optional replacement), world; revalidates while preserving the execution preference.
- PUT /control/automatic: enabled boolean; internal diagnostic pause/resume, no browser switch.
- POST /control/evaluate: request a bot cycle; this can execute the configured economic policy.
- POST /control/key: explicitly reveal the saved key to the authenticated operator.
- POST /control/pending/resolve: clear an uncertain request only while paused, after explicitly acknowledging activity-log inspection; resumes the bot without cancelling accepted work.
- POST /control/logout: invalidate this browser session.

Initialize the owner key locally using STEWARD_KEY_FILE or STEWARD_KEY. There is no public signup
or first-visitor claim flow. Local files are trusted operator storage, not encrypted at rest; protect
machine access. Keep credentials, runtime files, browser captures and logs out of Git.

## Production investment payback

Lumberyard, quarry and iron mine upgrades are eligible only if their **additional gross output**
can repay the sum of timber + stone + iron spent by the current world's round-end tick. All three
resource types count as one resource unit each. Existing production does not count as the return
on a new investment. Using live integer milli-resource rates and tables:

`repayment tick = earliest affordable/cooldown start + live build ticks + ceil(total cost × 1000 / additional milli-resources per tick)`

The start includes each resource's shortfall/production wait and any later server affordability or
Council tick. A zero/unknown increment or an unfundable cost does not establish payback. Equality
at round end is allowed. Resource multipliers observed in state are retained when projecting the
next level. Accepted construction is not cancelled; queued work is reevaluated after it finishes.
Fresh executor state is checked again before spending. Rejected investments are `not-needed` with
`NO_PAYBACK_BEFORE_ROUND_END`, so they do not reserve resources or block military proposals.

For example, Lumberyard 1→2 costs 63 + 75 + 50 = 188. Live rates rise from 1.867 to 2.175 timber/tick:
+0.308. Repayment takes 611 earning ticks after the 11-tick Hall-1 build, plus any funding delay.
Six owner-only sandbox cases test the exact old policy against the candidate one tick before,
exactly at, and one tick after the repayment deadline, verifying live cost and rate changes.
Run `retired-harness:experiment-payback.ts` with STEWARD_REVIEW_RUN pointing to a fresh private run directory.

Hall planning applies the same rule to projected producer upgrades, using projected stocks/rates
and live next-level costs, so it cannot justify a Hall using unprofitable future production work.
Hall itself retains its construction-time payback comparison. Farm, storehouse and cellar retain
their explicit capacity/protection rules: they do not directly generate a resource stream. This is
a gross-production estimate, not a guarantee of retained inventory: overflow, raids, trades, future
bonuses or later upgrades can change actual returns. No speculative future benefits are credited.

The service evaluates live state once per second. Account/world-list metadata is cached for at most
30 seconds; joining forces a refresh. Rules are cached by configuration revision, world, epoch and
rules version, and are fetched again immediately before an action. Idle cycles avoid a redundant
second state read. This stays within the upstream four-per-second dashboard read budget while the
browser polls the local snapshot every second. Rate-limit/error backoff remains in effect.

Automated scouting and raid proposal, dispatch, and experiment paths have been removed from the live
bot. The map's manual commands and the game's public scouting/battle reports remain available.

## Income versus spending policy (2026-11-16)

The capital's defense is Pikemen only. Before all three capital producers reach level 20, its home
target is 200; after that, the target is `max(200, 3 × strongest economic-city stationed Pikemen)`.
Each Wall-10 economic city targets `max(250, floor(capital home Pikemen / 3))` stationed Pikemen.
It requests a top-up only below 80% of target. With active requests, the capital trains toward
`max(own target, 250) + sum(all active city requests)`; without requests, it keeps the own target.
Sending requires 250 retained plus the individual request. Economic cities never train troops.

Pikeman budget uses one Pikeman's live costs, training time and population. It preserves 20% of
gross production for construction and the `max(50, 20% of capacity)` free-population buffer.
Training is minute-sized, affordable, and bounded by queues and round-end use time. The Farm can
run before a long build when future Pikeman batches would not fit above that buffer. The capital
trains Raiders toward 150 owned (home, away and queued); conquest needs at least 100 at home. Scouts are
maintained at 20 per owned city at the capital and supported at 20 per economic city on request.

The capital producer ceiling is level 25; attack, defence targets and growth still transition at level 20.
Hall projections and the conquest funding-upgrade fallback also allow capital producers through level 25.
Economic-city producers stop at level 10 until Wall 10,
then can grow to level 25. An economic city builds only Wall 10 as a military building. Capital
Walls compare marginal defense against one Pikeman and stop at level 10. The executor journals and
reconciles each action separately, including support and recall.

## Parallel queues, military buildings and recruitment batches

One authoritative process remains. `pending` journals the single prepared/submitted/uncertain
network write; `active` durably records accepted queue items and commands until confirmed.
Legacy accepted `pending` entries migrate on reconciliation. Each operation is reconciled and
cleared separately, so a construction failure/restart cannot erase accepted training. Revalidation,
account/world/epoch scoping, request IDs and operator pauses apply to all tracked operations.
Known accepted costs are already deducted from live stocks; every new submission refreshes state.
The President skips candidates blocked by an occupied queue so other queues can use their budget.
Unknown requests still serialize further writes until safely resolved. Normal construction remains
one queued build per village, normal training one batch per facility, and combat one command
lane globally. This is concurrency of server work, not concurrent duplicate network writers.

Training uses the existing per-facility queues and the President's single-action allocation.
Pikemen are recruited toward `max(own target, 250) + sum(all active city requests)` when requests
exist, otherwise the own target; Raider losses are retrained toward 150 owned.
Scouts are recruited at Stable 1 toward 20 at home per owned city. Each batch is
bounded by live training options, the one-minute duration, queue limits, affordability, the
population buffer and the round-end use window. The garrison remains Pikemen-only; Raiders are
the attack force and Scout training stays at Stable 1. The executor journals each action
separately and reports each accepted, confirmed,
rejected or uncertain result.

Capital Walls are capped at 10. Their marginal static defense is compared against one Pikeman,
using live wall and unit rules. Economic cities build Wall 10 after all producers reach level 10
at importance 75; it is the only military building an economic city builds. Economic-city
producers stop at 10 until Wall 10 is complete, then grow to 25. The capital's producer ceiling
remains 20.

After each capture, every capital-origin Raider stack stationed in the new economic city is
recalled to the capital; Pikemen remain. Recall is journalled and reconciled like other actions.
Enemy-village scouting, close/big target ranking and 2× battle simulation remain planned and are
not implemented in this phase.

Recurring conquests start only when estimated Envoy funding, training and capture plus 60 ticks fit before round end. Funding includes capital production and incoming trades. The nearest unowned map target is used; without a map, the estimate assumes 600 ticks of one-way travel.

While the active mission prepares and lacks its Envoy funds, economic cities send
only the remaining deficit to the capital. Keep 1000 per resource instead of the
ordinary 4000/next-build reserve; allocate the richest surplus first. Build Market
capacity toward at most 13 merchants (96), then ship with available merchants (95).
Deduct in-flight and journalled shipments and respect storage, standing orders and
round-end delivery. This does not add hypothetical future shipments to admission.
