/* ばんえい予測レビュー PWA サービスワーカー
   - HTML(index.html/ナビゲーション) と data.json は network-first（更新を確実に反映、オフライン時はキャッシュ）
   - アイコン/マニフェスト等の静的アセットは cache-first
   ※ 外殻(index.html)更新を確実に届けるため v2 で network-first に変更。CACHE名を上げて旧キャッシュを破棄。
   ※ v3: 発走前通知（showNotification / notificationclick / push）に対応。*/
const CACHE = "banei-review-v3";
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

// --- 発走前通知（KEIRIN 踏襲）---
// 通常はページ側の setTimeout から registration.showNotification で発火する。
// 将来サーバから Web Push する場合に備え push ハンドラも用意（同一実装）。
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data ? e.data.text() : "" }; }
  const title = d.title || "ばんえい予測レビュー";
  const opts = {
    body: d.body || "",
    tag: d.tag || "banei",
    renotify: true,
    icon: "./icon-192.png",
    badge: "./icon-192.png",
    data: { url: d.url || "./" },
  };
  e.waitUntil(self.registration.showNotification(title, opts));
});

// 通知タップでダッシュボードを前面化（既存タブがあれば再利用）
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "./";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => {
      for (const c of cs) { if ("focus" in c) return c.focus(); }
      return self.clients.openWindow ? self.clients.openWindow(url) : null;
    })
  );
});
