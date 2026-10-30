import test from 'node:test';
import assert from 'node:assert/strict';
import {cameraForFix,canFollow} from '../drive-mode.mjs';
test('camera only follows a reliable fix and keeps true heading',()=>{
 assert.equal(cameraForFix([55.2,25.3],120,180),null);
 assert.equal(cameraForFix([555,25.3],10,180),null);
 assert.deepEqual(cameraForFix([55.2,25.3],15,180),{center:[55.2,25.3],zoom:15.8,pitch:32,duration:850,bearing:180});
 assert.equal('bearing' in cameraForFix([55.2,25.3],15,null),false);
});
test('camera follow pauses for manual map interaction and respects inactive browser',()=>{
 const opts={driveMode:true,active:true,hidden:false};
 assert.equal(canFollow(10000,5000,0,opts),true);
 assert.equal(canFollow(10000,9500,0,opts),false);
 assert.equal(canFollow(10000,5000,11000,opts),false);
 assert.equal(canFollow(10000,5000,0,{...opts,hidden:true}),false);
 assert.equal(canFollow(10000,5000,0,{...opts,driveMode:false}),false);
});
