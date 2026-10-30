import {directionsUrl} from './web-routing.mjs';
export const DEPARTURE_OFFSETS=Object.freeze([0,15,30,60]);
/** The provider returns predictions; this does NOT measure future traffic in real time. */
export function predictedRouteUrl(from,to,token,departAt,{avoidTolls=false}={}){
 const date=departAt instanceof Date?departAt:new Date(departAt);
 if(!Number.isFinite(date.getTime()))throw Error('تاريخ المغادرة غير صالح');
 const url=new URL(directionsUrl(from,to,token,{avoidTolls}));
 url.searchParams.set('depart_at',date.toISOString().replace('.000Z','Z'));
 url.searchParams.set('alternatives','false');
 url.searchParams.set('steps','false');
 url.searchParams.set('overview','false');
 url.searchParams.delete('annotations');
 return url.toString();
}
export function departureOptions(result,baseDate=new Date()){
 const base=baseDate instanceof Date?baseDate:new Date(baseDate);
 if(!Number.isFinite(base.getTime())||!Array.isArray(result))return [];
 return result.filter(v=>DEPARTURE_OFFSETS.includes(v.offsetMinutes)&&Number.isFinite(v.durationSeconds)&&v.durationSeconds>0&&v.durationSeconds<86400)
 .map(v=>({
  offsetMinutes:v.offsetMinutes,durationSeconds:v.durationSeconds,
  departAt:new Date(base.getTime()+v.offsetMinutes*60000),
  arriveAt:new Date(base.getTime()+v.offsetMinutes*60000+v.durationSeconds*1000),
  source:'prediction'
 })).sort((a,b)=>a.offsetMinutes-b.offsetMinutes);
}
export function departureComparison(options){
 if(!Array.isArray(options)||!options.length)return null;
 const fastest=options.reduce((a,b)=>b.durationSeconds<a.durationSeconds?b:a);
 const earliestArrival=options.reduce((a,b)=>b.arriveAt<a.arriveAt?b:a);
 const now=options.find(x=>x.offsetMinutes===0);
 return {fastest,earliestArrival,drivingSavingSeconds:now?Math.max(0,now.durationSeconds-fastest.durationSeconds):null,
 arrivalDelaySeconds:now?Math.round((fastest.arriveAt-now.arriveAt)/1000):null};
}
