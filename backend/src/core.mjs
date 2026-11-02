import {createHash,timingSafeEqual} from 'node:crypto';
export const AUTH_ERROR='unauthorized';
export function verifyToken(candidate,secret){
 if(typeof candidate!=='string'||typeof secret!=='string'||secret.length<32||candidate.length>1024)return false;
 return timingSafeEqual(createHash('sha256').update(candidate).digest(),createHash('sha256').update(secret).digest());
}
export function allowedOrigin(origin,expected){return !origin||origin===expected;}
export function validEnvelope(e){
 if(!e||typeof e!=='object'||e.type!=='my-commute-encrypted'||e.version!==1||
 e.kdf!=='PBKDF2-SHA256'||e.cipher!=='AES-256-GCM'||e.iterations!==210000)return false;
 return ['salt','iv','data'].every(k=>typeof e[k]==='string'&&/^[A-Za-z0-9+/=]+$/.test(e[k]))&&
 e.salt.length>=20&&e.salt.length<=28&&e.iv.length>=16&&e.iv.length<=24&&e.data.length>20&&e.data.length<=3500000;
}
export function parseRevision(value){
 if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0||value>1000000000)return null;
 return value;
}
export function validClock(v){return typeof v==='string'&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v);}
export function validPushSettings(v){
 return v&&typeof v==='object'&&typeof v.enabled==='boolean'&&validClock(v.workTime)&&validClock(v.homeTime);
}
export function dubaiDateTime(now=new Date()){
 const date=now instanceof Date?now:new Date(now);
 if(!Number.isFinite(date.getTime()))return null;
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Dubai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date).map(p=>[p.type,p.value]));
 return {day:parts.year+'-'+parts.month+'-'+parts.day,time:parts.hour+':'+parts.minute};
}
/** A five-minute grace window tolerates minute boundaries and brief restarts.
 * The database enforces once-per-device/slot/day so repeated ticks are harmless. */
export function dueSlots(settings,now=new Date(),graceMinutes=5){
 const current=now instanceof Date?now:new Date(now);
 if(!settings?.enabled||!Number.isFinite(current.getTime())||
   !Number.isInteger(graceMinutes)||graceMinutes<1||graceMinutes>15)return [];
 const result=new Map();
 for(let elapsed=0;elapsed<graceMinutes;elapsed++){
  const clock=dubaiDateTime(new Date(current.getTime()-elapsed*60000));
  if(!clock)continue;
  for(const [slot,time] of [['work',settings.workTime],['home',settings.homeTime]]){
   if(time===clock.time)result.set(clock.day+':'+slot,{day:clock.day,slot});
  }
 }
 return [...result.values()];
}
const PUSH_HOSTS=new Set(['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com','push.services.mozilla.com','push.apple.com','wns.windows.com']);
export function validPushSubscription(v){
 if(!v||typeof v!=='object'||typeof v.endpoint!=='string'||v.endpoint.length>2048)return false;
 let u;try{u=new URL(v.endpoint)}catch{return false;}
 if(u.protocol!=='https:'||u.username||u.password||u.port||!(PUSH_HOSTS.has(u.hostname)||u.hostname.endsWith('.push.apple.com')))return false;
 return v.keys&&typeof v.keys.auth==='string'&&/^[\w-]{8,64}$/.test(v.keys.auth)&&typeof v.keys.p256dh==='string'&&/^[\w-]{60,180}$/.test(v.keys.p256dh);
}
export function endpointHash(endpoint){return createHash('sha256').update(endpoint).digest('hex');}
export function parseJson(input,max=3800000){
 if(Buffer.byteLength(input,'utf8')>max)throw Object.assign(Error('payload too large'),{status:413});
 try{return JSON.parse(input)}catch{throw Object.assign(Error('invalid JSON'),{status:400})}
}
