const CACHE='mycommute-smartnav-shell-v3';
const SHELL=['./','./index.html','./privacy.html','./style.css','./app.mjs','./nav-core.mjs','./decision-core.mjs','./trip-store.mjs','./salik-core.mjs','./salik-ledger.mjs','./route-cost-core.mjs','./departure-core.mjs','./web-routing.mjs','./web-experience.mjs','./drive-mode.mjs','./departure-planner.mjs','./gps-policy.mjs','./reminder-core.mjs','./secure-backup.mjs','./api-budget.mjs','./public-config.mjs','./manifest.webmanifest','./assets/icon-192.png','./assets/icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(names=>Promise.all(names.filter(n=>n!==CACHE).map(n=>caches.delete(n)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  event.respondWith(fetch(event.request).then(response=>{if(response.ok && SHELL.some(path=>new URL(path,self.registration.scope).pathname===new URL(event.request.url).pathname)){const clone=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,clone));}return response;}).catch(()=>caches.match(event.request)));
});
