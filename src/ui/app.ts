import type { Claim, GameState, Player, Tile } from "../game/types";
import { tileLabel, sortTiles, WIND_ZH, WIND_EN } from "../game/tiles";
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let state: GameState = createTable();
let selected: number | null = null;
let busy = false;
let gen = 0;
let betDraft = 10;
let root: HTMLElement;
let shopOpen = false;
let shopFlash = "";

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

function tileEl(
  tile: Tile,
  opts: { size?: "hand" | "mini"; selected?: boolean; last?: boolean; back?: boolean; drawn?: boolean } = {},
): string {
  const l = tileLabel(tile);
  const honor = tile.suit === "wind" || tile.suit === "dragon";
  const cls = [
    "tile",
    l.css,
    honor ? "honor" : "",
    opts.size === "hand" ? "hand-tile" : "",
    opts.selected ? "selected" : "",
    opts.last ? "last" : "",
    opts.drawn ? "drawn" : "",
    opts.back ? "back" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const sub = l.sub ? `<span class="sub">${l.sub}</span>` : "";
  const inner = `<span class="glyph"><span class="main">${l.main}</span>${sub}</span>`;
  if (opts.size === "hand") {
    return `<button type="button" class="${cls}" data-act="select" data-id="${tile.id}">${inner}</button>`;
  }
  return `<span class="${cls}" data-id="${tile.id}">${inner}</span>`;
}

function backs(n: number): string {
  return Array.from({ length: n }, () => `<span class="tile back"></span>`).join("");
}

function meldHtml(p: Player): string {
  return p.melds
    .map((m) => `<div class="meld ${m.concealed ? "concealed" : ""}">${m.tiles.map((t) => tileEl(t)).join("")}</div>`)
    .join("");
}

function riverHtml(p: Player): string {
  const lastId = state.lastDiscard?.id;
  return p.river.map((t) => tileEl(t, { last: t.id === lastId })).join("");
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

function seatHtml(i: number): string {
  const p = state.players[i]!;
  const pos = SEAT_POS[i]!;
  const active = state.current === i && state.phase !== "over" && state.phase !== "bet";
  const act = active ? "active" : "";
  if (i === 0) {
    return `<div class="seat pos-${pos} ${act}">
      <div class="river">${riverHtml(p)}</div>
      ${avatarHtml(i, active)}
    </div>`;
  }
  return `<div class="seat pos-${pos} ${act}">
    ${avatarHtml(i, active)}
    <div class="backs">${backs(p.hand.length)}</div>
    <div class="melds">${meldHtml(p)}</div>
    <div class="river">${riverHtml(p)}</div>
  </div>`;
}

function claimButtons(): string {
  if (state.phase !== "claim" || !state.pendingHumanClaims.length) return "";
  const types = new Set(state.pendingHumanClaims.map((c) => c.type));
  const chows = state.pendingHumanClaims.filter((c) => c.type === "chow");
  const btns: string[] = [];
  if (types.has("win")) btns.push(`<button class="act win" data-act="claim-win">胡 Win</button>`);
  if (types.has("kong")) btns.push(`<button class="act kong" data-act="claim-kong">杠 Kong</button>`);
  if (types.has("pung")) btns.push(`<button class="act pung" data-act="claim-pung">碰 Pung</button>`);
  for (const c of chows) {
    const a = c.chow!.tiles[0]!;
    const b = c.chow!.tiles[1]!;
    btns.push(
      `<button class="act chow chow-preview" data-act="claim-chow" data-a="${a.id}" data-b="${b.id}">
        吃 Chow ${tileEl(a)}${tileEl(b)}
      </button>`,
    );
  }
  btns.push(`<button class="act pass" data-act="pass">过 Pass</button>`);
  return btns.join("");
}

function turnButtons(): string {
  if (state.phase !== "discard" || state.current !== 0 || busy) {
    if (state.phase === "claim") return claimButtons();
    return "";
  }
  const btns: string[] = [];
  if (canSelfWin(state, 0)) btns.push(`<button class="act win" data-act="self-win">自摸 Win</button>`);
  for (const k of humanKongOptions(state)) {
    btns.push(
      `<button class="act kong" data-act="self-kong" data-kind="${k.kind}" data-mode="${k.mode}">杠 Kong</button>`,
    );
  }
  btns.push(
    `<button class="act discard" data-act="discard" ${selected === null ? "disabled" : ""}>打 Discard</button>`,
  );
  btns.push(`<button class="act sort" data-act="sort">理牌 Sort</button>`);
  return btns.join("");
}

function reqHud(): string {
  const p = state.players[0]!;
  const f = dongbeiFlags(p.hand, p.melds);
  const keOk = f.hasKe || f.dragonEyes;
  const items = [
    [f.opened, "开门", "Open"],
    [keOk, f.hasKe ? "有刻" : "中发白将", "Pung"],
    [f.yaojiu, "幺九", "1/9"],
    [f.threeSuits, "三门齐", "3 suits"],
  ] as const;
  return `<div class="reqs">${items
    .map(
      ([ok, zh, en]) =>
        `<span class="req ${ok ? "ok" : ""}">${ok ? "✓" : "○"} ${zh}<small>${en}</small></span>`,
    )
    .join("")}</div>`;
}

function payoutLines(): string {
  const w = state.winResult;
  if (!w) return "";
  if (!w.payouts.length) {
    return `<p class="sub">Stake $${w.stake} · no cash moved (broke or $0 bet).</p>`;
  }
  const names = state.players.map((p) => p.nameZh);
  const rows = w.payouts
    .map((x) => `<li><span>${names[x.from]} → ${names[x.to]}</span><span class="pts">${formatCash(x.amount)}</span></li>`)
    .join("");
  const scheme = w.selfDraw ? "自摸：三家各付赌注" : "点炮：放炮者付赌注";
  return `<p class="sub">${scheme} · stake $${w.stake}</p><ul class="fan-list">${rows}</ul>`;
}

function shopOverlay(): string {
  if (!shopOpen) return "";
  const cash = state.players[0]!.cash;
  const flash = shopFlash ? `<p class="shop-flash">${shopFlash}</p>` : "";
  const items = SHOP_ITEMS.map((item) => {
    const can = cash >= item.price;
    return `<div class="shop-item">
      <img class="shop-item-img" src="${item.src}" alt="${item.name}" draggable="false" />
      <div class="shop-item-info">
        <strong>${item.emoji} ${item.nameZh} · ${item.name}</strong>
        <span>$${item.price} · both of you hold it briefly</span>
      </div>
      <button class="btn shop-buy" data-act="buy-prop" data-item="${item.id}" ${can ? "" : "disabled"}>
        买 Buy · $${item.price}
      </button>
    </div>`;
  }).join("");
  return `<div class="overlay shop-overlay"><div class="modal shop-modal">
    <h2>小卖部 · Shop</h2>
    <p class="sub">共享小卖部 · Shared shop · 钱包 ${formatCash(cash)}</p>
    <div class="shop-chars">
      <div class="shop-char on">
        <div class="avatar-ring shop-ring">
          <img class="avatar" src="avatars/player.png" alt="You" draggable="false" />
          ${handProp(0, true)}
        </div>
        <span class="avatar-name">你 · YOU</span>
      </div>
      <div class="shop-char on">
        <div class="avatar-ring shop-ring">
          <img class="avatar" src="avatars/opposite.png?v=buzz2" alt="Opposite" draggable="false" />
          ${handProp(2, true)}
        </div>
        <span class="avatar-name">对家 · HIM</span>
      </div>
    </div>
    <div class="shop-catalog">${items}</div>
    ${flash}
    <div class="modal-actions">
      <button class="btn ghost" data-act="shop-close">关闭 Close</button>
    </div>
    ${cash < 1 ? `<p class="sub">Wallet empty — you can still browse. Win a hand to refill.</p>` : ""}
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
    const zeroNote =
      cash === 0
        ? `<p class="sub">You are at $0 — play on for pride. Win to rebuild the stack.</p>`
        : `<p class="sub">点炮：放炮者付给赢家赌注。自摸：其余三家各付一份赌注。付不出则倾家。</p>`;
    return `<div class="overlay"><div class="modal">
      <div class="modal-hero"><img class="avatar hero" src="avatars/player.png" alt="You" /></div>
      <h2>东北麻将</h2>
      <p class="sub">第 ${state.handNumber} 局 · You have ${formatCash(cash)}</p>
      <div class="bet-row">${cash === 0 ? `<span class="bet-chip on">$0</span>` : chips}</div>
      ${zeroNote}
      <p class="rules-mini">胡牌需：开门（吃/碰/明杠）· 有刻（或中发白做将）· 带幺九 · 三门齐</p>
      <button class="btn" data-act="deal">开局 Deal · ${formatCash(clamped)}</button>
    </div></div>`;
  }
  if (state.phase !== "over") return "";
  if (state.drawGame) {
    return `<div class="overlay"><div class="modal">
      <h2>荒庄 · Draw</h2>
      <p class="sub">牌墙摸完，本局赌注不动。</p>
      <div class="modal-actions">
        <button class="btn" data-act="next">下一局 Next</button>
        <button class="btn ghost" data-act="reset">重置 $100</button>
      </div>
    </div></div>`;
  }
  const w = state.winResult;
  const winner = state.players[state.winner ?? 0]!;
  const title = state.winner === 0 ? "你胡了 · You win" : `${winner.nameZh} 胡牌`;
  const how = w?.selfDraw ? "自摸 Self-draw" : `点炮 ${w?.loser != null ? state.players[w.loser]!.nameZh : "?"}`;
  const lines = (w?.lines ?? [])
    .map((l) => `<li><span>${l.nameZh} · ${l.name}</span><span class="pts">${l.fan ? l.fan + " 番" : "条件"}</span></li>`)
    .join("");
  const tiles = sortTiles(w?.concealed ?? []).map((t) => tileEl(t)).join("");
  const melds = (w?.melds ?? []).map((m) => `<div class="meld">${m.tiles.map((t) => tileEl(t)).join("")}</div>`).join("");
  return `<div class="overlay"><div class="modal">
    <h2>${title}</h2>
    <p class="sub">${how}</p>
    <div class="win-tiles">${melds}${tiles}</div>
    <ul class="fan-list">${lines}</ul>
    ${payoutLines()}
    <div class="balances">${state.players.map((p) => `<span>${p.nameZh} ${formatCash(p.cash)}</span>`).join("")}</div>
    <div class="modal-actions">
      <button class="btn" data-act="next">下一局 Next round</button>
      <button class="btn ghost" data-act="reset">重置 Reset $100</button>
    </div>
  </div></div>`;
}

export function render(): void {
  const mute = isMuted() ? "Unmute" : "Mute";
  const last = state.lastDiscard;
  const playing = state.phase !== "bet";
  root.innerHTML = `
    <header class="topbar">
      <div class="brand"><h1>AA Mahjong</h1><span class="zh">东北麻将</span></div>
      <div class="meta">
        <span>第 <b>${state.handNumber}</b> 局</span>
        <span>赌注 <b>${formatCash(state.stake)}</b></span>
        <span>牌墙 <b>${playing ? state.wall.length : "—"}</b></span>
        <span>你 <b>${formatCash(state.players[0]!.cash)}</b></span>
      </div>
      <div class="toolbar">
        <button class="btn ghost" data-act="mute">${mute}</button>
        <button class="btn ghost" data-act="shop">Shop 小卖部</button>
        <button class="btn ghost" data-act="next">下一局</button>
        <button class="btn" data-act="reset">重置</button>
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
            <div class="coin">
              <div class="round">东北麻将</div>
              <div class="wall">${playing ? state.wall.length + " in wall" : "下注中"}</div>
            </div>
            <div class="last-discard-slot">
              ${last ? `<span class="label">Last discard</span>${tileEl(last, { last: true })}` : ""}
            </div>
            <div class="status">${state.message}<br><span style="opacity:.8">${state.messageZh}</span></div>
          </div>
        </div>
      </div>
      <div class="dock">
        ${reqHud()}
        <div class="melds-row">${meldHtml(state.players[0]!)}</div>
        <div class="hand-row">
          ${state.players[0]!.hand.map((t) => tileEl(t, { size: "hand", selected: t.id === selected, drawn: t.id === state.lastDraw?.id })).join("")}
        </div>
        <div class="actions">${turnButtons()}</div>
        <div class="hint">吃上家 · 碰杠胡任意家 · 暗杠不算开门 · 胡牌需开门/有刻或中发白将/幺九/三门齐</div>
      </div>
    </div>
    ${overlay()}
  `;
}

async function continuePlay(): Promise<void> {
  const my = gen;
  while (state.phase !== "over" && state.phase !== "claim" && state.phase !== "bet") {
    if (my !== gen) return;
    if (state.phase === "draw") {
      await sleep(280);
      if (my !== gen) return;
      drawCurrent(state);
      sfx.draw();
      render();
    }
    if (state.phase as string === "over") break;
    if (state.phase === "discard") {
      if (state.current === 0) break;
      await sleep(420 + Math.random() * 380);
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

function findClaim(type: Claim["type"], a?: number, b?: number): Claim | undefined {
  return state.pendingHumanClaims.find((c) => {
    if (c.type !== type) return false;
    if (type === "chow" && c.chow) {
      const ids = c.chow.tiles.map((t) => t.id).sort();
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
    shopFlash = `Need $${item.price} · 钱不够啦`;
    sfx.click();
    render();
    return;
  }
  state.players[0]!.cash -= item.price;
  giveProp(0, id);
  giveProp(2, id);
  window.setTimeout(() => render(), PROP_MS - 850);
  shopFlash = `${item.emoji} ${item.name} for both of you!`;
  sfx.claim();
  render();
}

function goNext(): void {
  gen += 1;
  shopOpen = false;
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
  state = resetTable();
  selected = null;
  busy = false;
  betDraft = 10;
  sfx.click();
  render();
}

function onClick(ev: Event): void {
  const t = (ev.target as HTMLElement).closest("[data-act]") as HTMLElement | null;
  if (!t) return;
  resume();
  const act = t.dataset.act;
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
    const id = t.dataset.item as ShopPropId;
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
    betDraft = Number(t.dataset.n);
    sfx.click();
    render();
    return;
  }
  if (act === "deal") {
    const cash = state.players[0]!.cash;
    const stake = cash === 0 ? 0 : Math.max(0, Math.min(betDraft, cash));
    beginRound(state, stake);
    selected = null;
    busy = false;
    sfx.click();
    render();
    return;
  }
  if (busy && act !== "mute" && act !== "shop" && act !== "shop-close" && act !== "buy-prop") return;
  if (state.phase === "bet" && act !== "shop" && act !== "shop-close" && act !== "buy-prop" && act !== "bet-set" && act !== "deal") return;
  if (shopOpen && act !== "shop-close" && act !== "buy-prop" && act !== "mute") return;

  if (act === "select") {
    if (state.phase !== "discard" || state.current !== 0) return;
    const id = Number(t.dataset.id);
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
    const kind = t.dataset.kind!;
    const mode = t.dataset.mode as "concealed" | "added";
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
    const c = findClaim("chow", Number(t.dataset.a), Number(t.dataset.b));
    if (c) {
      humanClaim(state, c);
      sfx.claim();
      selected = null;
      void afterMove();
    }
  }
}

function onDblClick(ev: Event): void {
  const t = (ev.target as HTMLElement).closest("[data-act='select']") as HTMLElement | null;
  if (!t || busy) return;
  if (state.phase !== "discard" || state.current !== 0) return;
  const id = Number(t.dataset.id);
  if (!state.players[0]!.hand.some((x) => x.id === id)) return;
  selected = null;
  applyDiscard(state, id);
  sfx.discard();
  void afterMove();
}

export function start(el: HTMLElement): void {
  selfTestWin();
  loadMute();
  root = el;
  root.addEventListener("click", onClick);
  root.addEventListener("dblclick", onDblClick);
  window.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && selected !== null && !busy && state.phase === "discard" && state.current === 0) {
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
