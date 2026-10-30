import {fuelCost,normalizeSettings} from './decision-core.mjs';
import {priceChargedCount} from './salik-ledger.mjs';
/** Estimates only when the user provided chargeable passages for that exact route RESPONSE.
 * No route matching, no inferred gate counts, no treating null as zero.
 */
export function compareTotalRouteCosts(routes,chargeableCounts,settings,date=new Date(),{ramadan=false}={}){
 if(!Array.isArray(routes)||!Array.isArray(chargeableCounts)||!routes.length)return {complete:false,cheapest:null,items:[]};
 const prefs=normalizeSettings(settings);
 const items=routes.map((route,index)=>{
   const count=chargeableCounts[index];
   const fuel=Number.isFinite(route?.distance)&&route.distance>=0?fuelCost(route,prefs):null;
   const toll=Number.isInteger(count)&&count>=0&&count<=20?priceChargedCount(count,date,{ramadan}):null;
   const total=fuel!==null&&toll!==null?Math.round((fuel+toll.totalAED)*100)/100:null;
   return {index,chargeable:count??null,fuelAED:fuel===null?null:Math.round(fuel*100)/100,
     tollAED:toll?.totalAED??null,totalAED:total};
 });
 const complete=items.every(item=>item.totalAED!==null);
 const cheapest=complete?items.reduce((a,b)=>b.totalAED<a.totalAED?b:a):null;
 return {complete,cheapest,items};
}
