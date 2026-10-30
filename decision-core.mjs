/** Deterministic, dependency-free route decision policy. No invented live lane speeds. */
export const DEFAULT_SETTINGS = Object.freeze({
  mode: 'balanced', litersPer100km: 8.5, fuelPriceAED: 2.7,
  valueOfTimeAEDPerHour: 30, minimumSavingSeconds: 300,
  minimumSavingRatio: 0.08, confirmations: 2, maxHistory: 180
});
export const MODES = Object.freeze(['fast', 'balanced', 'economy']);

export function normalizeSettings(raw={}) {
  const v = {...DEFAULT_SETTINGS};
  if (MODES.includes(raw.mode)) v.mode = raw.mode;
  for (const [k, min, max] of [
    ['litersPer100km', 1, 40], ['fuelPriceAED', .1, 20],
    ['valueOfTimeAEDPerHour', 0, 300], ['minimumSavingSeconds', 60, 1800],
    ['minimumSavingRatio', .02, .5], ['confirmations', 1, 5], ['maxHistory', 30, 365]
  ]) {
    const n=Number(raw[k]);
    if (raw[k] !== null && raw[k] !== undefined && raw[k] !== '' && Number.isFinite(n) && n>=min && n<=max) v[k]=n;
  }
  return v;
}
export function fuelCost(route, settings=DEFAULT_SETTINGS) {
  return route.distance / 1000 * settings.litersPer100km / 100 * settings.fuelPriceAED;
}
export function rankScore(route, settings=DEFAULT_SETTINGS) {
  if (settings.mode==='fast') return route.duration;
  if (settings.mode==='economy') return fuelCost(route,settings);
  return fuelCost(route,settings) + route.duration / 3600 * settings.valueOfTimeAEDPerHour;
}
/** Identifiers are approximate; short/local road segments are noisy after reroutes. */
export function roadNames(route) {
  return [...new Set((route?.legs||[]).flatMap(l=>l.steps||[]).map(s=>String(s.name||'').trim().toLowerCase()).filter(x=>x.length>2))];
}
export function routeSimilarity(a,b) {
  if (!a || !b) return 0;
  const aa=roadNames(a),bb=roadNames(b);
  if (!aa.length || !bb.length) return 0;
  const x=new Set(aa), y=new Set(bb), intersection=[...x].filter(z=>y.has(z)).length;
  return intersection / Math.min(x.size,y.size);
}
/** Route matching can be ambiguous on service roads; avoid claiming strong identity. */
export function matchPreviousRoute(routes, previousRoute) {
  if (!previousRoute || !routes.length) return -1;
  const ranked=routes.map((r,i)=>({i,s:routeSimilarity(r,previousRoute)})).sort((a,b)=>b.s-a.s);
  return ranked[0].s>=0.67 ? ranked[0].i : -1;
}
export function chooseRoute(routes, previousRoute=null, pending=null, settings=DEFAULT_SETTINGS, force=false) {
  if (!routes.length) return {index:-1,pending:null,reason:'empty'};
  const scored=routes.map((r,i)=>({i,score:rankScore(r,settings)})).sort((a,b)=>a.score-b.score);
  const best=scored[0].i;
  const current=matchPreviousRoute(routes,previousRoute);
  if (force || current<0) return {index:best,pending:null,reason:force?'forced':'no-match'};
  if (best===current) return {index:current,pending:null,reason:'stable'};
  const delta=routes[current].duration-routes[best].duration;
  const ratio=delta / Math.max(routes[current].duration,1);
  const mode=settings.mode;
  const savingAED=rankScore(routes[current],settings)-rankScore(routes[best],settings);
  const relativeSaving=savingAED/Math.max(rankScore(routes[current],settings),0.01);
  // Time-first mode uses seconds; cost modes use AED and reject excessive detours.
  const improvement=mode==='fast'
    ? delta >= settings.minimumSavingSeconds && ratio >= settings.minimumSavingRatio
    : savingAED >= 2 && relativeSaving >= 0.08 && delta >= -600;
  if (!improvement) return {index:current,pending:null,reason:'hysteresis'};
  const candidateNames=roadNames(routes[best]);
  const same=pending?.route && routeSimilarity(pending.route,routes[best])>=0.6;
  const count=same?pending.count+1:1;
  if (count < settings.confirmations) {
    return {index:current,pending:{count,route:routes[best],candidateNames},reason:'confirming'};
  }
  return {index:best,pending:null,reason:'better-route'};
}
export function formatAED(n) { return Number.isFinite(n) ? `${n.toFixed(2)} د.إ` : 'غير معروف'; }

export function median(numbers) {
  const a=numbers.filter(Number.isFinite).sort((a,b)=>a-b);
  return a.length ? (a.length%2?a[(a.length-1)/2]:(a[a.length/2-1]+a[a.length/2])/2) : null;
}
export function tripStats(trips, destination=null) {
  const relevant=trips.filter(t=>t && (!destination || t.destination===destination) && Number.isFinite(t.durationSeconds) && t.durationSeconds>0);
  const recent=relevant.slice(-30);
  const durations=recent.map(t=>t.durationSeconds);
  const errors=recent.map(t=>Number.isFinite(t.initialEtaSeconds)?Math.abs(t.durationSeconds-t.initialEtaSeconds):NaN);
  const distances=recent.map(t=>t.distanceMeters).filter(Number.isFinite);
  return {count:relevant.length,medianSeconds:median(durations),medianEtaErrorSeconds:median(errors),totalMeters:distances.reduce((s,n)=>s+n,0)};
}
export function departureBuckets(trips,destination) {
  // Retrospective weekday and hour only; never misrepresent as live predictive traffic.
  const groups=new Map();
  for (const t of trips) {
    if (t.destination!==destination || !Number.isFinite(t.durationSeconds) || t.durationSeconds<120) continue;
    const d=new Date(t.startAt);
    if (Number.isNaN(+d)) continue;
    const key=`${d.getDay()}-${d.getHours()}`;
    if (!groups.has(key)) groups.set(key,[]);
    groups.get(key).push(t.durationSeconds);
  }
  return [...groups].filter(([,a])=>a.length>=3).map(([key,a])=>({key,count:a.length,medianSeconds:median(a)}));
}
