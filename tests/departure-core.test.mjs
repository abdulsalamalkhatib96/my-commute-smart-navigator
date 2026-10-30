import test from 'node:test';
import assert from 'node:assert/strict';
import {historicalDepartureAdvice,formatHistoricalAdvice} from '../departure-core.mjs';
const trip=(startAt,durationSeconds,destination='home')=>({startAt,durationSeconds,destination});
const t=[
 trip('2026-10-09T17:00:00+04:00',4000),trip('2026-10-16T17:20:00+04:00',4200),trip('2026-10-23T17:45:00+04:00',4100),
 trip('2026-10-09T18:00:00+04:00',3500),trip('2026-10-16T18:20:00+04:00',3600),trip('2026-10-23T18:45:00+04:00',3700),
 trip('2026-10-30T18:00:00+04:00',10),trip('2026-10-08T18:00:00+04:00',1000)
];
test('Historical sample floor, Dubai weekday, median',()=>{
 const a=historicalDepartureAdvice(t,'home',new Date('2026-10-30T17:05:00+04:00'));
 assert.equal(a.length,2);
 assert.equal(a[0].medianSeconds,4100);
 assert.equal(a[1].medianSeconds,3600);
 assert.equal(a[1].samples,3);
});
test('Never invent real-time traffic or cross-midnight observations',()=>{
 assert.deepEqual(historicalDepartureAdvice(t,'work',new Date('2026-10-30T17:00:00+04:00')),[]);
 assert.deepEqual(historicalDepartureAdvice(t,'home',new Date('2026-10-30T23:00:00+04:00')),[]);
 assert.match(formatHistoricalAdvice([]),/لا توجد/);
 assert.match(formatHistoricalAdvice(historicalDepartureAdvice(t,'home',new Date('2026-10-30T17:00:00+04:00'))),/الانتظار قد يؤخر الوصول/);
});
