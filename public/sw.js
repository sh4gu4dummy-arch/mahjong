/* AA Mahjong asset cache — Cache API, not localStorage */
const CACHE = "aa-mahjong-assets-1.4.5";
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
  "tiles/Back.svg",
  "tiles/Chun.svg",
  "tiles/Front.svg",
  "tiles/Haku.svg",
  "tiles/Hatsu.svg",
  "tiles/Man1.svg",
  "tiles/Man2.svg",
  "tiles/Man3.svg",
  "tiles/Man4.svg",
  "tiles/Man5.svg",
  "tiles/Man6.svg",
  "tiles/Man7.svg",
  "tiles/Man8.svg",
  "tiles/Man9.svg",
  "tiles/Nan.svg",
  "tiles/Pei.svg",
  "tiles/Pin1.svg",
  "tiles/Pin2.svg",
  "tiles/Pin3.svg",
  "tiles/Pin4.svg",
  "tiles/Pin5.svg",
  "tiles/Pin6.svg",
  "tiles/Pin7.svg",
  "tiles/Pin8.svg",
  "tiles/Pin9.svg",
  "tiles/Shaa.svg",
  "tiles/Sou1.svg",
  "tiles/Sou2.svg",
  "tiles/Sou3.svg",
  "tiles/Sou4.svg",
  "tiles/Sou5.svg",
  "tiles/Sou6.svg",
  "tiles/Sou7.svg",
  "tiles/Sou8.svg",
  "tiles/Sou9.svg",
  "tiles/Ton.svg"
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
