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
  const urls = [
    "avatars/player.png?v=a1",
    "avatars/right.png?v=l1",
    "avatars/opposite.png?v=j2",
    "avatars/left.png?v=c2",
    "tiles/Back.png?v=png2",
    "chars/player-full.png?v=cut2",
    "chars/opposite-full.png?v=cut2",
    "bg/park.png",
    "props/coffee.png?v=cut3",
    "props/beer.png?v=cut3",
    "props/cigarette.png?v=cut3",
  ];
  for (const u of urls) {
    const img = new Image();
    img.decoding = "async";
    img.src = u;
  }
}

registerAssetCache();
warmImages();
