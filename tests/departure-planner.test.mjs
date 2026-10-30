import test from 'node:test';
import assert from 'node:assert/strict';
import {predictedRouteUrl,departureOptions,departureComparison} from '../departure-planner.mjs';
const a=[55.1,25.1],b=[55.4,25.4];
test('future directions request is prediction without incompatible annotations',()=>{
 const u=new URL(predictedRouteUrl(a,b,'pk.sample','2026-10-30T13:00:00Z',{avoidTolls:true}));
 assert.equal(u.searchParams.get('depart_at'),'2026-10-30T13:00:00Z');
 assert.equal(u.searchParams.get('exclude'),'toll');
 assert.equal(u.searchParams.get('overview'),'false');
 assert.equal(u.searchParams.get('steps'),'false');
 assert.equal(u.searchParams.has('annotations'),false);
});
test('forecast keeps waiting and drive time separate',()=>{
 const input=[{offsetMinutes:0,durationSeconds:3600},{offsetMinutes:30,durationSeconds:1800},{offsetMinutes:60,durationSeconds:1600}];
 const options=departureOptions(input,new Date('2026-10-30T12:00:00Z'));
 const result=departureComparison(options);
 assert.equal(result.fastest.offsetMinutes,60);
 assert.equal(result.earliestArrival.offsetMinutes,0);
 assert.equal(result.drivingSavingSeconds,2000);
 assert.equal(result.arrivalDelaySeconds,1600);
});
test('failed or non-finite predictions never produce invented durations',()=>{
 assert.deepEqual(departureOptions([{offsetMinutes:15,durationSeconds:NaN},{offsetMinutes:25,durationSeconds:20}]),[]);
 assert.equal(departureComparison([]),null);
 assert.throws(()=>predictedRouteUrl(a,b,'pk.sample','not-a-date'));
});
