import webPush from 'web-push';
const keys=webPush.generateVAPIDKeys();
console.log('VAPID_PUBLIC_KEY='+keys.publicKey+'\nVAPID_PRIVATE_KEY='+keys.privateKey);
