import test from 'node:test';
import assert from 'node:assert/strict';
import {haversine,isValidCoordinate,nearestOnLine,progressOnSteps,laneSummary,routeIsPlausible} from '../nav-core.mjs';

test('haversine is zero for equal positions',()=>assert.equal(haversine([55,25],[55,25]),0));
test('haversine correctly estimates 1 degree latitude',()=>assert.ok(Math.abs(haversine([55,25],[55,26])-111195)<100));
test('coordinate validation rejects malformed coordinates',()=>{
  assert.equal(isValidCoordinate([55,25]),true);
  assert.equal(isValidCoordinate([25,200]),false);
  assert.equal(isValidCoordinate(['55',25]),false);
});
test('nearestOnLine reports remaining meters and lateral distance',()=>{
  const nearest=nearestOnLine([55,25.005],[[55,25],[55,25.01]]);
  assert.ok(nearest.lateralMeters<1);
  assert.ok(nearest.remainingMeters>500 && nearest.remainingMeters<600);
});
test('progressOnSteps uses closest step',()=>{
  const steps=[{geometry:{coordinates:[[55,25],[55,25.01]]}},
    {geometry:{coordinates:[[55,25.01],[55.01,25.01]]}}];
  assert.equal(progressOnSteps([55.008,25.01],steps).stepIndex,1);
});
test('lane guidance only reports valid maneuver lanes',()=>{
  const step={intersections:[{lanes:[{valid:false,indications:['left']},{valid:true,indications:['straight']}]}]};
  assert.deepEqual(laneSummary(step).map(l=>l.valid),[false,true]);
  assert.equal(laneSummary({intersections:[]}),null);
});
test('route validation does not accept empty or zero-duration routes',()=>{
  assert.equal(routeIsPlausible({duration:500,distance:1234,geometry:{coordinates:[[55,25],[56,26]]}}),true);
  assert.equal(routeIsPlausible({duration:0,distance:1234,geometry:{coordinates:[[55,25],[56,26]]}}),false);
});
