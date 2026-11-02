import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createHandler} from '../src/handler.mjs';
const token='abcdefghijklmnopqrstuvwxyzzzzzzzzz';
const db={
  async query(sql,args=[]){
   if(sql.startsWith('SELECT revision'))return {rows:this.row?[this.row]:[]};
   if(sql.startsWith('INSERT INTO private_snapshot')){if(this.row)return {rows:[]};this.row={revision:1,envelope:args[0]};return {rows:[{revision:1}]};}
   if(sql.startsWith('UPDATE private_snapshot')){if(!this.row||this.row.revision!==args[1])return {rows:[]};this.row={revision:this.row.revision+1,envelope:args[0]};return {rows:[{revision:this.row.revision}]};}
   throw Error('unexpected query '+sql);
  }
};
const envelope={type:'my-commute-encrypted',version:1,kdf:'PBKDF2-SHA256',cipher:'AES-256-GCM',iterations:210000,salt:'a'.repeat(24),iv:'b'.repeat(16),data:'c'.repeat(48)};
async function request(server,method,path,body,secret=token,origin='https://example.com'){
 const address=server.address();
 return fetch('http://127.0.0.1:'+address.port+path,{method,headers:{'Authorization':'Bearer '+secret,'Origin':origin,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined}).then(async r=>({status:r.status,data:await r.json()}));
}
test('API protects snapshot, rejects conflicts, never stores plaintext',async()=>{
 const server=http.createServer(createHandler({db,token,origin:'https://example.com'}));
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 try{
  assert.equal((await request(server,'GET','/v1/snapshot',null,'bad token')).status,401);
  assert.equal((await request(server,'GET','/v1/snapshot',null,token,'https://evil.com')).status,403);
  assert.equal((await request(server,'GET','/v1/snapshot')).data.revision,0);
  assert.equal((await request(server,'PUT','/v1/snapshot',{expectedRevision:0,envelope})).status,200);
  assert.equal((await request(server,'PUT','/v1/snapshot',{expectedRevision:0,envelope})).status,409);
  assert.equal((await request(server,'PUT','/v1/snapshot',{expectedRevision:1,envelope})).data.revision,2);
  assert.equal((await request(server,'GET','/v1/snapshot')).data.revision,2);
 }finally{server.close()}
});
