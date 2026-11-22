/** Research candidate: the owner's bounded first-conquest transition.
 * All proposals still pass through the President and the journalled executor.
 * Peaceful hamlet assumptions are experimental, not a player-threat policy. */
import type {Action,BuildingId, MapResponse, Report, Resources, SimulateBattleResponse, UnitId, VillageState} from '../shared/api.js';
import type {AdvisorContext, Proposal} from './types.js';
import { proposalTask } from '../bot/plan/graph.js';
import { cityRoles } from "../bot/strategy/roles.js";
import { stockMinutes } from "./balance.js";
import { expansionReadiness } from "./sustained-defense.js";
import {nextConquestBuilding, fundingUpgrade, conquestLoyalty} from '../review/conquest-plan.js';
import { BARRACKS_CAP, CONQUEST_PRODUCER_FLOOR, EARLY_HALL, RAIDER_MIN_BARRACKS, RAIDER_SEND_MIN, RAIDER_TARGET, hallRushActive } from "./defense-budget.js";

export interface ConquestPlan {
 scope: string;
 villageId: string;
 sequence?: number;
 startedTick: number;
 status: 'preparing' | 'captured' | 'stopped';
 targetId?: string;
 escort?: number;
 waves: number;
 lastBattle?: Report;
 reason?: string;
 capturedTick?: number;
}
export interface ConquestContext {
 plan: ConquestPlan;
 map?: MapResponse;
 assessment?: {tick: number; raiders: number; battle: SimulateBattleResponse; targetId?: string; targetLoyalty?: number};
}
const resources = ['timber','stone','iron'] as const;
const producerResources = {lumberyard:'timber',quarry:'stone',mine:'iron'} as const;
export function conquestScope(server: string, account: string, context: AdvisorContext): string {
 return JSON.stringify([server,account,context.state.world.id,context.state.world.epoch]);
}
export function conquestTravel(context: AdvisorContext, c: ConquestContext): number | null {
 const v=context.state.villages.find(v=>v.id===c.plan.villageId),t=c.map?.villages.find(t=>t.id===c.plan.targetId);
 const speed=(context.rules.rules.UNITS as Record<string,{speed:number}>).envoy.speed;
 return v&&t?Math.max(1,Math.ceil(Math.hypot(t.x-v.x,t.y-v.y)*speed)):null;
}
/** Exact loyalty boundaries, allowing council spacing, and six bounded hits at most. */
export function conquestCaptureTick(context: AdvisorContext,c: ConquestContext,start=context.state.world.tick,travel=conquestTravel(context,c),loyalty=100): number | null {
 if(travel===null)return null;
 const combat=context.rules.rules.COMBAT as {envoyLoyaltyHit:number;loyaltyRegenTicks:number};
 const interval=Math.max(travel*2,context.state.world.actIntervalTicks??0);
 const arrivals=Array.from({length:6},(_,i)=>Math.ceil(start)+travel+i*interval);
 const hit=conquestLoyalty(arrivals,combat.envoyLoyaltyHit,combat.loyaltyRegenTicks,100,loyalty,context.state.world.tick).findIndex(n=>n<=0);
 return hit<0?null:arrivals[hit];
}

export function conquestTargetLoyalty(context: AdvisorContext,c: ConquestContext): number {
 const now=context.state.world.tick,combat=context.rules.rules.COMBAT as {envoyLoyaltyHit:number;loyaltyRegenTicks:number};
 const report=c.plan.lastBattle;
 let tick=c.plan.startedTick,loyalty=100;
 const flying=context.state.commands.outgoing.filter(command=>command.from.id===c.plan.villageId&&command.to.id===c.plan.targetId&&command.kind==='attack'&&!command.returning&&command.arrivalTick>now).length;
 loyalty-=Math.max(0,c.plan.waves-flying)*combat.envoyLoyaltyHit;
 if(report&&report.defender.id===c.plan.targetId&&report.attacker.id===c.plan.villageId&&report.loyalty&&report.tick<=now){
  tick=report.tick;loyalty=report.loyalty.after;
 }
 const assessed=c.assessment?.targetLoyalty??c.assessment?.battle.loyalty?.before;
 if(c.assessment?.targetId===c.plan.targetId&&assessed!==undefined&&c.assessment&&c.assessment.tick>=tick&&c.assessment.tick<=now){
  tick=c.assessment.tick;loyalty=assessed;
 }
 return Math.max(0,Math.min(100,loyalty+Math.floor(now/combat.loyaltyRegenTicks)-Math.floor(tick/combat.loyaltyRegenTicks)));
}

/** Add bounded conquest work without excluding normal proposals. */
export function applyConquest(context: AdvisorContext,proposals: Proposal[],c?: ConquestContext): Proposal[] {
 if(!c||c.plan.status!=='preparing')return proposals;
 const {state,rules}=context,plan=c.plan,v=state.villages.find(v=>v.id===plan.villageId);
 if(!v)return proposals;
 const sequence=plan.sequence??1;
 const roles=context.cityRoles??cityRoles(context,[]);
 const retained=proposals;
 function deduplicateBuilds(candidates: Proposal[]): Proposal[] {
  const result: Proposal[]=[];
  const positions=new Map<string,number>();
  for(const proposal of candidates){
   if(proposal.action.type!=='build'){result.push(proposal);continue;}
   const key=`${proposal.villageId}:${proposal.action.building}`;
   const position=positions.get(key);
   if(position===undefined){positions.set(key,result.length);result.push(proposal);}
   else if(proposal.importance>result[position].importance)result[position]=proposal;
  }
  return result;
 }
 if(state.world.status!=='running'||rules.version!==state.world.rulesVersion||
   Object.values(v.orders).some(o=>o.length)||state.scheduled.length)return proposals;
 const metadata=rules.rules.BUILDINGS as Record<BuildingId,{name:string}>;
 const blockers=()=> (state.player.nextActTick??0)>state.world.tick?['COUNCIL_COOLDOWN']:[];
 const buffer=Math.max(50,Math.ceil(v.population.max*.2));
 const free=v.population.max-v.population.used;
 function build(building: BuildingId,importance=88): Proposal | null {
  const o=v!.options.build.find(o=>o.building===building);if(!o)return null;
  // Capacity is itself an ordinary paid prerequisite, never injected assets.
  if(building!=='farm'&&free<o.pop+buffer)return build('farm',96);
  if(building!=='storehouse'&&resources.some(r=>o.cost[r]>v!.storage))return build('storehouse',96);
  const b:string[]=[...o.blockers,...blockers()];
  if(v!.buildQueue.length)b.push('BUILD_QUEUE_BUSY');
  for(const r of resources)if(v!.resourcesMilli[r]<o.cost[r]*1000&&!b.includes('INSUFFICIENT_RESOURCES'))b.push('INSUFFICIENT_RESOURCES');
  const funded=Math.max(state.world.tick,...resources.map(r=>v!.productionPerTickMilli[r]>0?state.world.tick+Math.max(0,Math.ceil((o.cost[r]*1000-v!.resourcesMilli[r])/v!.productionPerTickMilli[r])):Infinity));
  if(funded+o.ticks+60>state.world.endsAtTick)b.push('ROUND_END_TOO_SOON');
  return {id:`${state.world.epoch}:${v!.id}:conquest:build:${building}:${o.level}`,task:proposalTask('conquest',{type:'build',building},o.level),advisor:'conquest',villageId:v!.id,villageName:v!.name,
   action:{type:'build',village:v!.id,building},buildingName:metadata[building].name,currentLevel:v!.buildings[building],targetLevel:o.level,
   importance,reason:`Bounded conquest transition: retain the paid home defence, producers ${CONQUEST_PRODUCER_FLOOR}, Hall ${EARLY_HALL}, Barracks ${BARRACKS_CAP}, Smithy 10, Market 5 and Court; fund capacity as needed.`,requirements:o.cost,blockers:[...new Set(b)],
   status:b.length?'waiting':'ready',affordableAtTick:Number.isFinite(funded)?funded:null};
 }
 function train(unit: 'raider'|'envoy',goal:number): Proposal | null {
  const o=v!.options.train.find(o=>o.unit===unit);if(!o)return null;
  const u=(rules.rules.UNITS as Record<UnitId,{building:keyof VillageState['training'];buildingLevel:number;smithyLevel:number}>)[unit];
  if(v!.buildings[u.building]<u.buildingLevel||v!.buildings.smithy<u.smithyLevel)return null;
  const owned=(v!.units.home[unit]??0)+(v!.units.away[unit]??0);
  const queued=Object.values(v!.training).flat().filter(q=>q.unit===unit).reduce((n,q)=>n+q.remaining,0);
  const remaining=goal-owned-queued;
  const count=unit==='raider'?Math.min(remaining,Math.ceil(61/o.ticksEach),
   (rules.rules.ECONOMY as {trainBatchMax:number}).trainBatchMax,o.maxCount):remaining;if(count<=0)return null;
  if(free<o.pop*count+buffer)return build('farm',96);
  const cost=Object.fromEntries(resources.map(r=>[r,o.cost[r]*count])) as Resources;
  if(resources.some(r=>cost[r]>v!.storage))return build('storehouse',96);
  const b:string[]=[...o.blockers,...blockers()];
  if(v!.training[u.building].length)b.push('TRAIN_QUEUE_BUSY');
  for(const r of resources)if(v!.resourcesMilli[r]<cost[r]*1000&&!b.includes('INSUFFICIENT_RESOURCES'))b.push('INSUFFICIENT_RESOURCES');
  const funded=Math.max(state.world.tick,...resources.map(r=>state.world.tick+Math.max(0,Math.ceil((cost[r]*1000-v!.resourcesMilli[r])/v!.productionPerTickMilli[r]))));
  const capture=conquestCaptureTick(context,c!,funded+o.ticksEach*(unit==='raider'?remaining:count));
  if(capture===null||capture+60>state.world.endsAtTick)b.push('ROUND_END_TOO_SOON');
  if(count>(rules.rules.ECONOMY as {trainBatchMax:number}).trainBatchMax)b.push('BATCH_CAPACITY');
 const task=sequence>=2
  ? unit==='envoy'?'expansion.envoy' as const:'expansion.escort' as const
  : proposalTask('conquest',{type:'train',unit},goal);
 return {id:`${state.world.epoch}:${v!.id}:conquest:train:${unit}:${goal}`,task,advisor:'conquest',villageId:v!.id,villageName:v!.name,
   action:{type:'train',village:v!.id,unit,count},buildingName:`Conquest ${unit}`,currentLevel:owned,targetLevel:owned+count,
   importance:90,reason:'Top up the Raiders needed at home for each conquest wave, in minute-long batches, plus one reusable Envoy. Paid defensive troops remain at home.',requirements:cost,
   blockers:[...new Set(b)],status:b.length?'waiting':'ready',affordableAtTick:funded};
 }
 const producers=['lumberyard','quarry','mine'] as const;
 const deficient=producers.filter(b=>v.buildings[b]<CONQUEST_PRODUCER_FLOOR).sort((a,b)=>stockMinutes(v,producerResources[a])-stockMinutes(v,producerResources[b])||v.buildings[a]-v.buildings[b]||a.localeCompare(b));
 if(deficient.length&&!hallRushActive(v)){const p=build(deficient[0]);if(p)retained.push(p);return deduplicateBuilds(retained);}
 let next=nextConquestBuilding(v.buildings,rules);
 let construction=next?build(next):null;
 // Saved prototype's funding fallback: compare paying for a producer with saving for this bill.
 if(construction?.blockers.length===1&&construction.blockers[0]==='INSUFFICIENT_RESOURCES'){
  let best:{p:Proposal;ticks:number}|undefined;
  for(const [building,resource] of [['lumberyard','timber'],['quarry','stone'],['mine','iron']] as const){
   const o=v.options.build.find(o=>o.building===building);if(!o?.ok||o.level>25||free<o.pop+buffer)continue;
   const income=(rules.tables.production as {perTickMilli:number}[])[o.level]?.perTickMilli;if(!income)continue;
   const f=fundingUpgrade({stockMilli:v.resourcesMilli,incomeMilli:v.productionPerTickMilli,bill:construction.requirements,upgradeCost:o.cost,ticks:o.ticks,resource,newIncomeMilli:income});
   const p=build(building);if(f.improves&&p?.status==='ready'&&(!best||f.upgradeTicks<best.ticks))best={p,ticks:f.upgradeTicks};
  }
  if(best)construction=best.p;
 }
 if(construction)retained.push(construction);
 if(plan.escort&&v.buildings.barracks>=RAIDER_MIN_BARRACKS){const p=train('raider',Math.max(RAIDER_TARGET,plan.escort));if(p)retained.push(p);}
 if(!next&&(sequence<2||expansionReadiness(context,roles).ready)){const p=train('envoy',1);if(p)retained.push(p);}
 const raiders=v.units.home.raider??0;
 const escortReady=plan.escort!==undefined&&raiders>=RAIDER_SEND_MIN;
 const expeditionTraining=Object.values(v.training).flat().some(batch=>batch.unit==="envoy");
 if(!next&&(v.units.home.envoy??0)>=1&&escortReady&&!expeditionTraining&&
   !state.commands.outgoing.some(cmd=>cmd.from.id===v.id)&&c.map?.tick===state.world.tick&&
   c.map.villages.find(t=>t.id===plan.targetId)?.ownerId===null&&c.assessment?.tick===state.world.tick&&
   c.assessment.raiders===raiders&&c.assessment.battle.winner==='attacker'&&(c.assessment.battle.attackerSurvivors.envoy??0)>=1){
  const capture=conquestCaptureTick(context,c,state.world.tick,conquestTravel(context,c),conquestTargetLoyalty(context,c)),b=blockers();
  if(plan.waves>=6||capture===null||capture+60>state.world.endsAtTick)b.push('ROUND_END_TOO_SOON');
  if((v.units.home.pikeman??0)<150)b.push('HOME_DEFENCE_CHANGED');
  retained.push({id:`${state.world.epoch}:${v.id}:conquest:send:${plan.waves}`,task:sequence>=2?'expansion.dispatch':proposalTask('conquest',{type:'send'},plan.waves+1),advisor:'conquest',villageId:v.id,villageName:v.name,
   action:{type:'send',village:v.id,target:plan.targetId!,kind:'attack',units:{raider:raiders,envoy:1}},buildingName:'Conquest attack',currentLevel:raiders,targetLevel:plan.waves+1,
   importance:94,reason:'Fresh unowned target, server-simulated surviving Envoy and retained 150 Pikemen. Confirm each battle before reusing the Envoy; stop after capture or six waves.',requirements:{timber:0,stone:0,iron:0},blockers:b,status:b.length?'waiting':'ready',affordableAtTick:state.world.tick});
 }
 return deduplicateBuilds(retained);
}

export function evaluateRecall(context: AdvisorContext): Proposal<Extract<Action,{type:"recall"}>>[] {
 const roles=context.cityRoles??cityRoles(context,[]);
 const capital=context.state.villages.find(v=>roles.get(v.id)?.role==="capital")??context.state.villages[0];
 if(!capital)return [];
 return context.state.villages.filter(v=>roles.get(v.id)?.role==="economic").flatMap(city=>{
  const raiders=city.supportHere.filter(stack=>stack.home.id===capital.id)
   .reduce((sum,stack)=>sum+(stack.units.raider??0),0);
  if(!raiders||(context.activeProposals??[]).some(proposal=>proposal.action.type==="recall"&&proposal.action.village===city.id&&proposal.action.home===capital.id))return [];
  const blockers:string[]=[];
  if(context.state.world.status!=="running")blockers.push("WORLD_NOT_RUNNING");
  if((context.state.player.nextActTick??context.state.world.tick)>context.state.world.tick)blockers.push("COUNCIL_COOLDOWN");
  return [{
   id:`${context.state.world.epoch}:${city.id}:recall:${raiders}`,task:"expansion.recall" as const,
   advisor:"conquest",villageId:city.id,villageName:city.name,
   action:{type:"recall" as const,village:city.id,home:capital.id,units:{raider:raiders}},
   buildingName:"Recall Raiders",currentLevel:raiders,targetLevel:0,importance:93,
   reason:"Return every Raider stationed here from the capital after capture; leave Pikemen in place.",
   requirements:{timber:0,stone:0,iron:0},blockers,status:blockers.length?"waiting" as const:"ready" as const,
   affordableAtTick:null,
  }];
 });
}

export function recurringConquestFits(context: AdvisorContext, capital: VillageState, map?: MapResponse): boolean {
 const {state}=context,now=state.world.tick;
 const option=capital.options.train.find(value=>value.unit==='envoy');
 const ready=(capital.units.home.envoy??0)>0;
 if(!option)return false;
 if(!ready&&resources.some(resource=>option.cost[resource]>capital.storage))return false;
 const trades=state.trades.incoming.filter(trade=>trade.to.id===capital.id&&!trade.returning&&trade.arrivalTick>=now)
  .sort((a,b)=>a.arrivalTick-b.arrivalTick);
 let tick=now,stock={...capital.resourcesMilli},funded=now;
 if(!ready){
  for(let i=0;i<=trades.length;i++){
   funded=Math.max(tick,...resources.map(resource=>{
    const deficit=option.cost[resource]*1000-stock[resource];
    return deficit<=0?tick:capital.productionPerTickMilli[resource]>0
     ?tick+Math.ceil(deficit/capital.productionPerTickMilli[resource]):Infinity;
   }));
   const trade=trades[i];
   if(!trade||funded<=trade.arrivalTick)break;
   for(const resource of resources)stock[resource]=Math.min(capital.storage*1000,
    stock[resource]+(trade.arrivalTick-tick)*capital.productionPerTickMilli[resource]+trade.resources[resource]*1000);
   tick=trade.arrivalTick;
  }
 }
 if(!Number.isFinite(funded))return false;
 const target=map?.villages.filter(value=>value.ownerId===null&&!state.villages.some(village=>village.id===value.id))
  .sort((a,b)=>Math.hypot(a.x-capital.x,a.y-capital.y)-Math.hypot(b.x-capital.x,b.y-capital.y)||a.id.localeCompare(b.id))[0];
 if(map&&!target)return false;
 const plan:ConquestPlan={scope:'',villageId:capital.id,targetId:target?.id,startedTick:now,status:'preparing',waves:0};
 const start=ready?now:Math.max(funded,...capital.training.court.map(batch=>batch.endTick))+option.ticksEach;
 const c={plan,map};
 const capture=conquestCaptureTick(context,c,start,map?conquestTravel(context,c):600);
 return capture!==null&&capture+60<=state.world.endsAtTick;
}
