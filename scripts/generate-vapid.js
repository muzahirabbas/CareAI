import webpush from 'web-push';

const vapidKeys = webpush.generateVAPIDKeys();

console.log('====================================');
console.log('VAPID PUBLIC KEY:');
console.log(vapidKeys.publicKey);
console.log('====================================');
console.log('VAPID PRIVATE KEY:');
console.log(vapidKeys.privateKey);
console.log('====================================');
console.log('Keep the private key secret. Use the public key in your React app to subscribe users.');

