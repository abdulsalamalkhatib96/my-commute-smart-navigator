/** Password-protected portable backup, local WebCrypto only, never sends data to a server. */
const ITERATIONS=210000, AAD='my-commute-encrypted-backup-v1', MAX_JSON=2800000;
function cryptoApi(){const c=globalThis.crypto;if(!c?.subtle||!c?.getRandomValues)throw Error('التشفير يتطلب HTTPS ومتصفحًا حديثًا');return c;}
const utf8=new TextEncoder(), decoder=new TextDecoder();
function encodeBytes(bytes){let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(text);}
function decodeBytes(value){if(typeof value!=='string'||value.length>MAX_JSON*2)throw Error('ترميز ملف غير صالح');const text=atob(value);return Uint8Array.from(text,c=>c.charCodeAt(0));}
async function makeKey(pass,salt){
 if(typeof pass!=='string'||pass.length<12||pass.length>512)throw Error('استخدم كلمة مرور من 12 حرفًا على الأقل');
 const c=cryptoApi();const material=await c.subtle.importKey('raw',utf8.encode(pass),'PBKDF2',false,['deriveKey']);
 return c.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations:ITERATIONS},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
export async function encryptPrivateBackup(payload,password){
 const source=JSON.stringify(payload);
 if(source.length>MAX_JSON)throw Error('حجم البيانات كبير للنسخة المشفرة');
 const c=cryptoApi(),salt=c.getRandomValues(new Uint8Array(16)),iv=c.getRandomValues(new Uint8Array(12));
 const key=await makeKey(password,salt);
 const encrypted=await c.subtle.encrypt({name:'AES-GCM',iv,additionalData:utf8.encode(AAD)},key,utf8.encode(source));
 return JSON.stringify({type:'my-commute-encrypted',version:1,kdf:'PBKDF2-SHA256',iterations:ITERATIONS,cipher:'AES-256-GCM',
   salt:encodeBytes(salt),iv:encodeBytes(iv),data:encodeBytes(new Uint8Array(encrypted))},null,2);
}
export async function decryptPrivateBackup(envelope,password){
 if(typeof envelope!=='string'||envelope.length>MAX_JSON*2)throw Error('الملف كبير جدًا');
 let parsed;try{parsed=JSON.parse(envelope)}catch{throw Error('ملف مشفر غير صالح')}
 if(parsed?.type!=='my-commute-encrypted'||parsed.version!==1||parsed.kdf!=='PBKDF2-SHA256'||parsed.cipher!=='AES-256-GCM'||parsed.iterations!==ITERATIONS)throw Error('صيغة النسخة المشفرة غير مدعومة');
 const salt=decodeBytes(parsed.salt),iv=decodeBytes(parsed.iv),data=decodeBytes(parsed.data);
 if(salt.length!==16||iv.length!==12||data.length>MAX_JSON+100)throw Error('حقل تشفير غير صالح');
 const key=await makeKey(password,salt);
 try{
  const clear=await cryptoApi().subtle.decrypt({name:'AES-GCM',iv,additionalData:utf8.encode(AAD)},key,data);
  if(clear.byteLength>MAX_JSON*4)throw Error('الملف كبير جدًا');
  return JSON.parse(decoder.decode(clear));
 }catch{throw Error('كلمة المرور غير صحيحة أو الملف عُدّل أو تلف');}
}
