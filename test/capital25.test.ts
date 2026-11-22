import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateEconomy } from "../src/advisors/economic.js";
import type { AdvisorContext } from "../src/advisors/types.js";
import { context } from "./control-fixtures.js";

function fixture(level: number) {
  const c: AdvisorContext = context();
  const v = c.state.villages[0]!;
  v.population = {max: 100000, used: 100};
  v.storage = 1000000;
  v.resourcesMilli = {timber: 100000000, stone: 100000000, iron: 100000000};
  v.productionPerTickMilli = {timber: 10000, stone: 10000, iron: 10000};
  c.cityRoles = new Map([[v.id, {role: "capital", reason: "fixture"}]]);
  for (const building of ["lumberyard", "quarry", "mine"] as const) {
    v.buildings[building] = level;
    Object.assign(v.options.build.find(option => option.building === building)!, {
      level: level + 1, cost: {timber: 1, stone: 1, iron: 1}, ticks: 1,
    });
  }
  const producers = () => evaluateEconomy(c).filter(proposal =>
    ["lumberyard", "quarry", "mine"].includes(proposal.action.building));
  return {c, v, producers};
}

test("capital producers continue from 20 through 25, then stop", () => {
  for (const level of [20, 24, 25]) {
    const {producers} = fixture(level);
    const proposals = producers();
    assert.equal(proposals.length, 3);
    assert.ok(proposals.every(proposal => proposal.status === (level < 25 ? "ready" : "not-needed")));
  }
});

test("economic-city ceilings remain 10 before Wall 10 and 25 afterward", () => {
  const {c, v, producers} = fixture(20);
  c.cityRoles = new Map([[v.id, {role: "economic", reason: "fixture"}]]);
  assert.ok(producers().every(proposal => proposal.status === "not-needed"));
  v.buildings.wall = 10;
  assert.ok(producers().every(proposal => proposal.status === "ready"));
  for (const building of ["lumberyard", "quarry", "mine"] as const) v.buildings[building] = 25;
  assert.ok(producers().every(proposal => proposal.status === "not-needed"));
});

test("capital producer growth still respects round-end payback and absent options", () => {
  const {c, v, producers} = fixture(20);
  c.state.world.endsAtTick = c.state.world.tick + 1;
  assert.ok(producers().every(proposal => proposal.blockers.includes("NO_PAYBACK_BEFORE_ROUND_END")));
  v.options.build = [];
  assert.deepEqual(producers(), []);
  c.state.villages = [];
  assert.deepEqual(evaluateEconomy(c), []);
});
