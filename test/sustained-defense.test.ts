import assert from "node:assert/strict";
import {test} from "node:test";
import type {AdvisorContext} from "../src/advisors/types.js";
import {evaluateSustainedDefense} from "../src/advisors/sustained-defense.js";
import {militaryAdvisor} from "../src/advisors/military.js";
import {developedContext} from "./control-fixtures.js";

function ready(): AdvisorContext {
  const context: AdvisorContext = developedContext();
  const capital = context.state.villages[0]!;
  Object.assign(capital.buildings, {
    lumberyard: 20, quarry: 20, mine: 20, barracks: 10, smithy: 2,
  });
  capital.population = {max: 1000, used: 300};
  capital.storage = 100000;
  capital.resourcesMilli = {timber: 100000000, stone: 100000000, iron: 100000000};
  capital.productionPerTickMilli = {timber: 100000, stone: 100000, iron: 100000};
  capital.units.home = {pikeman: 250, raider: 140, scout: 0};
  capital.units.away = {};
  capital.training.barracks = [];
  capital.training.stable = [];
  capital.options.train = [
    {unit: "pikeman", cost: {timber: 45, stone: 35, iron: 15}, pop: 1, ticksEach: 8, maxCount: 100, ok: true, blockers: [], affordableAtTick: null},
    {unit: "raider", cost: {timber: 75, stone: 55, iron: 40}, pop: 1, ticksEach: 8, maxCount: 100, ok: true, blockers: [], affordableAtTick: null},
    {unit: "scout", cost: {timber: 30, stone: 20, iron: 15}, pop: 1, ticksEach: 4, maxCount: 100, ok: true, blockers: [], affordableAtTick: null},
  ];
  context.cityRoles = new Map([[capital.id, {role: "capital", reason: "fixture"}]]);
  return context;
}

function addEconomicCity(context: AdvisorContext) {
  const capital = context.state.villages[0]!;
  const city = structuredClone(capital);
  city.id = "eco";
  city.name = "Economic city";
  city.buildings.wall = 10;
  city.units.home = {};
  city.supportHere = [];
  context.state.villages.push(city);
  context.state.world.villages = context.state.villages.length;
  context.cityRoles = new Map([
    [capital.id, {role: "capital", reason: "fixture"}],
    [city.id, {role: "economic", reason: "fixture"}],
  ]);
  return {capital, city};
}

test("economic Pikemen target is topped up only below 80%, counting home, stationed and incoming", () => {
  const context = ready();
  const {capital, city} = addEconomicCity(context);
  capital.units.home.pikeman = 700;
  city.units.home.pikeman = 0;
  city.supportHere = [{
    home: {id: capital.id, name: capital.name},
    units: {pikeman: 180},
  }] as typeof city.supportHere;
  context.state.commands.incoming = [{
    id: "incoming",
    kind: "support",
    from: {id: capital.id, name: capital.name},
    to: {id: city.id, name: city.name},
    units: {pikeman: 20},
  }] as typeof context.state.commands.incoming;

  let proposals = evaluateSustainedDefense(context);
  assert.ok(!proposals.some(proposal => proposal.task === "econ.request-defenders"));

  city.supportHere[0] = {
    ...city.supportHere[0]!,
    units: {pikeman: 199},
  };
  context.state.commands.incoming = [];
  proposals = evaluateSustainedDefense(context);
  const request = proposals.find(proposal => proposal.task === "econ.request-defenders");
  assert.equal(request?.action.type, "send");
  if (request?.action.type === "send") {
    assert.deepEqual(request.action.units, {pikeman: 51});
    assert.equal(request.action.target, city.id);
  }
});

test("capital Pikemen target is 200 before producer 20, then scales to three times the strongest city", () => {
  const context = ready();
  const {capital, city} = addEconomicCity(context);
  city.units.home.pikeman = 250;
  Object.assign(capital.buildings, {lumberyard: 19, quarry: 19, mine: 19});
  capital.units.home.pikeman = 150;
  let pikes = evaluateSustainedDefense(context).find(proposal =>
    proposal.action.type === "train" && proposal.action.unit === "pikeman",
  );
  assert.equal(pikes?.targetLevel, 200);

  Object.assign(capital.buildings, {lumberyard: 20, quarry: 20, mine: 20});
  city.units.home.pikeman = 100;
  capital.units.home.pikeman = 250;
  pikes = evaluateSustainedDefense(context).find(proposal =>
    proposal.action.type === "train" && proposal.action.unit === "pikeman",
  );
  assert.equal(pikes?.targetLevel, 450);
});

test("bounded Pikemen targets train when unsustainable but growth batches do not", () => {
  const context = ready();
  const capital = context.state.villages[0]!;
  capital.units.home.pikeman = 150;
  capital.productionPerTickMilli = {timber: 1, stone: 1, iron: 1};

  let pikes = evaluateSustainedDefense(context).find(proposal =>
    proposal.action.type === "train" && proposal.action.unit === "pikeman",
  );
  assert.equal(pikes?.importance, 75);
  assert.ok(!pikes?.blockers.includes("INCOME_CANNOT_SUSTAIN_TRAINING_AND_CONSTRUCTION"));

  capital.units.home.pikeman = 200;
  pikes = evaluateSustainedDefense(context).find(proposal =>
    proposal.action.type === "train" && proposal.action.unit === "pikeman",
  );
  assert.equal(pikes, undefined);
});

test("capital sends a defender request only when home Pikemen cover its target plus the request", () => {
  const context = ready();
  const {capital, city} = addEconomicCity(context);
  Object.assign(capital.buildings, {lumberyard: 19, quarry: 19, mine: 19});
  city.units.home.pikeman = 199;
  capital.units.home.pikeman = 300;

  let proposal = evaluateSustainedDefense(context).find(value => value.task === "econ.request-defenders");
  assert.ok(!proposal, "300 home Pikemen is below 250 + 51");

  capital.units.home.pikeman = 301;
  proposal = evaluateSustainedDefense(context).find(value => value.task === "econ.request-defenders");
  assert.equal(proposal?.action.type, "send");
  if (proposal?.action.type === "send") assert.deepEqual(proposal.action.units, {pikeman: 51});
});

test("capital trains enough below producer 20 to retain 250 and fund every city request", () => {
  const context = ready();
  const {capital, city} = addEconomicCity(context);
  Object.assign(capital.buildings, {lumberyard: 19, quarry: 19, mine: 19});
  capital.units.home.pikeman = 450;
  let proposals = evaluateSustainedDefense(context);
  assert.equal(proposals.find(value => value.action.type === "train" && value.action.unit === "pikeman")?.targetLevel, 500);
  assert.ok(!proposals.some(value => value.task === "econ.request-defenders"));

  const second = structuredClone(city);
  second.id = "eco2";
  second.units.home.pikeman = 100;
  context.state.villages.push(second);
  context.cityRoles = new Map([...context.cityRoles!, [second.id, {role: "economic", reason: "fixture"}]]);
  proposals = evaluateSustainedDefense(context);
  assert.equal(proposals.find(value => value.action.type === "train" && value.action.unit === "pikeman")?.targetLevel, 650);

  capital.units.home.pikeman = 650;
  proposals = evaluateSustainedDefense(context);
  assert.equal(proposals.filter(value => value.task === "econ.request-defenders").length, 2);
  assert.ok(!proposals.some(value => value.action.type === "train" && value.action.unit === "pikeman"));

  city.units.home.pikeman = second.units.home.pikeman = 200;
  capital.units.home.pikeman = 200;
  assert.ok(!evaluateSustainedDefense(context).some(value => value.action.type === "train" && value.action.unit === "pikeman"));
});

test("capital trains Scouts at 20 per owned city and economic cities never train troops", () => {
  const context = ready();
  const {capital, city} = addEconomicCity(context);
  capital.units.home.scout = 10;
  const proposals = militaryAdvisor.evaluate(context);
  const scoutTrain = proposals.find(proposal =>
    proposal.action.type === "train" && proposal.action.unit === "scout",
  );
  assert.equal(scoutTrain?.villageId, capital.id);
  assert.equal(scoutTrain?.targetLevel, 60);
  assert.equal(scoutTrain?.importance, 60);
  assert.ok(proposals.every(proposal =>
    proposal.villageId !== city.id || proposal.action.type !== "train",
  ));
});

test("economic-city Scout requests are sent before the capital's own reserve is full", () => {
  const context = ready();
  const {capital, city} = addEconomicCity(context);
  capital.units.home.scout = 25;
  const send = evaluateSustainedDefense(context).find(value => value.task === "econ.request-scouts");
  assert.equal(send?.action.type, "send");
  if (send?.action.type === "send") {
    assert.equal(send.action.target, city.id);
    assert.deepEqual(send.action.units, {scout: 20});
  }
});

test("Pikemen requests are sent before the capital's 3x scaling reserve is full", () => {
  const context = ready();
  const {capital, city} = addEconomicCity(context);
  capital.buildings.lumberyard = capital.buildings.quarry = capital.buildings.mine = 20;
  city.buildings.wall = 10;
  capital.units.home.pikeman = 1800;
  const send = evaluateSustainedDefense(context).find(value => value.task === "econ.request-defenders");
  assert.equal(send?.action.type, "send");
  if (send?.action.type === "send") assert.deepEqual(send.action.units, {pikeman: 600 - (city.units.home.pikeman ?? 0)});
});

test("Scouts wait for a second village even when training is available", () => {
  const context = ready();
  assert.ok(!evaluateSustainedDefense(context).some(value => value.action.type === "train" && value.action.unit === "scout"));
  addEconomicCity(context);
  assert.ok(evaluateSustainedDefense(context).some(value => value.action.type === "train" && value.action.unit === "scout"));
});
