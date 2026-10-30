import test from 'node:test';
import assert from 'node:assert/strict';
import {compareTotalRouteCosts} from '../route-cost-core.mjs';
const settings={litersPer100km:10,fuelPriceAED:3};
const routes=[{distance:40000},{distance:50000}];
const date='2026-10-30T07:00:00+04:00';
test('total route cost combines known fuel + user-supplied VAT-inclusive Salik',()=>{
 const r=compareTotalRouteCosts(routes,[2,0],settings,date);
 assert.equal(r.complete,true);
 assert.deepEqual(r.items.map(x=>x.totalAED),[24.6,15]);
 assert.equal(r.cheapest.index,1);
});
test('unknown gate count never silently becomes zero or cheapest',()=>{
 const r=compareTotalRouteCosts(routes,[null,0],settings,date);
 assert.equal(r.complete,false);assert.equal(r.cheapest,null);
 assert.equal(r.items[0].totalAED,null);
 assert.equal(r.items[1].tollAED,0);
});
test('invalid counts and Ramadan do not create fabricated totals',()=>{
 assert.equal(compareTotalRouteCosts(routes,[-1,0],settings,date).complete,false);
 assert.equal(compareTotalRouteCosts(routes,[1,2],settings,date,{ramadan:true}).complete,false);
 assert.equal(compareTotalRouteCosts(routes,[],settings,date).complete,false);
});
