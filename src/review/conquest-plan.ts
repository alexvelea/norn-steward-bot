/** Experimental opening helpers. Not installed in the live advisor list. */
import type {BuildingId,BuildingLevels,Resources,RulesResponse,SimulateBattleResponse} from '../shared/api.js';
export const CONQUEST_GOALS: readonly [BuildingId,number][]=[['smithy',10],['market',5],['court',1]];
export function nextConquestBuilding(levels:BuildingLevels,rules:RulesResponse):BuildingId|null{
 const metadata=rules.rules.BUILDINGS as Record<BuildingId,{requires:Partial<Record<BuildingId,number>>}>;
 function prerequisite(b:BuildingId,seen:Set<BuildingId>):BuildingId{
  if(seen.has(b))throw new Error('Cyclic building prerequisites');seen.add(b);
  for(const [id,n] of Object.entries(metadata[b].requires))if(levels[id as BuildingId]<n!)return prerequisite(id as BuildingId,seen);
  return b;
 }
 const goal=CONQUEST_GOALS.find(([b,n])=>levels[b]<n);return goal?prerequisite(goal[0],new Set()):null;
}
export function safeEnvoyAttack(battle:SimulateBattleResponse,maxEscortLoss=.2):boolean{
 const sent=(battle.attackerSurvivors.raider??0)+(battle.attackerLost.raider??0);
 return battle.winner==='attacker'&&(battle.attackerSurvivors.envoy??0)>=1&&sent>0&&(battle.attackerLost.raider??0)/sent<=maxEscortLoss;
}
/** Exact global regen boundaries between successive successful hits by one surviving Envoy. */
export function conquestLoyalty(arrivals:number[],hit:number,regenTicks:number,max=100,loyalty=max,previous=0):number[]{
 if(hit<=0||regenTicks<=0)throw new Error('Invalid live loyalty rules');
 return arrivals.map(t=>{if(!Number.isInteger(t)||t<previous)throw new Error('Arrival ticks must increase');loyalty=Math.min(max,loyalty+Math.floor(t/regenTicks)-Math.floor(previous/regenTicks));loyalty-=hit;previous=t;return loyalty;});
}

/** Compare saving with paying for a producer, including occupied construction time and all costs. */
export function fundingUpgrade(input:{stockMilli:Resources;incomeMilli:Resources;bill:Resources;upgradeCost:Resources;ticks:number;resource:keyof Resources;newIncomeMilli:number}):{saveTicks:number;upgradeTicks:number;improves:boolean}{
 const keys=['timber','stone','iron'] as const;
 const wait=(stock:Resources,rates:Resources)=>Math.max(0,...keys.map(r=>stock[r]>=input.bill[r]*1000?0:rates[r]>0?Math.ceil((input.bill[r]*1000-stock[r])/rates[r]):Infinity));
 const saveTicks=wait(input.stockMilli,input.incomeMilli);
 if(keys.some(r=>input.stockMilli[r]<input.upgradeCost[r]*1000)||input.newIncomeMilli<=input.incomeMilli[input.resource])return {saveTicks,upgradeTicks:Infinity,improves:false};
 const after=Object.fromEntries(keys.map(r=>[r,input.stockMilli[r]-input.upgradeCost[r]*1000+input.incomeMilli[r]*input.ticks])) as Resources;
 const rates={...input.incomeMilli,[input.resource]:input.newIncomeMilli};
 const upgradeTicks=input.ticks+wait(after,rates);
 return {saveTicks,upgradeTicks,improves:upgradeTicks<saveTicks};
}
