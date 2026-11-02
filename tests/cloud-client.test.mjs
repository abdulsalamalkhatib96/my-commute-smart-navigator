import test from 'node:test';
import assert from 'node:assert/strict';
import {cloudApiOrigin,createCloudClient,revisionMatches,payloadDigest} from '../cloud-client.mjs';
test('URL validation blocks insecure/private credential URLs',()=>{
 assert.equal(cloudApiOrigin('https://sync.example.com/'),'https://sync.example.com');
 for(const url of ['http://example.com','https://user:pass@example.com/','https://example.com/secret','https://example.com/?token=a','javascript:alert(1)'])assert.throws(()=>cloudApiOrigin(url));
});
test('cloud client sends bearer and optimistic CAS without tokens in URLs',async()=>{
 const calls=[];
 const api=createCloudClient({origin:'https://sync.example.com',token:'x'.repeat(40),request:async(url,options)=>{
  calls.push({url,options});return {ok:true,status:200,json:async()=>({revision:3})};
 }});
 assert.deepEqual(await api('/v1/snapshot',{method:'PUT',body:{expectedRevision:2,envelope:{}}}),{revision:3});
 assert.equal(calls[0].url,'https://sync.example.com/v1/snapshot');
 assert.equal(calls[0].options.headers.Authorization,'Bearer '+'x'.repeat(40));
 assert.equal(JSON.parse(calls[0].options.body).expectedRevision,2);
});
test('409 conflicts are exposed, not overwritten',async()=>{
 const api=createCloudClient({origin:'https://sync.example.com',token:'x'.repeat(40),request:async()=>({
  ok:false,status:409,json:async()=>({error:'version conflict',current:{revision:8}})})});
 await assert.rejects(api('/v1/snapshot',{method:'PUT',body:{}}),e=>e.status===409&&e.payload.current.revision===8);
 assert.equal(revisionMatches(2,3),false);
 assert.equal(revisionMatches(2,2),true);
});
test('payload digest varies with data for safe change detection',async()=>{
 const a=await payloadDigest({trips:[]}),b=await payloadDigest({trips:[1]});
 assert.equal(a.length,64);assert.notEqual(a,b);
});
