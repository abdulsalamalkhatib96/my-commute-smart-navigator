/** Foreground-only user opt-in reminders. Never claim scheduled push when website is closed. */
export const DEFAULT_REMINDERS=Object.freeze({enabled:false,workTime:'06:30',homeTime:'17:00'});
const formatTime=x=>typeof x==='string'&&/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/.test(x)?x:null;
export function parseReminderSettings(raw={}){
 if(!raw||typeof raw!=='object')return {...DEFAULT_REMINDERS};
 return {enabled:raw.enabled===true,
  workTime:formatTime(raw.workTime)||DEFAULT_REMINDERS.workTime,
  homeTime:formatTime(raw.homeTime)||DEFAULT_REMINDERS.homeTime};
}
export function dubaiDateAndMinute(date=new Date()){
 const input=date instanceof Date?date:new Date(date);
 if(!Number.isFinite(+input))return null;
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Dubai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(input).map(v=>[v.type,v.value]));
 return {day:p.year+'-'+p.month+'-'+p.day,minutes:Number(p.hour)*60+Number(p.minute)};
}
export function dueReminders(settings,date=new Date(),firedKeys=[]){
 const config=parseReminderSettings(settings),now=dubaiDateAndMinute(date);
 if(!config.enabled||!now)return [];
 const used=new Set(firedKeys);
 return [['work',config.workTime],['home',config.homeTime]].flatMap(([destination,time])=>{
   const [h,m]=time.split(':').map(Number);
   const scheduled=h*60+m,delta=now.minutes-scheduled;
   const key=now.day+':'+destination+':'+time;
   return delta>=0&&delta<5&&!used.has(key)?[{key,destination,time}]:[];
 });
}
