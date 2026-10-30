/** Browser-only trip history, intentionally not synced to any server. */
const KEY='mycommute.smartnav.trips.v2';
function store(){try{return localStorage;}catch{return null;}}
export function validTrip(t) {
  return t && typeof t==='object' && typeof t.id==='string' && t.id.length<=100 &&
    ['home','work'].includes(t.destination) && typeof t.startAt==='string' && typeof t.endAt==='string' && Number.isFinite(Date.parse(t.startAt)) && Number.isFinite(Date.parse(t.endAt)) &&
    Number.isFinite(t.durationSeconds) && t.durationSeconds>0 && t.durationSeconds<86400 &&
    Number.isFinite(t.distanceMeters) && t.distanceMeters>=0 && t.distanceMeters<1500000 &&
    (t.initialEtaSeconds===null || (Number.isFinite(t.initialEtaSeconds) && t.initialEtaSeconds>0 && t.initialEtaSeconds<86400));
}
export function readTrips() {
  try {
    const a=JSON.parse(store()?.getItem(KEY)||'[]');
    return Array.isArray(a)?a.filter(validTrip).slice(-365):[];
  } catch{return [];}
}
export function saveTrip(t,max=180) {
  if(!validTrip(t))return false;
  try{
    const a=readTrips().filter(x=>x.id!==t.id);
    a.push(t);
    store()?.setItem(KEY,JSON.stringify(a.slice(-Math.max(30,Math.min(365,max)))));
    return true;
  }catch{return false;}
}
export function clearTrips(){try{store()?.removeItem(KEY);return true;}catch{return false;}}
export function exportTrips(trips){return JSON.stringify({version:1,exportedAt:new Date().toISOString(),trips:trips.filter(validTrip)},null,2);}
export function csvTrips(trips) {
  const header=['id','destination','startAt','endAt','durationSeconds','distanceMeters','initialEtaSeconds'];
  const esc=v=>`"${String(v??'').replaceAll('"','""').replace(/^\s*[=+\-@]/,"'$&")}"`;
  return [header.join(','),...trips.filter(validTrip).map(t=>header.map(k=>esc(t[k])).join(','))].join('\r\n');
}
export function importTrips(raw,limit=365){
  if(raw.length>2_000_000) throw new Error('حجم النسخة كبير جدًا');
  const parsed=JSON.parse(raw);
  if(parsed?.version!==1 || !Array.isArray(parsed.trips)||parsed.trips.length>3650 || parsed.trips.some(t=>!validTrip(t))) throw new Error('صيغة النسخة غير مدعومة');
  const unique=new Map([...readTrips(),...parsed.trips].map(t=>[t.id,t]));
  const merged=[...unique.values()].sort((a,b)=>a.startAt.localeCompare(b.startAt)).slice(-Math.max(30,Math.min(limit,365)));
  store()?.setItem(KEY,JSON.stringify(merged));return merged.length;
}
