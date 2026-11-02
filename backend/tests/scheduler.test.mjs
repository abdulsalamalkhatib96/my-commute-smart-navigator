import test from 'node:test';
import assert from 'node:assert/strict';
import {runTick} from '../src/scheduler.mjs';
const subscription={endpoint:'https://fcm.googleapis.com/fcm/send/a'};
test('push tick is idempotent when database enforces uniqueness',async()=>{
 let delivered=0;const history=new Set();
 const db={async query(sql,args=[]){
  if(sql.startsWith('SELECT id,payload'))return {rows:[{id:'a',payload:subscription,enabled:true,work_time:'06:30',home_time:'17:00'}]};
  if(sql.startsWith('INSERT INTO deliveries')){const k=args.join(':');if(history.has(k))return {rows:[]};history.add(k);return {rows:[{subscription_id:'a'}]};}
  if(sql.startsWith('DELETE FROM deliveries'))return {rows:[]};
  throw Error('unexpected query');
 }};
 const push={async sendNotification(){delivered++}};
 assert.equal((await runTick({db,webPush:push,now:new Date('2026-11-02T02:30:00Z')})).sent,1);
 assert.equal((await runTick({db,webPush:push,now:new Date('2026-11-02T02:30:20Z')})).sent,0);
 assert.equal(delivered,1);
});

test('scheduler uses grace window and never duplicates the same daily reminder',async()=>{
 let count=0;
 const records=new Set();
 const db={async query(sql,args=[]){
  if(sql.startsWith('SELECT id,payload'))return {rows:[{id:'abc',payload:subscription,enabled:true,work_time:'06:30',home_time:'17:00'}]};
  if(sql.startsWith('INSERT INTO deliveries')){
   const key=args.join(':');if(records.has(key))return {rows:[]};
   records.add(key);return {rows:[{subscription_id:'abc'}]};
  }
  if(sql.startsWith('DELETE FROM deliveries'))return {rows:[]};
  throw Error('unexpected db call');
 }};
 const webPush={async sendNotification(){count++}};
 const first=await runTick({db,webPush,now:new Date('2026-11-02T02:33:00Z')});
 const second=await runTick({db,webPush,now:new Date('2026-11-02T02:34:00Z')});
 assert.equal(first.sent,1);assert.equal(second.sent,0);assert.equal(count,1);
});
