// sw.js — receives Android Share Sheet POST, hands text to the page
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='POST')return;
  e.respondWith((async()=>{
    try{
      const fd=await e.request.formData();
      const f=fd.get('md')||fd.get('file');
      const text=f&&f.text?await f.text():(fd.get('text')||'');
      const name=f&&f.name?f.name:'shared.md';
      const c=await caches.open('mda-share');
      await c.put('/__shared',new Response(JSON.stringify({name,text}),
        {headers:{'Content-Type':'application/json'}}));
    }catch(_){}
    return Response.redirect('./',303);
  })());
});
