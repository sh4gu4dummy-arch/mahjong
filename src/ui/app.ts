import type { Claim, GameState, Player, Tile, Wind } from "../game/types";
import { sortTiles } from "../game/tiles";
import {
  applyDiscard,
  aiPlayDiscard,
  beginRound,
  canSelfWin,
  createTable,
  declareKong,
  declareSelfWin,
  drawCurrent,
  formatCash,
  humanClaim,
  humanKongOptions,
  humanPass,
  nextHand,
  resetTable,
} from "../game/engine";
import { selfTestWin } from "../game/win";
import { isMuted, loadMute, resume, setMuted, sfx } from "./audio";
import { tileFaceSvg, tileCssClass } from "./tileFace";
import { getLang, loadLang, setLang, getTips, loadTips, setTips, getAutoTips, loadAutoTips, setAutoTips, getAutoPace, loadAutoPace, setAutoPace, paceFactor, getAFace, loadAFace, setAFace, t, type Lang, type AutoPace, type AFace } from "./i18n";
import { chooseTipDiscard } from "../game/ai";
import { loadSave, saveGame } from "./persist";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** When Auto is on + Slow, stretch play timing 3× so you can watch. */
const paced = (ms: number) => sleep(ms * (getAutoTips() ? paceFactor() : 1));
// paceFactor: Slow ≈5× / Fast ≈0.65× of base Auto delays

let state: GameState = createTable();
let selected: number | null = null;
let busy = false;
let gen = 0;
let betDraft = 10;
let root: HTMLElement;
let shopOpen = false;
let shopFlash = "";
let menuOpen = false;
let resultDismissed = false;

/** UI-only dealing: how many tiles revealed per seat (engine already dealt). */
let dealReveal: [number, number, number, number] | null = null;
/** Flying draw overlay */
let flyDraw: { seat: number; tile: Tile | null; key: number } | null = null;
let flyKey = 0;

let saveTimer: number | null = null;
let autoTimer: number | null = null;
let autoToken = 0;

function clearAutoTimer(): void {
  if (autoTimer !== null) {
    window.clearTimeout(autoTimer);
    autoTimer = null;
  }
  autoToken += 1;
}

function scheduleSave(): void {
  if (saveTimer !== null) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    saveTimer = null;
    saveGame(state, betDraft, selected);
  }, 150);
}

function saveNow(): void {
  if (saveTimer !== null) {
    window.clearTimeout(saveTimer);
    saveTimer = null;
  }
  saveGame(state, betDraft, selected);
}

type ShopPropId = "coffee" | "cigarette" | "beer";
interface ShopItem {
  id: ShopPropId;
  name: string;
  nameZh: string;
  price: number;
  src: string;
  emoji: string;
}
interface SeatProp {
  id: ShopPropId;
  until: number;
}

const PROP_MS = 3800;
const SHOP_ITEMS: ShopItem[] = [
  { id: "coffee", name: "Coffee", nameZh: "咖啡", price: 5, src: "props/coffee.png?v=cut3", emoji: "☕" },
  { id: "cigarette", name: "Cigarette", nameZh: "烟", price: 1, src: "props/cigarette.png?v=cut3", emoji: "🚬" },
  { id: "beer", name: "Beer", nameZh: "啤酒", price: 5, src: "props/beer.png?v=cut3", emoji: "🍺" },
];
const seatProp: Record<number, SeatProp | undefined> = {};
const seatPropTimers: Record<number, number> = {};

const SEAT_POS = ["bottom", "right", "top", "left"] as const;
const SEAT_AVATAR = [
  "avatars/player.png?v=a1",
  "avatars/right.png?v=l1",
  "avatars/opposite.png?v=j2",
  "avatars/left.png?v=c2",
] as const;

/** Counter-clockwise from East: E(0) → N(3) → W(2) → S(1) */
const DEAL_ORDER = [0, 3, 2, 1] as const;

const WIND_KIND: Record<Wind, string> = { E: "we", S: "ws", W: "ww", N: "wn" };

function tipDiscardTile(): Tile | null {
  if (dealReveal || busy) return null;
  if (state.phase !== "discard" || state.current !== 0) return null;
  const p = state.players[0]!;
  if (!p.hand.length) return null;
  return chooseTipDiscard(p, WIND_KIND[p.seat], WIND_KIND[state.roundWind]);
}

function tipDiscardId(): number | null {
  // Highlight only when Tips ON; Auto follows tip engine even if highlight is off.
  if (!getTips()) return null;
  const tip = tipDiscardTile();
  return tip ? tip.id : null;
}

function tileEl(
  tile: Tile,
  opts: {
    size?: "hand" | "mini" | "wall";
    selected?: boolean;
    last?: boolean;
    back?: boolean;
    drawn?: boolean;
    arriving?: boolean;
    toss?: boolean;
    tip?: boolean;
  } = {},
): string {
  const css = tileCssClass(tile);
  const honor = tile.suit === "wind" || tile.suit === "dragon";
  const cls = [
    "tile",
    css,
    honor ? "honor" : "",
    opts.size === "hand" ? "hand-tile" : "",
    opts.size === "wall" ? "wall-tile" : "",
    opts.selected ? "selected" : "",
    opts.last ? "last" : "",
    opts.drawn ? "drawn" : "",
    opts.back ? "back" : "",
    opts.arriving ? "arriving" : "",
    opts.toss ? "toss" : "",
    opts.tip ? "tip" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const face = opts.back ? backFaceHtml() : tileFaceSvg(tile);
  if (opts.size === "hand") {
    const badge = opts.tip ? `<span class="tip-badge" aria-hidden="true">💡</span>` : "";
    const tipAria = opts.tip ? ` aria-label="${t("tipAria")}"` : "";
    return `<button type="button" class="${cls}" data-act="select" data-id="${tile.id}"${tipAria}>${face}${badge}</button>`;
  }
  return `<span class="${cls}" data-id="${tile.id}">${face}</span>`;
}

function backFaceHtml(): string {
  return `<img class="face-img back-face" src="tiles/Back.png?v=png2" alt="" draggable="false" decoding="async" aria-hidden="true" />`;
}

function backs(n: number, arriving = false): string {
  return Array.from({ length: n }, (_, i) => {
    const last = arriving && i === n - 1 ? " arriving" : "";
    return `<span class="tile back${last}">${backFaceHtml()}</span>`;
  }).join("");
}

function meldHtml(p: Player): string {
  return p.melds
    .map((m) => `<div class="meld ${m.concealed ? "concealed" : ""}">${m.tiles.map((t) => tileEl(t)).join("")}</div>`)
    .join("");
}

function riverHtml(p: Player): string {
  const lastId = state.lastDiscard?.id;
  return p.river.map((t) => tileEl(t, { last: t.id === lastId, toss: t.id === lastId })).join("");
}

function cashChip(p: Player): string {
  // Only the human wallet is visible; AI money is unlimited and hidden.
  if (!p.isHuman) return "";
  return `<span class="cash">${formatCash(p.cash)}</span>`;
}


function seatRelLabel(i: number): string {
  if (i === 0) return t("seatYou");
  if (i === 1) return t("seatRight"); // 下家 / next
  if (i === 2) return t("seatOpp"); // 对家
  return t("seatLeft"); // 上家 / prev
}

function playerAvatarSrc(): string {
  return getAFace() === "camera" ? "avatars/player-face.png?v=face2" : "avatars/player.png?v=a1";
}

const HOLD_POSE_V = "hold1";

function playerFullSrc(prop?: ShopPropId | null): string {
  // Holding an item uses a gripped full-body pose (overrides face toggle for now).
  if (prop === "beer") return `chars/player-hold-beer.png?v=${HOLD_POSE_V}`;
  if (prop === "coffee") return `chars/player-hold-coffee.png?v=${HOLD_POSE_V}`;
  if (prop === "cigarette") return `chars/player-hold-cigarette.png?v=${HOLD_POSE_V}`;
  return getAFace() === "camera" ? "chars/player-face.png?v=face2" : "chars/player-full.png?v=cut2";
}

function oppositeFullSrc(prop?: ShopPropId | null): string {
  if (prop === "beer") return `chars/opposite-hold-beer.png?v=${HOLD_POSE_V}`;
  if (prop === "coffee") return `chars/opposite-hold-coffee.png?v=${HOLD_POSE_V}`;
  if (prop === "cigarette") return `chars/opposite-hold-cigarette.png?v=${HOLD_POSE_V}`;
  return "chars/opposite-full.png?v=cut2";
}

function faceToggleHtml(where: "dock" | "shop"): string {
  const face = getAFace();
  return `<div class="face-toggle" role="group" aria-label="${t("faceAria")}" data-where="${where}">
    <button type="button" class="face-btn ${face === "away" ? "on" : ""}" data-act="a-face" data-face="away">${t("faceAway")}</button>
    <button type="button" class="face-btn ${face === "camera" ? "on" : ""}" data-act="a-face" data-face="camera">${t("faceCamera")}</button>
  </div>`;
}

function avatarHtml(i: number, active: boolean): string {
  const p = state.players[i]!;
  const src = i === 0 ? playerAvatarSrc() : SEAT_AVATAR[i]!;
  const rel = seatRelLabel(i);
  const toggle = i === 0 ? faceToggleHtml("dock") : "";
  // No floating prop stickers on circular avatars
  return `<div class="avatar-wrap ${active ? "turn" : ""}">
    <div class="avatar-ring">
      <img class="avatar" src="${src}" alt="${rel}" draggable="false" />
    </div>
    <div class="avatar-meta">
      <span class="avatar-name">${rel}</span>
      ${cashChip(p)}
      ${toggle}
    </div>
  </div>`;
}

function visibleHandCount(i: number): number {
  if (!dealReveal) return state.players[i]!.hand.length;
  return dealReveal[i] ?? 0;
}

function seatHtml(i: number): string {
  const p = state.players[i]!;
  const pos = SEAT_POS[i]!;
  const active = state.current === i && state.phase !== "over" && state.phase !== "bet" && !dealReveal;
  const act = active ? "active" : "";
  const nShow = visibleHandCount(i);
  const aiArriving = !!(flyDraw && flyDraw.seat === i && i !== 0);
  if (i === 0) {
    return `<div class="seat pos-${pos} ${act}">
      <div class="melds">${meldHtml(p)}</div>
      <div class="river">${riverHtml(p)}</div>
    </div>`;
  }
  return `<div class="seat pos-${pos} ${act}">
    ${avatarHtml(i, active)}
    <div class="backs">${backs(nShow, aiArriving)}</div>
    <div class="melds">${meldHtml(p)}</div>
    <div class="river">${riverHtml(p)}</div>
  </div>`;
}

/** Visual wall count: engine wall + unrevealed dealt tiles during deal animation. */
function visualWallCount(): number {
  if (state.phase === "bet") return 0;
  if (!dealReveal) return state.wall.length;
  let hidden = 0;
  for (let i = 0; i < 4; i++) {
    hidden += Math.max(0, state.players[i]!.hand.length - (dealReveal[i] ?? 0));
  }
  return state.wall.length + hidden;
}

function wallSideHtml(count: number, side: string): string {
  // Single-layer clean wall: one row of backs per side (no 2-high offset stacks).
  const maxShow = 17;
  const show = Math.min(Math.max(0, count), maxShow);
  const items = Array.from({ length: show }, () =>
    `<span class="tile back wall-tile">${backFaceHtml()}</span>`,
  ).join("");
  return `<div class="wall-side wall-${side}" style="--n:${show}">${items}</div>`;
}

function tileWallHtml(last: Tile | null = null): string {
  const playing = state.phase !== "bet";
  if (!playing) {
    return `<div class="tile-wall empty">
      <div class="wall-label">${t("betting")}</div>
    </div>`;
  }
  const n = visualWallCount();
  // Distribute across 4 sides as evenly as possible
  const base = Math.floor(n / 4);
  const rem = n % 4;
  const counts = [0, 1, 2, 3].map((i) => base + (i < rem ? 1 : 0));
  const mid = last
    ? `<div class="wall-hub last-discard-slot">
        <span class="label">${t("lastDiscard")}</span>
        ${tileEl(last, { last: true, toss: true })}
      </div>`
    : `<div class="wall-hub" aria-hidden="true"></div>`;
  // Sides: bottom(East-facing), right, top, left — visual only
  return `<div class="tile-wall" aria-label="${t("wall")} ${n}">
    ${wallSideHtml(counts[2]!, "top")}
    ${wallSideHtml(counts[3]!, "left")}
    ${mid}
    ${wallSideHtml(counts[1]!, "right")}
    ${wallSideHtml(counts[0]!, "bottom")}
  </div>`;
}

function flyOverlay(): string {
  if (!flyDraw) return "";
  const pos = SEAT_POS[flyDraw.seat]!;
  const face =
    flyDraw.seat === 0 && flyDraw.tile
      ? tileEl(flyDraw.tile, { size: "hand", drawn: true })
      : `<span class="tile back hand-tile">${backFaceHtml()}</span>`;
  return `<div class="fly-layer"><div class="fly-tile to-${pos}" data-k="${flyDraw.key}">${face}</div></div>`;
}

function claimButtons(): string {
  if (state.phase !== "claim" || !state.pendingHumanClaims.length) return "";
  const types = new Set(state.pendingHumanClaims.map((c) => c.type));
  const chows = state.pendingHumanClaims.filter((c) => c.type === "chow");
  const btns: string[] = [];
  if (types.has("win")) btns.push(`<button class="act win" data-act="claim-win">${t("win")}</button>`);
  if (types.has("kong")) btns.push(`<button class="act kong" data-act="claim-kong">${t("kong")}</button>`);
  if (types.has("pung")) btns.push(`<button class="act pung" data-act="claim-pung">${t("pung")}</button>`);
  for (const c of chows) {
    const a = c.chow!.tiles[0]!;
    const b = c.chow!.tiles[1]!;
    btns.push(
      `<button class="act chow chow-preview" data-act="claim-chow" data-a="${a.id}" data-b="${b.id}">
        ${t("chow")} ${tileEl(a)}${tileEl(b)}
      </button>`,
    );
  }
  btns.push(`<button class="act pass" data-act="pass">${t("pass")}</button>`);
  return btns.join("");
}

function turnButtons(): string {
  // After Close on end screen: big Next round so the table isn't a dead end.
  if (state.phase === "over" && resultDismissed) {
    return `<button class="act win next-round-dock" data-act="next">${t("nextRound")}</button>`;
  }
  // Always keep Discard + Sort in the dock so the bar doesn't jump.
  const myDiscard = !dealReveal && !busy && state.phase === "discard" && state.current === 0;
  const btns: string[] = [];
  if (myDiscard) {
    if (canSelfWin(state, 0)) btns.push(`<button class="act win" data-act="self-win">${t("selfWin")}</button>`);
    for (const k of humanKongOptions(state)) {
      btns.push(
        `<button class="act kong" data-act="self-kong" data-kind="${k.kind}" data-mode="${k.mode}">${t("kong")}</button>`,
      );
    }
  }
  if (!dealReveal && state.phase === "claim") btns.push(claimButtons());
  const canDiscard = myDiscard && selected !== null;
  const canSort = myDiscard;
  btns.push(
    `<button class="act discard" data-act="discard" ${canDiscard ? "" : "disabled"}>${t("discard")}</button>`,
  );
  btns.push(`<button class="act sort" data-act="sort" ${canSort ? "" : "disabled"}>${t("sort")}</button>`);
  return btns.join("");
}


function payoutLines(): string {
  const w = state.winResult;
  if (!w) return "";
  if (!w.payouts.length) {
    return `<p class="sub">${t("stakeAmount")} $${w.stake} · ${t("noCashMoved")}</p>`;
  }
  const names = state.players.map((_, i) => seatRelLabel(i));
  const rows = w.payouts
    .map((x) => `<li><span>${names[x.from]} → ${names[x.to]}</span><span class="pts">${formatCash(x.amount)}</span></li>`)
    .join("");
  const scheme = w.selfDraw ? t("paySelf") : t("payDiscard");
  let youNet = 0;
  for (const x of w.payouts) {
    if (x.to === 0) youNet += x.amount;
    if (x.from === 0) youNet -= x.amount;
  }
  const youLine =
    youNet > 0
      ? `<p class="sub wallet-delta up">${t("youGot")} ${formatCash(youNet)}</p>`
      : youNet < 0
        ? `<p class="sub wallet-delta down">${t("youPaid")} ${formatCash(-youNet)}</p>`
        : `<p class="sub wallet-delta">${t("noWalletChange")}</p>`;
  return `<p class="sub">${scheme} · ${t("stakeAmount")} $${w.stake}</p><ul class="fan-list">${rows}</ul>${youLine}`;
}

function shopOverlay(): string {
  if (!shopOpen) return "";
  const cash = state.players[0]!.cash;
  const flash = shopFlash ? `<p class="shop-flash">${shopFlash}</p>` : "";
  const items = SHOP_ITEMS.map((item) => {
    const can = cash >= item.price;
    const label = getLang() === "zh" ? `${item.emoji} ${item.nameZh}` : `${item.emoji} ${item.name}`;
    const itemAlt = getLang() === "zh" ? item.nameZh : item.name;
    return `<div class="shop-item">
      <img class="shop-item-img" src="${item.src}" alt="${itemAlt}" draggable="false" />
      <div class="shop-item-info">
        <strong>${label}</strong>
        <span>$${item.price} · ${t("shopBoth")}</span>
      </div>
      <button class="btn shop-buy" data-act="buy-prop" data-item="${item.id}" ${can ? "" : "disabled"}>
        ${t("buy")} · $${item.price}
      </button>
    </div>`;
  }).join("");
  return `<div class="shop-scene" role="dialog" aria-label="${t("shopTitle")}">
    <div class="shop-bg" style="background-image:url('bg/park.png')" aria-hidden="true"></div>
    <div class="shop-stage">
      <div class="shop-char-full you">
        <div class="shop-char-body">
          <img class="shop-full" src="${playerFullSrc(seatProp[0]?.id)}" alt="${t("seatYou")}" draggable="false" />
        </div>
        <span class="shop-char-label">${t("seatYou")}</span>
        ${faceToggleHtml("shop")}
      </div>
      <div class="shop-char-full opp">
        <div class="shop-char-body">
          <img class="shop-full" src="${oppositeFullSrc(seatProp[2]?.id)}" alt="${t("seatOpp")}" draggable="false" />
        </div>
        <span class="shop-char-label">${t("seatOpp")}</span>
      </div>
    </div>
    <aside class="shop-panel">
      <h2>${t("shopTitle")}</h2>
      <p class="sub">${t("shopSub")} ${formatCash(cash)}</p>
      <div class="shop-catalog">${items}</div>
      ${flash}
      ${cash < 1 ? `<p class="sub">${t("walletEmpty")}</p>` : ""}
      <div class="modal-actions">
        <button class="btn" data-act="shop-close">${t("close")}</button>
      </div>
    </aside>
  </div>`;
}

function overlay(): string {
  if (shopOpen) return shopOverlay();
  if (state.phase === "bet") {
    const cash = state.players[0]!.cash;
    const presets = [0, 1, 5, 10, 20, 50].filter((n) => n <= cash);
    if (cash > 0 && !presets.includes(cash) && cash < 1000) presets.push(cash);
    if (!presets.includes(0)) presets.unshift(0);
    const clamped = Math.max(0, Math.min(betDraft, cash));
    const chips = presets
      .map(
        (n) =>
          `<button class="bet-chip ${clamped === n ? "on" : ""}" data-act="bet-set" data-n="${n}">$${n}</button>`,
      )
      .join("");
    const zeroNote =
      cash === 0
        ? `<p class="sub">${t("prideNote")}</p>
      <button class="btn" data-act="refuel" type="button">${t("refuelCash")}</button>`
        : "";
    return `<div class="overlay"><div class="modal">
      <div class="modal-hero"><img class="avatar hero" src="${playerAvatarSrc()}" alt="${t("you")}" /></div>
      <h2>${t("brand")}</h2>
      <p class="sub">${t("hand")} ${state.handNumber} · ${t("youHave")} ${formatCash(cash)}</p>
      <div class="bet-row">${chips}</div>
      ${zeroNote}
      ${t("rulesMini") ? `<p class="rules-mini">${t("rulesMini")}</p>` : ""}
      <button class="btn" data-act="deal">${t("deal")} · ${formatCash(clamped)}</button>
    </div></div>`;
  }
  if (state.phase !== "over") return "";
  if (resultDismissed) return "";
  if (state.drawGame) {
    return `<div class="overlay"><div class="modal">
      <h2>${t("drawGame")}</h2>
      <p class="sub">${t("drawGameSub")}</p>
      <div class="modal-actions">
        <button class="btn" data-act="next">${t("nextRound")}</button>
        <button class="btn ghost" data-act="close-result">${t("closeResult")}</button>
      </div>
    </div></div>`;
  }
  const w = state.winResult;
  const winnerIdx = state.winner ?? 0;
  const title = winnerIdx === 0 ? t("youWin") : `${seatRelLabel(winnerIdx)} ${t("someoneWins")}`;
  const how = w?.selfDraw
    ? t("selfDrawHow")
    : `${t("discardWinHow")} · ${w?.loser != null ? seatRelLabel(w.loser) : "?"}`;
  const lines = (w?.lines ?? [])
    .map((l) => {
      const name = getLang() === "zh" ? l.nameZh : l.name;
      return `<li><span>${name}</span><span class="pts">${l.fan ? `${l.fan} ${t("fanUnit")}` : "✓"}</span></li>`;
    })
    .join("");
  const tiles = sortTiles(w?.concealed ?? []).map((tile) => tileEl(tile)).join("");
  const melds = (w?.melds ?? []).map((m) => `<div class="meld">${m.tiles.map((tile) => tileEl(tile)).join("")}</div>`).join("");
  return `<div class="overlay"><div class="modal">
    <h2>${title}</h2>
    <p class="sub">${how}</p>
    <div class="win-tiles">${melds}${tiles}</div>
    <ul class="fan-list">${lines}</ul>
    ${payoutLines()}
    <div class="balances"><span>${t("you")} ${formatCash(state.players[0]!.cash)}</span></div>
    <div class="modal-actions">
      <button class="btn" data-act="next">${t("nextRound")}</button>
      <button class="btn ghost" data-act="close-result">${t("closeResult")}</button>
    </div>
  </div></div>`;
}

function humanHandHtml(): string {
  const hand = state.players[0]!.hand;
  const n = visibleHandCount(0);
  const shown = hand.slice(0, n);
  const arrivingId = flyDraw && flyDraw.seat === 0 && flyDraw.tile ? flyDraw.tile.id : -1;
  const tipId = tipDiscardId();
  return shown
    .map((tile) =>
      tileEl(tile, {
        size: "hand",
        selected: tile.id === selected,
        drawn: tile.id === state.lastDraw?.id && !dealReveal,
        arriving: tile.id === arrivingId,
        tip: tipId !== null && tile.id === tipId,
      }),
    )
    .join("");
}


function cashPill(): string {
  return `<span class="cash-pill">${t("you")} <b>${formatCash(state.players[0]!.cash)}</b></span>`;
}

function overflowMenu(mute: string): string {
  return `<div class="topbar-more">
    <button type="button" class="btn ghost menu-btn" data-act="menu-toggle" aria-expanded="${menuOpen ? "true" : "false"}" aria-label="${t("menu")}">⋯</button>
    <div class="overflow-menu ${menuOpen ? "open" : ""}" role="menu">
      <div class="overflow-meta">
        <span>${t("hand")} <b>${state.handNumber}</b></span>
        <span>${t("stake")} <b>${formatCash(state.stake)}</b></span>
      </div>
      ${langToggle()}
      <button type="button" class="btn ghost overflow-item" data-act="mute" role="menuitem">${mute}</button>
      <button type="button" class="btn ghost overflow-item" data-act="next" role="menuitem">${t("next")}</button>
      <button type="button" class="btn overflow-item" data-act="reset" role="menuitem">${t("reset")}</button>
    </div>
  </div>`;
}

function langToggle(): string {
  const cur = getLang();
  return `<div class="lang-toggle" role="group" aria-label="${t("language")}">
    <button type="button" class="lang-btn ${cur === "en" ? "on" : ""}" data-act="lang" data-lang="en">EN</button>
    <button type="button" class="lang-btn ${cur === "zh" ? "on" : ""}" data-act="lang" data-lang="zh">中文</button>
  </div>`;
}

function tipsToggle(): string {
  const on = getTips();
  const auto = getAutoTips();
  const pace = getAutoPace();
  const paceBtns = auto
    ? `<div class="pace-toggle" role="group" aria-label="${t("paceAria")}">
        <button type="button" class="act pace-act ${pace === "fast" ? "on" : ""}" data-act="auto-pace" data-pace="fast">${t("paceFast")}</button>
        <button type="button" class="act pace-act ${pace === "slow" ? "on" : ""}" data-act="auto-pace" data-pace="slow">${t("paceSlow")}</button>
      </div>`
    : "";
  return `<div class="tips-toggle dock-tips" role="group" aria-label="${t("tipsAria")}">
    <button type="button" class="act tips-act ${on ? "on" : ""}" data-act="tips" data-on="${on ? "0" : "1"}">${t("tips")} · ${on ? t("tipsOn") : t("tipsOff")}</button>
    <button type="button" class="act auto-act ${auto ? "on" : ""}" data-act="auto-tips" data-on="${auto ? "0" : "1"}">${t("auto")} · ${auto ? t("autoOn") : t("autoOff")}</button>
    ${paceBtns}
  </div>`;
}

export function render(): void {
  const mute = isMuted() ? t("unmute") : t("mute");
  const last = state.lastDiscard;
  const playing = state.phase !== "bet";

  // Full-screen park shop — hide the entire mahjong board while open.
  if (shopOpen) {
    root.innerHTML = `
      <header class="topbar shop-topbar">
        <div class="brand"><h1>${t("brand")}</h1></div>
        <div class="topbar-main">
          ${cashPill()}
          <button class="btn" data-act="shop-close">${t("close")}</button>
        </div>
        ${overflowMenu(mute)}
        <div class="topbar-center desktop-only">
          ${cashPill()}
          ${langToggle()}
        </div>
        <div class="toolbar desktop-toolbar">
          <button class="btn ghost" data-act="mute">${mute}</button>
          <button class="btn" data-act="shop-close">${t("close")}</button>
        </div>
      </header>
      ${shopOverlay()}
    `;
    clearAutoTimer();
    return;
  }

  root.innerHTML = `
    <header class="topbar">
      <div class="brand"><h1>${t("brand")}</h1></div>
      <div class="topbar-main">
        ${cashPill()}
        <button class="btn shop-btn" data-act="shop">${t("shop")}</button>
      </div>
      ${overflowMenu(mute)}
      <div class="topbar-center desktop-only">
        <div class="meta">
          <span>${t("hand")} <b>${state.handNumber}</b></span>
          <span>${t("stake")} <b>${formatCash(state.stake)}</b></span>
          ${cashPill()}
        </div>
        <button class="btn shop-btn" data-act="shop">${t("shop")}</button>
        ${langToggle()}
      </div>
      <div class="toolbar desktop-toolbar">
        <button class="btn ghost" data-act="mute">${mute}</button>
        <button class="btn ghost" data-act="next">${t("next")}</button>
        <button class="btn" data-act="reset">${t("reset")}</button>
      </div>
    </header>
    <div class="stage">
      <div class="table-frame">
        <div class="table">
          ${seatHtml(2)}
          ${seatHtml(3)}
          ${seatHtml(1)}
          ${seatHtml(0)}
          <div class="center">
            ${tileWallHtml(last)}
            ${flyOverlay()}
          </div>
        </div>
      </div>
      <div class="dock">
        <div class="dock-top">
          ${avatarHtml(0, state.current === 0 && state.phase !== "over" && state.phase !== "bet" && !dealReveal)}
          <div class="hand-row">${humanHandHtml()}</div>
        </div>
        <div class="actions">${turnButtons()}${tipsToggle()}</div>
      </div>
    </div>
    ${overlay()}
  `;
  scheduleAutoPlay();
}

async function animateDeal(my: number): Promise<void> {
  dealReveal = [0, 0, 0, 0];
  busy = true;
  render();

  // 3 rounds × 4 tiles each
  for (let round = 0; round < 3; round++) {
    for (const seat of DEAL_ORDER) {
      if (my !== gen) return;
      dealReveal[seat] = Math.min(dealReveal[seat]! + 4, state.players[seat]!.hand.length);
      sfx.draw();
      render();
      await sleep(55);
    }
  }
  // One each to make 13
  for (const seat of DEAL_ORDER) {
    if (my !== gen) return;
    dealReveal[seat] = Math.min(dealReveal[seat]! + 1, state.players[seat]!.hand.length);
    sfx.draw();
    render();
    await sleep(70);
  }
  // East jump tile (14th)
  if (my !== gen) return;
  dealReveal[0] = Math.min(dealReveal[0]! + 1, state.players[0]!.hand.length);
  sfx.draw();
  render();
  await sleep(120);

  dealReveal = null;
}

async function animateDraw(seat: number, tile: Tile | null): Promise<void> {
  flyKey += 1;
  flyDraw = { seat, tile, key: flyKey };
  render();
  await paced(seat === 0 ? 280 : 240);
  flyDraw = null;
}

async function continuePlay(): Promise<void> {
  const my = gen;
  while (state.phase !== "over" && state.phase !== "claim" && state.phase !== "bet") {
    if (my !== gen) return;
    if (state.phase === "draw") {
      const seat = state.current;
      // Peek: draw happens in engine; animate around it
      await paced(80);
      if (my !== gen) return;
      const beforeLen = state.wall.length;
      drawCurrent(state);
      const drawn = state.lastDraw;
      if (state.wall.length < beforeLen || drawn) {
        sfx.draw();
        await animateDraw(seat, seat === 0 ? drawn : null);
      }
      if (my !== gen) return;
      render();
    }
    if (state.phase as string === "over") break;
    if (state.phase === "discard") {
      if (state.current === 0) break;
      await paced(520 + Math.random() * 280);
      if (my !== gen) return;
      const id = aiPlayDiscard(state);
      if (id >= 0) sfx.discard();
      else if (state.phase as string === "over" && state.winner !== null) sfx.win();
      render();
    }
  }
  if (my !== gen) return;
  busy = false;
  scheduleSave();
  render();
}

async function afterMove(): Promise<void> {
  clearAutoTimer();
  busy = true;
  render();
  await continuePlay();
}

async function startDealAnimation(): Promise<void> {
  const my = gen;
  clearAutoTimer();
  busy = true;
  await animateDeal(my);
  if (my !== gen) return;
  busy = false;
  scheduleSave();
  render();
  // East discard phase — human to play; no auto-continue needed
}

function pickAutoClaim(): Claim | "pass" {
  const claims = state.pendingHumanClaims;
  const win = claims.find((c) => c.type === "win");
  if (win) return win;
  const kong = claims.find((c) => c.type === "kong");
  if (kong) return kong;
  const pung = claims.find((c) => c.type === "pung");
  if (pung) return pung;
  const chows = claims.filter((c) => c.type === "chow");
  if (chows.length) {
    // Prefer a chow — tip-aligned: any available chow counts as useful for 开门 / shape.
    return chows[0]!;
  }
  return "pass";
}

function applyAutoClaim(c: Claim): void {
  humanClaim(state, c);
  if (c.type === "win") sfx.win();
  else sfx.claim();
  selected = null;
  scheduleSave();
  if (c.type === "win") { resultDismissed = false; render(); }
  else void afterMove();
}

function scheduleAutoPlay(): void {
  clearAutoTimer();
  if (!getAutoTips()) return;
  if (busy || dealReveal || shopOpen) return;
  if (state.phase === "bet" || state.phase === "over") return;

  const delay = (550 + Math.floor(Math.random() * 250)) * paceFactor();
  const token = autoToken;

  if (state.phase === "discard" && state.current === 0) {
    autoTimer = window.setTimeout(() => {
      autoTimer = null;
      if (token !== autoToken) return;
      if (!getAutoTips() || busy || dealReveal || shopOpen) return;
      if (state.phase !== "discard" || state.current !== 0) return;

      if (canSelfWin(state, 0)) {
        if (declareSelfWin(state, 0)) sfx.win();
        scheduleSave();
        render();
        return;
      }

      const tip = tipDiscardTile();
      if (!tip) return;
      selected = null;
      applyDiscard(state, tip.id);
      sfx.discard();
      scheduleSave();
      void afterMove();
    }, delay);
    return;
  }

  if (state.phase === "claim" && state.pendingHumanClaims.length) {
    autoTimer = window.setTimeout(() => {
      autoTimer = null;
      if (token !== autoToken) return;
      if (!getAutoTips() || busy || dealReveal || shopOpen) return;
      if (state.phase !== "claim" || !state.pendingHumanClaims.length) return;

      const pick = pickAutoClaim();
      if (pick === "pass") {
        humanPass(state);
        sfx.click();
        scheduleSave();
        void afterMove();
        return;
      }
      applyAutoClaim(pick);
    }, delay);
  }
}

function findClaim(type: Claim["type"], a?: number, b?: number): Claim | undefined {
  return state.pendingHumanClaims.find((c) => {
    if (c.type !== type) return false;
    if (type === "chow" && c.chow) {
      const ids = c.chow.tiles.map((tile) => tile.id).sort();
      return ids[0] === Math.min(a ?? -1, b ?? -1) && ids[1] === Math.max(a ?? -1, b ?? -1);
    }
    return true;
  });
}

function giveProp(seat: number, id: ShopPropId): void {
  seatProp[seat] = { id, until: Date.now() + PROP_MS };
  if (seatPropTimers[seat]) window.clearTimeout(seatPropTimers[seat]);
  seatPropTimers[seat] = window.setTimeout(() => {
    delete seatProp[seat];
    render();
  }, PROP_MS);
}

function buyProp(id: ShopPropId): void {
  const item = SHOP_ITEMS.find((x) => x.id === id);
  if (!item) return;
  const cash = state.players[0]!.cash;
  if (cash < item.price) {
    shopFlash = `${t("needMoney")} · $${item.price}`;
    sfx.click();
    render();
    return;
  }
  state.players[0]!.cash -= item.price;
  giveProp(0, id);
  giveProp(2, id);
  window.setTimeout(() => render(), PROP_MS - 850);
  const nm = getLang() === "zh" ? item.nameZh : item.name;
  shopFlash = `${item.emoji} ${nm} ${t("forBoth")}`;
  sfx.claim();
  scheduleSave();
  render();
}

function goNext(): void {
  gen += 1;
  clearAutoTimer();
  shopOpen = false;
  menuOpen = false;
  resultDismissed = false;
  dealReveal = null;
  flyDraw = null;
  nextHand(state);
  selected = null;
  busy = false;
  const cash = state.players[0]!.cash;
  betDraft = cash === 0 ? 0 : Math.min(betDraft || 10, cash) || Math.min(10, cash);
  sfx.click();
  saveNow();
  render();
}

function goRefuel(): void {
  // Broke top-up: $10 only (new games still start at $100 via Reset).
  state.players[0]!.cash = 10;
  betDraft = 10;
  sfx.click();
  saveNow();
  render();
}

function goReset(): void {
  gen += 1;
  clearAutoTimer();
  shopOpen = false;
  menuOpen = false;
  resultDismissed = false;
  dealReveal = null;
  flyDraw = null;
  state = resetTable();
  selected = null;
  busy = false;
  betDraft = 10;
  sfx.click();
  saveNow();
  render();
}

function onClick(ev: Event): void {
  const target = ev.target as HTMLElement;
  const el = target.closest("[data-act]") as HTMLElement | null;
  if (!el) {
    if (menuOpen && !target.closest(".topbar-more")) {
      menuOpen = false;
      render();
    }
    return;
  }
  resume();
  const act = el.dataset.act;

  if (act === "lang") {
    const next = el.dataset.lang as Lang;
    if (next === "en" || next === "zh") {
      setLang(next);
      menuOpen = false;
      sfx.click();
      render();
    }
    return;
  }
  if (act === "tips") {
    setTips(el.dataset.on === "1");
    sfx.click();
    render();
    return;
  }
  if (act === "auto-tips") {
    setAutoTips(el.dataset.on === "1");
    sfx.click();
    render();
    return;
  }
  if (act === "auto-pace") {
    const p = el.dataset.pace === "slow" ? "slow" : "fast";
    setAutoPace(p as AutoPace);
    sfx.click();
    clearAutoTimer();
    render();
    scheduleAutoPlay();
    return;
  }
  if (act === "menu-toggle") {
    menuOpen = !menuOpen;
    sfx.click();
    render();
    return;
  }
  if (act === "menu-close") {
    menuOpen = false;
    render();
    return;
  }
  if (act === "mute") {
    setMuted(!isMuted());
    menuOpen = false;
    sfx.click();
    render();
    return;
  }
  if (act === "shop") {
    shopOpen = true;
    shopFlash = "";
    menuOpen = false;
    sfx.click();
    render();
    return;
  }
  if (act === "shop-close") {
    shopOpen = false;
    shopFlash = "";
    sfx.click();
    render();
    return;
  }
  if (act === "buy-prop") {
    const id = el.dataset.item as ShopPropId;
    if (id === "coffee" || id === "cigarette" || id === "beer") buyProp(id);
    return;
  }
  if (act === "refuel") {
    goRefuel();
    return;
  }
  if (act === "reset") {
    goReset();
    return;
  }
  if (act === "next") {
    goNext();
    return;
  }
  if (act === "close-result") {
    resultDismissed = true;
    sfx.click();
    render();
    return;
  }
  if (act === "a-face") {
    const f = el.dataset.face === "camera" ? "camera" : "away";
    setAFace(f as AFace);
    sfx.click();
    render();
    return;
  }
  if (act === "bet-set") {
    betDraft = Number(el.dataset.n);
    sfx.click();
    scheduleSave();
    render();
    return;
  }
  if (act === "deal") {
    if (busy) return;
    const cash = state.players[0]!.cash;
    const stake = cash === 0 ? 0 : Math.max(0, Math.min(betDraft, cash));
    beginRound(state, stake);
    selected = null;
    sfx.click();
    scheduleSave();
    void startDealAnimation();
    return;
  }
  if (busy && act !== "mute" && act !== "shop" && act !== "next" && act !== "shop-close" && act !== "buy-prop" && act !== "lang" && act !== "tips" && act !== "auto-tips" && act !== "auto-pace" && act !== "a-face" && act !== "close-result") return;
  if (state.phase === "bet" && act !== "shop" && act !== "shop-close" && act !== "buy-prop" && act !== "bet-set" && act !== "deal" && act !== "lang" && act !== "tips" && act !== "auto-tips" && act !== "auto-pace" && act !== "a-face" && act !== "close-result")
    return;
  if (shopOpen && act !== "shop-close" && act !== "buy-prop" && act !== "mute" && act !== "lang" && act !== "tips" && act !== "auto-tips" && act !== "auto-pace" && act !== "a-face" && act !== "close-result") return;

  if (act === "select") {
    clearAutoTimer();
    if (state.phase !== "discard" || state.current !== 0 || dealReveal) return;
    const id = Number(el.dataset.id);
    if (!state.players[0]!.hand.some((x) => x.id === id)) return;
    selected = selected === id ? null : id;
    sfx.click();
    scheduleSave();
    render();
    return;
  }
  if (act === "sort") {
    state.players[0]!.hand = sortTiles(state.players[0]!.hand);
    sfx.click();
    render();
    return;
  }
  if (act === "discard") {
    clearAutoTimer();
    if (selected === null || state.phase !== "discard" || state.current !== 0) return;
    const id = selected;
    selected = null;
    applyDiscard(state, id);
    sfx.discard();
    scheduleSave();
    void afterMove();
    return;
  }
  if (act === "self-win") {
    clearAutoTimer();
    if (declareSelfWin(state, 0)) sfx.win();
    scheduleSave();
    render();
    return;
  }
  if (act === "self-kong") {
    clearAutoTimer();
    const kind = el.dataset.kind!;
    const mode = el.dataset.mode as "concealed" | "added";
    if (declareKong(state, kind, mode)) {
      sfx.claim();
      selected = null;
      scheduleSave();
      void afterMove();
    }
    return;
  }
  if (act === "pass") {
    clearAutoTimer();
    humanPass(state);
    sfx.click();
    scheduleSave();
    void afterMove();
    return;
  }
  if (act === "claim-win") {
    clearAutoTimer();
    const c = findClaim("win");
    if (c) {
      humanClaim(state, c);
      sfx.win();
      scheduleSave();
      render();
    }
    return;
  }
  if (act === "claim-pung") {
    clearAutoTimer();
    const c = findClaim("pung");
    if (c) {
      humanClaim(state, c);
      sfx.claim();
      selected = null;
      scheduleSave();
      void afterMove();
    }
    return;
  }
  if (act === "claim-kong") {
    clearAutoTimer();
    const c = findClaim("kong");
    if (c) {
      humanClaim(state, c);
      sfx.claim();
      selected = null;
      scheduleSave();
      void afterMove();
    }
    return;
  }
  if (act === "claim-chow") {
    clearAutoTimer();
    const c = findClaim("chow", Number(el.dataset.a), Number(el.dataset.b));
    if (c) {
      humanClaim(state, c);
      sfx.claim();
      selected = null;
      scheduleSave();
      void afterMove();
    }
  }
}

function onDblClick(ev: Event): void {
  const el = (ev.target as HTMLElement).closest("[data-act='select']") as HTMLElement | null;
  if (!el || busy || dealReveal) return;
  if (state.phase !== "discard" || state.current !== 0) return;
  const id = Number(el.dataset.id);
  if (!state.players[0]!.hand.some((x) => x.id === id)) return;
  clearAutoTimer();
  selected = null;
  applyDiscard(state, id);
  sfx.discard();
  scheduleSave();
  void afterMove();
}

export function start(el: HTMLElement): void {
  selfTestWin();
  loadMute();
  loadLang();
  loadTips();
  loadAutoTips();
  loadAutoPace();
  loadAFace();
  root = el;
  root.addEventListener("click", onClick);
  root.addEventListener("dblclick", onDblClick);
  window.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && selected !== null && !busy && !dealReveal && state.phase === "discard" && state.current === 0) {
      clearAutoTimer();
      const id = selected;
      selected = null;
      applyDiscard(state, id);
      sfx.discard();
      scheduleSave();
      void afterMove();
    }
  });

  const saved = loadSave();
  if (saved) {
    state = saved.state;
    betDraft = saved.betDraft;
    selected = saved.selected;
    // Drop stale selection if that tile is no longer in hand.
    if (selected !== null && !state.players[0]!.hand.some((t) => t.id === selected)) {
      selected = null;
    }
    shopOpen = false;
    dealReveal = null;
    flyDraw = null;
    busy = false;
    // Skip deal/draw anims — resume mid-hand phase as-is.
    render();
    // Kick AI / draw loop if we restored into an automated phase.
    if (state.phase === "draw" || (state.phase === "discard" && state.current !== 0)) {
      void afterMove();
    }
    return;
  }

  render();
}

export function getState(): GameState {
  return state;
}

// silence unused import if tree-shaken differently
