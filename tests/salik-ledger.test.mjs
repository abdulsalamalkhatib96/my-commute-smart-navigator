import test from 'node:test';
import assert from 'node:assert/strict';
import {priceCrossings,priceChargedCount,SALIK_GATES} from '../salik-ledger.mjs';
const at=(day,h,m='00')=>`${day}T${h}:${m}:00+04:00`;
const e=(gate,direction,time)=>({gate,direction,at:time});
test('June 2026 5% VAT yields 6.30 peak and 4.20 off peak in Dubai',()=>{
 assert.deepEqual(priceChargedCount(2,at('2026-10-30','07')),{count:2,rate:6,baseAED:12,vatAED:.6,totalAED:12.6});
 assert.equal(priceChargedCount(1,at('2026-10-30','12')).totalAED,4.2);
 assert.equal(priceChargedCount(1,at('2026-03-30','07')).totalAED,6);
 assert.equal(priceChargedCount(1,at('2026-10-30','03')).totalAED,0);
});
test('same-direction paired gates in one hour count as one charge',()=>{
 const input=[e('safa-n','north',at('2026-10-30','07','50')),e('safa-s','north',at('2026-10-30','08','12'))];
 const r=priceCrossings(input);
 assert.equal(r.totalAED,6.3);assert.equal(r.discounted,1);assert.equal(r.charged,1);
});
test('opposite direction, mismatched pairs, >one hour pay independently',()=>{
 const start=e('mamzar-n','north',at('2026-10-30','07','00'));
 assert.equal(priceCrossings([start,e('mamzar-s','south',at('2026-10-30','07','10'))]).totalAED,12.6);
 assert.equal(priceCrossings([start,e('mamzar-s','north',at('2026-10-30','08','01'))]).totalAED,12.6);
 assert.equal(priceCrossings([start,e('airport','north',at('2026-10-30','07','10'))]).totalAED,12.6);
});
test('one charge cannot exempt an unlimited number of repeated gates',()=>{
 const rows=[e('safa-n','north',at('2026-10-30','07','00')),e('safa-s','north',at('2026-10-30','07','05')),e('safa-s','north',at('2026-10-30','07','10'))];
 assert.equal(priceCrossings(rows).totalAED,12.6);
});
test('invalid, unknown or Ramadan crossings never silently become zero',()=>{
 assert.equal(priceCrossings([e('fake','north',at('2026-10-30','07'))]),null);
 assert.equal(priceCrossings([e('safa-n','north','invalid')]),null);
 assert.equal(priceCrossings([e('safa-n','north',at('2026-10-30','07'))],{ramadan:true}),null);
 assert.equal(priceChargedCount(-1,new Date()),null);
 assert.equal(Object.keys(SALIK_GATES).length,10);
});
