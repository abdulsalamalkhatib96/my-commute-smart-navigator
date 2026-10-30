import {isValidCoordinate} from './nav-core.mjs';
import {normalizeSettings} from './decision-core.mjs';
/** Browser-only UI helpers, no API credentials or trip history in exports. */
export function dubaiArrival(seconds,now=new Date()){
 const date=now instanceof Date?now:new Date(now);
 if(!Number.isFinite(seconds)||seconds<0||seconds>86400||!Number.isFinite(date.getTime()))return '—';
 return new Intl.DateTimeFormat('ar-AE',{timeZone:'Asia/Dubai',hour:'2-digit',minute:'2-digit'}).format(new Date(date.getTime()+seconds*1000));
}
export function alternativeSummary(routes,index){
 if(!Array.isArray(routes)||!routes[index])return null;
 const times=routes.map(x=>x?.duration);
 if(times.some(t=>!Number.isFinite(t)||t<=0))return null;
 return {extraMinutes:Math.ceil((times[index]-Math.min(...times))/60),savedMinutes:Math.floor((Math.max(...times)-times[index])/60)};
}
export function trafficAge(lastSuccess,now=Date.now()){
 if(!Number.isFinite(lastSuccess)||lastSuccess<=0)return {state:'unknown',minutes:null};
 const minutes=Math.floor(Math.max(0,now-lastSuccess)/60000);
 return {state:minutes>=3?'stale':'fresh',minutes};
}
function place(value){
 if(value==null)return null;
 if(typeof value!=='object'||!isValidCoordinate(value.coordinates)||typeof value.name!=='string'||!value.name.trim()||value.name.length>150)throw Error('العنوان غير صالح');
 return {name:value.name.trim(),coordinates:[...value.coordinates]};
}
export function exportProfile({home=null,work=null,settings={},avoidTolls=false,destination='home'}={}){
 return JSON.stringify({kind:'my-commute-web',version:1,home:place(home),work:place(work),settings:normalizeSettings(settings),avoidTolls:avoidTolls===true,destination:destination==='work'?'work':'home'},null,2);
}
export function importProfile(json){
 if(typeof json!=='string'||json.length>200000)throw Error('الملف كبير أو غير صالح');
 let data;try{data=JSON.parse(json)}catch{throw Error('JSON غير صالح')}
 if(data?.kind!=='my-commute-web'||data.version!==1||!data.settings||typeof data.settings!=='object'||Array.isArray(data.settings)||typeof data.avoidTolls!=='boolean'||!['home','work'].includes(data.destination))throw Error('نسخة غير مدعومة');
 return {home:place(data.home),work:place(data.work),settings:normalizeSettings(data.settings),avoidTolls:data.avoidTolls,destination:data.destination};
}
