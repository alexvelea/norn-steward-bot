import assert from 'node:assert/strict';
import {test} from 'node:test';
import {conquestCaptureTick,conquestTargetLoyalty,recurringConquestFits,type ConquestContext} from '../src/advisors/conquest.js';
import {evaluateEconomy} from '../src/advisors/economic.js';
import {context} from './control-fixtures.js';
import type {Report,TrainOption} from '../src/shared/api.js';

test('late waves retain reported damage and regenerate on global tick boundaries',()=>{
 const c=context(),v=c.state.villages[0]!;c.state.world.tick=20140;
 const mission:ConquestContext={plan:{scope:'',villageId:v.id,targetId:'target',startedTick:18398,status:'preparing',waves:2,
  lastBattle:{tick:19885,attacker:{id:v.id},defender:{id:'target'},loyalty:{before:70,after:36}} as Report}};
 assert.equal(conquestTargetLoyalty(c,mission),38);
 assert.equal(conquestCaptureTick(c,mission,20140,255),21925);
 assert.equal(conquestCaptureTick(c,mission,20140,255,conquestTargetLoyalty(c,mission)),20905);
 mission.assessment={tick:20140,raiders:149,targetId:'target',battle:{loyalty:{before:5}} as any};
 assert.equal(conquestTargetLoyalty(c,mission),5);
 mission.assessment.targetId='other';assert.equal(conquestTargetLoyalty(c,mission),38);
 mission.plan.lastBattle!.defender.id='other';assert.equal(conquestTargetLoyalty(c,mission),46);
});

test('missing reports fall back to landed waves, excluding outbound commands',()=>{
 const c=context(),v=c.state.villages[0]!;c.state.world.tick=600;
 const mission:ConquestContext={plan:{scope:'',villageId:v.id,targetId:'target',startedTick:120,status:'preparing',waves:2}};
 assert.equal(conquestTargetLoyalty(c,mission),36);
 c.state.commands.outgoing=[{from:{id:v.id},to:{id:'target'},kind:'attack',returning:false,arrivalTick:650} as any];
 assert.equal(conquestTargetLoyalty(c,mission),70);
 mission.plan.waves=0;assert.equal(conquestTargetLoyalty(c,mission),100);
 assert.equal(conquestCaptureTick(c,mission,600,null),null);
});

test('capital Storehouse proactively fits the next Envoy without overflow; admission waits for paid capacity',()=>{
 const c=context(),v=c.state.villages[0]!;v.buildings.court=1;
 v.storage=14482;v.resourcesMilli={timber:0,stone:0,iron:0};
 c.state.villages.push({...structuredClone(v),id:'economic'});
 const envoy:TrainOption={unit:'envoy',cost:{timber:12000,stone:15000,iron:13000},ticksEach:75,pop:1,maxCount:0,ok:false,blockers:['INSUFFICIENT_RESOURCES'],affordableAtTick:null};
 v.options.train.push(envoy);
 const storage=()=>evaluateEconomy(c).find(p=>p.villageId===v.id&&p.action.building==='storehouse')!;
 assert.equal(storage().importance,96);assert.match(storage().reason,/next Envoy/);
 assert.equal(recurringConquestFits(c,v),false);
 v.storage=17668;assert.doesNotMatch(storage().reason,/next Envoy/);
 v.storage=14482;v.units.home.envoy=1;assert.doesNotMatch(storage().reason,/next Envoy/);
 v.units.home.envoy=0;v.options.train=[];assert.doesNotMatch(storage().reason,/next Envoy/);
 c.state.villages=[];assert.deepEqual(evaluateEconomy(c),[]);
});

test('economic villages do not receive the capital Envoy storage goal and late upgrades retain completion guards',()=>{
 const c=context(),v=c.state.villages[0]!;c.state.villages.push({...structuredClone(v),id:'economic'});
 v.options.train.push({unit:'envoy',cost:{timber:50000,stone:50000,iron:50000},ticksEach:75,pop:1,maxCount:0,ok:false,blockers:['INSUFFICIENT_RESOURCES'],affordableAtTick:null});
 c.state.world.endsAtTick=c.state.world.tick+1;
 const proposals=evaluateEconomy(c).filter(p=>p.action.building==='storehouse');
 assert.ok(proposals.find(p=>p.villageId===v.id)!.blockers.includes('ROUND_END_TOO_SOON'));
 assert.doesNotMatch(proposals.find(p=>p.villageId==='economic')!.reason,/next Envoy/);
});
