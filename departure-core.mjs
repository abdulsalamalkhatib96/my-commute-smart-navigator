/** Historical travel-time observations, never a live traffic forecast. */
import {median} from './decision-core.mjs';
import {dubaiLocalParts} from './salik-core.mjs';

export function historicalDepartureAdvice(trips,destination,reference=new Date()) {
  const now=dubaiLocalParts(reference);
  if(!now||!['home','work'].includes(destination))return [];
  return [0,1,2].map(offset=>{
    const hour=now.hour+offset;
    if(hour>=24)return null;
    const durations=trips.filter(t=>
      t.destination===destination && t.durationSeconds>=120 && t.durationSeconds<86400 &&
      dubaiLocalParts(t.startAt)?.weekday===now.weekday && dubaiLocalParts(t.startAt)?.hour===hour
    ).map(t=>t.durationSeconds);
    if(durations.length<3)return null;
    return {offsetHours:offset,departureHour:hour,samples:durations.length,medianSeconds:median(durations),confidence:durations.length>=10?'medium':'low'};
  }).filter(Boolean);
}
export function formatHistoricalAdvice(advice) {
  if(!advice.length)return 'لا توجد عينة تاريخية كافية لنفس اليوم والساعة. نحتاج 3 رحلات فعلية لكل نافذة.';
  const fastest=[...advice].sort((a,b)=>a.medianSeconds-b.medianSeconds)[0];
  const current=advice.find(x=>x.offsetHours===0);
  const saving=current?Math.round((current.medianSeconds-fastest.medianSeconds)/60):null;
  const note=saving!==null&&saving>0?`أقل بوسيط ${saving} دقيقة قيادة مقارنة بساعة الخروج الحالية`:'لا تتوفر مقارنة موثوقة مع ساعة الخروج الحالية';
  return `سجل الرحلات فقط: الساعة ${fastest.departureHour}:00 كان وسيط القيادة ${Math.round(fastest.medianSeconds/60)} دقيقة من ${fastest.samples} رحلات (${fastest.confidence==='low'?'ثقة منخفضة':'ثقة متوسطة'}). ${note}. هذا ليس تنبؤًا مروريًا مباشرًا، والانتظار قد يؤخر الوصول.`;
}
