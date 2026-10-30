import test from 'node:test';
import assert from 'node:assert/strict';
import {LIMITS,budgetDay,normalizeBudget,reserveBudget} from '../api-budget.mjs';
test('Dubai day key resets across midnight',()=>{
 assert.equal(budgetDay('2026-10-30T19:59:00Z'),'2026-10-30');
 assert.equal(budgetDay('2026-10-30T20:01:00Z'),'2026-10-31');
});
test('atomic reserve rejects limit without changing counts',()=>{
 const date=new Date('2026-10-30T12:00:00Z');
 const start={day:'2026-10-30',counts:{routing:239,search:0,forecast:0}};
 const denied=reserveBudget(start,'routing',2,date);
 assert.equal(denied.allowed,false);assert.equal(denied.ledger.counts.routing,239);
 const accepted=reserveBudget(start,'routing',1,date);
 assert.equal(accepted.allowed,true);assert.equal(accepted.remaining,0);
 assert.equal(start.counts.routing,239);
});
test('forecast batch reservation and daily reset',()=>{
 const now='2026-10-30T12:00:00Z';
 const initial=reserveBudget(null,'forecast',4,now);assert.equal(initial.ledger.counts.forecast,4);
 const reset=normalizeBudget(initial.ledger,'2026-10-31T12:00:00Z');
 assert.equal(reset.counts.forecast,0);
 assert.equal(LIMITS.forecast,20);
});
test('invalid and tampered budget does not allow extra daily credit',()=>{
 assert.throws(()=>reserveBudget(null,'bad',1));
 assert.throws(()=>reserveBudget(null,'routing',0));
 assert.equal(normalizeBudget({day:'2026-10-30',counts:{routing:-5}},'2026-10-30T12:00:00Z').counts.routing,0);
});
