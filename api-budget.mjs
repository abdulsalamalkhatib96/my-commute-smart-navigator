/** Conservative local Mapbox request throttle; NOT provider account billing or global quota. */
export const LIMITS=Object.freeze({routing:240,search:30,forecast:20});
export function budgetDay(date=new Date()){
 const d=date instanceof Date?date:new Date(date);
 if(!Number.isFinite(+d))return null;
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Dubai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d).map(v=>[v.type,v.value]));
 return p.year+'-'+p.month+'-'+p.day;
}
export function normalizeBudget(ledger,date=new Date()){
 const day=budgetDay(date);
 if(!day)throw Error('الوقت غير صالح');
 const source=ledger?.day===day?ledger.counts:{};
 const counts=Object.fromEntries(Object.keys(LIMITS).map(key=>{
  const value=source?.[key];
  return [key,Number.isInteger(value)&&value>=0&&value<=LIMITS[key]?value:0];
 }));
 return {day,counts};
}
export function reserveBudget(ledger,kind,amount=1,date=new Date()){
 const current=normalizeBudget(ledger,date);
 if(!Object.hasOwn(LIMITS,kind)||!Number.isInteger(amount)||amount<1||amount>LIMITS[kind])throw Error('نوع الطلب أو عدده غير صالح');
 const remaining=LIMITS[kind]-current.counts[kind];
 if(amount>remaining)return {allowed:false,ledger:current,remaining};
 current.counts[kind]+=amount;
 return {allowed:true,ledger:current,remaining:LIMITS[kind]-current.counts[kind]};
}
