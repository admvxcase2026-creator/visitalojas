/* Service worker do app de Visitas VX Case.
   - Guarda o app no aparelho (abre sem internet).
   - index.html: tenta a rede primeiro (pega atualizações) e cai no que está guardado.
   - Bibliotecas e fontes de CDN: usa o guardado e atualiza em segundo plano.
   - Supabase (dados e fotos): sempre direto na rede, nunca guardado aqui. */
const VERSAO = 'vx-visitas-v12';
const APP = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png', './favicon.svg', './favicon-32.png', './favicon.ico'];
const LIBS = [
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js',
];
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSAO);
    await Promise.all(APP.map(u => c.add(u).catch(() => {})));
    await Promise.all(LIBS.map(u => c.add(new Request(u, { mode: 'cors' })).catch(() => {})));
    self.skipWaiting();
  })());
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const ks = await caches.keys();
    await Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('message', e => { if (e.data === 'skip') self.skipWaiting(); });
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.hostname.endsWith('supabase.co')) return;               // dados: direto na rede
  const mesmaOrigem = u.origin === self.location.origin;
  if (mesmaOrigem) {
    e.respondWith((async () => {
      const c = await caches.open(VERSAO);
      try {
        const r = await fetch(req);
        if (r && r.ok) c.put(req, r.clone());
        return r;
      } catch (err) {
        const hit = await c.match(req, { ignoreSearch: true }) || (req.mode === 'navigate' ? await c.match('./index.html') : null);
        if (hit) return hit;
        throw err;
      }
    })());
    return;
  }
  // CDN (bibliotecas, fontes): guardado primeiro, atualiza por trás
  e.respondWith((async () => {
    const c = await caches.open(VERSAO);
    const hit = await c.match(req);
    const rede = fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()); return r; }).catch(() => null);
    return hit || (await rede) || new Response('', { status: 504 });
  })());
});
