import assert from "node:assert/strict";
import { test } from "node:test";
import { estimateHall, LEGACY_HALL_LOOKAHEAD } from "../src/advisors/hall.js";
import { evaluateEconomy } from "../src/advisors/economic.js";
import { context } from "./control-fixtures.js";

function scenario() {
  const c = structuredClone(context()),
    v = c.state.villages[0];
  v.storage = v.hidden = v.population.max = 1_000_000;
  v.resourcesMilli = { timber: 1_000_000, stone: 1_000_000, iron: 1_000_000 };
  v.resources = { timber: 1000, stone: 1000, iron: 1000 };
  v.productionPerTickMilli = { timber: 1000, stone: 1000, iron: 1000 };
  for (const p of c.rules.tables.production) p.perTickMilli = 1000;
  for (const id of ["lumberyard", "quarry", "mine"] as const) {
    for (const row of c.rules.tables.buildings[id]) {
      row.cost = { timber: 100, stone: 100, iron: 100 };
      row.ticksByHall[1] = 100;
      row.ticksByHall[2] = 80;
      row.pop = 1;
    }
    Object.assign(
      v.options.build.find((o) => o.building === id)!,
      { cost: { timber: 100, stone: 100, iron: 100 }, ticks: 100, pop: 0 },
    );
  }
  Object.assign(
    v.options.build.find((o) => o.building === "hall")!,
    { cost: { timber: 100, stone: 100, iron: 100 }, ticks: 50, pop: 0 },
  );
  return {
    c,
    v,
    estimate: () =>
      estimateHall(v, c.rules, c.state.world, LEGACY_HALL_LOOKAHEAD),
  };
}
test("Hall first repays its own construction on a busy affordable useful sequence", () => {
  const { c, estimate } = scenario();
  const h = estimate();
  assert.equal(h.sequence.length, 8);
  assert.equal(h.baselineTicks, 800);
  assert.equal(h.hallFirstTicks, 690);
  assert.equal(h.savingTicks, 110);
  assert.equal(h.needed, true);
  assert.ok(h.importance > 60 && h.importance < 80);
  assert.match(h.reason, /including its 50-tick build and all resource costs/);
  assert.deepEqual(estimate(), h);
  for (const p of c.rules.tables.production)
    p.perTickMilli = 1000 + p.level * 200;
  const proposal = evaluateEconomy(c).find(
    (p) => p.action.building === "hall",
  )!;
  assert.equal(proposal.status, "not-needed");
  assert.match(proposal.reason, /level 8/);
});
test("Hall resource cost and wait reverse a superficially profitable speed upgrade", () => {
  const { v, estimate } = scenario();
  v.options.build.find((o) => o.building === "hall")!.cost = {
    timber: 3000,
    stone: 3000,
    iron: 3000,
  };
  const h = estimate();
  assert.equal(h.needed, false);
  assert.equal(h.hallFirstWaitTicks, 2190);
  assert.equal(h.hallFirstTicks, 2880);
  assert.equal(h.savingTicks, -2080);
});
test("resource-starved plans avoid hypothetical savings from unaffordable distant upgrades", () => {
  const { v, estimate } = scenario();
  v.resourcesMilli = { timber: 0, stone: 0, iron: 0 };
  v.productionPerTickMilli = { timber: 1, stone: 1, iron: 1 };
  const h = estimate();
  assert.equal(h.needed, false);
  assert.equal(h.sequence.length, 0);
  assert.match(h.reason, /No feasible useful upgrade sequence/);
});
test("Hall comparison respects individual resource bottlenecks rather than total income", () => {
  const { v, estimate } = scenario();
  v.productionPerTickMilli.iron = 1;
  v.options.build.find((o) => o.building === "hall")!.cost.iron = 1010;
  assert.equal(estimate().needed, false);
  assert.equal(estimate().hallFirstTicks, null);
});
test("storage and population prevent impossible Hall spending", () => {
  const { v, estimate } = scenario();
  v.options.build.find((o) => o.building === "hall")!.cost.timber = 1_000_001;
  assert.equal(estimate().hallFirstTicks, null);
  v.options.build.find((o) => o.building === "hall")!.cost.timber = 100;
  v.options.build.find((o) => o.building === "hall")!.pop = 1_000_000;
  assert.equal(estimate().hallFirstTicks, null);
});
test("short remaining round time and maxed producers prevent imaginary payback", () => {
  const { c, v, estimate } = scenario();
  c.state.world.endsAtTick = c.state.world.tick + 120;
  assert.equal(estimate().needed, false);
  c.state.world.endsAtTick = c.state.world.tick + 10000;
  for (const id of ["lumberyard", "quarry", "mine"] as const)
    v.buildings[id] = 30;
  assert.equal(estimate().sequence.length, 0);
  assert.equal(estimate().needed, false);
});
test("existing queues and standing orders defer Hall planning", () => {
  const { v, estimate } = scenario();
  v.orders.build = [{ building: "farm", toLevel: 3 }];
  assert.equal(estimate().needed, false);
  v.orders.build = [];
  v.buildQueue = [
    {
      id: "manual",
      building: "quarry",
      level: 2,
      cost: { timber: 1, stone: 1, iron: 1 },
      startTick: 100,
      endTick: 200,
    },
  ];
  assert.equal(estimate().sequence.length, 0);
});

test("capital Hall projections can use producer 21 through 25 without changing the default ceiling", () => {
  const {c, v} = scenario();
  for (const id of ["lumberyard", "quarry", "mine"] as const) v.buildings[id] = 20;
  assert.equal(estimateHall(v, c.rules, c.state.world, LEGACY_HALL_LOOKAHEAD).sequence.length, 0);
  const policy = {...LEGACY_HALL_LOOKAHEAD, producerCeiling: 25};
  const projection = estimateHall(v, c.rules, c.state.world, policy);
  assert.ok(projection.sequence.length > 0);
  assert.ok(projection.sequence.every(step => step.level > 20 && step.level <= 25));
  for (const id of ["lumberyard", "quarry", "mine"] as const) v.buildings[id] = 25;
  assert.equal(estimateHall(v, c.rules, c.state.world, policy).sequence.length, 0);
});
test("planned sequence includes needed capacity and does not presume fixed producer counts", () => {
  const { v, estimate } = scenario();
  v.population = { used: 151, max: 200 };
  const h = estimate();
  assert.equal(h.sequence[0].building, "farm");
  assert.ok(h.sequence.some((s) => s.building === "lumberyard"));
});
test("a small apparent gain must exceed the uncertainty margin", () => {
  const { v, estimate } = scenario();
  v.options.build.find((o) => o.building === "hall")!.ticks = 155;
  const h = estimate();
  assert.equal(h.savingTicks, 5);
  assert.equal(h.needed, false);
});

test("Council action cadence removes speed benefits when construction already fits between actions", () => {
  const { c, estimate } = scenario();
  c.state.world.actIntervalTicks = 200;
  const h = estimate();
  assert.equal(h.needed, false);
  assert.ok(h.hallFirstTicks! > h.baselineTicks);
});

test("longer useful pipeline can justify a Hall rejected by the old eight-build cutoff", () => {
  const { c, v } = scenario();
  v.options.build.find((o) => o.building === "hall")!.ticks = 155;
  const old = estimateHall(v, c.rules, c.state.world, LEGACY_HALL_LOOKAHEAD);
  for (const p of c.rules.tables.production)
    p.perTickMilli = 1000 + p.level * 200;
  const revised = estimateHall(v, c.rules, c.state.world);
  assert.equal(old.needed, false);
  assert.equal(revised.needed, true);
  assert.ok(revised.savingTicks > old.savingTicks);
  c.state.world.endsAtTick = c.state.world.tick + 200;
  assert.equal(estimateHall(v, c.rules, c.state.world).needed, false);
});
test("imminent attack does not defer Hall investment", () => {
  const { c, v } = scenario();
  const withoutAttack = evaluateEconomy(c).find((p) => p.action.building === "hall")!;
  c.state.commands.incoming = [
    {
      kind: "attack",
      arrivalTick: c.state.world.tick + 50,
      to: { id: v.id },
    } as any,
  ];
  const p = evaluateEconomy(c).find((p) => p.action.building === "hall")!;
  assert.equal(p.status, withoutAttack.status);
  assert.equal(p.reason, withoutAttack.reason);
  assert.deepEqual(p.blockers, withoutAttack.blockers);
  assert.doesNotMatch(p.reason, /attack arrives/);
});

test("projected farm completion resolves stale population blockers in the Hall pipeline", () => {
  const { c, v } = scenario();
  v.population = { used: 151, max: 200 };
  for (const option of v.options.build.filter((o) =>
    ["lumberyard", "quarry", "mine"].includes(o.building),
  )) {
    option.pop = 60;
    option.blockers = ["INSUFFICIENT_POPULATION"];
    option.ok = false;
  }
  for (const p of c.rules.tables.production)
    p.perTickMilli = 1000 + p.level * 200;
  const result = estimateHall(v, c.rules, c.state.world);
  assert.equal(result.sequence[0].building, "farm");
  assert.ok(
    result.sequence.some((s) =>
      ["lumberyard", "quarry", "mine"].includes(s.building),
    ),
  );
});

test("Hall cannot justify itself with producer upgrades that cannot repay before round end", () => {
  const { c, v } = scenario();
  const estimate = estimateHall(v, c.rules, c.state.world);
  assert.equal(estimate.needed, false);
  assert.equal(estimate.sequence.length, 0);
});
