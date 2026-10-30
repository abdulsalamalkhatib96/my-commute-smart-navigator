import test from 'node:test';
import assert from 'node:assert/strict';
import {dubaiArrival,alternativeSummary,trafficAge,exportProfile,importProfile} from '../web-experience.mjs';
test('route time difference compared to alternatives',()=>assert.deepEqual(alternativeSummary([{duration:3600},{duration:4200},{duration:5100}],1),{extraMinutes:10,savedMinutes:15}));
test('unknown traffic is not presented as fresh',()=>{assert.equal(trafficAge(0).state,'unknown');assert.equal(trafficAge(1000,181001).state,'stale');assert.equal(trafficAge(1000,30000).state,'fresh');});
test('arrival uses Asia/Dubai timezone regardless of server',()=>{
 assert.equal(dubaiArrival(3600,'2026-10-30T12:00:00Z'),new Intl.DateTimeFormat('ar-AE',{timeZone:'Asia/Dubai',hour:'2-digit',minute:'2-digit'}).format(new Date('2026-10-30T13:00:00Z')));
});
test('backup round trips without leaking tokens',()=>{
 const home={name:'home',coordinates:[55.4,25.4]};
 const json=exportProfile({home,settings:{mode:'fast'},avoidTolls:true,destination:'work',token:'pk.sensitive'});
 assert.equal(json.includes('pk.sensitive'),false);assert.deepEqual(importProfile(json).home,home);assert.equal(importProfile(json).settings.mode,'fast');
});
test('reject invalid coordinates and unsupported documents',()=>{
 assert.throws(()=>importProfile('no'));assert.throws(()=>importProfile('x'.repeat(200001)));
 const bad=JSON.parse(exportProfile());bad.home={name:'bad',coordinates:[400,0]};
 assert.throws(()=>importProfile(JSON.stringify(bad)));
});
