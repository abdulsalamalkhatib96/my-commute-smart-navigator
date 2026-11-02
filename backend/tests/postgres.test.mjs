import test from 'node:test';
import assert from 'node:assert/strict';
import {database,migrate,getSnapshot,putSnapshot,putSubscription,getSubscriptions,reserveDelivery,releaseDelivery,removeSubscription} from '../src/store.mjs';
const url=process.env.DATABASE_URL;
test('real PostgreSQL CAS, encrypted record and idempotent push delivery',{skip:!url},async()=>{
 const db=database(url);
 const envelope={type:'my-commute-encrypted',version:1,kdf:'PBKDF2-SHA256',cipher:'AES-256-GCM',iterations:210000,salt:'a'.repeat(24),iv:'b'.repeat(16),data:'c'.repeat(48)};
 try{
  await migrate(db);
  await db.query('TRUNCATE TABLE deliveries,subscriptions,private_snapshot');
  assert.equal((await getSnapshot(db)).revision,0);
  assert.equal(await putSnapshot(db,0,envelope),1);
  assert.equal(await putSnapshot(db,0,envelope),null);
  assert.equal(await putSnapshot(db,1,envelope),2);
  assert.equal(await putSnapshot(db,1,envelope),null);
  assert.deepEqual((await getSnapshot(db)).envelope,envelope);
  const sub={endpoint:'https://fcm.googleapis.com/fcm/send/testing',keys:{auth:'abcdefghijk',p256dh:'A'.repeat(80)}};
  const id=await putSubscription(db,sub,{enabled:true,workTime:'06:30',homeTime:'17:00'});
  assert.equal((await getSubscriptions(db)).length,1);
  assert.equal(await reserveDelivery(db,id,'2026-11-02','work'),true);
  assert.equal(await reserveDelivery(db,id,'2026-11-02','work'),false);
  await releaseDelivery(db,id,'2026-11-02','work');
  assert.equal(await reserveDelivery(db,id,'2026-11-02','work'),true);
  await removeSubscription(db,sub.endpoint);
  assert.equal((await getSubscriptions(db)).length,0);
 }finally{await db.end();}
});
