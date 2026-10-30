import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_REMINDERS,parseReminderSettings,dubaiDateAndMinute,dueReminders} from '../reminder-core.mjs';
test('reminders disabled by default; invalid values normalized',()=>{
 assert.deepEqual(dueReminders(DEFAULT_REMINDERS,new Date('2026-10-30T02:30:00Z')),[]);
 const r=parseReminderSettings({enabled:true,workTime:'25:99',homeTime:'12:05'});
 assert.equal(r.workTime,'06:30');assert.equal(r.homeTime,'12:05');assert.equal(r.enabled,true);
});
test('Dubai time determines scheduled reminders independent of local machine timezone',()=>{
 const t=new Date('2026-10-30T02:30:00Z');
 assert.deepEqual(dubaiDateAndMinute(t),{day:'2026-10-30',minutes:390});
 const due=dueReminders({enabled:true,workTime:'06:30',homeTime:'17:00'},t);
 assert.equal(due.length,1);assert.equal(due[0].destination,'work');
 assert.deepEqual(dueReminders({enabled:true,workTime:'06:30'},t,[due[0].key]),[]);
});
test('grace period is five minutes, never late-day replay',()=>{
 const set={enabled:true,workTime:'06:30',homeTime:'17:00'};
 assert.equal(dueReminders(set,new Date('2026-10-30T02:34:59Z')).length,1);
 assert.equal(dueReminders(set,new Date('2026-10-30T02:35:00Z')).length,0);
 assert.equal(dueReminders(set,new Date('2026-10-30T12:59:00Z')).length,0);
});
