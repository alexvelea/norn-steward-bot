import { defenseBudget, producerLevel, militaryEconomy, defenseReady } from "./defense-budget.js";
import { productionPayback } from "./payback.js";
import { completionWindow } from "./completion.js";
import { estimateHall, HALL_LOOKAHEAD } from "./hall.js";
import type { Action, BuildingId, Resources, VillageState } from "../shared/api.js";
import { balanceLags, balanceScore, type ResourceId } from "./balance.js";
import {
  compareProposals,
  type Advisor,
  type AdvisorContext,
  type Proposal,
} from "./types.js";
import { proposalTask } from "../bot/plan/graph.js";
import { cityRoles } from "../bot/strategy/roles.js";

export const ECONOMIC_BUILDINGS = [
  "hall",
  "lumberyard",
  "quarry",
  "mine",
  "storehouse",
  "farm",
] as const;
const producers = {
  lumberyard: "timber",
  quarry: "stone",
  mine: "iron",
} as const;
const resources = ["timber", "stone", "iron"] as const;
const round = (n: number) => Math.round(n * 10) / 10;
export interface EconomicForecast {
  strategyPhase: string;
  militaryBurnPerMinute: Resources;
  militaryTargetPerMinute: Resources;
  netProductionPerMinute: Resources;
  villageId: string;
  villageName: string;
  stock: Resources;
  threeMinutes: Resources;
  fiveMinutes: Resources;
  fiveMinuteProduction: Resources;
  producerDemand: Resources;
  coverage: Resources;
  freePopulation: number;
  requiredFreePopulation: number;
  storage: number;
  hidden: number;
}
export function forecastEconomy(v: VillageState): EconomicForecast {
  const flow = militaryEconomy(v);
  const stock = {} as Resources,
    threeMinutes = {} as Resources,
    fiveMinutes = {} as Resources;
  const fiveMinuteProduction = {} as Resources,
    producerDemand = {} as Resources,
    coverage = {} as Resources;
  const upgrades = v.options.build.filter(
    (o) => o.building in producers && !o.blockers.includes("MAX_LEVEL"),
  );
  for (const r of resources) {
    stock[r] = v.resourcesMilli[r] / 1000;
    threeMinutes[r] = stock[r] + (flow.availableMilli[r] / 1000) * 180;
    fiveMinuteProduction[r] = (v.productionPerTickMilli[r] / 1000) * 300;
    fiveMinutes[r] = stock[r] + fiveMinuteProduction[r];
    producerDemand[r] = upgrades.reduce((sum, o) => sum + o.cost[r], 0);
    coverage[r] = threeMinutes[r] / Math.max(1, producerDemand[r]);
  }
  return {
    strategyPhase: flow.stage,
    militaryBurnPerMinute: Object.fromEntries(resources.map(r=>[r,flow.burn[r]*60])) as Resources,
    militaryTargetPerMinute: Object.fromEntries(resources.map(r=>[r,flow.targetPerTick[r]*60])) as Resources,
    netProductionPerMinute: Object.fromEntries(resources.map(r=>[r,flow.availableMilli[r]*60/1000])) as Resources,
    villageId: v.id,
    villageName: v.name,
    stock,
    threeMinutes,
    fiveMinutes,
    fiveMinuteProduction,
    producerDemand,
    coverage,
    freePopulation: v.population.max - v.population.used,
    requiredFreePopulation: Math.max(50, v.population.max * 0.2),
    storage: v.storage,
    hidden: v.hidden,
  };
}

export const economicAdvisor: Advisor = {
  id: "economic",
  evaluate: evaluateEconomy,
};
export function evaluateEconomy(context: AdvisorContext): Proposal<Extract<Action, {type: "build"}>>[] {
  const { state, rules } = context;
  const metadata = rules.rules.BUILDINGS as Record<
    BuildingId,
    { name: string; maxLevel: number }
  >;
  if (!metadata || rules.version !== state.world.rulesVersion)
    throw new Error("Live rules do not match this world's rules version.");
  const proposals: Proposal<Extract<Action, {type: "build"}>>[] = [];
  const roles = context.cityRoles ?? cityRoles(context, []);
  for (const v of state.villages) {
    const producerCeiling = context.cityRoles?.get(v.id)?.role === "economic"
      ? v.buildings.wall >= 10 ? 25 : 10
      : 25;
    const f = forecastEconomy(v);
    const flow = militaryEconomy(v), phaseLevel = producerLevel(v);
    const defense = defenseReady(v) ? defenseBudget(v) : null;
    const farmOption = v.options.build.find(o => o.building === "farm");
    const farmWindow = farmOption ? completionWindow(state, v, farmOption) : null;
    const bundles = defense ? Math.ceil(61 / defense.ticks) : 0;
    // A Farm bought for recruitment must leave time for the entire minute-long
    // Pikeman batch, including funding/cooldown waits and already-paid Barracks work.
    const recruitmentStart = farmWindow ? Math.max(
      farmWindow.completionTick + (state.world.actIntervalTicks ?? 0),
      ...v.training.barracks.map(q => q.endTick),
    ) : Infinity;
    const farmForRecruitment = !!defense && recruitmentStart + defense.ticks * bundles + 60 <= state.world.endsAtTick && f.freePopulation < Math.ceil(f.requiredFreePopulation) + defense.pop * bundles;
    const needsFarm = f.freePopulation < f.requiredFreePopulation || farmForRecruitment;
    const storageTicks = Math.max(0, Math.min(300, state.world.endsAtTick - state.world.tick));
    const storageForecast = (r: keyof Resources) => v.resourcesMilli[r] + flow.availableMilli[r] * storageTicks;
    const needsStorage = resources.some((r) => storageForecast(r) > v.storage * 1000);
    const envoyOption = v.options.train.find(option => option.unit === "envoy");
    const envoyStorage = roles.get(v.id)?.role === "capital" && state.villages.length >= 2 &&
      !v.units.home.envoy && !v.units.away.envoy && !v.training.court.some(batch => batch.unit === "envoy") &&
      !!envoyOption && resources.some(resource => envoyOption.cost[resource] > v.storage);
    const producerCoverages = Object.values(producers).map(
      (r) => f.coverage[r],
    );
    const hall = estimateHall(v, rules, state.world, context.cityRoles?.get(v.id)?.role === "economic"
      ? undefined : {...HALL_LOOKAHEAD, producerCeiling});
    for (const building of ECONOMIC_BUILDINGS) {
      const option = v.options.build.find((o) => o.building === building),
        queued = v.buildQueue.find((q) => q.building === building);
      if (
        !option ||
        (!queued && v.buildings[building] >= metadata[building].maxLevel)
      )
        continue;
      let importance = 0,
        reason = "",
        needed = true;
      let balance: { resource: ResourceId; lag: number; score: number } | null =
        null;
      if (building in producers) {
        const r = producers[building as keyof typeof producers];
        const lag = balanceLags(v)[r];
        const score = lag === undefined ? null : balanceScore(lag);
        if (lag !== undefined && score !== null) balance = { resource: r, lag, score };
        const rank = producerCoverages.filter(
          (n) => n < f.coverage[r] - 1e-9,
        ).length;
        const milestone = phaseLevel < 5 ? 5 : phaseLevel < 8 ? 8 : 10;
        importance = v.buildings[building] < milestone ? (phaseLevel < 5 ? 85 : 75) - rank : 60 - rank * 10;
        if (defense && v.productionPerTickMilli[r] / 1000 * 0.8 < defense.perTick[r]) importance = 82 - rank;
        reason = (v.buildings[building] < 5 ? "Production-first opening: bring each producer to level 5 before protection, Hall investment or starter military; necessary Farm/Storehouse capacity still takes priority. " : "") + `After reserving full-time military burn, in 3 minutes: ${round(f.threeMinutes[r])} ${r} (stock ${round(f.stock[r])} + production). The next lumberyard/quarry/mine upgrades together require ${f.producerDemand[r]} ${r}; projected coverage is ${round(f.coverage[r])}× that basket. Lower coverage takes priority (production rank ${rank + 1}).`;
        if (defense && importance >= 80 && v.buildings[building] >= 5) reason += ` Recruitment resource shortage: Pikemen need ${round(defense.perTick[r]*60)} ${r}/minute; current production is ${round(v.productionPerTickMilli[r]*60/1000)}. Income must cover full-time training while leaving at least 20% for construction; strengthen this income first.`;
        if (v.buildings[building] >= producerCeiling) { needed = false; reason += ` Producer policy ceiling ${producerCeiling} reached; spend on useful capacity and logistics instead of further compounding.`; }
      } else if (building === "farm") {
        needed = needsFarm;
        importance = needed ? (f.freePopulation <= 0 ? 100 : 95) : 20;
        reason = `${f.freePopulation} population slots free; target max(50, 20% of ${v.population.max}) = ${round(f.requiredFreePopulation)}. ${needed ? "Below the required buffer; expand capacity." : "Buffer is sufficient; do not upgrade."} Queued buildings and recruitment are already included in population used.${farmForRecruitment ? " Also leave room for the next minute-long Pikeman batch so recruitment cannot stall exactly at the buffer." : ""}`;
      } else if (building === "storehouse") {
        needed = needsStorage || envoyStorage;
        const peak = Math.max(...resources.map((r) => storageForecast(r) / 1000));
        importance = needed
          ? 90 +
            Math.min(9, Math.ceil((peak / Math.max(1, v.storage) - 1) * 10))
          : 25;
        if (envoyStorage) importance = 96;
        reason = `Stock + ${storageTicks} ticks of income after reserved troop burn (at most 300, bounded by round end): timber ${round(storageForecast("timber") / 1000)}, stone ${round(storageForecast("stone") / 1000)}, iron ${round(storageForecast("iron") / 1000)}. Storage holds ${v.storage} of each. ${needsStorage ? "At least one resource would overflow; upgrade storage." : envoyStorage ? "No overflow is required for Envoy capacity." : "All resources fit; do not upgrade."}`;
        if (envoyStorage) reason = `The capital's next Envoy costs ${envoyOption!.cost.timber}/${envoyOption!.cost.stone}/${envoyOption!.cost.iron}; upgrade Storehouse beyond ${v.storage} per resource before recurring admission. ` + reason;
      } else {
        needed = hall.needed;
        importance = defense ? Math.min(69, hall.importance) : hall.importance;
        reason = hall.reason;
        if (phaseLevel < 8 || v.buildings.hall >= 5) { needed = false; importance = 30; reason = phaseLevel < 8 ? "Grow all three producers to level 8 before discretionary Great Hall investment." : "Great Hall 5 milestone reached; retain construction income for production and military capability."; }
        else { needed = true; importance = 86; reason = "All three producers reached level 8. Bring Great Hall to level 5 for construction speed before the level-10 production milestone."; }
      }
      const payback =
        building in producers && !queued && !v.buildQueue.length
          ? productionPayback({
              cost: option.cost,
              stockMilli: v.resourcesMilli,
              ratesMilli: v.productionPerTickMilli,
              availableRatesMilli: flow.availableMilli,
              resource: producers[building as keyof typeof producers],
              currentLevel: v.buildings[building],
              targetLevel: option.level,
              production: rules.tables.production,
              tick: state.world.tick,
              endTick: state.world.endsAtTick,
              buildTicks: option.ticks,
              nextActTick: state.player.nextActTick,
              affordableAtTick: option.affordableAtTick,
            })
          : null;
      if (payback) {
        reason += " " + payback.reason;
        if (!payback.repays) needed = false;
      }
      const window = queued ? null : completionWindow(state, v, option);
      const tooLate = !!window && !window.fits;
      if (tooLate && needed) {
        needed = false;
        reason += ` Earliest snapshot completion is tick ${window!.completionTick}; the round ends at ${window!.endsAtTick}. Save these resources rather than buy construction that cannot finish by round end.`;
      }
      if (needed && balance) {
        importance = Math.max(importance, balance.score);
        reason += ` Resource balance: ${balance.resource} stock is ${round(balance.lag)} minutes behind the other two.`;
      }
      const blockers: string[] = queued
        ? ["ALREADY_QUEUED"]
        : [...option.blockers];
      if (payback && !payback.repays)
        blockers.push("NO_PAYBACK_BEFORE_ROUND_END");
      if (tooLate && !queued) blockers.push("ROUND_END_TOO_SOON");
      if (!needed && !queued) blockers.push("NOT_NEEDED");
      if (
        !queued &&
        Object.entries(option.cost).some(
          ([r, n]) => n > v.resources[r as keyof Resources],
        ) &&
        !blockers.includes("INSUFFICIENT_RESOURCES")
      )
        blockers.push("INSUFFICIENT_RESOURCES");
      if (!queued && v.buildQueue.length) blockers.push("BUILD_QUEUE_BUSY");
      if (v.orders.build.length) blockers.push("EXTERNAL_BUILD_ORDERS");
      if (state.world.status === "ended") blockers.push("WORLD_ENDED");
      if (
        state.player.nextActTick !== null &&
        state.player.nextActTick > state.world.tick
      )
        blockers.push("COUNCIL_COOLDOWN");
      const target = queued?.level ?? option.level;
      proposals.push({
        id: `${state.world.epoch}:${v.id}:${building}:${target}`,
        task: proposalTask("economic", { type: "build", building }, target),
        advisor: "economic",
        villageId: v.id,
        villageName: v.name,
        action: { type: "build", village: v.id, building },
        buildingName: metadata[building].name,
        currentLevel: v.buildings[building],
        targetLevel: target,
        importance,
        reason,
        requirements: queued?.cost ?? option.cost,
        blockers,
        status: queued
          ? "queued"
          : !needed
            ? "not-needed"
            : option.ok && blockers.length === 0
              ? "ready"
              : "waiting",
        affordableAtTick: option.affordableAtTick,
      });
    }
  }
  return proposals.sort(compareProposals);
}
