const CACHE='paperline-v3';
const BASE=new URL('./',self.registration.scope).toString();
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll([BASE,`${BASE}index.html`]))));
self.addEventListener('fetch',e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(x=>{const copy=x.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return x}).catch(()=>caches.match(`${BASE}index.html`)))));
