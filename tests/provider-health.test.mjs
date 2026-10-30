import test from 'node:test';
import assert from 'node:assert/strict';
import {mapboxHealthReport,TEST_ROUTE} from '../provider-health.mjs';
test('never claims token success on HTTP 401 or 403',()=>{
 assert.equal(mapboxHealthReport(401,{}).code,'unauthorized');
 assert.equal(mapboxHealthReport(403,{}).code,'forbidden');
 assert.equal(mapboxHealthReport(429,{code:'TooManyRequests'}).ok,false);
});
test('valid route response with real congestion annotation is distinguished',()=>{
 const payload={code:'Ok',routes:[{duration:3600,distance:65000,legs:[{annotation:{congestion:['low','heavy','unknown']}}]}]};
 assert.deepEqual(mapboxHealthReport(200,payload),{ok:true,code:'ok',routes:1,trafficCoverage:true,shortestMinutes:60});
});
test('missing traffic data is NOT reported as traffic coverage',()=>{
 const payload={code:'Ok',routes:[{duration:1200,distance:10000,legs:[{annotation:{congestion:['unknown']}}]}]};
 assert.equal(mapboxHealthReport(200,payload).trafficCoverage,false);
 assert.equal(mapboxHealthReport(200,{code:'Ok',routes:[]}).ok,false);
 assert.ok(TEST_ROUTE.from[0]>50&&TEST_ROUTE.to[0]<60);
});
