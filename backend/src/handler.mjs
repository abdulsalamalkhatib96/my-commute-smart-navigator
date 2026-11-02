import {verifyToken,allowedOrigin,validEnvelope,validPushSubscription,validPushSettings,parseRevision,parseJson} from './core.mjs';
import {getSnapshot,putSnapshot,putSubscription,removeSubscription,erasePersonalRecords} from './store.mjs';
const MAX_BODY=3800000;
function respond(res,status,data,extra={}){
 res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra});
 res.end(JSON.stringify(data));
}
async function readBody(req){
 const chunks=[];let length=0;
 for await(const chunk of req){length+=chunk.length;if(length>MAX_BODY)throw Object.assign(Error('too large'),{status:413});chunks.push(chunk)}
 return parseJson(Buffer.concat(chunks).toString('utf8'),MAX_BODY);
}
export function createHandler({db,token,origin,vapidPublicKey}){
 if(!token||token.length<32||!origin)throw Error('SYNC_API_TOKEN must contain >=32 chars and WEB_ORIGIN is required');
 return async function handler(req,res){
  try{
   const source=req.headers.origin;
   if(!allowedOrigin(source,origin)){respond(res,403,{error:'origin not permitted'});return;}
   res.setHeader('Access-Control-Allow-Origin',origin);
   res.setHeader('Vary','Origin');
   res.setHeader('Access-Control-Allow-Methods','GET,PUT,POST,DELETE,OPTIONS');
   res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type');
   res.setHeader('Access-Control-Max-Age','600');
   if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
   const url=new URL(req.url||'/', 'http://localhost');
   if(url.pathname==='/health'&&req.method==='GET'){respond(res,200,{status:'ok'});return;}
   const header=req.headers.authorization||'';
   if(!header.startsWith('Bearer ')||!verifyToken(header.slice(7),token)){respond(res,401,{error:'unauthorized'});return;}
   if(url.pathname==='/v1/snapshot'&&req.method==='GET'){
    respond(res,200,await getSnapshot(db));return;
   }
   if(url.pathname==='/v1/snapshot'&&req.method==='PUT'){
    const input=await readBody(req),revision=parseRevision(input?.expectedRevision);
    if(revision===null||!validEnvelope(input?.envelope)){respond(res,422,{error:'expectedRevision and encrypted envelope required'});return;}
    const newRevision=await putSnapshot(db,revision,input.envelope);
    if(newRevision===null){respond(res,409,{error:'version conflict',current:await getSnapshot(db)});return;}
    respond(res,200,{revision:newRevision});return;
   }
   if(url.pathname==='/v1/data'&&req.method==='DELETE'){
    const input=await readBody(req);
    if(input?.confirmation!=='ERASE_REMOTE_DATA'){respond(res,422,{error:'explicit confirmation required'});return;}
    await erasePersonalRecords(db);
    respond(res,200,{erased:true});return;
   }
   if(url.pathname==='/v1/push/key'&&req.method==='GET'){
    respond(res,200,{publicKey:vapidPublicKey||null});return;
   }
   if(url.pathname==='/v1/push/subscriptions'&&req.method==='POST'){
    const data=await readBody(req);
    if(!validPushSubscription(data?.subscription)||!validPushSettings(data?.settings)){respond(res,422,{error:'invalid subscription or reminder settings'});return;}
    await putSubscription(db,data.subscription,data.settings);
    respond(res,200,{ok:true});return;
   }
   if(url.pathname==='/v1/push/subscriptions'&&req.method==='DELETE'){
    const input=await readBody(req);
    if(typeof input?.endpoint!=='string'||input.endpoint.length>2048){respond(res,422,{error:'endpoint required'});return;}
    await removeSubscription(db,input.endpoint);
    respond(res,200,{ok:true});return;
   }
   respond(res,404,{error:'not found'});
  }catch(e){const status=e.status===413?413:e.status===400?400:500;
    if(status===500)console.error('request failure',e.message);
    if(!res.headersSent)respond(res,status,{error:status===500?'internal error':e.message});else res.end();
  }
 };
}
