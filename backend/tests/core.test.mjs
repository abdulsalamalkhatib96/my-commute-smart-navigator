import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyToken,validEnvelope,parseRevision,validPushSubscription,dueSlots,dubaiDateTime,allowedOrigin} from '../src/core.mjs';
const secret='this-is-a-long-production-like-secret-123456';
test('token validation is exact; short secrets forbidden',()=>{
 assert.equal(verifyToken(secret,secret),true);
 assert.equal(verifyToken(secret+'x',secret),false);
 assert.equal(verifyToken('a','short'),false);
});
test('optimistic revision and encrypted-envelope validation',()=>{
 assert.equal(parseRevision(0),0);
 assert.equal(parseRevision(-1),null);
 assert.equal(parseRevision('0'),null);
 const envelope={type:'my-commute-encrypted',version:1,kdf:'PBKDF2-SHA256',cipher:'AES-256-GCM',iterations:210000,salt:'a'.repeat(24),iv:'b'.repeat(16),data:'c'.repeat(40)};
 assert.equal(validEnvelope(envelope),true);
 assert.equal(validEnvelope({...envelope,version:2}),false);
});
test('only allowed push HTTPS endpoints and key shapes',()=>{
 const good={endpoint:'https://fcm.googleapis.com/fcm/send/a',keys:{auth:'abcdefghijk',p256dh:'A'.repeat(80)}};
 assert.equal(validPushSubscription(good),true);
 assert.equal(validPushSubscription({...good,endpoint:'https://localhost/private'}),false);
 assert.equal(validPushSubscription({...good,endpoint:'http://fcm.googleapis.com/a'}),false);
});
test('Dubai date and schedule, zero default delivery outside window',()=>{
 const when='2026-11-02T02:30:00Z';
 assert.deepEqual(dubaiDateTime(when),{day:'2026-11-02',time:'06:30'});
 assert.deepEqual(dueSlots({enabled:true,workTime:'06:30',homeTime:'17:00'},when),[{day:'2026-11-02',slot:'work'}]);
 assert.equal(dueSlots({enabled:false,workTime:'06:30',homeTime:'17:00'},when).length,0);
 assert.equal(allowedOrigin('https://evil.com','https://example.com'),false);
});

test('reminder grace window catches short restart, never sends too late',()=>{
 const s={enabled:true,workTime:'06:30',homeTime:'17:00'};
 assert.deepEqual(dueSlots(s,'2026-11-02T02:34:00Z'),[{day:'2026-11-02',slot:'work'}]);
 assert.deepEqual(dueSlots(s,'2026-11-02T02:35:00Z'),[]);
 assert.deepEqual(dueSlots(s,'2026-11-02T02:30:00Z'),[{day:'2026-11-02',slot:'work'}]);
 const midnight={enabled:true,workTime:'23:59',homeTime:'17:00'};
 assert.deepEqual(dueSlots(midnight,'2026-11-02T20:02:00Z'),[{day:'2026-11-02',slot:'work'}]);
});

test('valid Apple Web Push provider subdomains allowed, spoofed hostnames denied',()=>{
 const keys={auth:'abcdefghijk',p256dh:'A'.repeat(80)};
 assert.equal(validPushSubscription({endpoint:'https://web.push.apple.com/Q9J79PUSH',keys}),true);
 assert.equal(validPushSubscription({endpoint:'https://gateway.push.apple.com/path',keys}),true);
 assert.equal(validPushSubscription({endpoint:'https://web.push.apple.com.evil.example/path',keys}),false);
 assert.equal(validPushSubscription({endpoint:'https://notpush.apple.com/path',keys}),false);
});
