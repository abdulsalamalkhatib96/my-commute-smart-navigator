import webPush from 'web-push';
import {database,migrate} from './store.mjs';
import {runTick} from './scheduler.mjs';
const db=database(process.env.DATABASE_URL);
if(!process.env.VAPID_PUBLIC_KEY||!process.env.VAPID_PRIVATE_KEY||!process.env.VAPID_SUBJECT)throw Error('VAPID config required');
webPush.setVapidDetails(process.env.VAPID_SUBJECT,process.env.VAPID_PUBLIC_KEY,process.env.VAPID_PRIVATE_KEY);
try{await migrate(db);console.log(await runTick({db,webPush}));}finally{await db.end()}
