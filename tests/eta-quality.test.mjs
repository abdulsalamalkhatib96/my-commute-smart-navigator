import test from 'node:test';
import assert from 'node:assert/strict';
import {etaCalibration,adjustedEtaSeconds} from '../eta-quality.mjs';
const t=(duration,expected,completed=true,destination='home')=>({durationSeconds:duration,initialEtaSeconds:expected,completed,destination});
test('never calibrate from unfinished or legacy ambiguous trips',()=>{
 const trips=[t(3600,2400,false),t(4500,3000),t(4600,3100),t(4300,3000),t(4200,3100)];
 assert.equal(etaCalibration(trips,'home').status,'insufficient');
 assert.equal(adjustedEtaSeconds(2000,etaCalibration(trips,'home')),null);
});
test('bias and dispersion use median and MAD for outlier robustness',()=>{
 const trips=[t(2100,1800),t(1980,1800),t(2040,1800),t(2160,1800),t(2200,1800),t(7200,1800)];
 const result=etaCalibration(trips,'home');
 assert.equal(result.status,'observed');
 assert.equal(result.samples,6);
 assert.ok(result.biasSeconds>=240&&result.biasSeconds<=400);
 assert.ok(result.bufferMinutes>=3);
 assert.equal(adjustedEtaSeconds(1800,result),Math.round(1800+result.biasSeconds));
});
test('different destination not mixed and bogus trips excluded',()=>{
 const input=[t(2000,1800,true,'home'),t(2100,1800,true,'work'),t(2200,1800,true,'home')];
 assert.equal(etaCalibration(input,'home').samples,2);
 assert.equal(etaCalibration(input,'work').samples,1);
 assert.equal(etaCalibration(null,'work').samples,0);
});
