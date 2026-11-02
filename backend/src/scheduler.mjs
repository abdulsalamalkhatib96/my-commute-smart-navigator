import {dueSlots} from './core.mjs';
import {getSubscriptions,reserveDelivery,releaseDelivery,removeSubscription,cleanup} from './store.mjs';
/** Each due minute sends at most once, even with concurrent workers. Sent before delivery
 * on success gives at-most-once guarantees; a crash after reservation can miss a reminder. */
export async function runTick({db,webPush,now=new Date()}){
 const subscriptions=await getSubscriptions(db);
 const result={eligible:0,sent:0,failed:0};
 for(const entry of subscriptions){
  for(const {day,slot} of dueSlots(entry.settings,now)){
   result.eligible++;
   if(!await reserveDelivery(db,entry.id,day,slot))continue;
   try{
    await webPush.sendNotification(entry.payload,JSON.stringify({
     title:slot==='work'?'وقت الذهاب للعمل':'وقت العودة للبيت',
     body:'افتح My Commute لمراجعة الازدحام قبل الانطلاق.',
     slot,day
    }),{TTL:300,urgency:'normal'});
    result.sent++;
   }catch(error){
    result.failed++;
    if([404,410].includes(error.statusCode))await removeSubscription(db,entry.payload.endpoint);
    else await releaseDelivery(db,entry.id,day,slot);
   }
  }
 }
 await cleanup(db);
 return result;
}
