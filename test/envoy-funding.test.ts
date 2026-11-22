import assert from 'node:assert/strict';
import {test} from 'node:test';
import {envoyFunding} from '../src/advisors/conquest-funding.js';
import {applyConquest} from '../src/advisors/conquest.js';
import {context} from './control-fixtures.js';

function fixture(){
 const c=context(),capital=c.state.villages[0];
 capital.storage=50000;capital.resourcesMilli={timber:0,stone:0,iron:0};
 capital.options.train=[{unit:'envoy',cost:{timber:6000,stone:7500,iron:6500},ticksEach:75,pop:40,maxCount:0,ok:false,blockers:['INSUFFICIENT_RESOURCES'],affordableAtTick:null}];
 const city=structuredClone(capital);city.id='city';city.buildings.market=5;
 city.merchants={total:13,available:13};city.resourcesMilli={timber:9000000,stone:9000000,iron:9000000};
 c.state.villages.push(city);
 return {c,capital,city};
}
test('richest surplus funds the deficit first, retaining 1000 and bounding merchant capacity',()=>{
 const {c,capital,city}=fixture();const rich=structuredClone(city);rich.id='rich';rich.resourcesMilli={timber:12000000,stone:12000000,iron:12000000};c.state.villages.push(rich);
 const trades=envoyFunding(c,capital).filter(p=>p.action.type==='trade');
 assert.equal(trades[0].villageId,'rich');assert.equal(trades[0].requestRank,0);
 for(const resource of ['timber','stone','iron'] as const)assert.equal(trades.reduce((sum,p)=>sum+p.requirements[resource],0),capital.options.train[0].cost[resource]);
 for(const p of trades)assert.ok(Object.values(p.requirements).reduce((a,b)=>a+b,0)<=13000);
});
test('no duplicate funding when funded, owned, queued, incoming or journalled',()=>{
 const {c,capital,city}=fixture();
 const run=()=>envoyFunding(c,capital);
 capital.units.home.envoy=1;assert.deepEqual(run(),[]);capital.units.home.envoy=0;
 capital.training.court=[{unit:'envoy',remaining:1} as any];assert.deepEqual(run(),[]);capital.training.court=[];
 c.state.trades.incoming=[{from:{id:city.id},to:{id:capital.id},returning:false,arrivalTick:120,resources:{timber:6000,stone:7500,iron:6500}} as any];assert.deepEqual(run(),[]);
 c.state.trades.incoming=[];
 const active={action:{type:'trade',village:city.id,target:capital.id,resources:{timber:6000,stone:7500,iron:6500}}} as any;
 assert.deepEqual(envoyFunding({...c,activeProposals:[active]},capital),[]);
 capital.resourcesMilli={timber:6000000,stone:7500000,iron:6500000};assert.deepEqual(run(),[]);
});
test('Market-less cities request a paid Market, unavailable merchants do not produce trades',()=>{
 const {c,capital,city}=fixture();city.buildings.market=0;city.merchants={total:0,available:0};
 const proposals=envoyFunding(c,capital);assert.equal(proposals.length,1);assert.equal(proposals[0].action.type,'build');
 city.buildings.market=5;city.merchants={total:13,available:0};assert.deepEqual(envoyFunding(c,capital),[]);
});
test('empty surplus, standing orders, ended worlds, missing options and late delivery are safe',()=>{
 for(const mutate of [
  (x:ReturnType<typeof fixture>)=>{x.city.resourcesMilli={timber:1000000,stone:1000000,iron:1000000};},
  (x:ReturnType<typeof fixture>)=>{x.city.orders.build=[{building:'farm',toLevel:2}];},
  (x:ReturnType<typeof fixture>)=>{x.c.state.world.status='ended';},
  (x:ReturnType<typeof fixture>)=>{x.capital.options.train=[];},
  (x:ReturnType<typeof fixture>)=>{x.c.state.world.endsAtTick=150;},
 ]){const x=fixture();mutate(x);assert.deepEqual(envoyFunding(x.c,x.capital),[]);}
 const {c,capital}=fixture();assert.deepEqual(applyConquest(c,[]),[]);
 assert.ok(applyConquest(c,[],{plan:{scope:'',villageId:capital.id,startedTick:100,status:'preparing',waves:0}}).some(p=>p.action.type==='trade'));
});
