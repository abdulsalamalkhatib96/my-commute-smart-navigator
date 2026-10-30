/** Web planning and Mapbox traffic annotations. No lane-speed claims. */
const valid = p => Array.isArray(p) && p.length===2 && p.every(Number.isFinite) && Math.abs(p[0])<=180 && Math.abs(p[1])<=90;
const haversine=(a,b)=>{const r=Math.PI/180,dLat=(b[1]-a[1])*r,dLon=(b[0]-a[0])*r,h=Math.sin(dLat/2)**2+Math.cos(a[1]*r)*Math.cos(b[1]*r)*Math.sin(dLon/2)**2;return 12742017.6*Math.asin(Math.min(1,Math.sqrt(h)));};
export function previewOrigin(kind,home,work){const p=kind==='home'?home:kind==='work'?work:null;return valid(p?.coordinates)?p.coordinates:null;}
export function validRouteEndpoints(origin,destination){return valid(origin)&&valid(destination)&&haversine(origin,destination)>=100;}
export function directionsUrl(origin,destination,token,{avoidTolls=false}={}){
 if(!validRouteEndpoints(origin,destination))throw new Error('حدد نقطتي انطلاق ووصول مختلفتين.');
 if(typeof token!=='string'||!/^pk\.[A-Za-z0-9._-]+$/.test(token))throw new Error('مفتاح Mapbox العام غير صحيح.');
 const coord=p=>p.map(n=>n.toFixed(6)).join(',');
 const params=new URLSearchParams({alternatives:'true',steps:'true',overview:'full',geometries:'geojson',language:'ar',annotations:'congestion,distance,speed',notifications:'all',access_token:token});
 if(avoidTolls)params.set('exclude','toll');
 return 'https://api.mapbox.com/directions/v5/mapbox/driving-traffic/'+coord(origin)+';'+coord(destination)+'?'+params;
}
const LEVELS=new Set(['low','moderate','heavy','severe','unknown']);
export function trafficFeatures(route){
 const coords=route?.geometry?.coordinates,congestion=route?.legs?.[0]?.annotation?.congestion;
 if(!Array.isArray(coords)||!Array.isArray(congestion)||coords.length!==congestion.length+1)return [];
 return congestion.flatMap((v,i)=>valid(coords[i])&&valid(coords[i+1])?[{type:'Feature',properties:{congestion:LEVELS.has(v)?v:'unknown'},geometry:{type:'LineString',coordinates:[coords[i],coords[i+1]]}}]:[]);
}
export function trafficSummary(route){
 const a=route?.legs?.[0]?.annotation,levels=a?.congestion;
 if(!Array.isArray(levels)||!levels.length)return {available:false,known:0,total:0,heavyPercent:null};
 const dist=Array.isArray(a.distance)&&a.distance.length===levels.length?a.distance:null;
 let known=0,heavy=0,total=0;
 levels.forEach((v,i)=>{if(!LEVELS.has(v)||v==='unknown')return;const weight=dist&&Number.isFinite(dist[i])&&dist[i]>=0?dist[i]:1;known+=weight;if(v==='heavy'||v==='severe')heavy+=weight;total++;});
 return {available:known>0,known,total,heavyPercent:known>0?Math.round(100*heavy/known):null};
}
/** Mapbox v5 returns notifications on route *legs*, not the top-level route. */
export function routeTollEvidence(route){
 const legs=Array.isArray(route?.legs)?route.legs:[];
 const notices=legs.flatMap(leg=>Array.isArray(leg?.notifications)?leg.notifications:[]);
 const toll=notices.filter(n=>n?.subtype==='toll');
 return {reported:toll.length>0,avoidanceFailed:toll.some(n=>n?.type==='violation'),count:toll.length};
}
export function possibleTollViolation(route){return routeTollEvidence(route).reported;}

