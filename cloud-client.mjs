/** Manual-first, encrypted personal cloud sync; never expose secrets in URL. */
export function cloudApiOrigin(raw){
 if(typeof raw!=='string'||!raw.trim())throw Error('أدخل رابط خادم HTTPS');
 let u;try{u=new URL(raw.trim())}catch{throw Error('عنوان الخادم غير صحيح')}
 if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.pathname!=='/'||u.hostname.length<4)
   throw Error('رابط الخادم يجب أن يكون HTTPS origin دون مسار أو رمز أو كلمات مرور');
 return u.origin;
}
export function createCloudClient({origin,token,request=fetch}){
 const endpoint=cloudApiOrigin(origin);
 if(typeof token!=='string'||token.length<32||token.length>1024)throw Error('رمز مزامنة شخصي بطول 32 حرفًا على الأقل مطلوب');
 return async function api(path,{method='GET',body}={}){
  if(!/^\/v1\/[a-z/]+$/.test(path))throw Error('مسار API غير مسموح');
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),18000);
  try{
   const response=await request(endpoint+path,{method,signal:controller.signal,cache:'no-store',
    headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:body===undefined?undefined:JSON.stringify(body)});
   let payload;try{payload=await response.json()}catch{throw Error('استجابة الخادم ليست JSON')}
   if(!response.ok){
    const error=Error(response.status===401?'رمز الدخول للخادم غير صالح':response.status===409?'تعارض تعديل بين الأجهزة':
      response.status===403?'هذا الموقع غير مسموح له بالاتصال بالخادم':payload.error||'فشل طلب الخادم');
    error.status=response.status;error.payload=payload;throw error;
   }
   return payload;
  }catch(error){
   if(error.name==='AbortError')throw Error('انتهت مهلة الاتصال بخادم المزامنة');
   throw error;
  }finally{clearTimeout(timeout);}
 };
}
export async function payloadDigest(payload,cryptoAPI=globalThis.crypto){
 if(!cryptoAPI?.subtle)throw Error('تحتاج HTTPS للتشفير والمزامنة');
 const bytes=new TextEncoder().encode(JSON.stringify(payload));
 const hash=new Uint8Array(await cryptoAPI.subtle.digest('SHA-256',bytes));
 return Array.from(hash,b=>b.toString(16).padStart(2,'0')).join('');
}
export function revisionMatches(localRevision,remoteRevision){
 return Number.isSafeInteger(localRevision)&&localRevision>=0&&localRevision===remoteRevision;
}
export function vapidBytes(base64url){
 if(typeof base64url!=='string'||!/^[A-Za-z0-9_-]{80,150}$/.test(base64url))throw Error('VAPID public key غير صالح');
 const pad='='.repeat((4-base64url.length%4)%4);
 return Uint8Array.from(atob(base64url.replaceAll('-','+').replaceAll('_','/')+pad),x=>x.charCodeAt(0));
}
