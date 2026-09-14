/* The Street Book — service worker.
   The shell is cached so the app opens with no signal. Map tiles and county
   records are cached as you look at them, so a route you have already opened
   still works in a dead spot. A route you have never opened will not. */
var SHELL = 'streetbook-shell-v5';
var RUN   = 'streetbook-run-v1';
var FILES = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png',
             './icon-maskable.png', './apple-touch-icon.png', './roofs.json'];

self.addEventListener('install', function(e){
  e.waitUntil(caches.open(SHELL).then(function(c){ return c.addAll(FILES); }).then(function(){ return self.skipWaiting(); }));
});
self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){ return k !== SHELL && k !== RUN; })
                           .map(function(k){ return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});

function trim(cache, max){
  cache.keys().then(function(keys){
    if(keys.length <= max) return;
    for(var i = 0; i < keys.length - max; i++) cache.delete(keys[i]);
  });
}

self.addEventListener('fetch', function(e){
  var req = e.request;
  if(req.method !== 'GET') return;
  var url = new URL(req.url);
  var sameOrigin = url.origin === self.location.origin;

  if(req.mode === 'navigate' || (sameOrigin && url.pathname.match(/index\.html$/))){
    /* fresh when there is signal, cached when there is not */
    e.respondWith(fetch(req).then(function(res){
      var copy = res.clone();
      caches.open(SHELL).then(function(c){ c.put('./index.html', copy); });
      return res;
    }).catch(function(){
      return caches.match('./index.html').then(function(r){ return r || caches.match('./'); });
    }));
    return;
  }
  if(sameOrigin){
    e.respondWith(caches.match(req).then(function(hit){ return hit || fetch(req); }));
    return;
  }
  /* tiles, fonts, the map engine, the county records */
  e.respondWith(caches.match(req).then(function(hit){
    var net = fetch(req).then(function(res){
      if(res && (res.status === 200 || res.type === 'opaque')){
        var copy = res.clone();
        caches.open(RUN).then(function(c){ c.put(req, copy); trim(c, 1500); });
      }
      return res;
    }).catch(function(){ return hit; });
    return hit || net;
  }));
});
