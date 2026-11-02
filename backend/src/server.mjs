import http from 'node:http';
import webPush from 'web-push';
import {database,migrate} from './store.mjs';
import {createHandler} from './handler.mjs';
import {runTick} from './scheduler.mjs';
const token=process.env.SYNC_API_TOKEN,origin=process.env.WEB_ORIGIN,db=database(process.env.DATABASE_URL);
if(!token||token.length<32||!origin)throw Error('SYNC_API_TOKEN (>=32 chars), WEB_ORIGIN required');
const enabled=!!(process.env.VAPID_PUBLIC_KEY&&process.env.VAPID_PRIVATE_KEY&&process.env.VAPID_SUBJECT);
if(enabled)webPush.setVapidDetails(process.env.VAPID_SUBJECT,process.env.VAPID_PUBLIC_KEY,process.env.VAPID_PRIVATE_KEY);
await migrate(db);
const server=http.createServer(createHandler({db,token,origin,vapidPublicKey:enabled?process.env.VAPID_PUBLIC_KEY:null}));
server.requestTimeout=20000;server.headersTimeout=10000;server.listen(Number(process.env.PORT||8080),'0.0.0.0');
let running=false;
async function check(){
 if(!enabled||running)return;running=true;
 try{await runTick({db,webPush})}catch(error){console.error('push tick failure',error.message)}finally{running=false}
}
const interval=setInterval(check,30000);void check();
process.on('SIGTERM',()=>{clearInterval(interval);server.close(()=>db.end().then(()=>process.exit(0)));});
