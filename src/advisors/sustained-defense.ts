import type { Action, Resources, VillageState } from "../shared/api.js";
import type { AdvisorContext, CityRoles, Proposal } from "./types.js";
import { EARLY_PIKEMEN_TARGET, PRODUCER_CEILING, defenseBudget, defenseReady, defenseSustainable, earlyGoalMet, militaryUnlocked } from "./defense-budget.js";
import { minuteTrainingProposal } from "./military-training.js";
import { cityRoles } from "../bot/strategy/roles.js";

const zeroCost: Resources = { timber: 0, stone: 0, iron: 0 };

function supportCommands(context: AdvisorContext, capitalId: string, cityId: string) {
  const commands = [...context.state.commands.outgoing, ...context.state.commands.incoming]
    .filter(command => command.kind === "support" && command.from.id === capitalId &&
      command.to.id === cityId && !("returning" in command && command.returning));
  return [...new Map(commands.map(command => [command.id, command])).values()];
}

function incomingSupport(context: AdvisorContext, capitalId: string, cityId: string, unit: "pikeman" | "scout"): number {
  return supportCommands(context, capitalId, cityId)
    .reduce((sum, command) => sum + (command.units?.[unit] ?? 0), 0);
}

function stationed(village: VillageState, unit: "pikeman" | "scout"): number {
  return village.supportHere.reduce((sum, stack) => sum + (stack.units[unit] ?? 0), 0);
}

function supportInFlight(context: AdvisorContext, capitalId: string, cityId: string): boolean {
  return supportCommands(context, capitalId, cityId).length > 0 ||
    (context.activeProposals ?? []).some(proposal => proposal.action.type === "send" &&
      proposal.action.kind === "support" && proposal.action.village === capitalId &&
      proposal.action.target === cityId);
}

export function cityDefenderTarget(capital: VillageState): number {
  return Math.max(250, Math.floor((capital.units.home.pikeman ?? 0) / 3));
}

export function pikemenAtCity(context: AdvisorContext, capitalId: string, city: VillageState): number {
  return (city.units.home.pikeman ?? 0) + stationed(city, "pikeman") +
    incomingSupport(context, capitalId, city.id, "pikeman");
}

export function expansionReadiness(context: AdvisorContext, roles: CityRoles): { ready: boolean; blockers: string[] } {
  const { state } = context;
  const capital = state.villages.find(village => roles.get(village.id)?.role === "capital") ?? state.villages[0];
  const blockers: string[] = [];
  if (!capital) return { ready: false, blockers: ["Capital is unavailable."] };
  if (capital.buildings.court < 1) blockers.push(`${capital.name} needs Court 1.`);
  if ((capital.units.home.pikeman ?? 0) < 150) blockers.push(`${capital.name} needs at least 150 home Pikemen.`);
  if (Object.values(capital.orders).some(order => order.length)) blockers.push(`${capital.name} has active orders.`);

  const target = cityDefenderTarget(capital);
  for (const city of state.villages.filter(village => roles.get(village.id)?.role === "economic")) {
    if (city.buildings.hall < 10) blockers.push(`${city.name} needs Great Hall 10.`);
    if (city.buildings.wall < 10) blockers.push(`${city.name} needs Wall 10.`);
    if (pikemenAtCity(context, capital.id, city) < 0.8 * target) {
      blockers.push(`${city.name} needs at least ${Math.ceil(0.8 * target)} Pikemen stationed (80% of target ${target}).`);
    }
  }
  return { ready: blockers.length === 0, blockers };
}

function supportProposal(
  context: AdvisorContext, capital: VillageState, city: VillageState,
  unit: "pikeman" | "scout", count: number, current: number, target: number,
  task: "econ.request-defenders" | "econ.request-scouts", importance: number,
): Proposal<Extract<Action, { type: "send" }>> {
  const blockers: string[] = [];
  if (context.state.world.status !== "running") blockers.push("WORLD_NOT_RUNNING");
  if ((context.state.player.nextActTick ?? context.state.world.tick) > context.state.world.tick) blockers.push("COUNCIL_COOLDOWN");
  return {
    id: `${context.state.world.epoch}:${city.id}:${task}:${count}`, task, advisor: "military",
    villageId: city.id, villageName: city.name,
    action: { type: "send", village: capital.id, target: city.id, kind: "support", units: { [unit]: count } },
    buildingName: `${unit} support for ${city.name}`, currentLevel: current, targetLevel: target, importance,
    reason: `Station ${count} ${unit}s from the capital to bring this city to ${target}.`,
    requirements: zeroCost, blockers, status: blockers.length ? "waiting" : "ready", affordableAtTick: null,
  };
}

export function evaluateSustainedDefense(context: AdvisorContext): Proposal[] {
  const { state, rules } = context;
  if (rules.version !== state.world.rulesVersion) throw new Error("Live rules do not match this world's rules version.");
  const roles = context.cityRoles ?? cityRoles(context, []);
  const capital = state.villages.find(village => roles.get(village.id)?.role === "capital") ?? state.villages[0];
  if (!capital) return [];
  const cities = state.villages.filter(village => roles.get(village.id)?.role === "economic");
  const defenderRequests = cities.flatMap(city => {
    if (city.buildings.wall < 10) return [];
    const target = cityDefenderTarget(capital);
    const atCity = pikemenAtCity(context, capital.id, city);
    return atCity < 0.8 * target ? [{ city, target, atCity, amount: target - atCity }] : [];
  });
  const strongestCity = cities.reduce((maximum, city) => Math.max(maximum, pikemenAtCity(context, capital.id, city)), 0);
  const producers = Math.min(capital.buildings.mine, capital.buildings.quarry, capital.buildings.lumberyard);
  const ownTarget = !militaryUnlocked(capital) ? 0 : producers < PRODUCER_CEILING ? EARLY_PIKEMEN_TARGET : Math.max(EARLY_PIKEMEN_TARGET, 3 * strongestCity);
  const requestTotal = defenderRequests.reduce((sum, request) => sum + request.amount, 0);
  const pikeTarget = Math.max(ownTarget, requestTotal > 0 ? 250 : 0) + requestTotal;
  const proposals: Proposal[] = [];

  const pikeOption = capital.options.train.find(option => option.unit === "pikeman");
  const budget = defenseBudget(capital);
  if (pikeOption && budget && defenseReady(capital)) {
    const queued = capital.training.barracks.filter(batch => batch.unit === "pikeman")
      .reduce((sum, batch) => sum + batch.remaining, 0);
    const deficit = pikeTarget - (capital.units.home.pikeman ?? 0) - queued;
    const growth = deficit <= 0 && producers >= PRODUCER_CEILING;
    const batch = growth ? Math.ceil(61 / budget.ticks) : Math.max(0, deficit);
    if (batch > 0 && (!growth || defenseSustainable(capital))) {
      const pikeTask = producers >= PRODUCER_CEILING ? "military.defence-scale" : earlyGoalMet(capital) ? "military.pikemen-baseline" : "early.pikemen";
      const proposal = minuteTrainingProposal(context, capital, "pikeman", batch, pikeTask,
        growth ? 50 : 75,
        growth ? "Grow the Pikemen garrison after its current target is met." :
          `Train toward ${pikeTarget} home Pikemen: own target ${pikeTarget - requestTotal} plus ${requestTotal} active city requests.`,
        `${state.world.epoch}:${capital.id}:pikemen:${pikeTarget}:${growth ? "growth" : "target"}`,
        (capital.units.home.pikeman ?? 0) + queued,
        growth ? (capital.units.home.pikeman ?? 0) + queued + batch : pikeTarget);
      if (proposal) {
        proposals.push(proposal);
      }
    }
  }
  for (const request of defenderRequests) {
    if (supportInFlight(context, capital.id, request.city.id)) continue;
    const needed = request.amount;
    if (needed <= 0 || (capital.units.home.pikeman ?? 0) < 250 + needed) continue;
    proposals.push(supportProposal(context, capital, request.city, "pikeman", needed,
      request.atCity, request.target, "econ.request-defenders", 80));
  }

  const homeScoutTarget = state.villages.length >= 2 ? 20 * state.villages.length : 0;
  const scoutRequests = cities.flatMap(city => {
    if (city.buildings.wall < 10) return [];
    const atCity = stationed(city, "scout") + incomingSupport(context, capital.id, city.id, "scout");
    return atCity < 20 ? [{ city, atCity, amount: 20 - atCity }] : [];
  });
  const scoutTarget = homeScoutTarget + scoutRequests.reduce((sum, request) => sum + request.amount, 0);
  const queuedScouts = capital.training.stable.filter(batch => batch.unit === "scout")
    .reduce((sum, batch) => sum + batch.remaining, 0);
  const scoutDeficit = scoutTarget - (capital.units.home.scout ?? 0) - queuedScouts;
  if (state.villages.length >= 2 && scoutDeficit > 0) {
    const proposal = minuteTrainingProposal(context, capital, "scout", scoutDeficit, "military.scouts", 60,
      `Train toward ${scoutTarget} home Scouts: ${homeScoutTarget} for owned cities plus ${scoutTarget - homeScoutTarget} active city requests.`,
      `${state.world.epoch}:${capital.id}:scouts:${scoutTarget}`,
      (capital.units.home.scout ?? 0) + queuedScouts, scoutTarget);
    if (proposal) proposals.push(proposal);
  }
  for (const request of scoutRequests) {
    if (supportInFlight(context, capital.id, request.city.id)) continue;
    const needed = request.amount;
    if (needed <= 0 || (capital.units.home.scout ?? 0) < needed) continue;
    proposals.push(supportProposal(context, capital, request.city, "scout", needed,
      request.atCity, 20, "econ.request-scouts", 62));
  }
  return proposals;
}
