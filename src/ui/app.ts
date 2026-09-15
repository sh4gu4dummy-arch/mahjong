import type { Claim, GameState, Player, Tile, Wind } from "../game/types";
import { sortTiles, WIND_ZH, WIND_EN } from "../game/tiles";
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
import { dongbeiFlags, selfTestWin } from "../game/win";
import { isMuted, loadMute, resume, setMuted, sfx } from "./audio";
import { tileFaceSvg, tileCssClass } from "./tileFace";
import { getLang, loadLang, setLang, getTips, loadTips, setTips, t, type Lang } from "./i18n";
import { chooseTipDiscard } from "../game/ai";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let state: GameState = createTable();
let selected: number | null = null;
let busy = false;
let gen = 0;
let betDraft = 10;
let root: HTMLElement;
let shopOpen = false;
let shopFlash = "";

/** UI-only dealing: how many tiles revealed per seat (engine already dealt). */
let dealReveal: [number, number, number, number] | null = null;
/** Flying draw overlay */
let flyDraw: { seat: number; tile: Tile | null; key: number } | null = null;
let flyKey = 0;

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
  { id: "coffee", name: "Coffee", nameZh: "咖啡", price: 5, src: "props/coffee.png", emoji: "☕" },
  { id: "cigarette", name: "Cigarette", nameZh: "烟", price: 1, src: "props/cigarette.png", emoji: "🚬" },
  { id: "beer", name: "Beer", nameZh: "啤酒", price: 5, src: "props/beer.png", emoji: "🍺" },
];
const seatProp: Record<number, SeatProp | undefined> = {};
const seatPropTimers: Record<number, number> = {};

const SEAT_POS = ["bottom", "right", "top", "left"] as const;
const SEAT_AVATAR = [
  "avatars/player.png",
  "avatars/right.png",
  "avatars/opposite.png?v=buzz2",
  "avatars/left.png",
] as const;

/** Counter-clockwise from East: E(0) → N(3) → W(2) → S(1) */
const DEAL_ORDER = [0, 3, 2, 1] as const;

const WIND_KIND: Record<Wind, string> = { E: "we", S: "ws", W: "ww", N: "wn" };

function tipDiscardId(): number | null {
  if (!getTips()) return null;
  if (dealReveal || busy) return null;
  if (state.phase !== "discard" || state.current !== 0) return null;
  const p = state.players[0]!;
  if (!p.hand.length) return null;
  const tip = chooseTipDiscard(p, WIND_KIND[p.seat], WIND_KIND[state.roundWind]);
  return tip.id;
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
  const face = opts.back ? "" : tileFaceSvg(tile);
  if (opts.size === "hand") {
    const badge = opts.tip ? `<span class="tip-badge" aria-hidden="true">💡</span>` : "";
    return `<button type="button" class="${cls}" data-act="select" data-id="${tile.id}" ${opts.tip ? 'aria-label="AI tip"' : ""}>${face}${badge}</button>`;
  }
  return `<span class="${cls}" data-id="${tile.id}">${face}</span>`;
}

function backs(n: number, arriving = false): string {
  return Array.from({ length: n }, (_, i) => {
    const last = arriving && i === n - 1 ? " arriving" : "";
    return `<span class="tile back${last}"></span>`;
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
  return `<span class="cash">${formatCash(p.cash)}</span>`;
}

function handProp(i: number, big = false): string {
  const p = seatProp[i];
  if (!p || p.until <= Date.now()) return "";
  const item = SHOP_ITEMS.find((x) => x.id === p.id);
  if (!item) return "";
  const fading = p.until - Date.now() < 900 ? "fading" : "";
  return `<img class="hand-prop prop-${p.id} ${big ? "big" : ""} ${fading}" src="${item.src}" alt="${item.name}" draggable="false" />`;
}

function avatarHtml(i: number, active: boolean): string {
  const p = state.players[i]!;
  const src = SEAT_AVATAR[i]!;
  const label = p.isHuman ? "YOU" : WIND_EN[p.seat];
  return `<div class="avatar-wrap ${active ? "turn" : ""}">
    <div class="avatar-ring">
      <img class="avatar" src="${src}" alt="${label}" draggable="false" />
      ${handProp(i)}
    </div>
    <div class="avatar-meta">
      <span class="avatar-name">${WIND_ZH[p.seat]} · ${label}</span>
      ${cashChip(p)}
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
      <div class="river">${riverHtml(p)}</div>
      ${avatarHtml(i, active)}
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
  // Each stack = 2 tiles high; schematic compact wall
  const stacks = Math.ceil(count / 2);
  const maxShow = 18;
  const show = Math.min(stacks, maxShow);
  const items: string[] = [];
  for (let s = 0; s < show; s++) {
    const rem = Math.max(0, count - s * 2);
    const n = Math.min(2, rem);
    if (n <= 0) break;
    const layers = Array.from({ length: n }, () => `<span class="tile back wall-tile"></span>`).join("");
    items.push(`<div class="wall-stack">${layers}</div>`);
  }
  return `<div class="wall-side wall-${side}">${items.join("")}</div>`;
}

function tileWallHtml(): string {
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
  // Sides: bottom(East-facing), right, top, left — visual only
  return `<div class="tile-wall" aria-label="${t("wall")} ${n}">
    ${wallSideHtml(counts[2]!, "top")}
    ${wallSideHtml(counts[3]!, "left")}
    ${wallSideHtml(counts[1]!, "right")}
    ${wallSideHtml(counts[0]!, "bottom")}
    <div class="wall-hub">
      <div class="wall-title">${t("dongbei")}</div>
      <div class="wall-count">${n} ${t("inWall")}</div>
    </div>
  </div>`;
}

function flyOverlay(): string {
  if (!flyDraw) return "";
  const pos = SEAT_POS[flyDraw.seat]!;
  const face =
    flyDraw.seat === 0 && flyDraw.tile
      ? tileEl(flyDraw.tile, { size: "hand", drawn: true })
      : `<span class="tile back hand-tile"></span>`;
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
  if (dealReveal || busy) {
    if (state.phase === "claim" && !dealReveal) return claimButtons();
    return "";
  }
  if (state.phase !== "discard" || state.current !== 0) {
    if (state.phase === "claim") return claimButtons();
    return "";
  }
  const btns: string[] = [];
  if (canSelfWin(state, 0)) btns.push(`<button class="act win" data-act="self-win">${t("selfWin")}</button>`);
  for (const k of humanKongOptions(state)) {
    btns.push(
      `<button class="act kong" data-act="self-kong" data-kind="${k.kind}" data-mode="${k.mode}">${t("kong")}</button>`,
    );
  }
  btns.push(
    `<button class="act discard" data-act="discard" ${selected === null ? "disabled" : ""}>${t("discard")}</button>`,
  );
  btns.push(`<button class="act sort" data-act="sort">${t("sort")}</button>`);
  return btns.join("");
}

function reqHud(): string {
  const p = state.players[0]!;
  const f = dongbeiFlags(p.hand, p.melds);
  const keOk = f.hasKe || f.dragonEyes;
  const items = [
    [f.opened, t("reqOpen"), "Open"],
    [keOk, f.hasKe ? t("reqKe") : t("reqDragonEyes"), "Pung"],
    [f.yaojiu, t("reqYao"), "1/9"],
    [f.threeSuits, t("reqSuits"), "3 suits"],
  ] as const;
  return `<div class="reqs">${items
    .map(
      ([ok, zh]) =>
        `<span class="req ${ok ? "ok" : ""}">${ok ? "✓" : "○"} ${zh}</span>`,
    )
    .join("")}</div>`;
}

function payoutLines(): string {
  const w = state.winResult;
  if (!w) return "";
  if (!w.payouts.length) {
    return `<p class="sub">Stake $${w.stake} · ${t("noCashMoved")}</p>`;
  }
  const names = state.players.map((p) => p.nameZh);
  const rows = w.payouts
    .map((x) => `<li><span>${names[x.from]} → ${names[x.to]}</span><span class="pts">${formatCash(x.amount)}</span></li>`)
    .join("");
  const scheme = w.selfDraw ? t("paySelf") : t("payDiscard");
  return `<p class="sub">${scheme} · stake $${w.stake}</p><ul class="fan-list">${rows}</ul>`;
}

function shopOverlay(): string {
  if (!shopOpen) return "";
  const cash = state.players[0]!.cash;
  const flash = shopFlash ? `<p class="shop-flash">${shopFlash}</p>` : "";
  const items = SHOP_ITEMS.map((item) => {
    const can = cash >= item.price;
    const label = getLang() === "zh" ? `${item.emoji} ${item.nameZh} · ${item.name}` : `${item.emoji} ${item.name} · ${item.nameZh}`;
    return `<div class="shop-item">
      <img class="shop-item-img" src="${item.src}" alt="${item.name}" draggable="false" />
      <div class="shop-item-info">
        <strong>${label}</strong>
        <span>$${item.price} · ${t("shopBoth")}</span>
      </div>
      <button class="btn shop-buy" data-act="buy-prop" data-item="${item.id}" ${can ? "" : "disabled"}>
        ${t("buy")} · $${item.price}
      </button>
    </div>`;
  }).join("");
  return `<div class="overlay shop-overlay"><div class="modal shop-modal">
    <h2>${t("shopTitle")}</h2>
    <p class="sub">${t("shopSub")} ${formatCash(cash)}</p>
    <div class="shop-chars">
      <div class="shop-char on">
        <div class="avatar-ring shop-ring">
          <img class="avatar" src="avatars/player.png" alt="You" draggable="false" />
          ${handProp(0, true)}
        </div>
        <span class="avatar-name">${t("seatYou")}</span>
      </div>
      <div class="shop-char on">
        <div class="avatar-ring shop-ring">
          <img class="avatar" src="avatars/opposite.png?v=buzz2" alt="Opposite" draggable="false" />
          ${handProp(2, true)}
        </div>
        <span class="avatar-name">${t("seatOpp")}</span>
      </div>
    </div>
    <div class="shop-catalog">${items}</div>
    ${flash}
    <div class="modal-actions">
      <button class="btn ghost" data-act="shop-close">${t("close")}</button>
    </div>
    ${cash < 1 ? `<p class="sub">${t("walletEmpty")}</p>` : ""}
  </div></div>`;
}

function overlay(): string {
  if (shopOpen) return shopOverlay();
  if (state.phase === "bet") {
    const cash = state.players[0]!.cash;
    const presets = [5, 10, 20, 50].filter((n) => n <= cash);
    if (cash > 0 && !presets.includes(cash) && cash < 1000) presets.push(cash);
    const clamped = Math.max(0, Math.min(betDraft, cash));
    const chips = presets
      .map(
        (n) =>
          `<button class="bet-chip ${clamped === n ? "on" : ""}" data-act="bet-set" data-n="${n}">$${n}</button>`,
      )
      .join("");
    const zeroNote = cash === 0 ? `<p class="sub">${t("prideNote")}</p>` : `<p class="sub">${t("payNote")}</p>`;
    return `<div class="overlay"><div class="modal">
      <div class="modal-hero"><img class="avatar hero" src="avatars/player.png" alt="You" /></div>
      <h2>${t("dongbei")}</h2>
      <p class="sub">${t("hand")} ${state.handNumber} · ${t("youHave")} ${formatCash(cash)}</p>
      <div class="bet-row">${cash === 0 ? `<span class="bet-chip on">$0</span>` : chips}</div>
      ${zeroNote}
      <p class="rules-mini">${t("rulesMini")}</p>
      <button class="btn" data-act="deal">${t("deal")} · ${formatCash(clamped)}</button>
    </div></div>`;
  }
  if (state.phase !== "over") return "";
  if (state.drawGame) {
    return `<div class="overlay"><div class="modal">
      <h2>${t("drawGame")}</h2>
      <p class="sub">${t("drawGameSub")}</p>
      <div class="modal-actions">
        <button class="btn" data-act="next">${t("nextRound")}</button>
        <button class="btn ghost" data-act="reset">${t("resetCash")}</button>
      </div>
    </div></div>`;
  }
  const w = state.winResult;
  const winner = state.players[state.winner ?? 0]!;
  const title = state.winner === 0 ? t("youWin") : `${winner.nameZh} ${t("someoneWins")}`;
  const how = w?.selfDraw ? t("selfDrawHow") : `${t("discardWinHow")} ${w?.loser != null ? state.players[w.loser]!.nameZh : "?"}`;
  const lines = (w?.lines ?? [])
    .map((l) => {
      const name = getLang() === "zh" ? `${l.nameZh} · ${l.name}` : `${l.name} · ${l.nameZh}`;
      return `<li><span>${name}</span><span class="pts">${l.fan ? l.fan + (getLang() === "zh" ? " 番" : " fan") : "✓"}</span></li>`;
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
    <div class="balances">${state.players.map((p) => `<span>${p.nameZh} ${formatCash(p.cash)}</span>`).join("")}</div>
    <div class="modal-actions">
      <button class="btn" data-act="next">${t("nextRound")}</button>
      <button class="btn ghost" data-act="reset">${t("resetCash")}</button>
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

function langToggle(): string {
  const cur = getLang();
  return `<div class="lang-toggle" role="group" aria-label="Language">
    <button type="button" class="lang-btn ${cur === "en" ? "on" : ""}" data-act="lang" data-lang="en">EN</button>
    <button type="button" class="lang-btn ${cur === "zh" ? "on" : ""}" data-act="lang" data-lang="zh">中文</button>
  </div>`;
}

function tipsToggle(): string {
  const on = getTips();
  return `<div class="tips-toggle" role="group" aria-label="AI tips">
    <span class="tips-label">${t("tips")}</span>
    <button type="button" class="tips-btn ${on ? "on" : ""}" data-act="tips" data-on="1">${t("tipsOn")}</button>
    <button type="button" class="tips-btn ${!on ? "on" : ""}" data-act="tips" data-on="0">${t("tipsOff")}</button>
  </div>`;
}

export function render(): void {
  const mute = isMuted() ? t("unmute") : t("mute");
  const last = state.lastDiscard;
  const playing = state.phase !== "bet";
  const wallN = playing ? visualWallCount() : "—";
  const statusMsg = dealReveal
    ? getLang() === "zh"
      ? `${t("dealing")}<br><span style="opacity:.8">${t("dealing")}</span>`
      : `${t("dealing")}<br><span style="opacity:.8">${t("dealing")}</span>`
    : `${state.message}<br><span style="opacity:.8">${state.messageZh}</span>`;

  root.innerHTML = `
    <header class="topbar">
      <div class="brand"><h1>AA 麻将</h1><span class="zh">${t("dongbei")}</span></div>
      <div class="meta">
        <span>${t("hand")} <b>${state.handNumber}</b></span>
        <span>${t("stake")} <b>${formatCash(state.stake)}</b></span>
        <span>${t("wall")} <b>${wallN}</b></span>
        <span>${t("you")} <b>${formatCash(state.players[0]!.cash)}</b></span>
      </div>
      <div class="toolbar">
        ${langToggle()}
        ${tipsToggle()}
        <button class="btn ghost" data-act="mute">${mute}</button>
        <button class="btn ghost" data-act="shop">${t("shop")}</button>
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
            ${tileWallHtml()}
            <div class="last-discard-slot">
              ${last ? `<span class="label">${t("lastDiscard")}</span>${tileEl(last, { last: true, toss: true })}` : ""}
            </div>
            <div class="status">${statusMsg}</div>
            ${flyOverlay()}
          </div>
        </div>
      </div>
      <div class="dock">
        ${reqHud()}
        <div class="melds-row">${meldHtml(state.players[0]!)}</div>
        <div class="hand-row">${humanHandHtml()}</div>
        <div class="actions">${turnButtons()}</div>
        <div class="hint">${t("hint")}</div>
      </div>
    </div>
    ${overlay()}
  `;
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
  await sleep(seat === 0 ? 280 : 240);
  flyDraw = null;
}

async function continuePlay(): Promise<void> {
  const my = gen;
  while (state.phase !== "over" && state.phase !== "claim" && state.phase !== "bet") {
    if (my !== gen) return;
    if (state.phase === "draw") {
      const seat = state.current;
      // Peek: draw happens in engine; animate around it
      await sleep(80);
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
      await sleep(380 + Math.random() * 320);
      if (my !== gen) return;
      const id = aiPlayDiscard(state);
      if (id >= 0) sfx.discard();
      else if (state.phase as string === "over" && state.winner !== null) sfx.win();
      render();
    }
  }
  if (my !== gen) return;
  busy = false;
  render();
}

async function afterMove(): Promise<void> {
  busy = true;
  render();
  await continuePlay();
}

async function startDealAnimation(): Promise<void> {
  const my = gen;
  busy = true;
  await animateDeal(my);
  if (my !== gen) return;
  busy = false;
  render();
  // East discard phase — human to play; no auto-continue needed
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
  render();
}

function goNext(): void {
  gen += 1;
  shopOpen = false;
  dealReveal = null;
  flyDraw = null;
  nextHand(state);
  selected = null;
  busy = false;
  const cash = state.players[0]!.cash;
  betDraft = cash === 0 ? 0 : Math.min(betDraft || 10, cash) || Math.min(10, cash);
  sfx.click();
  render();
}

function goReset(): void {
  gen += 1;
  shopOpen = false;
  dealReveal = null;
  flyDraw = null;
  state = resetTable();
  selected = null;
  busy = false;
  betDraft = 10;
  sfx.click();
  render();
}

function onClick(ev: Event): void {
  const el = (ev.target as HTMLElement).closest("[data-act]") as HTMLElement | null;
  if (!el) return;
  resume();
  const act = el.dataset.act;

  if (act === "lang") {
    const next = el.dataset.lang as Lang;
    if (next === "en" || next === "zh") {
      setLang(next);
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
  if (act === "mute") {
    setMuted(!isMuted());
    sfx.click();
    render();
    return;
  }
  if (act === "shop") {
    shopOpen = true;
    shopFlash = "";
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
  if (act === "reset") {
    goReset();
    return;
  }
  if (act === "next") {
    goNext();
    return;
  }
  if (act === "bet-set") {
    betDraft = Number(el.dataset.n);
    sfx.click();
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
    void startDealAnimation();
    return;
  }
  if (busy && act !== "mute" && act !== "shop" && act !== "shop-close" && act !== "buy-prop" && act !== "lang" && act !== "tips") return;
  if (state.phase === "bet" && act !== "shop" && act !== "shop-close" && act !== "buy-prop" && act !== "bet-set" && act !== "deal" && act !== "lang" && act !== "tips")
    return;
  if (shopOpen && act !== "shop-close" && act !== "buy-prop" && act !== "mute" && act !== "lang" && act !== "tips") return;

  if (act === "select") {
    if (state.phase !== "discard" || state.current !== 0 || dealReveal) return;
    const id = Number(el.dataset.id);
    if (!state.players[0]!.hand.some((x) => x.id === id)) return;
    selected = selected === id ? null : id;
    sfx.click();
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
    if (selected === null || state.phase !== "discard" || state.current !== 0) return;
    const id = selected;
    selected = null;
    applyDiscard(state, id);
    sfx.discard();
    void afterMove();
    return;
  }
  if (act === "self-win") {
    if (declareSelfWin(state, 0)) sfx.win();
    render();
    return;
  }
  if (act === "self-kong") {
    const kind = el.dataset.kind!;
    const mode = el.dataset.mode as "concealed" | "added";
    if (declareKong(state, kind, mode)) {
      sfx.claim();
      selected = null;
      void afterMove();
    }
    return;
  }
  if (act === "pass") {
    humanPass(state);
    sfx.click();
    void afterMove();
    return;
  }
  if (act === "claim-win") {
    const c = findClaim("win");
    if (c) {
      humanClaim(state, c);
      sfx.win();
      render();
    }
    return;
  }
  if (act === "claim-pung") {
    const c = findClaim("pung");
    if (c) {
      humanClaim(state, c);
      sfx.claim();
      selected = null;
      void afterMove();
    }
    return;
  }
  if (act === "claim-kong") {
    const c = findClaim("kong");
    if (c) {
      humanClaim(state, c);
      sfx.claim();
      selected = null;
      void afterMove();
    }
    return;
  }
  if (act === "claim-chow") {
    const c = findClaim("chow", Number(el.dataset.a), Number(el.dataset.b));
    if (c) {
      humanClaim(state, c);
      sfx.claim();
      selected = null;
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
  selected = null;
  applyDiscard(state, id);
  sfx.discard();
  void afterMove();
}

export function start(el: HTMLElement): void {
  selfTestWin();
  loadMute();
  loadLang();
  loadTips();
  root = el;
  root.addEventListener("click", onClick);
  root.addEventListener("dblclick", onDblClick);
  window.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && selected !== null && !busy && !dealReveal && state.phase === "discard" && state.current === 0) {
      const id = selected;
      selected = null;
      applyDiscard(state, id);
      sfx.discard();
      void afterMove();
    }
  });
  render();
}

export function getState(): GameState {
  return state;
}

// silence unused import if tree-shaken differently
