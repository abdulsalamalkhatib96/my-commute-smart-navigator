/** Salik standard variable schedule (Dubai) — manually supplied gate count only.
 * Special Ramadan hours must be checked externally; never treat a missing value as zero.
 * https://www.dubai.ae/en/living/driving-transportation/road-toll-in-dubai-salik
 */
export function dubaiLocalParts(date) {
  const dt=date instanceof Date?date:new Date(date);
  if (!Number.isFinite(dt.getTime())) return null;
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Dubai',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(dt);
  const p=Object.fromEntries(parts.map(({type,value})=>[type,value]));
  return {weekday:p.weekday,hour:Number(p.hour),minute:Number(p.minute)};
}
export function salikRateAt(date,{ramadan=false}={}) {
  if(ramadan)return null;
  const p=dubaiLocalParts(date);if(!p)return null;
  const t=p.hour+p.minute/60;
  if(t>=1&&t<6)return 0;
  if(p.weekday==='Sun')return 4;
  if((t>=6&&t<10)||(t>=16&&t<20))return 6;
  return 4;
}
/** 2026-06-01 UAE government notes 5% VAT on toll transactions; not clear here whether
 * displayed gate tariffs are tax-inclusive, so model it only as an optional scenario. */
export function salikVatScenario(gates,date,options={}) {
  const base=estimateSalik(gates,date,options);
  if(!base)return null;
  const dt=date instanceof Date?date:new Date(date);
  const applicable=dt.getTime()>=Date.parse('2026-05-31T20:00:00Z'); // June 1 00:00 Dubai
  const candidateVAT=applicable?Math.round(base.aed*0.05*100)/100:0;
  return {...base,vatIfAdditional:candidateVAT,totalIfAdditional:Math.round((base.aed+candidateVAT)*100)/100,vatApplicable:applicable};
}
export function estimateSalik(gates,date,options={}) {
  if(!Number.isInteger(gates)||gates<0||gates>20)return null;
  const rate=salikRateAt(date,options);
  return rate===null?null:{rate,crossings:gates,aed:rate*gates};
}
