import "./style.css";
import { start } from "./ui/app";

const app = document.querySelector<HTMLElement>("#app");
if (!app) throw new Error("#app missing");
start(app);

/** Prefer Cache API / HTTP cache — do not stuff images into localStorage. */
function registerAssetCache(): void {
  if (!("serviceWorker" in navigator)) return;
  const sw = new URL("sw.js", window.location.href);
  void navigator.serviceWorker.register(sw.href).then((reg) => {
    void reg.update();
  }).catch(() => undefined);
}

function warmImages(): void {
  const hold = "hold8";
  const urls = [
    "avatars/player.png?v=a1",
    "avatars/player-face.png?v=face7",
    "avatars/right.png?v=l1",
    "avatars/opposite.png?v=j2",
    "avatars/left.png?v=c2",
    "tiles/Back.png?v=png2",
    "bg/park.png?v=park2",
    "props/coffee.png?v=cut3",
    "props/beer.png?v=cut3",
    "props/cigarette.png?v=cut3",
    `chars/player-full.png?v=cut3`,
    `chars/player-face.png?v=${hold}`,
    `chars/player-hold-beer.png?v=${hold}`,
    `chars/player-hold-coffee.png?v=${hold}`,
    `chars/player-hold-cigarette.png?v=${hold}`,
    `chars/player-hold-beer-face.png?v=${hold}`,
    `chars/player-hold-coffee-face.png?v=${hold}`,
    `chars/player-hold-cigarette-face.png?v=${hold}`,
    `chars/opposite-full.png?v=cut3`,
    `chars/opposite-hold-beer.png?v=${hold}`,
    `chars/opposite-hold-coffee.png?v=${hold}`,
    `chars/opposite-hold-cigarette.png?v=${hold}`,
  ];
  for (const u of urls) {
    const img = new Image();
    img.decoding = "async";
    img.src = u;
  }
}

registerAssetCache();
warmImages();
