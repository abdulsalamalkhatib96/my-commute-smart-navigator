import test from 'node:test';
import assert from 'node:assert/strict';
import {validGpsTimestamp,routeCooldownMs} from '../gps-policy.mjs';
test('rejects stale/future GPS timestamps without resetting last accepted fix',()=>{
 const now=1000000;
 assert.equal(validGpsTimestamp(now-1000,0,now),true);
 assert.equal(validGpsTimestamp(now-31000,0,now),false);
 assert.equal(validGpsTimestamp(now+6000,0,now),false);
 assert.equal(validGpsTimestamp(now-1000,now-100,now),false);
 assert.equal(validGpsTimestamp(NaN,0,now),false);
});
test('confirmed deviation reroutes earlier without removing cooldown',()=>{
 assert.equal(routeCooldownMs(false),35000);
 assert.equal(routeCooldownMs(true),8000);
 assert.ok(routeCooldownMs(true)>0);
});
