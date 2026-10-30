import {salikRateAt} from './salik-core.mjs';
/** Named toll crossings entered by the user. Not automatic map-matching. */
export const SALIK_GATES=Object.freeze({
 'mamzar-n':'الممزر الشمالية','mamzar-s':'الممزر الجنوبية',
 'safa-n':'الصفا الشمالية','safa-s':'الصفا الجنوبية',
 'airport':'نفق المطار','maktoum':'جسر آل مكتوم','garhoud':'جسر القرهود',
 'business-bay':'معبر الخليج التجاري','barsha':'البرشاء','jebel-ali':'جبل علي'
});
const PAIRED=Object.freeze({
 'mamzar-n':'mamzar-s','mamzar-s':'mamzar-n',
 'safa-n':'safa-s','safa-s':'safa-n'
});
const VAT_START=Date.parse('2026-05-31T20:00:00Z'); // Dubai 2026-06-01 00:00
const money=x=>Math.round((x+Number.EPSILON)*100)/100;
function validEvent(e){
 if(!e||typeof e!=='object'||!Object.hasOwn(SALIK_GATES,e.gate)||!['north','south'].includes(e.direction))return false;
 if(typeof e.at!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$/.test(e.at))return false;
 return Number.isFinite(Date.parse(e.at));
}
/** Return null for unverified Ramadan/invalid events instead of inventing a toll total. */
export function priceCrossings(events,{ramadan=false}={}){
 if(!Array.isArray(events)||events.length>40||events.some(e=>!validEvent(e)))return null;
 const sorted=events.map((e,i)=>({...e,originalIndex:i,time:new Date(e.at).getTime()})).sort((a,b)=>a.time-b.time||a.originalIndex-b.originalIndex);
 const eligible=[];
 let baseAED=0,vatAED=0;
 const items=[];
 for(const crossing of sorted){
  const match=eligible.find(x=>x.gate===PAIRED[crossing.gate]&&x.direction===crossing.direction&&!x.used&&crossing.time-x.time<=3600000&&crossing.time>=x.time);
  const discount=Boolean(match);
  if(match)match.used=true;
  const raw=salikRateAt(crossing.at,{ramadan});
  if(raw===null)return null;
  const base=discount?0:raw;
  const vat=crossing.time>=VAT_START?money(base*0.05):0;
  baseAED+=base;vatAED+=vat;
  items.push({gate:crossing.gate,direction:crossing.direction,at:crossing.at,discount,baseAED:base,vatAED:vat,totalAED:money(base+vat)});
  if(PAIRED[crossing.gate]&&!discount)eligible.push({gate:crossing.gate,direction:crossing.direction,time:crossing.time,used:false});
 }
 return {crossings:items,charged:items.filter(x=>!x.discount).length,discounted:items.filter(x=>x.discount).length,
    baseAED:money(baseAED),vatAED:money(vatAED),totalAED:money(baseAED+vatAED)};
}
/** Manual count is a count of CHARGEABLE passages; pairing must be subtracted first. */
export function priceChargedCount(count,date,{ramadan=false}={}){
 if(!Number.isInteger(count)||count<0||count>20)return null;
 const d=date instanceof Date?date:new Date(date),time=d.getTime(),rate=salikRateAt(d,{ramadan});
 if(rate===null||!Number.isFinite(time))return null;
 const baseAED=count*rate,vatAED=time>=VAT_START?money(baseAED*0.05):0;
 return {count,rate,baseAED,vatAED,totalAED:money(baseAED+vatAED)};
}
