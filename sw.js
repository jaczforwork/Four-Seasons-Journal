/* 四季手账：离线缓存。页面优先走网络（保证拿到新版），没网时用缓存；Supabase 的请求不拦截。 */
const V = 'sjsz-v4';
const CORE = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
async function page(req) {
  const cache = await caches.open(V);
  const cached = await cache.match('index.html');
  const net = fetch(req).then(res => { if (res.ok) cache.put('index.html', res.clone()); return res; });
  if (!cached) return net;
  net.catch(() => {});
  try {
    const first = await Promise.race([net, new Promise(r => setTimeout(() => r(null), 3500))]);
    return first || cached;
  } catch (e) { return cached; }
}
async function asset(req) {
  const cache = await caches.open(V);
  const cached = await cache.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}
async function cdn(req) {
  const cache = await caches.open(V);
  const cached = await cache.match(req);
  const net = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()); return res; });
  if (cached) { net.catch(() => {}); return cached; }
  return net;
}
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.origin === location.origin) {
    if (u.pathname.endsWith('/sw.js')) return;
    if (req.mode === 'navigate' || u.pathname.endsWith('/') || u.pathname.endsWith('/index.html')) e.respondWith(page(req));
    else e.respondWith(asset(req));
    return;
  }
  if (/(^|\.)jsdelivr\.net$|^fonts\.googleapis\.com$|^fonts\.gstatic\.com$/.test(u.hostname)) e.respondWith(cdn(req));
});
