import pg from 'pg';
import {endpointHash} from './core.mjs';
export function database(url){
 if(!url)throw Error('DATABASE_URL is required');
 return new pg.Pool({connectionString:url,max:5,connectionTimeoutMillis:6000});
}
export async function migrate(db){
 await db.query(`CREATE TABLE IF NOT EXISTS private_snapshot(
  singleton SMALLINT PRIMARY KEY CHECK(singleton=1),
  revision INTEGER NOT NULL CHECK(revision>0),
  envelope JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
 await db.query(`CREATE TABLE IF NOT EXISTS subscriptions(
  id CHAR(64) PRIMARY KEY,
  payload JSONB NOT NULL,
  enabled BOOLEAN NOT NULL,
  work_time CHAR(5) NOT NULL,
  home_time CHAR(5) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
 await db.query(`CREATE TABLE IF NOT EXISTS deliveries(
  subscription_id CHAR(64) NOT NULL,
  day CHAR(10) NOT NULL,
  slot VARCHAR(10) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(subscription_id,day,slot))`);
}
export async function getSnapshot(db){
 const {rows}=await db.query('SELECT revision,envelope,updated_at FROM private_snapshot WHERE singleton=1');
 return rows[0]?{revision:rows[0].revision,envelope:rows[0].envelope,updatedAt:rows[0].updated_at}:{revision:0,envelope:null,updatedAt:null};
}
export async function putSnapshot(db,expected,envelope){
 if(expected===0){
  const result=await db.query('INSERT INTO private_snapshot(singleton,revision,envelope) VALUES(1,1,$1) ON CONFLICT(singleton) DO NOTHING RETURNING revision',[envelope]);
  return result.rows[0]?.revision??null;
 }
 const result=await db.query('UPDATE private_snapshot SET revision=revision+1,envelope=$1,updated_at=NOW() WHERE singleton=1 AND revision=$2 RETURNING revision',[envelope,expected]);
 return result.rows[0]?.revision??null;
}
export async function putSubscription(db,subscription,settings){
 const id=endpointHash(subscription.endpoint);
 await db.query(`INSERT INTO subscriptions(id,payload,enabled,work_time,home_time)
  VALUES($1,$2,$3,$4,$5)
  ON CONFLICT(id) DO UPDATE SET payload=$2,enabled=$3,work_time=$4,home_time=$5,updated_at=NOW()`,[id,subscription,settings.enabled,settings.workTime,settings.homeTime]);
 return id;
}
export async function removeSubscription(db,endpoint){
 await db.query('DELETE FROM subscriptions WHERE id=$1',[endpointHash(endpoint)]);
}
export async function getSubscriptions(db){
 const {rows}=await db.query('SELECT id,payload,enabled,work_time,home_time FROM subscriptions WHERE enabled=true');
 return rows.map(r=>({id:r.id,payload:r.payload,settings:{enabled:r.enabled,workTime:r.work_time,homeTime:r.home_time}}));
}
export async function reserveDelivery(db,id,day,slot){
 const {rows}=await db.query('INSERT INTO deliveries(subscription_id,day,slot) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING subscription_id',[id,day,slot]);
 return rows.length>0;
}
export async function releaseDelivery(db,id,day,slot){
 await db.query('DELETE FROM deliveries WHERE subscription_id=$1 AND day=$2 AND slot=$3',[id,day,slot]);
}
export async function cleanup(db){
 await db.query("DELETE FROM deliveries WHERE created_at < NOW()-INTERVAL '45 days'");
}
