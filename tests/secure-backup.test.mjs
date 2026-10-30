import test from 'node:test';
import assert from 'node:assert/strict';
import {encryptPrivateBackup,decryptPrivateBackup} from '../secure-backup.mjs';
const password='long-strong-passphrase-2026';
test('AES-GCM secure backup encrypt/decrypt round trip with non-ASCII values',async()=>{
 const value={profile:{name:'البيت',coordinates:[55.3,25.4]},trips:[{id:'a',duration:2400}]};
 const ciphertext=await encryptPrivateBackup(value,password);
 assert.equal(ciphertext.includes('البيت'),false);
 assert.deepEqual(await decryptPrivateBackup(ciphertext,password),value);
});
test('wrong password and tampered ciphertext fail closed',async()=>{
 const ciphertext=await encryptPrivateBackup({message:'private'},password);
 await assert.rejects(decryptPrivateBackup(ciphertext,'this-is-not-the-password'));
 const envelope=JSON.parse(ciphertext);
 const data=envelope.data;
 envelope.data=data.slice(0,-5)+'AAAAA';
 await assert.rejects(decryptPrivateBackup(JSON.stringify(envelope),password));
});
test('short password, malformed files and unsupported versions rejected',async()=>{
 await assert.rejects(encryptPrivateBackup({},'short'));
 await assert.rejects(decryptPrivateBackup('wrong json',password));
 await assert.rejects(decryptPrivateBackup(JSON.stringify({type:'my-commute-encrypted',version:99}),password));
});
