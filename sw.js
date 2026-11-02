const CACHE='mycommute-smartnav-shell-v4';
const SHELL=['./','./index.html','./privacy.html','./style.css','./app.mjs','./nav-core.mjs','./decision-core.mjs','./trip-store.mjs','./salik-core.mjs','./salik-ledger.mjs','./route-cost-core.mjs','./provider-health.mjs','./eta-quality.mjs','./departure-core.mjs','./web-routing.mjs','./web-experience.mjs','./drive-mode.mjs','./departure-planner.mjs','./gps-policy.mjs','./reminder-core.mjs','./secure-backup.mjs','./api-budget.mjs','./public-config.mjs','./cloud-client.mjs','./manifest.webmanifest','./assets/icon-192.png','./assets/icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(names=>Promise.all(names.filter(n=>n!==CACHE).map(n=>caches.delete(n)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  event.respondWith(fetch(event.request).then(response=>{if(response.ok && SHELL.some(path=>new URL(path,self.registration.scope).pathname===new URL(event.request.url).pathname)){const clone=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,clone));}return response;}).catch(()=>caches.match(event.request)));
});

// Push payload is issued by the authenticated personal backend; avoid opening arbitrary external URLs.
self.addEventListener('push',event=>{
 let body={};try{body=event.data?.json()||{}}catch{}
 const title=typeof body.title==='string'&&body.title.length<=80?body.title:'My Commute — تذكير';
 const message=typeof body.body==='string'&&body.body.length<=180?body.body:'تحقق من رحلتك قبل المغادرة.';
 event.waitUntil(self.registration.showNotification(title,{body:message,tag:'mycommute-'+(body.slot==='work'?'work':'home'),
 icon:'./assets/icon-192.png',badge:'./assets/icon-192.png',data:{url:self.registration.scope}}));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async windows=>{
  const existing=windows.find(client=>client.url.startsWith(self.registration.scope));
  if(existing)return existing.focus();
  return self.clients.openWindow(self.registration.scope);
 }));
});
