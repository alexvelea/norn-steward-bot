import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyConquest, recurringConquestFits, conquestCaptureTick, conquestScope, evaluateRecall, type ConquestContext} from '../src/advisors/conquest.js';
import {selectProposal} from '../src/advisors/president.js';
import {allocateWithPresident} from '../src/bot/allocation/president.js';
import type {AdvisorContext, Proposal} from '../src/advisors/types.js';
import {developedContext} from './control-fixtures.js';
import {Controller} from '../src/control/controller.js';
import {RemoteError, type Remote} from '../src/control/remote.js';
import type {SavedControl, Settings} from '../src/control/types.js';
import type {Action, Report} from '../src/shared/api.js';
import { conquestMission } from '../src/bot/strategy/missions/conquest.js';
import { evaluateMilitaryDevelopment } from '../src/advisors/military-development.js';

function fixture(){
 const context:AdvisorContext=developedContext(),v=context.state.villages[0];
 Object.assign(v.buildings,{lumberyard:15,quarry:15,mine:15,hall:13,barracks:10,smithy:10,market:5,storehouse:5,court:1});
 v.population={max:10000,used:500};v.storage=100000;
 v.resources={timber:50000,stone:50000,iron:50000};v.resourcesMilli={timber:50000000,stone:50000000,iron:50000000};
 v.units.home={pikeman:153,raider:150,envoy:1};
 v.options.train=['raider','envoy'].map(unit=>({unit:unit as 'raider'|'envoy',cost:{timber:55,stone:35,iron:45},ticksEach:4,pop:1,maxCount:1000,ok:true,blockers:[],affordableAtTick:null}));
 const c:ConquestContext={plan:{scope:conquestScope('https://sandbox.invalid','p1',context),villageId:v.id,startedTick:100,status:'preparing',waves:0,targetId:'t',escort:140},
  map:{tick:100,snapshotTick:100,size:100,players:[],villages:[{id:'t',x:2,y:1,name:'Target',ownerId:null,ownerName:null,points:0}]},
  assessment:{tick:100,raiders:150,battle:{winner:'attacker',attackerSurvivors:{raider:124,envoy:1},attackerLost:{}} as any}};
 return {context,v,c};
}
test('conquest retains paid defence, requires fresh neutral ownership and a surviving Envoy',()=>{
 const {context,v,c}=fixture();
 let p=selectProposal(applyConquest(context,[],c)).selected;
 assert.equal(p?.action.type,'send');assert.equal(p?.importance,94);if(p?.action.type==='send')assert.deepEqual(p.action.units,{raider:150,envoy:1});
 c.map!.tick--;assert.equal(applyConquest(context,[],c).length,0);c.map!.tick++;
 c.map!.villages[0].ownerId='enemy';assert.equal(applyConquest(context,[],c).length,0);c.map!.villages[0].ownerId=null;
 c.assessment!.battle.attackerSurvivors.envoy=0;assert.equal(applyConquest(context,[],c).length,0);
 c.assessment!.battle.attackerSurvivors.envoy=1;v.units.home.pikeman=149;
 assert.equal(selectProposal(applyConquest(context,[],c)).selected,null);
});
test('conquest dispatches with 150 home Raiders during Pikeman training',()=>{
 const {context,v,c}=fixture();c.plan.waves=1;
 v.training.barracks=[{
  id:'queued-pikemen',unit:'pikeman',count:2,remaining:2,
  costEach:{timber:45,stone:35,iron:15},nextTick:101,endTick:109,
 }];
 const proposals=applyConquest(context,[],c);
 assert.ok(!proposals.some(p=>p.action.type==='train'));
 assert.equal(selectProposal(proposals).selected?.action.type,'send');
});
test('an impossible capture deadline, external orders and six waves prevent dispatch',()=>{
 const {context,v,c}=fixture();assert.equal(conquestCaptureTick(context,c),250);
 context.state.world.endsAtTick=309;assert.equal(selectProposal(applyConquest(context,[],c)).selected,null);
 context.state.world.endsAtTick=21600;c.plan.waves=6;assert.equal(selectProposal(applyConquest(context,[],c)).selected,null);c.plan.waves=0;
 v.orders.build=[{building:'wall',toLevel:2}];assert.equal(applyConquest(context,[],c).length,0);v.orders.build=[];

});

test('conquest waits for the integer processing tick after fractional recruitment',()=>{
 const {context,c}=fixture();
 assert.equal(conquestCaptureTick(context,c,100.906),conquestCaptureTick(context,c,101));
 assert.equal(conquestCaptureTick(context,c,100),250);
});

test('dispatch can finish a damaged target late while fresh-target admission remains blocked',()=>{
 const {context,v,c}=fixture();context.state.world.endsAtTick=230;c.plan.waves=2;
 c.plan.lastBattle={tick:100,attacker:{id:v.id},defender:{id:'t'},loyalty:{before:39,after:5}} as Report;
 c.assessment!.targetId='t';c.assessment!.targetLoyalty=5;
 c.assessment!.battle.loyalty={before:100,after:66,conquered:false};
 assert.equal(recurringConquestFits(context,v,c.map),false);
 assert.equal(selectProposal(applyConquest(context,[],c)).selected?.action.type,'send');
});
test('standing orders, scheduled actions and a non-running world preserve proposals unchanged',()=>{
 for(const block of [
  (x:ReturnType<typeof fixture>)=>{x.v.orders.build=[{building:'wall',toLevel:2}];},
  (x:ReturnType<typeof fixture>)=>{x.context.state.scheduled=[{} as any];},
  (x:ReturnType<typeof fixture>)=>{x.context.state.world.status='ended';},
 ]){
  const x=fixture(),proposals=[{id:'normal',task:'economy.storehouse',villageId:x.v.id,
   action:{type:'build',village:x.v.id,building:'storehouse'},importance:91} as Proposal];
  block(x);
  assert.strictEqual(applyConquest(x.context,proposals,x.c),proposals);
 }
});
test('conquest keeps only the more important proposal when its Smithy step duplicates military development',()=>{
 const {context,v,c}=fixture();
 Object.assign(v.buildings,{hall:10,barracks:5,wall:5,smithy:0,market:0,court:0});
 v.units.home.pikeman=250;
 for(const option of v.options.build)option.level=v.buildings[option.building]+1;
 const routine=evaluateMilitaryDevelopment(context).find(p=>p.villageId===v.id&&
  p.action.type==='build'&&p.action.building==='smithy')!;
 routine.importance=95;
 let smithies=applyConquest(context,[routine],c).filter(p=>p.villageId===v.id&&
  p.action.type==='build'&&p.action.building==='smithy');
 assert.equal(smithies.length,1);assert.equal(smithies[0],routine);
 routine.importance=80;
 smithies=applyConquest(context,[routine],c).filter(p=>p.villageId===v.id&&
  p.action.type==='build'&&p.action.building==='smithy');
 assert.equal(smithies.length,1);assert.equal(smithies[0].advisor,'conquest');assert.equal(smithies[0].importance,88);
});
test('transition funds producer 15 before the Court path and saves through the President',()=>{
 const {context,v,c}=fixture();v.buildings.mine=14;
 const o=v.options.build.find(o=>o.building==='mine')!;o.level=15;o.cost={timber:500,stone:500,iron:500};o.ok=false;o.blockers=['INSUFFICIENT_RESOURCES'];
 v.resourcesMilli={timber:0,stone:0,iron:0};
 const proposals=applyConquest(context,[],c),selection=selectProposal(proposals);
 assert.equal(selection.selected,null);assert.equal(selection.reservations.length,1);
 assert.equal(proposals[0].action.type,'build');if(proposals[0].action.type==='build')assert.equal(proposals[0].action.building,'mine');
 assert.ok(!proposals.some(p=>p.action.type==='train'));
});
test('after producers 15 and the early Hall 10 opening, conquest starts with Smithy',()=>{
 const {context,v,c}=fixture();
 Object.assign(v.buildings,{hall:10,barracks:5,smithy:0,market:0,court:0});
 for(const option of v.options.build)option.level=v.buildings[option.building]+1;
 const proposal=applyConquest(context,[],c).find(value=>value.advisor==='conquest'&&value.action.type==='build');
 assert.equal(proposal?.action.type,'build');
 if(proposal?.action.type==='build')assert.equal(proposal.action.building,'smithy');
 assert.ok(!applyConquest(context,[],c).some(value=>value.action.type==='build'&&
  (value.action.building==='hall'||value.action.building==='barracks')));
});
test('an active Hall rush skips the conquest producer-15 floor',()=>{
 const {context,v,c}=fixture();
 Object.assign(v.buildings,{lumberyard:12,quarry:12,mine:12,hall:6,barracks:1,wall:5,smithy:0,market:0,court:0});
 for(const option of v.options.build)option.level=v.buildings[option.building]+1;
 const proposals=applyConquest(context,[],c);
 assert.ok(!proposals.some(value=>value.advisor==='conquest'&&value.action.type==='build'&&
  ['lumberyard','quarry','mine'].includes(value.action.building)));
});
test('conquest develops the producer with the least stock first',()=>{
 const {context,v,c}=fixture();
 for(const building of ['lumberyard','quarry','mine'] as const){
  v.buildings[building]=14;
  v.options.build.find(o=>o.building===building)!.level=15;
 }
 v.resources={timber:680,stone:19,iron:5556};
 const proposal=applyConquest(context,[],c).find(p=>p.advisor==='conquest');
 assert.equal(proposal?.action.type,'build');
 if(proposal?.action.type==='build')assert.equal(proposal.action.building,'quarry');
});

test('capital conquest funding fallback permits producer 21 through 25 but not 26',()=>{
 for(const level of [21,25,26]){
  const {context,v,c}=fixture();
  Object.assign(v.buildings,{lumberyard:20,quarry:20,mine:level-1,smithy:9});
  v.resourcesMilli={timber:1000000,stone:1000000,iron:1000000};
  v.productionPerTickMilli={timber:1000,stone:1000,iron:1000};
  v.units.home.envoy=0;
  for(const o of v.options.build)o.ok=false;
  Object.assign(v.options.build.find(o=>o.building==='smithy')!,{
   level:10,cost:{timber:1000,stone:1000,iron:10000},ticks:10,blockers:['INSUFFICIENT_RESOURCES'],
  });
  Object.assign(v.options.build.find(o=>o.building==='mine')!,{
   level,cost:{timber:1,stone:1,iron:1},ticks:1,pop:0,ok:true,blockers:[],
  });
  const proposal=applyConquest(context,[],c).find(p=>p.action.type==='build');
  assert.equal(proposal?.action.type,'build');
  if(proposal?.action.type==='build')assert.equal(proposal.action.building,level<=25?'mine':'smithy');
 }
});
test('transition keeps normal proposals while conquest is preparing',()=>{
 const {context,c}=fixture();
 const routine={id:'new',task:'military.pikemen-baseline',villageId:'v1',action:{type:'train',village:'v1',unit:'pikeman',count:9}} as Proposal;
 const result=applyConquest(context,[routine],c);
 assert.ok(result.includes(routine));
 c.plan.status='captured';assert.deepEqual(applyConquest(context,[routine],c),[routine]);
});
test('conquest dispatch needs 100 Raiders at home, not away, and sends every home Raider while the rest train',()=>{
 const {context,v,c}=fixture();
 v.units.home.raider=99;v.units.away.raider=1;c.assessment!.raiders=99;
 assert.ok(!applyConquest(context,[],c).some(proposal=>proposal.action.type==='send'));
 v.units.home.raider=100;v.units.away.raider=0;c.assessment!.raiders=100;
 v.training.barracks=[{id:'raiders',unit:'raider',count:16,remaining:16,costEach:{timber:55,stone:35,iron:45},nextTick:104,endTick:164}];
 const send=selectProposal(applyConquest(context,[],c)).selected;
 assert.equal(send?.action.type,'send');
 if(send?.action.type==='send')assert.deepEqual(send.action.units,{raider:100,envoy:1});
});
test('recall returns the capital-origin Raider stack after a city becomes economic',()=>{
 const context:AdvisorContext=developedContext(),capital=context.state.villages[0]!;
 const city=structuredClone(capital);city.id='captured';city.name='Captured';city.supportHere=[{
  home:{id:capital.id,name:capital.name},units:{raider:83,pikeman:250},
 }] as typeof city.supportHere;
 context.state.villages.push(city);
 context.cityRoles=new Map([
  [capital.id,{role:'capital',reason:'fixture'}],
  [city.id,{role:'economic',reason:'captured'}],
 ]);
 const recall=evaluateRecall(context)[0];
 assert.equal(recall?.task,'expansion.recall');
 assert.deepEqual(recall?.action,{type:'recall',village:city.id,home:capital.id,units:{raider:83}});
 assert.equal(recall?.importance,93);
});
test('first conquest Raider and Envoy proposals keep their existing importance',()=>{
 const {context,v,c}=fixture();v.units.home.raider=0;v.units.home.envoy=0;
 const proposals=applyConquest(context,[],c);
 const raider=proposals.find(p=>p.action.type==='train'&&p.action.unit==='raider');
 const envoy=proposals.find(p=>p.action.type==='train'&&p.action.unit==='envoy');
 assert.equal(raider?.importance,90);assert.equal(envoy?.importance,90);
});

/** Exercise the production Controller, including its second state read and durable journal. */
async function executor(mode: 'ok'|'lost'|'unapplied'|'reject' = 'ok') {
 const x=fixture(),writes:Action[]=[],reads:string[]=[];
 let now=0,first=true,stateReads=0,preflight: (()=>void)|undefined;
 const settings:Settings={serverUrl:'https://sandbox.invalid',worldId:x.context.state.world.id,apiKey:'test'};
 let saved:SavedControl={settings,pending:null,decisions:[],missions:[conquestMission(structuredClone(x.c.plan))]};
 const reports:Report[]=[];
 const storage={load:async()=>structuredClone(saved),save:async(s:SavedControl)=>{saved=structuredClone(s);}};
 const remote:Remote=async <T>(_s:Settings,path:string,body?:unknown):Promise<T>=>{
  reads.push(path);
  if(path==='/me')return {account:{id:x.context.state.player.id},worlds:[],sandboxes:[]} as T;
  if(path==='/worlds')return [x.context.state.world] as T;
  if(path.endsWith('/state')){if(++stateReads===2)preflight?.();return structuredClone(x.context.state) as T;}
  if(path.endsWith('/rules'))return x.context.rules as T;
  if(path.endsWith('/history'))return {samples:[]} as T;
  if(path.endsWith('/map'))return {...x.c.map,tick:x.context.state.world.tick,snapshotTick:x.context.state.world.tick} as T;
  if(path.endsWith('/reports'))return {reports,next:null} as T;
  if(path.includes('/reports/'))return structuredClone(reports.find(r=>path.endsWith('/'+r.id))) as T;
  if(path.endsWith('/simulate/battle')){
   assert.equal((body as {loyalty:number}).loyalty,100);
   return x.c.assessment!.battle as T;
  }
  assert.ok(path.endsWith('/actions'),path);
  const action=(body as {actions:Action[]}).actions[0];
  assert.deepEqual(saved.pending?.action,action,'exact request is persisted before POST');
  assert.ok(['prepared','uncertain'].includes(saved.pending!.phase));
  writes.push(structuredClone(action));
  if(mode==='reject')return {tick:100,results:[{ok:false,type:'send',error:{code:'TARGET_PROTECTED',message:'Changed target'}}]} as T;
  if(mode==='unapplied'&&first){first=false;throw new RemoteError(429,5000,'backoff');}
  assert.equal(action.type,'send');if(action.type!=='send')throw new Error('Expected conquest send');
  const command={id:'command',kind:'attack' as const,from:{id:x.v.id},to:{id:'t'},units:action.units,sentTick:100,arrivalTick:110};
  x.context.state.commands.outgoing=[command as any];x.v.units.home.raider=0;x.v.units.home.envoy=0;
  if(mode==='lost')throw new RemoteError(0,5000,'lost successful response');
  return {tick:100,results:[{ok:true,type:'send',data:{command}}]} as T;
 };
 const create=()=>Controller.create(storage,settings,remote,()=>now);
 return {...x,writes,reads,reports,create,controller:await create(),saved:()=>saved,
  advance:()=>{now+=10000;},preflight:(f:()=>void)=>{preflight=f;},
  report:(conquered=false)=>{
   const r={id:'battle',commandId:'command',tick:110,kind:'battle',role:'attacker',
    attacker:{id:x.v.id,ownerId:x.context.state.player.id},defender:{id:'t',ownerId:null},
    outcome:'won',conquered,attackerUnits:{sent:{raider:140,envoy:1},lost:conquered?{raider:2,envoy:1}:{}},
    loyalty:{before:34,after:conquered?0:1}} as Report;
   reports.push(r);x.context.state.world.tick=110;x.context.state.commands.outgoing=[];
   return r;
  }};
}

test('conquest journals its send and reconciles terminal capture across a paused restart',async()=>{
 const x=await executor();await x.controller.cycle();
 assert.equal(x.writes.length,1);assert.equal(x.saved().missions?.[0]?.memory.waves,1);
 assert.equal(x.saved().pending?.missionId,x.saved().missions?.[0]?.id);
 await x.controller.setAutomatic(false);x.report(true);
 x.context.state.villages.push({...structuredClone(x.v),id:'t'});x.context.state.world.status='ended';
 const restarted=await x.create();await restarted.cycle();
 assert.equal(restarted.snapshot().error,null);assert.equal(restarted.snapshot().automatic,false);
 assert.equal(x.saved().missions?.[0]?.status,'completed');assert.equal(x.saved().missions?.[0]?.memory.capturedTick,110);
 assert.equal(x.saved().pending,null);assert.equal(x.saved().active?.length,0);assert.equal(x.writes.length,1);
 assert.equal(x.saved().missions?.[0]?.memory.lastBattle?.conquered,true);
 assert.ok(restarted.snapshot().decisions.some(d=>d.kind==='confirmed'&&d.text.includes('Conquest battle')));
});

test('uncertain conquest sends suppress applied replays and retry unapplied writes with the same ID',async()=>{
 const lost=await executor('lost');await lost.controller.cycle();lost.advance();
 await lost.controller.setAutomatic(false);const restarted=await lost.create();await restarted.cycle();
 assert.equal(lost.writes.length,1);assert.equal(lost.saved().pending,null);
 assert.equal(lost.saved().missions?.[0]?.status,'failed');assert.equal(restarted.snapshot().automatic,false);
 const retry=await executor('unapplied');await retry.controller.cycle();retry.advance();
 const next=await retry.create();await next.cycle();
 assert.equal(retry.writes.length,2);assert.deepEqual(retry.writes[0],retry.writes[1]);
 assert.equal(retry.saved().pending?.phase,'accepted');assert.equal(retry.saved().missions?.[0]?.memory.waves,1);
});

test('conquest expiry pauses execution, and a changed epoch never replays the old action',async()=>{
 const x=await executor('unapplied');await x.controller.cycle();
 x.context.state.world.tick=x.saved().pending!.expiresTick;x.advance();await x.controller.cycle();
 assert.equal(x.controller.snapshot().automatic,false);assert.equal(x.writes.length,1);
 x.context.state.world.epoch='next';x.advance();await x.controller.cycle();
 assert.equal(x.saved().pending,null);assert.equal(x.writes.length,1);
});

test('fresh ownership, home defence and external orders prevent conquest writes',async()=>{
 for(const mutate of [
  (x:Awaited<ReturnType<typeof executor>>)=>{x.c.map!.villages[0].ownerId='enemy';},
  (x:Awaited<ReturnType<typeof executor>>)=>{x.v.units.home.pikeman=149;},
  (x:Awaited<ReturnType<typeof executor>>)=>{x.v.orders.build=[{building:'wall',toLevel:2}];},
  (x:Awaited<ReturnType<typeof executor>>)=>{x.context.state.scheduled=[{} as any];},
 ]){
  const x=await executor();x.preflight(()=>mutate(x));await x.controller.cycle();
  assert.equal(x.controller.snapshot().error,null);assert.ok(!x.writes.some(a=>a.type==='send'),String(mutate));
 }
});

test('individual conquest rejection remains visible and does not count as an accepted wave',async()=>{
 const x=await executor('reject');await x.controller.cycle();
 assert.equal(x.writes.length,1);assert.equal(x.saved().pending,null);assert.equal(x.saved().missions?.[0]?.memory.waves,0);
 assert.ok(x.controller.snapshot().decisions.some(d=>d.kind==='rejected'&&d.text.includes('TARGET_PROTECTED')));
});

test('a failed battle or missing accepted command stops conquest without replacement troops',async()=>{
 for(const report of [false,true]){
  const x=await executor();await x.controller.cycle();await x.controller.setAutomatic(false);
  if(report){x.report().attackerUnits!.lost.envoy=1;}else{x.context.state.commands.outgoing=[];}
  const restarted=await x.create();await restarted.cycle();
  assert.equal(x.saved().missions?.[0]?.status,'failed');assert.equal(x.saved().pending,null);assert.equal(x.writes.length,1);
 }
});

test('authoritative capture survives a missing report or a lost final send response',async()=>{
 for(const mode of ['ok','lost'] as const){
  const x=await executor(mode);await x.controller.cycle();await x.controller.setAutomatic(false);x.advance();
  x.context.state.world.tick=110;x.context.state.world.status='ended';x.context.state.commands.outgoing=[];
  x.context.state.villages.push({...structuredClone(x.v),id:'t'});
  const restarted=await x.create();await restarted.cycle();
  assert.equal(restarted.snapshot().error,null);assert.equal(x.saved().missions?.[0]?.status,'completed');
  assert.equal(x.saved().pending,null);assert.equal(x.writes.length,1);assert.equal(restarted.snapshot().automatic,false);
  if(mode==='lost')assert.ok(restarted.snapshot().decisions.some(d=>d.kind==='uncertain'&&d.text.includes('final request attribution remains unknown')));
 }
});

test('incoming attacks leave affordable Smithy construction eligible',()=>{
 const {context,v,c}=fixture();
 Object.assign(v.buildings,{hall:10,barracks:5,wall:5,smithy:0,market:0,court:0});
 v.units.home.pikeman=250;
 for(const option of v.options.build)option.level=v.buildings[option.building]+1;
 c.assessment=undefined;
 context.state.commands.incoming=[{kind:'attack',to:{id:v.id}} as any];
 const selected=selectProposal(applyConquest(context,[],c)).selected;
 assert.equal(selected?.action.type,'build');if(selected?.action.type==='build')assert.equal(selected.action.building,'smithy');
 assert.ok(!applyConquest(context,[],c).some(p=>p.action.type==='send'));
});

test('incoming attacks do not hold a ready Raider and Envoy expedition at home',async()=>{
 const x=await executor();
 x.preflight(()=>{x.context.state.commands.incoming=[{kind:'attack',to:{id:x.v.id}} as any];});
 await x.controller.cycle();
 assert.equal(x.writes.length,1);assert.equal(x.writes[0].type,'send');
 if(x.writes[0].type==='send')assert.deepEqual(x.writes[0].units,{raider:150,envoy:1});
 assert.equal(x.v.units.home.pikeman,153);
});

test('incoming attacks do not prevent entering conquest with Barracks 5 and no Pikemen',async()=>{
 const x=await executor();x.saved().missions=[];
 x.v.units.home.pikeman=0;x.v.buildings.barracks=5;
 x.context.state.commands.incoming=[{kind:'attack',to:{id:x.v.id}} as any];
 const c=await x.create();await c.setAutomatic(false);await c.cycle();
 assert.equal(x.saved().missions?.[0]?.status,'active');assert.equal(x.writes.length,0);
});

test('repeated cycles retain one first-conquest mission instance',async()=>{
 const x=await executor();x.saved().missions=[];
 const c=await x.create();await c.setAutomatic(false);await c.cycle();await c.cycle();
 assert.equal(x.saved().missions?.filter(mission=>mission.definition==='firstConquest').length,1);
 assert.equal(x.saved().missions?.[0]?.sequence,1);
});

test('recurring conquest tops up the surviving escort before dispatch',()=>{
 const {context,v,c}=fixture();
 c.plan.sequence=2;c.plan.escort=140;
 v.units.home.raider=110;v.units.home.envoy=0;
 v.options.train.find(option=>option.unit==='raider')!.ticksEach=2;
 let proposals=applyConquest(context,[],c);
 const escort=proposals.find(p=>p.action.type==='train'&&p.action.unit==='raider');
 assert.equal(escort?.task,'expansion.escort');
 if(escort?.action.type==='train')assert.equal(escort.action.count,31);
 else assert.fail('Missing Raider escort top-up');
 assert.ok(proposals.some(p=>p.task==='expansion.envoy'&&p.action.type==='train'&&p.action.unit==='envoy'));
 assert.ok(!proposals.some(p=>p.action.type==='send'));
 v.units.home.raider=150;v.units.home.envoy=1;
 c.assessment={tick:context.state.world.tick,raiders:150,battle:{winner:'attacker',attackerSurvivors:{raider:114,envoy:1},attackerLost:{}} as any};
 proposals=applyConquest(context,[],c);
 const dispatch=proposals.find(p=>p.action.type==='send');
 assert.equal(dispatch?.task,'expansion.dispatch');assert.equal(dispatch?.importance,94);
 assert.ok(!proposals.some(p=>p.action.type==='train'&&p.action.unit==='raider'));
 c.plan.waves=1;v.units.home.raider=110;c.assessment.raiders=110;
 let nextWave=applyConquest(context,[],c);
 assert.ok(nextWave.some(p=>p.action.type==='train'&&p.action.unit==='raider'));
 assert.equal(selectProposal(nextWave).selected?.action.type,'send');
 v.units.home.raider=90;c.assessment.raiders=90;
 nextWave=applyConquest(context,[],c);
 assert.ok(!nextWave.some(p=>p.action.type==='send'));
});

test('recurring conquest waits for defended economic cities before training an Envoy',()=>{
 const {context,v,c}=fixture();c.plan.sequence=2;v.units.home.pikeman=250;v.units.home.envoy=0;v.units.away.envoy=0;
 const economic=structuredClone(v);economic.id='economic';economic.name='Larkdale';
 economic.buildings.hall=10;economic.buildings.wall=9;economic.units.home.pikeman=200;
 context.state.villages.push(economic);context.state.world.villages=2;
 const envoy=()=>applyConquest(context,[],c).some(proposal=>
  proposal.task==='expansion.envoy'&&proposal.action.type==='train'&&proposal.action.unit==='envoy');
 assert.equal(envoy(),false,'Wall 9 must block the recurring Envoy');
 economic.buildings.wall=10;economic.units.home.pikeman=199;
 assert.equal(envoy(),false,'less than 80% of the Pikemen target must block the recurring Envoy');
 economic.units.home.pikeman=200;
 assert.equal(envoy(),true,'Wall 10 and 80% of the target must allow the recurring Envoy');
});

test('recurring conquest starts only after every capital and economic-city gate is met',async()=>{
 for(const block of ['hall','wall','court','pikemen','orders','active'] as const){
  const x=await executor();
  x.v.units.home.pikeman=250;
  const previous=structuredClone(x.c.plan);previous.status='captured';
  x.saved().missions=[conquestMission(previous)];
  const economic=structuredClone(x.v);economic.id='economic';economic.name='Economic';economic.buildings.hall=10;
  economic.buildings.wall=10;economic.units.home.pikeman=200;
  x.context.state.villages.push(economic);x.context.state.world.villages=2;
  if(block==='hall')economic.buildings.hall=9;
  if(block==='wall')economic.buildings.wall=9;
  if(block==='court')x.v.buildings.court=0;
  if(block==='pikemen')x.v.units.home.pikeman=149;
  if(block==='orders')x.v.orders.build=[{building:'wall',toLevel:2}];
  if(block==='active'){previous.status='preparing';x.saved().missions=[conquestMission(previous)];}
  const controller=await x.create();await controller.setAutomatic(false);await controller.cycle();
  assert.equal(x.saved().missions?.length,1,`gate ${block}`);
 }
});

test('a completed first conquest starts a sequenced recurring mission with a new identity',async()=>{
 const x=await executor();
 x.v.units.home.pikeman=250;
 const previous=structuredClone(x.c.plan);previous.status='captured';
 x.saved().missions=[conquestMission(previous)];
 const economic=structuredClone(x.v);economic.id='economic';economic.name='Economic';economic.buildings.hall=10;
 economic.buildings.wall=10;economic.units.home.pikeman=200;
 x.context.state.villages.push(economic);x.context.state.world.villages=2;
 const controller=await x.create();await controller.setAutomatic(false);await controller.cycle();
 const recurring=x.saved().missions?.find(mission=>mission.definition==='conquest');
 assert.ok(recurring);
 assert.equal(recurring.sequence,2);
 assert.equal(recurring.id,`${recurring.scope}:conquest:${x.v.id}:${x.context.state.world.tick}`);
 assert.ok(controller.snapshot().proposals.some(proposal=>proposal.task==='expansion.dispatch'));
 assert.ok(!controller.snapshot().proposals.some(proposal=>
  proposal.action.type==='train'&&proposal.action.unit==='raider'
 ));
});

test('a recurring mission leaves capital economy selectable while waiting for its home escort',async()=>{
 const x=await executor();
 x.v.units.home.pikeman=250;
 x.v.resourcesMilli.timber=x.v.storage*1000+1000;
 x.v.resources.timber=x.v.storage+1;
 x.c.plan.sequence=2;x.c.plan.escort=200;
 x.v.units.home.raider=100;x.c.assessment!.raiders=100;
 x.saved().missions=[conquestMission(structuredClone(x.c.plan))];
 const controller=await x.create();await controller.setAutomatic(false);await controller.cycle();
 const view=controller.snapshot();
 const economy=view.proposals.filter(proposal=>
  proposal.villageId===x.v.id&&proposal.advisor==='economic'&&proposal.status==='ready');
 assert.ok(economy.length>0);
 assert.ok(allocateWithPresident(economy).selection.selected);
 assert.equal(view.planning.reservations.some(reservation=>reservation.kind==='exclusiveSpending'),false);
 assert.equal(x.writes.length,0);
});
test('a preparing first conquest keeps an overflowing capital Storehouse selectable',async()=>{
 const x=await executor();
 x.v.resourcesMilli.timber=x.v.storage*1000;
 const controller=await x.create();await controller.setAutomatic(false);await controller.cycle();
 const view=controller.snapshot();
 const economy=view.proposals.filter(proposal=>
  proposal.villageId===x.v.id&&proposal.advisor==='economic'&&proposal.status==='ready');
 const storehouse=economy.find(proposal=>
  proposal.action.type==='build'&&proposal.action.building==='storehouse');
 assert.ok(storehouse);
 assert.equal(allocateWithPresident(economy).selection.selected?.id,storehouse.id);
 assert.equal(view.planning.reservations.some(reservation=>reservation.kind==='exclusiveSpending'),false);
 assert.equal(x.writes.length,0);
});

test('Raider escort is funded in minute batches, letting affordable Smithy work proceed while training',()=>{
 const {context,v,c}=fixture();v.units.home.raider=0;v.units.home.envoy=0;v.buildings.smithy=5;v.buildings.court=0;
 v.resourcesMilli={timber:2000000,stone:2000000,iron:2000000};
 const o=v.options.build.find(o=>o.building==='smithy')!;o.level=6;o.ok=true;o.blockers=[];o.cost={timber:699,stone:572,iron:762};
 let proposals=applyConquest(context,[],c);let selected=selectProposal(proposals).selected;
 assert.equal(selected?.action.type,'train');if(selected?.action.type==='train')assert.equal(selected.action.count,16);
 v.training.barracks=[{id:'raiders',unit:'raider',count:16,remaining:16,costEach:{timber:55,stone:35,iron:45},nextTick:104,endTick:164}];
 v.resourcesMilli={timber:1120000,stone:1440000,iron:1280000};
 proposals=applyConquest(context,[],c);selected=selectProposal(proposals).selected;
 assert.equal(selected?.action.type,'build');if(selected?.action.type==='build')assert.equal(selected.action.building,'smithy');
 v.training.barracks=[];v.units.home.raider=142;
 const last=applyConquest(context,[],c).find(p=>p.action.type==='train'&&p.action.unit==='raider');if(last?.action.type==='train')assert.equal(last.action.count,8);else assert.fail('Missing final bounded batch');
});

test('first conquest waits for the producer gate, Barracks cap and empty orders',async()=>{
 for(const mutate of [
  (v:any)=>{v.buildings.mine=11;},
  (v:any)=>{v.buildings.barracks=4;},
  (v:any)=>{v.orders.build.push({building:'mine'});},
 ]){
  const x=await executor();x.saved().missions=[];mutate(x.v);
  const c=await x.create();await c.setAutomatic(false);await c.cycle();
  assert.equal(x.saved().missions?.length,0);
 }
});

test('recurring admission includes scaled Envoy cost, production, incoming trade arrival and capture margin',()=>{
 const {context,v,c}=fixture();
 v.units.home.envoy=0;v.training.court=[];
 const option=v.options.train.find(value=>value.unit==='envoy')!;
 option.cost={timber:1000,stone:1000,iron:1000};option.ticksEach=100;
 v.resourcesMilli={timber:0,stone:0,iron:0};
 v.productionPerTickMilli={timber:1000,stone:1000,iron:1000};
 const arrival=conquestCaptureTick(context,c,1200)!;
 context.state.world.endsAtTick=arrival+60;
 assert.equal(recurringConquestFits(context,v,c.map),true);
 context.state.world.endsAtTick--;
 assert.equal(recurringConquestFits(context,v,c.map),false);
 v.productionPerTickMilli={timber:0,stone:0,iron:0};
 context.state.trades.incoming=[{id:'fund',to:{id:v.id},resources:{timber:1000,stone:1000,iron:1000},arrivalTick:1100,returning:false} as any];
 context.state.world.endsAtTick=arrival+60;
 assert.equal(recurringConquestFits(context,v,c.map),true);
 context.state.trades.incoming[0]!.arrivalTick++;
 assert.equal(recurringConquestFits(context,v,c.map),false);
 context.state.trades.incoming=[];
 assert.equal(recurringConquestFits(context,v,c.map),false);
});

test('recurring admission handles absent map, absent targets, missing training option and retained Envoy',()=>{
 const {context,v,c}=fixture();
 assert.equal(recurringConquestFits(context,v),true);
 assert.equal(recurringConquestFits(context,v,{...c.map!,villages:[]}),false);
 context.state.world.endsAtTick=context.state.world.tick+60;
 assert.equal(recurringConquestFits(context,v,c.map),false);
 v.options.train=[];
 assert.equal(recurringConquestFits(context,v,c.map),false);
});

test('a late recurring mission is not persisted or allowed to reserve capital spending',async()=>{
 const x=await executor();x.v.units.home.pikeman=250;
 const previous=structuredClone(x.c.plan);previous.status='captured';
 x.saved().missions=[conquestMission(previous)];
 const economic=structuredClone(x.v);economic.id='economic';economic.buildings.hall=10;
 economic.buildings.wall=10;economic.units.home.pikeman=200;
 x.context.state.villages.push(economic);x.context.state.world.villages=2;
 x.context.state.world.endsAtTick=x.context.state.world.tick+60;
 const controller=await x.create();await controller.setAutomatic(false);await controller.cycle();
 assert.equal(x.saved().missions?.length,1);
 assert.ok(!controller.snapshot().proposals.some(proposal=>proposal.task==='expansion.envoy'));
});

test('recurring admission uses stock, retained Envoys and the nearest neutral target',()=>{
 const {context,v,c}=fixture();
 const capture=conquestCaptureTick(context,c)!;
 context.state.world.endsAtTick=capture+60;
 const option=v.options.train.find(value=>value.unit==='envoy')!;
 option.ticksEach=100;
 assert.equal(recurringConquestFits(context,v,c.map),true,'retained Envoy needs no funding or training');
 v.units.home.envoy=0;
 assert.equal(recurringConquestFits(context,v,c.map),false,'training must fit even when stock is funded');
 context.state.world.endsAtTick+=100;
 assert.equal(recurringConquestFits(context,v,c.map),true);
 option.cost={timber:v.storage+1,stone:1,iron:1};
 assert.equal(recurringConquestFits(context,v,c.map),false,'unfundable storage capacity');
 v.units.home.envoy=1;
 c.map!.villages.unshift({...c.map!.villages[0]!,id:'far',x:90,y:90});
 c.map!.villages.unshift({...c.map!.villages[0]!,id:'owned',x:v.x,y:v.y,ownerId:'enemy'});
 assert.equal(recurringConquestFits(context,v,c.map),true,'nearer owned targets are excluded');
 context.state.world.endsAtTick=context.state.world.tick+60;
 assert.equal(recurringConquestFits(context,v),false,'fallback is not instantaneous');
});

test('recurring admission combines production and several incoming trades, excluding unrelated trades',()=>{
 const {context,v,c}=fixture();v.units.home.envoy=0;
 const option=v.options.train.find(value=>value.unit==='envoy')!;
 option.cost={timber:1000,stone:1000,iron:1000};option.ticksEach=100;
 v.resourcesMilli={timber:100000,stone:100000,iron:100000};
 v.productionPerTickMilli={timber:1000,stone:1000,iron:1000};
 const trade=(id:string,arrivalTick:number)=>({id,to:{id:v.id},resources:{timber:200,stone:200,iron:200},arrivalTick,returning:false} as any);
 context.state.trades.incoming=[trade('later',500),trade('earlier',300)];
 context.state.world.endsAtTick=conquestCaptureTick(context,c,700)!+60;
 assert.equal(recurringConquestFits(context,v,c.map),true);
 context.state.world.endsAtTick--;
 assert.equal(recurringConquestFits(context,v,c.map),false);
 context.state.trades.incoming[0]!.returning=true;
 context.state.trades.incoming[1]!.to.id='elsewhere';
 assert.equal(recurringConquestFits(context,v,c.map),false);
});
