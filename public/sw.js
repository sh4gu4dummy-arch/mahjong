/* AA Mahjong asset cache — Cache API, not localStorage */
const CACHE = "aa-mahjong-assets-1.4.19";
const PRECACHE = [
  "avatars/left.png",
  "avatars/opposite.png",
  "avatars/player.png",
  "avatars/right.png",
  "avatars/player-face.png",
  "bg/park.png",
  "chars/opposite-full.png",
  "chars/player-full.png",
  "chars/player-face.png",
  "chars/player-hold-beer.png",
  "chars/player-hold-coffee.png",
  "chars/player-hold-cigarette.png",
  "chars/opposite-hold-beer.png",
  "chars/opposite-hold-coffee.png",
  "chars/opposite-hold-cigarette.png",
  "props/beer.png",
  "props/cigarette.png",
  "props/coffee.png",
  "tiles/Back.png",
  "tiles/Chun.png",
  "tiles/Front.png",
  "tiles/Haku.png",
  "tiles/Hatsu.png",
  "tiles/Man1.png",
  "tiles/Man2.png",
  "tiles/Man3.png",
  "tiles/Man4.png",
  "tiles/Man5.png",
  "tiles/Man6.png",
  "tiles/Man7.png",
  "tiles/Man8.png",
  "tiles/Man9.png",
  "tiles/Nan.png",
  "tiles/Pei.png",
  "tiles/Pin1.png",
  "tiles/Pin2.png",
  "tiles/Pin3.png",
  "tiles/Pin4.png",
  "tiles/Pin5.png",
  "tiles/Pin6.png",
  "tiles/Pin7.png",
  "tiles/Pin8.png",
  "tiles/Pin9.png",
  "tiles/Shaa.png",
  "tiles/Sou1.png",
  "tiles/Sou2.png",
  "tiles/Sou3.png",
  "tiles/Sou4.png",
  "tiles/Sou5.png",
  "tiles/Sou6.png",
  "tiles/Sou7.png",
  "tiles/Sou8.png",
  "tiles/Sou9.png",
  "tiles/Ton.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll(
        PRECACHE.map((p) => new Request("./" + p, { cache: "reload" })),
      ).catch(() => undefined),
    ).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k.startsWith("aa-mahjong-assets-") && k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const path = url.pathname;
  const isAsset = /\.(png|svg|jpe?g|webp)$/i.test(path) ||
    /\/(tiles|avatars|chars|props|bg)\//.test(path);
  if (!isAsset) return;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      } catch (err) {
        if (hit) return hit;
        throw err;
      }
    }),
  );
});
