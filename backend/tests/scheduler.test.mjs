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
