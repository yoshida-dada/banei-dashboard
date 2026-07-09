/* ばんえい予測レビュー PWA サービスワーカー
   - HTML(index.html/ナビゲーション) と data.json は network-first（更新を確実に反映、オフライン時はキャッシュ）
   - アイコン/マニフェスト等の静的アセットは cache-first
   ※ 外殻(index.html)更新を確実に届けるため v2 で network-first に変更。CACHE名を上げて旧キャッシュを破棄。*/
const CACHE = "banei-review-v2";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function networkFirst(request, cacheKey) {
  return fetch(request)
    .then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(cacheKey, copy));
      return res;
    })
    .catch(() => caches.match(cacheKey).then((r) => r || caches.match("./index.html")));
}

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);

  // data.json は network-first
  if (url.pathname.endsWith("/data.json")) {
    e.respondWith(networkFirst(e.request, "./data.json"));
    return;
  }
  // HTML（ナビゲーション / index.html / ルート）は network-first で最新の外殻を反映
  const isDoc = e.request.mode === "navigate"
    || url.pathname.endsWith("/index.html")
    || url.pathname.endsWith("/banei-dashboard/")
    || url.pathname === "/";
  if (isDoc) {
    e.respondWith(networkFirst(e.request, "./index.html"));
    return;
  }
  // その他アセットは cache-first
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});
