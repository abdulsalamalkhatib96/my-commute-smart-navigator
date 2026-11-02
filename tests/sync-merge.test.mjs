import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeTripHistories} from '../sync-merge.mjs';
const base={id:'trip-1',destination:'home',startAt:'2026-11-02T05:00:00Z',endAt:'2026-11-02T06:00:00Z',durationSeconds:3600,distanceMeters:50000,initialEtaSeconds:3700,completed:true};
test('different trips merge, same trip deduplicates and remains deterministic',async()=>{
 const x={...base,id:'second',destination:'work'};
 const r=await mergeTripHistories([base],[base,x]);
 assert.equal(r.trips.length,2);assert.equal(r.conflicts.length,0);
});
test('same ID with different content preserves BOTH, never overwrites',async()=>{
 const conflict={...base,durationSeconds:3800};
 const r=await mergeTripHistories([base],[conflict]);
 assert.equal(r.trips.length,2);assert.equal(r.conflicts.length,1);
 assert.equal(r.trips.find(t=>t.id==='trip-1').durationSeconds,3600);
 assert.equal(r.trips.find(t=>t.id!==base.id).durationSeconds,3800);
 const again=await mergeTripHistories(r.trips,[conflict]);
 assert.deepEqual(again.trips,r.trips);
});
test('capacity overflow is fatal, never discards oldest trips silently',async()=>{
 const local=Array.from({length:30},(_,i)=>({...base,id:'L'+i}));
 await assert.rejects(mergeTripHistories(local,[{...base,id:'extra'}],{max:30}),/تتجاوز حد الحفظ/);
});
test('malformed and duplicate remote trips cannot be merged',async()=>{
 await assert.rejects(mergeTripHistories([base],[{...base,initialEtaSeconds:NaN}]));
 await assert.rejects(mergeTripHistories([],[base,base]));
});

test('full supported capacity preserves the union when former preference was 180',async()=>{
 const local=Array.from({length:180},(_,i)=>({...base,id:'local-'+i}));
 const remote=Array.from({length:80},(_,i)=>({...base,id:'remote-'+i}));
 const r=await mergeTripHistories(local,remote,{max:365});
 assert.equal(r.trips.length,260);
});
