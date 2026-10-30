/** Public POIs only, never sends the user's saved home/work for a diagnostics request. */
export const TEST_ROUTE=Object.freeze({
 from:[55.27917,25.19750], // Dubai Mall
 to:[55.4793062,25.3996216] // Ajman City Centre, Ajman government open data
});
export function mapboxHealthReport(status,payload){
 if(status===401)return {ok:false,code:'unauthorized',message:'المفتاح غير صالح أو غير مصرح له بواجهة Directions.'};
 if(status===403)return {ok:false,code:'forbidden',message:'الوصول مرفوض؛ تحقق من نطاقات المفتاح وصلاحياته.'};
 if(!Number.isInteger(status)||status<200||status>=300)return {ok:false,code:'http',message:'تعذر الوصول لخدمة Directions (HTTP '+status+').'};
 if(payload?.code!=='Ok'||!Array.isArray(payload.routes)||!payload.routes.length)return {ok:false,code:'routes',message:'استجابة من Mapbox دون مسار قيادة صالح.'};
 const routes=payload.routes.filter(r=>Number.isFinite(r.duration)&&r.duration>0&&Number.isFinite(r.distance)&&r.distance>0);
 if(!routes.length)return {ok:false,code:'routes',message:'لم تتوفر مدد ومسافات صالحة.'};
 const traffic=routes.some(r=>r.legs?.some(l=>Array.isArray(l.annotation?.congestion)&&l.annotation.congestion.some(x=>typeof x==='string'&&x!=='unknown')));
 return {ok:true,code:'ok',routes:routes.length,trafficCoverage:traffic,shortestMinutes:Math.ceil(Math.min(...routes.map(x=>x.duration))/60)};
}
