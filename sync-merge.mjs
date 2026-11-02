import {validTrip} from './trip-store.mjs';
import {payloadDigest} from './cloud-client.mjs';
const canonical=t=>JSON.stringify(Object.fromEntries(Object.keys(t).sort().map(key=>[key,t[key]])));
/** Merge without silent last-writer-wins data loss. Conflicting IDs are preserved
 * under deterministic 16-byte fingerprint IDs. Any capacity loss is rejected. */
export async function mergeTripHistories(local,remote,{max=180}={}){
 if(!Array.isArray(local)||!Array.isArray(remote)||local.some(t=>!validTrip(t))||remote.some(t=>!validTrip(t))||
   !Number.isInteger(max)||max<30||max>365)throw Error('سجلات الرحلات أو حد الحفظ غير صالح');
 const seen=new Map(),conflicts=[];
 for(const record of local){
  const other=seen.get(record.id);
  if(other&&canonical(other)!==canonical(record))throw Error('يوجد تعارض معرّف داخل سجل هذا الجهاز');
  seen.set(record.id,record);
 }
 const incoming=new Set();
 for(const record of remote){
  const signature=canonical(record),found=incoming.has(record.id);
  if(found)throw Error('معرف رحلة مكرر في النسخة السحابية');
  incoming.add(record.id);
  const prior=seen.get(record.id);
  if(!prior){seen.set(record.id,record);continue;}
  if(canonical(prior)===signature)continue;
  const digest=(await payloadDigest(record)).slice(0,20);
  const renamed=record.id.slice(0,67)+':remote:'+digest;
  const existing=seen.get(renamed);
  if(existing&&canonical(existing)!==canonical({...record,id:renamed}))
    throw Error('تعارض غير قابل للتسوية تلقائيًا، لم يتم تعديل البيانات');
  seen.set(renamed,{...record,id:renamed});
  conflicts.push({originalId:record.id,preservedId:renamed});
 }
 if(seen.size>max)throw Error('سجلات الأجهزة تتجاوز حد الحفظ ('+max+'). صدّر نسخة محلية وزد الحد قبل الدمج؛ لن تُحذف أي رحلة.');
 const trips=[...seen.values()].sort((a,b)=>a.startAt.localeCompare(b.startAt)||a.id.localeCompare(b.id));
 return {trips,conflicts};
}
