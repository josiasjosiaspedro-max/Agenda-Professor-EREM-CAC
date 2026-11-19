const CACHE='agenda-docente-v7-1-contexto-undo-selecao-1';
const ASSETS=['./','./index.html','./manifest.webmanifest','./icon-180.png','./icon-192.png','./icon-512.png','./supabase-config.js','./cloud.js','./v6.js','./v6.css','./v7.css','./v7-interface.js','./v7-calendar.js','./v7-notes.js'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET' || new URL(event.request.url).origin!==self.location.origin) return;
  event.respondWith(fetch(event.request).then(res=>{
    if(res && res.ok) {const copy=res.clone(); caches.open(CACHE).then(c=>c.put(event.request,copy)).catch(()=>{});}
    return res;
  }).catch(()=>caches.match(event.request).then(r=>r || (event.request.mode==='navigate'?caches.match('./index.html'):undefined))));
});
