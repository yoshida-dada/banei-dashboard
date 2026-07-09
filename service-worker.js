/* ばんえい予測レビュー PWA サービスワーカー
   - アプリ外殻(HTML/アイコン/マニフェスト)は cache-first でオフライン起動
   - data.json は network-first（最新予測を優先、オフライン時は最後に取得したものを表示）*/
const CACHE = "banei-review-v1";
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

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);

  // data.json（?t=... のキャッシュ回避付き）は network-first
  if (url.pathname.endsWith("/data.json")) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("./data.json", copy));
          return res;
        })
        .catch(() => caches.match("./data.json"))
    );
    return;
  }

  // それ以外の外殻は cache-first
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});
