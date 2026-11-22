import { PRODUCER_CEILING } from "./defense-budget.js";
import { productionPayback } from "./payback.js";
import type {
  BuildingId,
  LevelRow,
  Resources,
  RulesResponse,
  StateResponse,
  VillageState,
} from "../shared/api.js";

const resources = ["timber", "stone", "iron"] as const;
const producers = {
  lumberyard: "timber",
  quarry: "stone",
  mine: "iron",
} as const;
const producerIds = Object.keys(producers) as (keyof typeof producers)[];
/** A bounded client-side estimate, not a game simulation or a committed build plan. */
export const LEGACY_HALL_LOOKAHEAD = {
  maxUpgrades: 8,
  maxTicks: 3600,
  minimumSaving: 20,
  margin: 0.1,
  producerPayback: false,
} as const;
export const HALL_LOOKAHEAD = {
  ...LEGACY_HALL_LOOKAHEAD,
  maxUpgrades: 24,
  maxTicks: 7200,
  producerPayback: true,
} as const;
export interface HallPolicy {
  maxUpgrades: number;
  maxTicks: number;
  minimumSaving: number;
  margin: number;
  producerPayback?: boolean;
  producerCeiling?: number;
}
export interface HallEstimate {
  needed: boolean;
  importance: number;
  reason: string;
  sequence: { building: BuildingId; level: number }[];
  baselineTicks: number;
  hallFirstTicks: number | null;
  baselineWaitTicks: number;
  hallFirstWaitTicks: number | null;
  savingTicks: number;
}
interface Projection {
  stock: Resources;
  rates: Resources;
  levels: VillageState["buildings"];
  storage: number;
  hidden: number;
  used: number;
  capacity: number;
  elapsed: number;
  waiting: number;
  nextActAt: number;
}
export function estimateHall(
  v: VillageState,
  rules: RulesResponse,
  world: StateResponse["world"],
  policy: HallPolicy = HALL_LOOKAHEAD,
): HallEstimate {
  const option = v.options.build.find((o) => o.building === "hall");
  const result: HallEstimate = {
    needed: false,
    importance: 30,
    reason: "",
    sequence: [],
    baselineTicks: 0,
    hallFirstTicks: null,
    baselineWaitTicks: 0,
    hallFirstWaitTicks: null,
    savingTicks: 0,
  };
  const skip = (reason: string) => ({ ...result, reason });
  if (!option || !rules.tables.buildings.hall[v.buildings.hall])
    return skip("Great Hall is at its maximum level.");
  if (v.buildQueue.length || v.orders.build.length)
    return skip(
      "Reassess Great Hall payback after existing construction or standing orders finish; no speculative queued production is counted.",
    );
  if (world.status !== "running")
    return skip("Great Hall planning waits for a running round.");
  if (option.blockers.some((b) => b !== "INSUFFICIENT_RESOURCES"))
    return skip(`Great Hall cannot be planned: ${option.blockers.join(", ")}.`);
  const horizon = Math.min(
    policy.maxTicks,
    world.endsAtTick === null ? Infinity : world.endsAtTick - world.tick,
  );
  if (horizon <= 0)
    return skip("There is no remaining round time for Great Hall payback.");
  const unlocks = Object.entries(
    rules.rules.BUILDINGS as Record<
      string,
      { name: string; requires: Partial<Record<BuildingId, number>> }
    >,
  )
    .filter(
      ([, rule]) =>
        rule.requires?.hall === v.buildings.hall + 1 &&
        Object.entries(rule.requires).every(
          ([id, level]) =>
            id === "hall" || v.buildings[id as BuildingId] >= level!,
        ),
    )
    .map(([, rule]) => rule.name);
  const unlockReason = unlocks.length
    ? ` Also unlocks ${unlocks.join(", ")}; no speculative military value is assigned without a recruitment plan.`
    : "";
  const initial = (): Projection => ({
    stock: Object.fromEntries(
      resources.map((r) => [r, v.resourcesMilli[r] / 1000]),
    ) as Resources,
    rates: Object.fromEntries(
      resources.map((r) => [r, v.productionPerTickMilli[r] / 1000]),
    ) as Resources,
    levels: { ...v.buildings },
    storage: v.storage,
    hidden: v.hidden,
    used: v.population.used,
    capacity: v.population.max,
    elapsed: 0,
    waiting: 0,
    nextActAt: 0,
  });
  const metadata = rules.rules.BUILDINGS as Record<
    BuildingId,
    { requires?: Partial<Record<BuildingId, number>> }
  >;
  const rowFor = (p: Projection, id: BuildingId): LevelRow | undefined =>
    rules.tables.buildings[id][p.levels[id]];
  const advance = (p: Projection, ticks: number) => {
    for (const r of resources)
      p.stock[r] = Math.min(p.storage, p.stock[r] + p.rates[r] * ticks);
    p.elapsed += ticks;
  };
  const build = (p: Projection, id: BuildingId): boolean => {
    const row = rowFor(p, id);
    if (!row) return false;
    // Current next-level options remain authoritative; future steps only use live tables.
    const live =
      p.levels[id] === v.buildings[id]
        ? v.options.build.find((o) => o.building === id)
        : undefined;
    if (
      live?.blockers.some(
        (b) =>
          ![
            "INSUFFICIENT_RESOURCES",
            "INSUFFICIENT_POPULATION",
            "EXCEEDS_STORAGE",
            "REQUIREMENTS_NOT_MET",
          ].includes(b),
      )
    )
      return false;
    if (
      Object.entries(metadata[id]?.requires ?? {}).some(
        ([b, level]) => p.levels[b as BuildingId] < level!,
      )
    )
      return false;
    const cost = live?.cost ?? row.cost;
    const oldPop = rules.tables.buildings[id][p.levels[id] - 1]?.pop ?? 0;
    const pop = live?.pop ?? row.pop - oldPop;
    if (p.used + pop > p.capacity) return false;
    let wait = 0;
    for (const r of resources) {
      if (cost[r] > p.storage) return false;
      if (cost[r] > p.stock[r]) {
        if (p.rates[r] <= 0) return false;
        wait = Math.max(wait, Math.ceil((cost[r] - p.stock[r]) / p.rates[r]));
      }
    }
    // The first Hall uses its actual option duration; future work uses the projected Hall level.
    const duration =
      id === "hall"
        ? option.ticks
        : p.levels.hall === v.buildings.hall
          ? (live?.ticks ?? row.ticksByHall[p.levels.hall])
          : row.ticksByHall[p.levels.hall];
    if (!Number.isFinite(duration) || p.elapsed + wait + duration > horizon)
      return false;
    const cooldownWait = Math.max(0, p.nextActAt - p.elapsed);
    p.waiting += Math.max(0, wait - cooldownWait);
    wait = Math.max(wait, cooldownWait);
    if (p.elapsed + wait + duration > horizon) return false;
    advance(p, wait);
    p.nextActAt = p.elapsed + (world.actIntervalTicks ?? 0);
    for (const r of resources) p.stock[r] -= cost[r];
    advance(p, duration);
    p.used += pop;
    p.levels[id]++;
    if (id in producers) {
      const r = producers[id as keyof typeof producers];
      const oldRate = rules.tables.production[p.levels[id] - 1]?.perTickMilli;
      const newRate = rules.tables.production[p.levels[id]]?.perTickMilli;
      if (!oldRate || newRate === undefined) return false;
      p.rates[r] *= newRate / oldRate;
    } else if (id === "storehouse")
      p.storage = rules.tables.storage[p.levels[id]];
    else if (id === "cellar") p.hidden = rules.tables.cellar[p.levels[id]];
    else if (id === "farm") p.capacity = rules.tables.farm[p.levels[id]];
    return true;
  };
  const choose = (p: Projection): BuildingId | undefined => {
    const available = (id: BuildingId) => !!rowFor(p, id);
    const farmNeeded = p.capacity - p.used < Math.max(50, p.capacity * 0.2);
    const peak = Math.max(
      ...resources.map((r) => p.stock[r] + p.rates[r] * 300),
    );
    const storageScore =
      peak > p.storage
        ? 90 + Math.min(9, Math.ceil((peak / Math.max(1, p.storage) - 1) * 10))
        : 0;
    const farmScore = farmNeeded ? (p.capacity - p.used <= 0 ? 100 : 95) : 0;
    if (
      farmScore &&
      available("farm") &&
      (!storageScore || !available("storehouse") || farmScore >= storageScore)
    )
      return "farm";
    if (storageScore && available("storehouse")) return "storehouse";
    const candidates = producerIds.filter((id) => {
      if (p.levels[id] >= (policy.producerCeiling ?? PRODUCER_CEILING) || !available(id)) return false;
      if (!policy.producerPayback) return true;
      const row = rowFor(p, id)!;
      const live =
        p.levels[id] === v.buildings[id]
          ? v.options.build.find((o) => o.building === id)
          : undefined;
      return productionPayback({
        cost: live?.cost ?? row.cost,
        stockMilli: Object.fromEntries(
          resources.map((r) => [r, p.stock[r] * 1000]),
        ) as Resources,
        ratesMilli: Object.fromEntries(
          resources.map((r) => [r, p.rates[r] * 1000]),
        ) as Resources,
        resource: producers[id],
        currentLevel: p.levels[id],
        targetLevel: row.level,
        production: rules.tables.production,
        tick: world.tick + p.elapsed,
        endTick: world.endsAtTick,
        buildTicks:
          p.levels.hall === v.buildings.hall
            ? (live?.ticks ?? row.ticksByHall[p.levels.hall])
            : row.ticksByHall[p.levels.hall],
        nextActTick: world.tick + p.nextActAt,
      }).repays;
    });
    const opening = candidates.filter(id => p.levels[id] < 5);
    if (!opening.length && p.hidden < Math.max(...resources.map(r => p.rates[r] * 60)) && available("cellar")) return "cellar";
    const coverage = (id: keyof typeof producers) => {
      const r = producers[id];
      const demand = candidates.reduce(
        (sum, b) => sum + rowFor(p, b)!.cost[r],
        0,
      );
      return (p.stock[r] + p.rates[r] * 180) / Math.max(1, demand);
    };
    return (opening.length ? opening : candidates).sort((a, b) => {
      const difference = coverage(a) - coverage(b);
      return Math.abs(difference) > 1e-9 ? difference : a.localeCompare(b);
    })[0];
  };
  const baseline = initial();
  for (let step = 0; step < policy.maxUpgrades; step++) {
    const id = choose(baseline);
    if (!id) break;
    const target = baseline.levels[id] + 1;
    if (!build(baseline, id)) break;
    result.sequence.push({ building: id, level: target });
  }
  result.baselineTicks = baseline.elapsed;
  result.baselineWaitTicks = baseline.waiting;
  if (!result.sequence.length)
    return skip(
      "No feasible useful upgrade sequence within the remaining planning horizon; retain resources rather than build Great Hall speculatively.",
    );
  const hallFirst = initial();
  let feasible = build(hallFirst, "hall");
  for (const { building } of result.sequence)
    if (feasible) feasible = build(hallFirst, building);
  const sequence = result.sequence
    .map((s) => `${s.building} ${s.level}`)
    .join(" → ");
  if (!feasible)
    return {
      ...result,
      reason: `Great Hall first cannot complete the same planned sequence within ${horizon} ticks or available capacity/prerequisites: ${sequence}. Continue useful upgrades and reassess.`,
    };
  result.hallFirstTicks = hallFirst.elapsed;
  result.hallFirstWaitTicks = hallFirst.waiting;
  result.savingTicks = baseline.elapsed - hallFirst.elapsed;
  const requiredSaving = Math.max(
    policy.minimumSaving,
    Math.ceil(option.ticks * policy.margin),
    Math.ceil(baseline.elapsed * 0.02),
  );
  result.needed = result.savingTicks >= requiredSaving;
  // Protection and urgent capacity still outrank the Hall; production ranks 40–60.
  result.importance = result.needed
    ? 70 +
      Math.min(
        9,
        Math.floor((result.savingTicks / Math.max(1, baseline.elapsed)) * 100),
      )
    : 30;
  result.reason = `Plan (${result.sequence.length} upgrades, ≤${horizon} ticks): ${sequence}. Without Hall: ${baseline.elapsed} ticks (${baseline.waiting} waiting for resources). Hall first: ${hallFirst.elapsed} ticks (${hallFirst.waiting} resource wait), including its ${option.ticks}-tick build and all resource costs. Net ${result.savingTicks >= 0 ? "saving" : "delay"}: ${Math.abs(result.savingTicks)} ticks; require at least ${requiredSaving} saved. ${result.needed ? "Construction is the bottleneck; upgrade Great Hall before production." : "The Hall does not repay its cost and delay in this horizon; continue useful upgrades."}${unlockReason}`;
  return result;
}
