import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSettings,fuelCost,rankScore,chooseRoute,routeSimilarity,tripStats,departureBuckets,median} from '../decision-core.mjs';
const mk=(minutes,km,road)=>({duration:minutes*60,distance:km*1000,legs:[{steps:[{name:road},{name:'Ajman road'}]}],geometry:{coordinates:[[55,25],[56,26]]}});
test('settings reject invalid and hostile numeric inputs',()=>{
  assert.equal(normalizeSettings({litersPer100km:-3}).litersPer100km,8.5);
  assert.equal(normalizeSettings({mode:'invalid'}).mode,'balanced');
});
test('fuel cost excludes unknown tolls',()=>assert.ok(Math.abs(fuelCost(mk(50,100,'E611'),normalizeSettings({litersPer100km:8,fuelPriceAED:2.5}))-20)<.001));
test('fast and balanced routing have different decision models',()=>{
  assert.ok(rankScore(mk(20,40,'E311'),normalizeSettings({mode:'fast'}))<rankScore(mk(40,20,'E611'),normalizeSettings({mode:'fast'})));
  assert.ok(rankScore(mk(20,40,'E311'),normalizeSettings({mode:'economy'}))>rankScore(mk(40,20,'E611'),normalizeSettings({mode:'economy'})));
});
test('similar routes match even when near-start minor segments change',()=>assert.equal(routeSimilarity(mk(50,20,'E611'),mk(51,21,'E611')),1));
test('hysteresis suppresses 1-minute churn',()=>{
  const previous=mk(61,60,'E611');const arr=[mk(60,59,'E311'),mk(61,60,'E611')];
  assert.equal(chooseRoute(arr,previous,null,normalizeSettings({mode:'fast'})).index,1);
});
test('route upgrade requires confirmation over two polls',()=>{
  const previous=mk(70,60,'E611');const arr=[mk(58,55,'E311'),mk(70,60,'E611')];
  const first=chooseRoute(arr,previous,null,normalizeSettings({mode:'fast'}));
  assert.equal(first.index,1);assert.equal(first.reason,'confirming');
  const second=chooseRoute(arr,arr[first.index],first.pending,normalizeSettings({mode:'fast'}));
  assert.equal(second.index,0);assert.equal(second.reason,'better-route');
});
test('median handles even and empty samples',()=>{assert.equal(median([4,2]),3);assert.equal(median([]),null)});
test('trip statistics and historic departure buckets never assume traffic data',()=>{
  const trips=Array.from({length:3},(_,i)=>({id:String(i),destination:'home',startAt:`2026-10-26T17:0${i}:00`,durationSeconds:3600+i*60,distanceMeters:60000,initialEtaSeconds:3500,endAt:'2026-10-26T18:00:00'}));
  assert.equal(tripStats(trips,'home').count,3);
  assert.equal(departureBuckets(trips,'home').length,1);
});

test('routes with only common destination road do not match',()=>{
  assert.ok(routeSimilarity(mk(50,20,'E611'),mk(50,20,'E311'))<.67);
});
test('economy mode can select slower route with material fuel savings after confirmation',()=>{
  const current=mk(46,90,'E311'), cheaper=mk(52,55,'E611');
  const settings=normalizeSettings({mode:'economy'});
  const a=[current,cheaper];
  const first=chooseRoute(a,current,null,settings);
  assert.equal(first.index,0);assert.equal(first.reason,'confirming');
  const second=chooseRoute(a,current,first.pending,settings);
  assert.equal(second.index,1);
});
