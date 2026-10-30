import test from 'node:test';
import assert from 'node:assert/strict';
import {salikRateAt,estimateSalik,dubaiLocalParts} from '../salik-core.mjs';
const at=(day,h,m='00')=>new Date(`${day}T${h}:${m}:00+04:00`);
test('Dubai standard peak and off-peak rate',()=>{
 assert.equal(salikRateAt(at('2026-10-30','07')),6);
 assert.equal(salikRateAt(at('2026-10-30','12')),4);
 assert.equal(salikRateAt(at('2026-10-30','18')),6);
 assert.equal(salikRateAt(at('2026-10-30','20')),4);
});
test('Sunday off-peak and early hours free',()=>{
 assert.equal(salikRateAt(at('2026-11-01','08')),4);
 assert.equal(salikRateAt(at('2026-11-01','03')),0);
});
test('Unverified Ramadan schedule explicitly unknown',()=>{
 assert.equal(salikRateAt(at('2026-10-30','07'),{ramadan:true}),null);
 assert.equal(estimateSalik(2,at('2026-10-30','07'),{ramadan:true}),null);
});
test('Manual crossing number bounded, timezone explicit',()=>{
 assert.deepEqual(estimateSalik(2,at('2026-10-30','07')),{rate:6,crossings:2,aed:12});
 assert.equal(estimateSalik(-1,new Date()),null);
 assert.equal(estimateSalik(1.5,new Date()),null);
 assert.equal(dubaiLocalParts('invalid'),null);
});
