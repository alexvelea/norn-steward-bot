import { BARRACKS_CAP, EARLY_GATE, EARLY_HALL, EARLY_PIKEMEN_TARGET, EARLY_WALL, PRODUCER_CEILING, RAIDER_TARGET } from "../../advisors/defense-budget.js";

export type PlanNodeKind =
  | "objective"
  | "mission"
  | "group"
  | "task"
  | "milestone"
  | "policy"
  | "capability";

export type PlanScope = "account" | "village";

export type CityRole = "capital" | "economic";

export interface PlanNode {
  key: string;
  kind: PlanNodeKind;
  title: string;
  summary: string;
  advisor?: string;
  scope?: PlanScope;
  predicateKey?: string;
  thresholds?: Readonly<Record<string, number>>;
  /** Roles this node (and everything it contains) applies to; inherited from the nearest ancestor. */
  roles?: readonly CityRole[];
  /** Designed in the diagram but not codified yet: rendered, never executed. */
  planned?: true;
  /** Live until a task that requires it, or its group, is done; then it stays done and its work goes to this replacement. */
  replacedBy?: string;
}

export interface PlanEdge {
  from: string;
  to: string;
  kind: "contains" | "requires" | "contributesTo";
}

export interface PlanDefinition {
  nodes: readonly PlanNode[];
  edges: readonly PlanEdge[];
}

const producerLevels = { "5": 5, "8": 8, "10": 10, "12": 12, "15": 15, "20": 20, ceiling: 25 };

export const PLAN = {
  nodes: [
    { key: "round", kind: "objective", title: "Complete the round", summary: "Run the current policy in the selected world.", scope: "account" },
    { key: "economy", kind: "mission", title: "Develop the economy", summary: "Maintain capacity, protection, productive investment, and construction runway.", scope: "account", roles: ["capital"] },
    { key: "economy.producers", kind: "group", title: "Resource producers", summary: "Develop lumberyard, quarry, and mine under the current producer policy.", scope: "village" },
    { key: "economy.lumberyard", kind: "task", title: "Lumberyard", summary: "Evaluate timber production and payback.", advisor: "economic", scope: "village", predicateKey: "building.lumberyard" },
    { key: "economy.quarry", kind: "task", title: "Quarry", summary: "Evaluate stone production and payback.", advisor: "economic", scope: "village", predicateKey: "building.quarry" },
    { key: "economy.mine", kind: "task", title: "Iron mine", summary: "Evaluate iron production and payback.", advisor: "economic", scope: "village", predicateKey: "building.mine" },
    { key: "economy.balance", kind: "policy", title: "Resource balance", summary: "Boost the producer of a resource whose stock (in minutes of its own production) lags the other two by 5 minutes or more.", scope: "village", thresholds: { lagMinutes: 5, baseScore: 90, maxScore: 99 } },
    { key: "economy.producers.5", kind: "milestone", title: "Producers at level 5", summary: "All three resource producers reach level 5.", scope: "village", predicateKey: "producers.minimum", thresholds: { minimum: producerLevels["5"] } },
    { key: "economy.producers.8", kind: "milestone", title: "Producers at level 8", summary: "All three resource producers reach level 8.", scope: "village", predicateKey: "producers.minimum", thresholds: { minimum: producerLevels["8"] } },
    { key: "economy.producers.10", kind: "milestone", title: "Producers at level 10", summary: "All three resource producers reach level 10.", scope: "village", predicateKey: "producers.minimum", thresholds: { minimum: producerLevels["10"] } },
    { key: "economy.producers.12", kind: "milestone", title: "Producers at level 12", summary: "All three resource producers reach level 12; the early capital gate is Lumberyard 14, Quarry 14, Mine 14.", scope: "village", predicateKey: "producers.minimum", thresholds: { minimum: producerLevels["12"] } },
    { key: "economy.producers.15", kind: "milestone", title: "Producers at level 15", summary: "All three resource producers reach level 15 after Barracks 5.", scope: "village", predicateKey: "producers.minimum", thresholds: { minimum: producerLevels["15"] } },
    { key: "economy.producers.20", kind: "milestone", title: "Producers at level 20", summary: "All three resource producers reach level 20.", scope: "village", predicateKey: "producers.minimum", thresholds: { minimum: producerLevels["20"] } },
    { key: "economy.producer-cap", kind: "policy", title: "Producers capped at 25", summary: "Capital producers stop at level 25; attack and defence transitions remain at level 20.", scope: "village" },
    { key: "economy.capacity", kind: "group", title: "Capacity and protection", summary: "Protect resources and maintain population and storage capacity.", scope: "village" },
    { key: "economy.farm", kind: "task", title: "Farm capacity", summary: "Keep free population for queued work and Pikeman training; before a long build, offer the Farm first if the batches trained meanwhile wouldn't fit.", advisor: "economic", scope: "village", predicateKey: "building.farm" },
    { key: "economy.storehouse", kind: "task", title: "Storehouse capacity", summary: "Prevent projected overflow; after a capture, proactively expand capital storage to fit the next Envoy before recurring admission, even without overflow.", advisor: "economic", scope: "village", predicateKey: "building.storehouse" },
    { key: "economy.hall", kind: "task", title: "Great Hall", summary: "Use the existing bounded construction payback comparison.", advisor: "economic", scope: "village", predicateKey: "building.hall" },
    { key: "economy.successor-window", kind: "policy", title: "Early-build successor window", summary: "Allow only the existing strict construction-successor window.", scope: "village", thresholds: { remainingRealSecondsExclusive: 10 } },
    { key: "economy.payback", kind: "policy", title: "Production payback", summary: "Keep the existing round-end production return test and ceiling.", scope: "village", thresholds: { producerCeiling: producerLevels.ceiling } },
    { key: "economy.round-end", kind: "policy", title: "Round-end completion", summary: "Keep current affordability, construction, and use deadlines.", scope: "village" },
    { key: "economy.hall-push", kind: "policy", title: "Great Hall push", summary: "Once producers reach 20, force the Great Hall to 15, then keep it growing alongside military growth.", thresholds: { level: 15 }, advisor: "military", scope: "village" },
    { key: "early-game", kind: "group", title: "Early game", summary: "Grow producers to 14/14/14, then build Barracks 1, Wall 5, Hall 10 and Barracks 5 before reaching producers 15. Train toward 200 home Pikemen alongside the build order and complete the infrastructure that enables conquest.", scope: "village", roles: ["capital"] },
    { key: "early.economy", kind: "milestone", title: "Early producer gate", summary: "Reach Lumberyard 14, Quarry 14 and Mine 14.", scope: "village", predicateKey: "producers.early-gate", thresholds: { lumberyard: EARLY_GATE.lumberyard, quarry: EARLY_GATE.quarry, mine: EARLY_GATE.mine } },
    { key: "early.barracks1", kind: "task", title: "Barracks 1", summary: "Build Barracks 1 after the early producer gate.", advisor: "military", scope: "village", predicateKey: "building.barracks", thresholds: { level: 1 } },
    { key: "early.wall5", kind: "task", title: "Wall 5", summary: "Rush Wall 5 after Barracks 1, before further military development.", advisor: "military", scope: "village", predicateKey: "building.wall", thresholds: { level: EARLY_WALL } },
    { key: "early.hall10", kind: "task", title: "Hall 10", summary: "Complete Hall 10 after Wall 5 and before further Barracks growth.", advisor: "military", scope: "village", predicateKey: "building.hall", thresholds: { level: EARLY_HALL } },
    { key: "early.barracks5", kind: "task", title: "Barracks 5", summary: "Grow Barracks to level 5 after Hall 10; Barracks stops there.", advisor: "military", scope: "village", predicateKey: "building.barracks", thresholds: { level: BARRACKS_CAP } },
    { key: "early.pikemen", kind: "task", title: "200 home Pikemen", summary: "Train Pikemen from Barracks 1 in parallel until 200 are home.", advisor: "military", scope: "village", predicateKey: "troops.home-pikeman", thresholds: { count: EARLY_PIKEMEN_TARGET }, replacedBy: "military.pikemen-baseline" },
    { key: "defense", kind: "mission", title: "Military", summary: "Build the Pikemen garrison, keep the Raider attack force trained, and station Scouts.", scope: "account", roles: ["capital"] },
    { key: "military.garrison", kind: "group", title: "Garrison", summary: "Organize the capital's garrison requirements and growth.", scope: "village" },
    { key: "military.pikemen-baseline", kind: "task", title: "Train Pikemen", summary: "Recruit from Barracks 1 toward the own target: 200 before producer 20, then max(200, 3 × strongest economic-city stationed Pikemen). With active requests, train toward max(own target, 250) + all active city requests, ensuring 250 retained after support. Without requests, keep the own target.", scope: "village", predicateKey: "troops.pikeman", thresholds: { count: EARLY_PIKEMEN_TARGET } },
    { key: "military.defence-scale", kind: "policy", title: "Capital holds 3× any city", summary: "At producer 20, the own target is max(200, 3 × strongest economic-city stationed Pikemen). With active requests, train toward max(own target, 250) + all active city requests; otherwise keep the own target. Economic cities follow via their ÷3 defender target.", scope: "village", thresholds: { multiplier: 3 } },
    { key: "military.barracks-growth", kind: "task", title: "Barracks grows when troops lag", summary: "Raise Barracks when it cannot train enough Pikemen or conquest Raiders in time; Barracks is capped at level 5.", scope: "village" },
    { key: "military.scouting", kind: "group", title: "Scouting", summary: "Build Stable 1 and keep the capital's Scouts trained.", scope: "village" },
    { key: "military.stable1", kind: "task", title: "Stable 1", summary: "After producers 15 and 200 home Pikemen, build Stable 1 for Scouts, including its Smithy 5 prerequisite.", advisor: "military", scope: "village", predicateKey: "building.stable", thresholds: { level: 1 } },
    { key: "military.scouts", kind: "task", title: "Train Scouts", summary: "The capital keeps 20 Scouts at home per city it owns, and stations 20 in each economic city on request.", scope: "village", predicateKey: "troops.scout", thresholds: { perCity: 20 } },
    { key: "military.wall-cap", kind: "policy", title: "Wall capped at 10", summary: "Capital Walls stop at level 10.", scope: "village", predicateKey: "building.wall", thresholds: { maxLevel: 10 } },
    { key: "military.attack", kind: "group", title: "Attack", summary: "Late-game resource sink: once the capital's producers reach 20, turn surplus into Lancers and Rams and keep building in the capital.", scope: "village" },
    { key: "military.attack-workshop", kind: "task", title: "Workshop 10", summary: "After Stable 10, build Workshop 10 before raising the Stable further.", advisor: "military", scope: "village", predicateKey: "building.workshop", thresholds: { level: 10 } },
    { key: "military.attack-stable", kind: "task", title: "Stable 10 and beyond", summary: "Build the Stable to at least 10; after Workshop 10, keep raising it when it cannot train units fast enough. Farm takes priority.", advisor: "military", scope: "village", predicateKey: "building.stable", thresholds: { level: 10 } },
    { key: "military.lancers", kind: "policy", title: "Pump Lancers", summary: "Train Lancers from the Stable continuously while timber, stone and iron are each above 10,000 in the capital.", advisor: "military", scope: "village", thresholds: { resourceFloor: 10000 } },
    { key: "military.rams", kind: "policy", title: "Pump Rams", summary: "Train Rams from the Workshop while timber, stone and iron are each above 20,000 in the capital; Lancers come first.", advisor: "military", scope: "village", thresholds: { resourceFloor: 20000 } },
    { key: "military.capital-growth", kind: "policy", title: "Keep building the capital", summary: "The troop sink ranks below capital construction, so buildings keep growing while Lancers and Rams absorb the surplus.", scope: "village" },
    { key: "conquest", kind: "mission", title: "Conquest", summary: "Capture the first city once per round, then prepare for the next cities.", scope: "account", roles: ["capital"] },
    { key: "military.raiders", kind: "task", title: "Raider force", summary: `Keep ${RAIDER_TARGET} Raiders for conquest, counting home, away and queued troops; replace losses. Each wave needs at least 100 at home and takes every Raider at home.`, scope: "village", predicateKey: "troops.raider", thresholds: { count: RAIDER_TARGET } },
    { key: "first-conquest", kind: "group", title: "First conquest", summary: "Starts at the early producer gate and Barracks 5 alongside the early game. Prepare the escort and Envoy and dispatch waves until the city is captured; later captures belong to Next cities.", scope: "account", roles: ["capital"], thresholds: { originVillages: 1, barracks: 5, standingOrders: 0 } },
    { key: "conquest.infrastructure", kind: "group", title: "Conquest enabled", summary: "Build Smithy 10, Market 5 and Court, with capacity and funding as needed.", scope: "village" },
    { key: "conquest.smithy10", kind: "task", title: "Smithy 10", summary: "Build the conquest Smithy requirement.", advisor: "conquest", scope: "village", predicateKey: "building.smithy", thresholds: { level: 10 } },
    { key: "conquest.market5", kind: "task", title: "Market 5", summary: "Build the conquest Market requirement.", advisor: "conquest", scope: "village", predicateKey: "building.market", thresholds: { level: 5 } },
    { key: "conquest.court", kind: "task", title: "Court", summary: "Build the next conquest building returned by current rules.", advisor: "conquest", scope: "village", predicateKey: "building.court", thresholds: { level: 1 } },
    { key: "conquest.capacity", kind: "task", title: "Conquest capacity prerequisite", summary: "Propose a Farm (96) when a conquest build or Raider/Envoy batch would leave less than max(50, 20% of the population limit rounded up) free. Propose a Storehouse (96) if any resource cost exceeds storage.", advisor: "conquest", scope: "village", predicateKey: "capacity.conquest" },
    { key: "conquest.producer-funding", kind: "policy", title: "Producer funding fallback", summary: "Compare the existing bounded producer investment against saving for the next conquest building.", scope: "village" },
    { key: "conquest.producer-investment", kind: "task", title: "Conquest producer investment", summary: "Build the selected producer when the bounded funding fallback applies.", advisor: "conquest", scope: "village", predicateKey: "producer.funding" },
    { key: "conquest.enabled", kind: "milestone", title: "Conquest enabled", summary: "Smithy 10, Market 5 and Court are complete; the Court needs the early-game Hall 10.", scope: "village", predicateKey: "requires.done" },
    { key: "expansion", kind: "mission", title: "Next cities", summary: "After the first capture, conquer the next cities one at a time once existing cities are developed.", scope: "account", roles: ["capital"] },
    { key: "conquest.escort", kind: "task", title: "Prepare Raider escort", summary: "Prepare the simulated bounded escort without replacing surviving waves.", advisor: "conquest", scope: "village", predicateKey: "troops.raider", replacedBy: "expansion.escort" },
    { key: "conquest.envoy", kind: "task", title: "Prepare Envoy", summary: "Prepare one reusable Envoy for the bounded mission.", advisor: "conquest", scope: "village", predicateKey: "troops.envoy", thresholds: { count: 1 }, replacedBy: "expansion.envoy" },
    { key: "conquest.dispatch", kind: "task", title: "Dispatch conquest wave", summary: "Recheck ownership and simulation before each of at most six waves.", advisor: "conquest", scope: "village", predicateKey: "conquest.dispatch", thresholds: { maximumWaves: 6 }, replacedBy: "expansion.dispatch" },
    { key: "conquest.target-owned", kind: "milestone", title: "Target owned", summary: "Fresh village ownership completes the mission regardless of final response attribution.", scope: "account", predicateKey: "village.target-owned" },
    { key: "conquest.first-achieved", kind: "milestone", title: "First city captured", summary: "Retain evidence for the completed first conquest.", scope: "account", predicateKey: "history.first-conquest" },
    { key: "expansion.recall", kind: "task", title: "Recall the escort", summary: "After a capture, the conquering attack's survivors stay in the captured city as support; send every stationed Raider back home to the capital. Pikemen are left in place.", scope: "village", roles: ["economic"] },
    { key: "capability.parallel-budgets", kind: "capability", title: "Parallel mission budgets", summary: "Unavailable: no cross-mission parallel budget allocator.", scope: "account" },
    { key: "capability.multi-submit", kind: "capability", title: "Multiple submissions per cycle", summary: "Unavailable: one authorized submission per cycle remains.", scope: "account" },
    { key: "roles", kind: "policy", title: "City roles", summary: "Tag every city automatically: the conquest origin is the capital, every other city is economic.", scope: "account" },
    { key: "logistics", kind: "mission", title: "Supply economic cities", summary: "The capital fulfils requests published by economic cities: resources by trade, later defenders.", scope: "account", roles: ["capital"] },
    { key: "logistics.fulfil", kind: "task", title: "Fulfil requests", summary: "Send each requested resource as its own trade, weighed against the capital's own builds; one shipment per resource in flight per city.", advisor: "logistics", scope: "village", predicateKey: "requests.fulfil" },
    { key: "economic-city", kind: "mission", title: "Economic city", summary: "Grow a captured city into an economy fed by capital shipments; no military.", scope: "village", roles: ["economic"] },
    { key: "econ.build-order", kind: "group", title: "Build order", summary: "Fixed steps in order; each step starts only after the previous one is done.", scope: "village" },
    { key: "econ.cellar3", kind: "task", title: "1. Cellar 3", summary: "Cheap first protection: hides 796 of each resource.", advisor: "economic", scope: "village", predicateKey: "building.cellar", thresholds: { level: 3 } },
    { key: "econ.hall5", kind: "task", title: "2. Great Hall 5", summary: "First construction speed-up with shipped resources.", advisor: "economic", scope: "village", predicateKey: "building.hall", thresholds: { level: 5 } },
    { key: "econ.cellar-cover", kind: "task", title: "3. Cellar covers requested stock", summary: "Raise the Cellar until it hides the requested stock: Cellar 7 hides 2,491, covering a 2,000 top-up.", advisor: "economic", scope: "village", predicateKey: "building.cellar", thresholds: { level: 7 } },
    { key: "econ.hall13", kind: "task", title: "4. Great Hall 13", summary: "Keep building the Hall with pulled resources: about 47% faster construction at level 13.", advisor: "economic", scope: "village", predicateKey: "building.hall", thresholds: { level: 13 } },
    { key: "econ.cellar10", kind: "task", title: "5. Cellar 10", summary: "Hides 5,860 of each resource.", advisor: "economic", scope: "village", predicateKey: "building.cellar", thresholds: { level: 10 } },
    { key: "econ.storehouse3", kind: "task", title: "6. Storehouse 3", summary: "Holds 5,358 of each resource, room for larger top-ups and for stock bound to the capital.", advisor: "economic", scope: "village", predicateKey: "building.storehouse", thresholds: { level: 3 } },
    { key: "econ.setup-done", kind: "milestone", title: "Setup done", summary: "Every build-order step is done; the city moves on to producers, storage growth and the Market.", scope: "village", predicateKey: "steps.done" },
    { key: "econ.producers", kind: "group", title: "Producers", summary: "Producers up to 10; above that is Producers 11–25, after Wall 10.", scope: "village" },
    { key: "econ.lumberyard", kind: "task", title: "Lumberyard", summary: "Grow timber production.", advisor: "economic", scope: "village", predicateKey: "building.lumberyard", thresholds: { level: 10 } },
    { key: "econ.quarry", kind: "task", title: "Quarry", summary: "Grow stone production.", advisor: "economic", scope: "village", predicateKey: "building.quarry", thresholds: { level: 10 } },
    { key: "econ.mine", kind: "task", title: "Iron mine", summary: "Grow iron production.", advisor: "economic", scope: "village", predicateKey: "building.mine", thresholds: { level: 10 } },
    { key: "econ.balance", kind: "policy", title: "Resource balance", summary: "Same rule as the capital: boost the producer of a lagging resource; the boost is not capped by the economic-city producer score.", scope: "village", thresholds: { lagMinutes: 5, baseScore: 90, maxScore: 99 } },
    { key: "econ.producers.5", kind: "milestone", title: "Producers at level 5", summary: "All three producers reach level 5.", scope: "village", predicateKey: "producers.minimum", thresholds: { minimum: 5 } },
    { key: "econ.producers.10", kind: "milestone", title: "Producers at level 10", summary: "All three producers reach level 10.", scope: "village", predicateKey: "producers.minimum", thresholds: { minimum: 10 } },
    { key: "econ.producers-late", kind: "group", title: "Producers 11–25", summary: "Raise producers from level 11 through 25 after Wall 10.", scope: "village" },
    { key: "econ.lumberyard25", kind: "task", title: "Lumberyard", summary: "Grow timber production.", advisor: "economic", scope: "village", predicateKey: "building.lumberyard", thresholds: { level: 25 } },
    { key: "econ.quarry25", kind: "task", title: "Quarry", summary: "Grow stone production.", advisor: "economic", scope: "village", predicateKey: "building.quarry", thresholds: { level: 25 } },
    { key: "econ.mine25", kind: "task", title: "Iron mine", summary: "Grow iron production.", advisor: "economic", scope: "village", predicateKey: "building.mine", thresholds: { level: 25 } },
    { key: "econ.producers.25", kind: "milestone", title: "Producers at level 25", summary: "All three producers reach level 25.", scope: "village", predicateKey: "producers.minimum", thresholds: { minimum: 25 } },
    { key: "econ.farm", kind: "task", title: "Farm when blocked", summary: "Build a Farm only when population blocks the next step.", advisor: "economic", scope: "village", predicateKey: "building.farm" },
    { key: "econ.storage-growth", kind: "policy", title: "Storage grows when needed", summary: "Raise the Storehouse when stock plus shipments in flight and income would overflow it; the Cellar follows so it keeps protecting the stock.", scope: "village", thresholds: { forecastTicks: 300 } },
    { key: "econ.storehouse", kind: "task", title: "Storehouse", summary: "Storehouse upgrade chosen by the storage policy.", advisor: "economic", scope: "village", predicateKey: "building.storehouse" },
    { key: "econ.cellar", kind: "task", title: "Cellar follows storage", summary: "Keep Cellar protection at or above the stock the city holds.", advisor: "economic", scope: "village", predicateKey: "building.cellar" },
    { key: "econ.market-growth", kind: "policy", title: "Market grows when needed", summary: "Market 1 after producers 5; further levels when the surplus for the capital needs more merchants than the Market has.", scope: "village" },
    { key: "econ.no-military", kind: "policy", title: "No military", summary: "Never builds Barracks, Smithy or Stable and never trains troops; the Wall up to 10 is the exception. Defenders and Scouts are stationed by the capital.", scope: "village" },
    { key: "econ.market", kind: "task", title: "Market", summary: "Build a Market once producers reach level 5 (needs Great Hall 3 and Storehouse 2); the market policy raises it when surplus shipping needs more merchants.", advisor: "economic", scope: "village", predicateKey: "building.market", thresholds: { level: 1 } },
    { key: "logistics.market-growth", kind: "task", title: "Market grows when needed", summary: "Raise the capital's Market when open requests need more merchants than it has.", advisor: "logistics", scope: "village", predicateKey: "building.market" },
    { key: "econ.requests", kind: "group", title: "Requests to the capital", summary: "What this city asks the capital for; the capital decides whether it can afford it.", scope: "village" },
    { key: "econ.request-resources", kind: "task", title: "Request resources", summary: "Per resource, by stage: setup below 1,000 tops up to 2,000 (95); growth below 2,000 tops up to 4,000 (85); developed the same buffer at 40.", advisor: "logistics", scope: "village", predicateKey: "requests.resources", thresholds: { setupBelow: 1000, setupTopUp: 2000, setupScore: 95, growthBelow: 2000, growthTopUp: 4000, growthScore: 85, developedScore: 40 } },
    { key: "econ.request-defenders", kind: "task", title: "Request defenders", summary: "Unlocked by Wall 10. Target stationed Pikemen = max(250, floor(capital home Pikemen ÷ 3)); request a top-up only below 80% (capital 600 → target 250, top-up below 200). The capital trains for 250 retained + all active city requests, or its higher own target plus requests, and sends only when 250 remain at home.", scope: "village", thresholds: { baseline: 250, capitalShare: 3, triggerShare: 0.8 } },
    { key: "econ.request-scouts", kind: "task", title: "Request scouts", summary: "Keep 20 Scouts stationed; support Scouts defend against enemy scouting.", scope: "village" },
    { key: "econ.producers.15", kind: "milestone", title: "Producers at level 15", summary: "All three producers reach level 15.", scope: "village", predicateKey: "producers.minimum", thresholds: { minimum: 15 } },
    { key: "econ.surplus", kind: "task", title: "Send surplus to the capital", summary: "Once all producers are 15+, ship stock above the next build's cost (at least 4,000 of each kept) to the capital, bounded by merchants and the capital's free storage.", advisor: "economic", scope: "village", thresholds: { producers: 15, reserve: 4000, minimumMerchants: 5 } },
    { key: "econ.wall10", kind: "task", title: "Wall 10", summary: "Built after producers reach 10; the only military building an economic city builds.", scope: "village", thresholds: { level: 10 } },
    { key: "expansion.next", kind: "group", title: "Next conquest", summary: "After the first capture, keep taking one new city at a time when existing cities are developed enough.", scope: "account", roles: ["capital"] },
    { key: "expansion.readiness", kind: "policy", title: "Expansion readiness", summary: "Start the next mission after capital readiness and Great Hall 10 in every economic city, only if estimated Envoy funding, training and capture fit before round end with a 60-tick margin; train its Envoy only after Every city defended.", scope: "village", thresholds: { economicHall: 10, homePikemen: 150, endMargin: 60 } },
    { key: "expansion.cities-defended", kind: "milestone", title: "Every city defended", summary: "Every economic city has Wall 10 and at least 80% of its Pikemen target stationed.", scope: "account", thresholds: { economicWall: 10, defenderShare: 0.8 } },
    { key: "expansion.envoy", kind: "task", title: "Train next Envoy", summary: "Train one Envoy for the next target once the next conquest has started.", advisor: "conquest", scope: "village", predicateKey: "troops.envoy" },
    { key: "expansion.escort", kind: "task", title: "Escort army at home", summary: `Before every wave, train up to max(${RAIDER_TARGET}, simulated escort) Raiders; earlier survivors count.`, advisor: "conquest", scope: "village", predicateKey: "troops.raider" },
    { key: "expansion.dispatch", kind: "task", title: "Dispatch waves", summary: "Recheck each of at most six waves with at least 100 home Raiders. Capture deadlines use current target loyalty from battle reports or target assessments, otherwise landed hits and regeneration; fresh admission assumes 100.", advisor: "conquest", scope: "village", predicateKey: "conquest.dispatch", thresholds: { maximumWaves: 6 } },
    { key: "expansion.captured", kind: "milestone", title: "Target captured", summary: "The captured city is tagged economic and starts the economic-city flow.", scope: "account" },
    { key: "expansion.cities4", kind: "milestone", title: "4 cities owned", summary: "Own four cities before opening the enemy-conquest plan.", scope: "account", predicateKey: "cities.count", thresholds: { minimum: 4 }, planned: true },
    { key: "expansion.enemy", kind: "group", title: "Enemy conquest", summary: "Scout and simulate attacks on enemy player villages before dispatching conquest.", scope: "account", planned: true },
    { key: "expansion.enemy-target", kind: "policy", title: "Close and big", summary: "Target enemy player villages, ranked by size (points) over distance.", scope: "account", planned: true },
    { key: "expansion.enemy-scout", kind: "task", title: "Scout the target", summary: "Send Scouts before any attack; use the report's intel for the battle simulation.", scope: "village", planned: true },
    { key: "expansion.decisive", kind: "policy", title: "Attack at 2×", summary: "Attack only with at least 100 Raiders at home, when our attack is at least 2× their defence and an Envoy is simulated to survive. Winner losses are (loser ÷ winner)^1.5, so a 2× edge costs about 35% of the army.", scope: "account", thresholds: { strengthRatio: 2 }, planned: true },
    { key: "expansion.enemy-dispatch", kind: "task", title: "Dispatch conquest", summary: "Dispatch the enemy conquest after scouting and a decisive battle simulation, with at least 100 Raiders at home.", scope: "village", planned: true },
  ] as const satisfies readonly PlanNode[],
  edges: [
    { from: "round", to: "economy", kind: "contains" },
    { from: "round", to: "early-game", kind: "contains" },
    { from: "round", to: "conquest", kind: "contains" },
    { from: "round", to: "defense", kind: "contains" },
    { from: "round", to: "logistics", kind: "contains" },
    { from: "round", to: "economic-city", kind: "contains" },
    { from: "round", to: "roles", kind: "contains" },
    { from: "round", to: "capability.parallel-budgets", kind: "contains" },
    { from: "round", to: "capability.multi-submit", kind: "contains" },
    { from: "logistics", to: "logistics.fulfil", kind: "contains" },
    { from: "economic-city", to: "econ.build-order", kind: "contains" },
    { from: "econ.build-order", to: "econ.cellar3", kind: "contains" },
    { from: "econ.build-order", to: "econ.hall5", kind: "contains" },
    { from: "econ.build-order", to: "econ.cellar-cover", kind: "contains" },
    { from: "econ.build-order", to: "econ.hall13", kind: "contains" },
    { from: "econ.build-order", to: "econ.cellar10", kind: "contains" },
    { from: "econ.build-order", to: "econ.storehouse3", kind: "contains" },
    { from: "econ.build-order", to: "econ.setup-done", kind: "contains" },
    { from: "economic-city", to: "econ.producers", kind: "contains" },
    { from: "econ.producers", to: "econ.lumberyard", kind: "contains" },
    { from: "econ.producers", to: "econ.quarry", kind: "contains" },
    { from: "econ.producers", to: "econ.mine", kind: "contains" },
    { from: "econ.producers", to: "econ.balance", kind: "contains" },
    { from: "econ.producers", to: "econ.producers.5", kind: "contains" },
    { from: "econ.producers", to: "econ.producers.10", kind: "contains" },
    { from: "economic-city", to: "econ.wall10", kind: "contains" },
    { from: "economic-city", to: "econ.producers-late", kind: "contains" },
    { from: "econ.producers-late", to: "econ.lumberyard25", kind: "contains" },
    { from: "econ.producers-late", to: "econ.quarry25", kind: "contains" },
    { from: "econ.producers-late", to: "econ.mine25", kind: "contains" },
    { from: "econ.producers-late", to: "econ.producers.25", kind: "contains" },
    { from: "economic-city", to: "econ.farm", kind: "contains" },
    { from: "economic-city", to: "econ.storage-growth", kind: "contains" },
    { from: "econ.storage-growth", to: "econ.storehouse", kind: "contains" },
    { from: "econ.storage-growth", to: "econ.cellar", kind: "contains" },
    { from: "economic-city", to: "econ.market-growth", kind: "contains" },
    { from: "economic-city", to: "econ.no-military", kind: "contains" },
    { from: "econ.market-growth", to: "econ.market", kind: "contains" },
    { from: "logistics", to: "logistics.market-growth", kind: "contains" },
    { from: "economic-city", to: "econ.requests", kind: "contains" },
    { from: "econ.requests", to: "econ.request-resources", kind: "contains" },
    { from: "econ.requests", to: "econ.request-defenders", kind: "contains" },
    { from: "econ.requests", to: "econ.request-scouts", kind: "contains" },
    { from: "econ.producers-late", to: "econ.producers.15", kind: "contains" },
    { from: "economic-city", to: "econ.surplus", kind: "contains" },
    { from: "expansion.next", to: "expansion.readiness", kind: "contains" },
    { from: "expansion.next", to: "expansion.cities-defended", kind: "contains" },
    { from: "expansion.readiness", to: "expansion.envoy", kind: "contains" },
    { from: "expansion.cities-defended", to: "expansion.envoy", kind: "requires" },
    { from: "expansion.next", to: "expansion.escort", kind: "contains" },
    { from: "expansion.next", to: "expansion.dispatch", kind: "contains" },
    { from: "expansion.next", to: "expansion.captured", kind: "contains" },
    { from: "expansion", to: "expansion.recall", kind: "contains" },
    { from: "expansion", to: "expansion.cities4", kind: "contains" },
    { from: "expansion", to: "expansion.enemy", kind: "contains" },
    { from: "expansion.enemy", to: "expansion.enemy-target", kind: "contains" },
    { from: "expansion.enemy", to: "expansion.enemy-scout", kind: "contains" },
    { from: "expansion.enemy", to: "expansion.decisive", kind: "contains" },
    { from: "expansion.enemy", to: "expansion.enemy-dispatch", kind: "contains" },
    { from: "econ.cellar3", to: "econ.hall5", kind: "requires" },
    { from: "econ.hall5", to: "econ.cellar-cover", kind: "requires" },
    { from: "econ.cellar-cover", to: "econ.hall13", kind: "requires" },
    { from: "econ.hall13", to: "econ.cellar10", kind: "requires" },
    { from: "econ.cellar10", to: "econ.storehouse3", kind: "requires" },
    { from: "econ.storehouse3", to: "econ.setup-done", kind: "requires" },
    { from: "econ.setup-done", to: "econ.producers", kind: "requires" },
    { from: "econ.setup-done", to: "econ.storage-growth", kind: "requires" },
    { from: "econ.setup-done", to: "econ.market-growth", kind: "requires" },
    { from: "econ.producers.5", to: "econ.market", kind: "requires" },
    { from: "econ.producers.10", to: "econ.wall10", kind: "requires" },
    { from: "econ.wall10", to: "econ.producers-late", kind: "requires" },
    { from: "econ.wall10", to: "econ.request-defenders", kind: "requires" },
    { from: "econ.market", to: "econ.surplus", kind: "requires" },
    { from: "econ.producers.15", to: "econ.surplus", kind: "requires" },
    { from: "conquest.market5", to: "logistics", kind: "requires" },
    { from: "econ.request-resources", to: "logistics.fulfil", kind: "contributesTo" },
    { from: "econ.request-defenders", to: "logistics.fulfil", kind: "contributesTo" },
    { from: "econ.request-scouts", to: "logistics.fulfil", kind: "contributesTo" },
    { from: "logistics.fulfil", to: "economic-city", kind: "contributesTo" },
    { from: "conquest.first-achieved", to: "expansion.next", kind: "requires" },
    { from: "expansion.envoy", to: "expansion.dispatch", kind: "requires" },
    { from: "expansion.escort", to: "expansion.dispatch", kind: "requires" },
    { from: "expansion.dispatch", to: "expansion.captured", kind: "contributesTo" },
    { from: "expansion.captured", to: "economic-city", kind: "contributesTo" },
    { from: "economy", to: "economy.producers", kind: "contains" },
    { from: "economy.producers", to: "economy.lumberyard", kind: "contains" },
    { from: "economy.producers", to: "economy.quarry", kind: "contains" },
    { from: "economy.producers", to: "economy.mine", kind: "contains" },
    { from: "economy.producers", to: "economy.balance", kind: "contains" },
    { from: "economy.producers", to: "economy.producers.5", kind: "contains" },
    { from: "economy.producers", to: "economy.producers.8", kind: "contains" },
    { from: "economy.producers", to: "economy.producers.10", kind: "contains" },
    { from: "economy.producers", to: "economy.producers.12", kind: "contains" },
    { from: "economy.producers", to: "economy.producers.15", kind: "contains" },
    { from: "economy.producers", to: "economy.producers.20", kind: "contains" },
    { from: "economy.producers", to: "economy.producer-cap", kind: "contains" },
    { from: "economy", to: "economy.capacity", kind: "contains" },
    { from: "economy.capacity", to: "economy.farm", kind: "contains" },
    { from: "economy.capacity", to: "economy.storehouse", kind: "contains" },
    { from: "economy", to: "economy.hall", kind: "contains" },
    { from: "economy", to: "economy.successor-window", kind: "contains" },
    { from: "economy", to: "economy.payback", kind: "contains" },
    { from: "economy", to: "economy.round-end", kind: "contains" },
    { from: "economy", to: "economy.hall-push", kind: "contains" },
    { from: "defense", to: "military.garrison", kind: "contains" },
    { from: "military.garrison", to: "military.pikemen-baseline", kind: "contains" },
    { from: "military.garrison", to: "military.defence-scale", kind: "contains" },
    { from: "military.garrison", to: "military.barracks-growth", kind: "contains" },
    { from: "defense", to: "military.scouting", kind: "contains" },
    { from: "military.scouting", to: "military.stable1", kind: "contains" },
    { from: "military.scouting", to: "military.scouts", kind: "contains" },
    { from: "defense", to: "military.wall-cap", kind: "contains" },
    { from: "defense", to: "military.attack", kind: "contains" },
    { from: "military.attack", to: "military.attack-workshop", kind: "contains" },
    { from: "military.attack", to: "military.attack-stable", kind: "contains" },
    { from: "military.attack", to: "military.lancers", kind: "contains" },
    { from: "military.attack", to: "military.rams", kind: "contains" },
    { from: "military.attack", to: "military.capital-growth", kind: "contains" },
    { from: "early-game", to: "early.economy", kind: "contains" },
    { from: "early-game", to: "early.barracks1", kind: "contains" },
    { from: "early-game", to: "early.wall5", kind: "contains" },
    { from: "early-game", to: "early.hall10", kind: "contains" },
    { from: "early-game", to: "early.barracks5", kind: "contains" },
    { from: "early-game", to: "early.pikemen", kind: "contains" },
    { from: "early-game", to: "conquest.infrastructure", kind: "contains" },
    { from: "conquest", to: "military.raiders", kind: "contains" },
    { from: "conquest", to: "first-conquest", kind: "contains" },
    { from: "conquest", to: "expansion", kind: "contains" },
    { from: "conquest.infrastructure", to: "conquest.smithy10", kind: "contains" },
    { from: "conquest.infrastructure", to: "conquest.market5", kind: "contains" },
    { from: "conquest.infrastructure", to: "conquest.court", kind: "contains" },
    { from: "conquest.infrastructure", to: "conquest.capacity", kind: "contains" },
    { from: "conquest.infrastructure", to: "conquest.producer-funding", kind: "contains" },
    { from: "conquest.infrastructure", to: "conquest.enabled", kind: "contains" },
    { from: "first-conquest", to: "conquest.escort", kind: "contains" },
    { from: "first-conquest", to: "conquest.envoy", kind: "contains" },
    { from: "first-conquest", to: "conquest.dispatch", kind: "contains" },
    { from: "first-conquest", to: "conquest.target-owned", kind: "contains" },
    { from: "first-conquest", to: "conquest.first-achieved", kind: "contains" },
    { from: "expansion", to: "expansion.next", kind: "contains" },
    { from: "expansion.cities4", to: "expansion.enemy", kind: "requires" },
    { from: "expansion.enemy-scout", to: "expansion.enemy-dispatch", kind: "requires" },
    { from: "conquest.producer-funding", to: "conquest.producer-investment", kind: "contains" },
    { from: "economy.producers.8", to: "economy.hall", kind: "requires" },
    { from: "economy.producers.20", to: "military.defence-scale", kind: "requires" },
    { from: "economy.producers.20", to: "economy.hall-push", kind: "requires" },
    { from: "early.economy", to: "early.barracks1", kind: "requires" },
    { from: "early.barracks1", to: "early.wall5", kind: "requires" },
    { from: "early.wall5", to: "early.hall10", kind: "requires" },
    { from: "early.hall10", to: "early.barracks5", kind: "requires" },
    { from: "early.barracks5", to: "economy.producers.15", kind: "requires" },
    { from: "early.barracks1", to: "early.pikemen", kind: "requires" },
    { from: "early.barracks1", to: "first-conquest", kind: "requires" },
    { from: "economy.producers.15", to: "military.stable1", kind: "requires" },
    { from: "early.pikemen", to: "military.stable1", kind: "requires" },
    { from: "economy.producers.20", to: "military.attack", kind: "requires" },
    { from: "military.attack-stable", to: "military.attack-workshop", kind: "requires" },
    { from: "military.stable1", to: "military.scouts", kind: "requires" },
    { from: "economy.producers.15", to: "conquest.infrastructure", kind: "requires" },
    { from: "conquest.escort", to: "conquest.dispatch", kind: "requires" },
    { from: "conquest.envoy", to: "conquest.dispatch", kind: "requires" },
    { from: "conquest.smithy10", to: "conquest.enabled", kind: "requires" },
    { from: "conquest.market5", to: "conquest.enabled", kind: "requires" },
    { from: "conquest.court", to: "conquest.enabled", kind: "requires" },
    { from: "conquest.enabled", to: "expansion", kind: "requires" },
    { from: "conquest.enabled", to: "conquest.dispatch", kind: "requires" },
    { from: "conquest.dispatch", to: "conquest.target-owned", kind: "contributesTo" },
    { from: "conquest.target-owned", to: "conquest.first-achieved", kind: "requires" },
    { from: "conquest.target-owned", to: "expansion.recall", kind: "requires" },
  ] as const satisfies readonly PlanEdge[],
} satisfies PlanDefinition;

export type TaskKey = Extract<(typeof PLAN.nodes)[number], { kind: "task" | "policy" }>["key"];

export function proposalTask(
  advisor: string,
  action: { type: string; building?: string; unit?: string },
  targetLevel: number,
): TaskKey {
  if (action.type === "trade") return "logistics.fulfil";
  if (action.type === "recall") return "expansion.recall";
  if (advisor === "conquest") {
    if (action.type === "send") return "conquest.dispatch";
    if (action.type === "train") return action.unit === "envoy" ? "conquest.envoy" : "conquest.escort";
    if (["lumberyard", "quarry", "mine"].includes(action.building ?? "")) return "conquest.producer-investment";
    if (action.building === "hall" || action.building === "barracks") return "conquest.capacity";
    if (action.building === "smithy") return "conquest.smithy10";
    if (action.building === "market") return "conquest.market5";
    if (action.building === "court") return "conquest.court";
    return "conquest.capacity";
  }
  if (advisor === "military") {
    if (action.building === "hall") return "early.hall10";
    if (action.building === "wall" && targetLevel <= EARLY_WALL) return "early.wall5";
    if (action.building === "barracks" && targetLevel === 1) return "early.barracks1";
    if (action.building === "barracks" && targetLevel <= BARRACKS_CAP) return "early.barracks5";
    if (action.building === "smithy") return "military.stable1";
  }
  if (action.type === "train") {
    if (action.unit === "raider") return "military.raiders";
    if (action.unit === "scout") return "military.scouts";
    if (action.unit === "envoy") return "conquest.envoy";
    return "military.pikemen-baseline";
  }
  if (action.building === "farm") return "economy.farm";
  if (action.building === "storehouse") return "economy.storehouse";
  if (action.building === "hall") return "economy.hall";
  if (action.building === "lumberyard") return "economy.lumberyard";
  if (action.building === "quarry") return "economy.quarry";
  if (action.building === "mine") return "economy.mine";
  if (action.building === "wall") return "military.wall-cap";
  if (action.building === "barracks" && targetLevel === 1) return "early.barracks1";
  if (action.building === "barracks" && targetLevel <= BARRACKS_CAP) return "early.barracks5";
  if (action.building === "stable") return "military.stable1";
  if (action.building === "smithy") return "conquest.smithy10";
  if (action.building === "cellar") return "econ.cellar";
  if (action.building === "market") return "logistics.market-growth";
  if (action.building === "court") return "conquest.court";
  return "military.barracks-growth";
}

export function isTaskKey(value: unknown): value is TaskKey {
  return typeof value === "string" && PLAN.nodes.some(node =>
    node.key === value && (node.kind === "task" ||
      (node.kind === "policy" && !PLAN.edges.some(edge => edge.kind === "contains" && edge.from === node.key)))
  );
}

export function validatePlan(plan: PlanDefinition = PLAN): void {
  const byKey = new Map<string, PlanNode>();
  for (const node of plan.nodes) {
    if (!node.key || byKey.has(node.key)) throw new Error(`Duplicate or empty plan node key: ${node.key}`);
    if ((node.kind === "task" || node.kind === "milestone") && !node.scope) {
      throw new Error(`Plan node ${node.key} requires a scope`);
    }
    byKey.set(node.key, node);
  }
  for (const node of plan.nodes) {
    if (node.replacedBy && !byKey.has(node.replacedBy)) {
      throw new Error(`Unknown replacement target for ${node.key}: ${node.replacedBy}`);
    }
  }
  const containsParents = new Map<string, string>();
  const requires = new Map<string, string[]>();
  for (const edge of plan.edges) {
    if (!byKey.has(edge.from) || !byKey.has(edge.to)) throw new Error(`Unknown plan edge reference: ${edge.from} -> ${edge.to}`);
    if (edge.kind === "contains") {
      if (containsParents.has(edge.to)) throw new Error(`Plan node ${edge.to} has multiple contains parents`);
      containsParents.set(edge.to, edge.from);
    }
    if (edge.kind === "requires") requires.set(edge.from, [...(requires.get(edge.from) ?? []), edge.to]);
  }
  const roots = plan.nodes.filter(node => !containsParents.has(node.key));
  if (roots.length !== 1 || roots[0]?.kind !== "objective") throw new Error("Contains edges must form one rooted tree");
  const visiting = new Set<string>(), visited = new Set<string>();
  const walkContains = (key: string): void => {
    if (visiting.has(key)) throw new Error(`Contains cycle at ${key}`);
    if (visited.has(key)) return;
    visiting.add(key);
    for (const edge of plan.edges) if (edge.kind === "contains" && edge.from === key) walkContains(edge.to);
    visiting.delete(key);
    visited.add(key);
  };
  walkContains(roots[0].key);
  if (visited.size !== plan.nodes.length) throw new Error("Contains edges must reach every plan node");
  visiting.clear(); visited.clear();
  const walkRequires = (key: string): void => {
    if (visiting.has(key)) throw new Error(`Requires cycle at ${key}`);
    if (visited.has(key)) return;
    visiting.add(key);
    for (const next of requires.get(key) ?? []) walkRequires(next);
    visiting.delete(key);
    visited.add(key);
  };
  for (const node of plan.nodes) walkRequires(node.key);
}
