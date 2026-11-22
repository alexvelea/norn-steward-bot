import type {Resources, VillageState} from '../shared/api.js';
import type {AdvisorContext, Proposal} from './types.js';
import {cityRoles} from '../bot/strategy/roles.js';

const resources=['timber','stone','iron'] as const;
const reserve=1000;

export function envoyFunding(context:AdvisorContext,capital:VillageState,goal=1):Proposal[]{
 const {state}=context;
 const option=capital.options.train.find(value=>value.unit==='envoy');
 const queued=capital.training.court.filter(batch=>batch.unit==='envoy').reduce((sum,batch)=>sum+batch.remaining,0);
 const missing=Math.max(0,goal-(capital.units.home.envoy??0)-(capital.units.away.envoy??0)-queued);
 if(!option||!missing||state.world.status!=='running')return [];
 const deficit=Object.fromEntries(resources.map(resource=>[resource,Math.max(0,
  Math.min(capital.storage,option.cost[resource]*missing)-Math.floor(capital.resourcesMilli[resource]/1000))])) as Resources;
 const inbound=state.trades.incoming.filter(trade=>trade.to.id===capital.id&&!trade.returning&&trade.arrivalTick>=state.world.tick);
 for(const trade of inbound)for(const resource of resources)deficit[resource]=Math.max(0,deficit[resource]-trade.resources[resource]);
 const active=context.activeProposals??[];
 for(const proposal of active){
  const action=proposal.action;
  if(action.type==='trade'&&action.target===capital.id&&!inbound.some(trade=>trade.from.id===action.village))
   for(const resource of resources)deficit[resource]=Math.max(0,deficit[resource]-(action.resources[resource]??0));
 }
 if(!resources.some(resource=>deficit[resource]>0))return [];
 const roles=context.cityRoles??cityRoles(context,[]);
 const cities=state.villages.filter(city=>roles.get(city.id)?.role==='economic'&&
  !Object.values(city.orders).some(orders=>orders.length)&&
  !active.some(proposal=>proposal.action.type==='trade'&&proposal.action.village===city.id))
  .map(city=>({city,surplus:Object.fromEntries(resources.map(resource=>[resource,
   Math.max(0,Math.floor(city.resourcesMilli[resource]/1000)-reserve)])) as Resources}))
  .sort((a,b)=>resources.reduce((sum,r)=>sum+b.surplus[r]-a.surplus[r],0)||a.city.id.localeCompare(b.city.id));
 const market=context.rules.rules.MARKET as {merchantCarry:number;merchantSpeed:number};
 const proposals:Proposal[]=[];
 for(const {city,surplus} of cities){
  const travel=Math.max(1,Math.ceil(Math.hypot(city.x-capital.x,city.y-capital.y)*market.merchantSpeed));
  if(state.world.tick+travel+60>=state.world.endsAtTick)continue;
  const available=resources.reduce((sum,r)=>sum+Math.min(surplus[r],deficit[r]),0);
  if(!available)continue;
  const wanted=Math.min(13,Math.ceil(available/market.merchantCarry));
  const build=city.options.build.find(value=>value.building==='market');
  if(city.merchants.total<wanted&&build&&!city.buildQueue.length&&
   build.blockers.every(blocker=>blocker==='INSUFFICIENT_RESOURCES')&&
   state.world.tick+build.ticks+travel+60<state.world.endsAtTick){
   const blockers:string[]=[...build.blockers];
   if(resources.some(r=>city.resourcesMilli[r]<build.cost[r]*1000)&&!blockers.includes('INSUFFICIENT_RESOURCES'))blockers.push('INSUFFICIENT_RESOURCES');
   if((state.player.nextActTick??0)>state.world.tick)blockers.push('COUNCIL_COOLDOWN');
   proposals.push({id:`${state.world.epoch}:${city.id}:envoy-market:${build.level}`,task:'econ.market',advisor:'conquest',villageId:city.id,villageName:city.name,
    action:{type:'build',village:city.id,building:'market'},buildingName:'Envoy funding Market',currentLevel:city.buildings.market,targetLevel:build.level,
    importance:96,reason:'Expand economic-city merchants to fund the preparing conquest; retain 1000 of each resource.',requirements:build.cost,blockers,
    status:blockers.length?'waiting':'ready',affordableAtTick:build.affordableAtTick});
  }
  let capacity=city.merchants.available*market.merchantCarry;
  if(!city.buildings.market||capacity<=0)continue;
  const shipment={timber:0,stone:0,iron:0};
  for(const resource of [...resources].sort((a,b)=>deficit[b]-deficit[a])){
   shipment[resource]=Math.min(capacity,surplus[resource],deficit[resource]);
   deficit[resource]-=shipment[resource];capacity-=shipment[resource];
  }
  if(!resources.some(resource=>shipment[resource]))continue;
  const blockers:string[]=[];
  if((state.player.nextActTick??0)>state.world.tick)blockers.push('COUNCIL_COOLDOWN');
  proposals.push({id:`${state.world.epoch}:${city.id}:envoy-funding:${shipment.timber}:${shipment.stone}:${shipment.iron}`,task:'econ.surplus',advisor:'conquest',
   villageId:city.id,villageName:city.name,action:{type:'trade',village:city.id,target:capital.id,resources:shipment},
   buildingName:'Fund conquest Envoys',currentLevel:0,targetLevel:0,importance:95,
   reason:'Ship the preparing mission’s Envoy deficit, richest surplus first; lower the city reserve to 1000 per resource.',requirements:shipment,
   blockers,status:blockers.length?'waiting':'ready',affordableAtTick:null,requestRank:proposals.length});
 }
 return proposals;
}
