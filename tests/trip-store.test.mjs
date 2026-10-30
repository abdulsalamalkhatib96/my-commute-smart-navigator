import test from 'node:test';import assert from 'node:assert/strict';
import {validTrip,exportTrips,csvTrips,importTrips,readTrips,saveTrip,clearTrips} from '../trip-store.mjs';
globalThis.localStorage={data:new Map(),getItem(k){return this.data.get(k)??null},setItem(k,v){this.data.set(k,v)},removeItem(k){this.data.delete(k)}};
const sample={id:'x',destination:'home',startAt:'2026-10-30T05:00:00Z',endAt:'2026-10-30T06:00:00Z',durationSeconds:3600,distanceMeters:50000,initialEtaSeconds:3700};
test('invalid trips rejected',()=>{assert.equal(validTrip(sample),true);assert.equal(validTrip({...sample,durationSeconds:NaN}),false)});
test('trip save deduplicates by id',()=>{saveTrip(sample);saveTrip(sample);assert.equal(readTrips().length,1)});
test('export and import round-trip, malformed input is rejected',()=>{
  const encoded=exportTrips(readTrips());clearTrips();assert.equal(importTrips(encoded),1);
  assert.throws(()=>importTrips('{"trips":[{}],"version":1}'));
});
test('CSV safely quotes formula injection',()=>{
  const out=csvTrips([{...sample,id:'=SUM(A1)'}]);assert.ok(out.includes("'=SUM"));
});
