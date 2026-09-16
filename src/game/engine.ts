import type { Claim, GameState, Payout, Player, Tile, Wind } from "./types";
import {
  buildFullSet,
  nextSeat,
  shuffle,
  sortTiles,
  takeIds,
  takeKind,
  WIND_EN,
  WIND_ZH,
  WINDS,
  tileName,
} from "./tiles";
import { addedKongTiles, bestClaim, claimsForPlayer, concealedKongKinds, humanClaimRelevant } from "./claims";
import { chooseDiscard, pickAiClaim, aiShouldConcealedKong } from "./ai";
import { isWinningHand, rollingPayout, toWinResult } from "./win";

const NAMES: { en: string; zh: string }[] = [
  { en: "A", zh: "A" },
  { en: "L", zh: "L" },
  { en: "J", zh: "J" },
  { en: "C", zh: "C" },
];

export const START_CASH = 100;
export const AI_START_CASH = 1000;

function seatKind(w: Wind): string {
  return { E: "we", S: "ws", W: "ww", N: "wn" }[w];
}

function makePlayer(i: number, cash: number): Player {
  return {
    seat: WINDS[i]!,
    name: NAMES[i]!.en,
    nameZh: NAMES[i]!.zh,
    isHuman: i === 0,
    hand: [],
    melds: [],
    river: [],
    cash,
  };
}

export function defaultCash(): number[] {
  return [START_CASH, AI_START_CASH, AI_START_CASH, AI_START_CASH];
}

export function createTable(cash: number[] = defaultCash()): GameState {
  return {
    players: [0, 1, 2, 3].map((i) => makePlayer(i, cash[i] ?? (i === 0 ? START_CASH : AI_START_CASH))),
    wall: [],
    current: 0,
    phase: "bet",
    dealer: 0,
    roundWind: "E",
    lastDiscard: null,
    lastDiscarder: null,
    lastDraw: null,
    winner: null,
    winResult: null,
    drawGame: false,
    turnCount: 0,
    pendingHumanClaims: [],
    pendingAiClaims: [],
    message: "Choose a stake for this hand.",
    messageZh: "请选择本局赌注。",
    stake: 0,
    handNumber: 1,
    eggPayouts: [],
    justBeaten: [],
  };
}

export function resetTable(): GameState {
  return createTable();
}

export function nextHand(state: GameState): void {
  const cash = state.players.map((p) => p.cash);
  const n = state.handNumber + 1;
  const next = createTable(cash);
  next.handNumber = n;
  Object.assign(state, next);
}

export function beginRound(state: GameState, requestedStake: number): void {
  const cash = state.players.map((p) => p.cash);
  const stake = Math.max(0, Math.min(Math.floor(requestedStake) || 0, cash[0] ?? 0));
  const wall = shuffle(buildFullSet());
  const players = [0, 1, 2, 3].map((i) => makePlayer(i, cash[i] ?? (i === 0 ? START_CASH : AI_START_CASH)));
  for (let r = 0; r < 13; r++) {
    for (let p = 0; p < 4; p++) players[p]!.hand.push(wall.pop()!);
  }
  const eastDraw = wall.pop()!;
  players[0]!.hand.push(eastDraw);
  for (const p of players) p.hand = sortTiles(p.hand);

  state.players = players;
  state.wall = wall;
  state.current = 0;
  state.phase = "discard";
  state.dealer = 0;
  state.lastDiscard = null;
  state.lastDiscarder = null;
  state.lastDraw = eastDraw;
  state.winner = null;
  state.winResult = null;
  state.drawGame = false;
  state.turnCount = 0;
  state.pendingHumanClaims = [];
  state.pendingAiClaims = [];
  state.stake = stake;
  state.eggPayouts = [];
  state.justBeaten = [];
  state.message = stake
    ? `Stake $${stake}. Your deal — discard a tile.`
    : "Playing for pride ($0). Discard to begin.";
  state.messageZh = stake
    ? `本局赌注 $${stake}。庄家开牌 — 请打出一张。`
    : "赌注 $0，继续打牌。请打出一张。";
}

export function canSelfWin(state: GameState, player: number): boolean {
  const p = state.players[player]!;
  return isWinningHand(p.hand, p.melds);
}

export function humanKongOptions(state: GameState): { kind: string; mode: "concealed" | "added" }[] {
  if (state.phase !== "discard" || state.current !== 0) return [];
  const p = state.players[0]!;
  const out: { kind: string; mode: "concealed" | "added" }[] = [];
  for (const k of concealedKongKinds(p.hand)) out.push({ kind: k, mode: "concealed" });
  for (const t of addedKongTiles(p)) out.push({ kind: t.kind, mode: "added" });
  return out;
}

function drawFromWall(state: GameState, player: number, fromEnd = false): Tile | null {
  if (!state.wall.length) return null;
  const tile = fromEnd ? state.wall.shift()! : state.wall.pop()!;
  state.players[player]!.hand.push(tile);
  state.players[player]!.hand = sortTiles(state.players[player]!.hand);
  state.lastDraw = tile;
  return tile;
}

function finishDrawGame(state: GameState): void {
  state.phase = "over";
  state.drawGame = true;
  // Eggs already settled immediately; nothing outstanding.
  const eggNote = state.eggPayouts.length
    ? ` Egg money already settled (${state.eggPayouts.length} xfer).`
    : "";
  const eggZh = state.eggPayouts.length ? ` 蛋钱已即时结算（${state.eggPayouts.length} 笔）。` : "";
  state.message = `Wall exhausted — draw game. Stakes stay.${eggNote}`;
  state.messageZh = `荒庄 — 流局，赌注不动。${eggZh}`;
}

/** Human clamped to wallet; AI cash moves for real (can hit 0). */
function pay(state: GameState, from: number, to: number, amount: number): number {
  if (amount <= 0) return 0;
  const payer = state.players[from]!;
  const payee = state.players[to]!;
  const amt = Math.min(Math.max(0, payer.cash), amount);
  if (amt <= 0) return 0;
  payer.cash -= amt;
  payee.cash += amt;
  return amt;
}

/** Refill broke AI to AI_START_CASH; record names on state.justBeaten. */
export function refillBrokeAi(state: GameState): string[] {
  const beaten: string[] = [];
  for (let i = 1; i < 4; i++) {
    const p = state.players[i]!;
    if (p.cash <= 0) {
      beaten.push(p.name);
      p.cash = AI_START_CASH;
    }
  }
  if (beaten.length) state.justBeaten = [...state.justBeaten, ...beaten];
  return beaten;
}

/**
 * Changchun 滚番 settle:
 * payout = stake * 2^(fan-1)
 * 自摸: all three pay shared fan (incl. 自摸).
 * 点炮: all three pay; discarder +1 放炮 on their fan only.
 */
function settle(state: GameState): void {
  const w = state.winResult;
  if (!w) return;
  w.stake = state.stake;
  const stake = state.stake;
  if (stake <= 0) {
    w.payouts = [];
    return;
  }
  const payouts: Payout[] = [];
  const baseFan = Math.max(1, w.fan);
  for (let i = 0; i < 4; i++) {
    if (i === w.winner) continue;
    let fan = baseFan;
    if (!w.selfDraw && w.loser === i) fan = baseFan + 1; // 放炮
    const due = rollingPayout(stake, fan);
    const amt = pay(state, i, w.winner, due);
    if (amt > 0) payouts.push({ from: i, to: w.winner, amount: amt, fan });
  }
  w.payouts = payouts;
  refillBrokeAi(state);
}

type EggMode = "open" | "added" | "concealed";

function settleEgg(state: GameState, konger: number, mode: EggMode, discarder?: number): Payout[] {
  const stake = state.stake;
  if (stake <= 0) return [];
  const payouts: Payout[] = [];
  if (mode === "open") {
    if (discarder === undefined || discarder === null) return [];
    const amt = pay(state, discarder, konger, stake);
    if (amt > 0) payouts.push({ from: discarder, to: konger, amount: amt, egg: true });
  } else {
    const mult = mode === "concealed" ? 2 : 1;
    for (let i = 0; i < 4; i++) {
      if (i === konger) continue;
      const amt = pay(state, i, konger, stake * mult);
      if (amt > 0) payouts.push({ from: i, to: konger, amount: amt, egg: true });
    }
  }
  state.eggPayouts.push(...payouts);
  refillBrokeAi(state);
  return payouts;
}

function eggNote(state: GameState, konger: number, mode: EggMode, batch: Payout[]): void {
  if (!batch.length) return;
  const who = state.players[konger]!;
  const label = mode === "open" ? "open kong" : mode === "added" ? "added kong" : "concealed kong";
  const labelZh = mode === "open" ? "明杠" : mode === "added" ? "补杠" : "暗杠";
  const total = batch.reduce((s, p) => s + p.amount, 0);
  state.message = `Egg (${label}): ${who.name} +$${total}. ${state.message}`;
  state.messageZh = `蛋钱（${labelZh}）：${who.nameZh} +$${total}。${state.messageZh}`;
}

export function applyDiscard(state: GameState, tileId: number): { needClaim: boolean } {
  const p = state.players[state.current]!;
  const idx = p.hand.findIndex((t) => t.id === tileId);
  if (idx < 0) throw new Error("tile not in hand");
  const tile = p.hand.splice(idx, 1)[0]!;
  p.river.push(tile);
  p.hand = sortTiles(p.hand);
  state.lastDiscard = tile;
  state.lastDiscarder = state.current;
  state.turnCount += 1;

  const discarder = state.current;
  const next = nextSeat(discarder);
  const all: Claim[] = [];
  for (let i = 0; i < 4; i++) {
    all.push(...claimsForPlayer(state.players[i]!, i, tile, discarder, next));
  }
  const human = all.filter((c) => c.player === 0);
  const ai = all.filter((c) => c.player !== 0);

  const aiWanted: Claim[] = [];
  for (const c of ai) {
    const pick = pickAiClaim(state.players[c.player]!, c.player, tile, c.type === "chow");
    if (!pick) continue;
    if (pick.type === c.type) {
      if (c.type === "chow" && pick.chow) aiWanted.push(pick);
      else if (c.type !== "chow") aiWanted.push(pick);
    }
  }
  // Freeze AI intents at discard so human 过 does not re-roll pickAiClaim.
  state.pendingAiClaims = aiWanted;

  if (humanClaimRelevant(human, aiWanted, discarder)) {
    state.phase = "claim";
    state.pendingHumanClaims = human;
    state.message = `${p.name} discarded ${tileName(tile)}. Claim?`;
    state.messageZh = `${p.nameZh} 打出 ${tileName(tile)} — 吃碰杠胡？`;
    return { needClaim: true };
  }

  const chosen = bestClaim(aiWanted, discarder);
  if (chosen) {
    resolveClaim(state, chosen);
    return { needClaim: false };
  }

  advanceToDraw(state, next);
  return { needClaim: false };
}

export function humanPass(state: GameState): void {
  if (state.phase !== "claim" || !state.lastDiscard || state.lastDiscarder === null) return;
  const discarder = state.lastDiscarder;
  const next = nextSeat(discarder);
  // Use intents frozen at discard — do not re-roll pickAiClaim.
  const aiWanted = state.pendingAiClaims;
  state.pendingHumanClaims = [];
  const chosen = bestClaim(aiWanted, discarder);
  if (chosen) resolveClaim(state, chosen);
  else advanceToDraw(state, next);
}

export function humanClaim(state: GameState, claim: Claim): void {
  if (state.phase !== "claim" || state.lastDiscarder === null) return;
  if (claim.player !== 0) return;
  const discarder = state.lastDiscarder;
  // Closer equal-rank AI beats human — only apply when human wins bestClaim.
  const chosen = bestClaim([claim, ...state.pendingAiClaims], discarder);
  if (!chosen) return;
  resolveClaim(state, chosen);
}

function takeDiscardFromRiver(state: GameState): Tile {
  const d = state.lastDiscarder!;
  const river = state.players[d]!.river;
  const tile = river.pop()!;
  state.lastDiscard = null;
  return tile;
}

function resolveClaim(state: GameState, claim: Claim): void {
  const p = state.players[claim.player]!;
  const tile = state.lastDiscard!;
  const discarder = state.lastDiscarder!;

  if (claim.type === "win") {
    const hand = [...p.hand, tile];
    const res = toWinResult(
      claim.player,
      discarder,
      false,
      hand,
      p.melds,
      p.seat,
      state.roundWind,
      state.dealer,
      tile.kind,
    );
    // Guard: never end the hand with a null winResult.
    if (!res) return;
    state.pendingHumanClaims = [];
    state.pendingAiClaims = [];
    takeDiscardFromRiver(state);
    state.phase = "over";
    state.winner = claim.player;
    state.winResult = res;
    settle(state);
    const who = claim.player === 0 ? "You win" : `${p.name} wins`;
    const zh = claim.player === 0 ? "你胡了" : `${p.nameZh} 胡牌`;
    const mult = rollingPayout(1, res.fan);
    state.message = `${who}! 点炮 · ${res.fan} fan · stake $${state.stake} (×${mult}/base).`;
    state.messageZh = `${zh}！点炮 · ${res.fan}番 · 赌注 $${state.stake}（底×${mult}）。`;
    return;
  }

  state.pendingHumanClaims = [];
  state.pendingAiClaims = [];
  const claimed = takeDiscardFromRiver(state);

  if (claim.type === "pung") {
    const { taken, rest } = takeKind(p.hand, claimed.kind, 2);
    p.hand = sortTiles(rest);
    p.melds.push({ type: "pung", tiles: [...taken, claimed], concealed: false, from: discarder });
    state.current = claim.player;
    state.phase = "discard";
    setTurnMessage(state, "pung", claimed);
    return;
  }

  if (claim.type === "kong") {
    const { taken, rest } = takeKind(p.hand, claimed.kind, 3);
    p.hand = sortTiles(rest);
    p.melds.push({ type: "kong", tiles: [...taken, claimed], concealed: false, from: discarder });
    state.current = claim.player;
    const eggPay = settleEgg(state, claim.player, "open", discarder);
    afterKong(state, claim.player);
    eggNote(state, claim.player, "open", eggPay);
    return;
  }

  if (claim.type === "chow" && claim.chow) {
    const ids = claim.chow.tiles.map((t) => t.id);
    const { taken, rest } = takeIds(p.hand, ids);
    p.hand = sortTiles(rest);
    const chowTiles = sortTiles([...taken, claimed]);
    p.melds.push({ type: "chow", tiles: chowTiles, concealed: false, from: discarder });
    state.current = claim.player;
    state.phase = "discard";
    setTurnMessage(state, "chow", claimed);
  }
}

function setTurnMessage(state: GameState, verb: string, tile: Tile): void {
  const p = state.players[state.current]!;
  const map: Record<string, [string, string]> = {
    pung: ["pung", "碰"],
    chow: ["chow", "吃"],
    kong: ["kong", "杠"],
  };
  const [en, zh] = map[verb] ?? [verb, verb];
  if (p.isHuman) {
    state.message = `You ${en} ${tileName(tile)} — discard.`;
    state.messageZh = `你${zh}了 ${tileName(tile)} — 请打牌。`;
  } else {
    state.message = `${p.name} ${en}s ${tileName(tile)}.`;
    state.messageZh = `${p.nameZh}${zh}了 ${tileName(tile)}。`;
  }
}

function afterKong(state: GameState, player: number): void {
  const tile = drawFromWall(state, player, true);
  if (!tile) {
    finishDrawGame(state);
    return;
  }
  const p = state.players[player]!;
  if (isWinningHand(p.hand, p.melds)) {
    if (!p.isHuman) {
      declareSelfWin(state, player);
      return;
    }
  }
  state.phase = "discard";
  state.current = player;
  if (p.isHuman) {
    state.message = `Kong replacement ${tileName(tile)} — discard or win.`;
    state.messageZh = `杠开 ${tileName(tile)} — 可打或自摸。`;
  } else {
    state.message = `${p.name} kongs and draws a replacement.`;
    state.messageZh = `${p.nameZh} 开杠补牌。`;
  }
}

function advanceToDraw(state: GameState, who: number): void {
  state.current = who;
  state.pendingHumanClaims = [];
  state.pendingAiClaims = [];
  if (!state.wall.length) {
    finishDrawGame(state);
    return;
  }
  state.phase = "draw";
}

export function drawCurrent(state: GameState): Tile | null {
  if (state.phase !== "draw") return null;
  const who = state.current;
  const tile = drawFromWall(state, who, false);
  if (!tile) {
    finishDrawGame(state);
    return null;
  }
  state.phase = "discard";
  const p = state.players[who]!;
  if (p.isHuman) {
    state.message = `You drew ${tileName(tile)} — discard a tile.`;
    state.messageZh = `你摸了 ${tileName(tile)} — 请打出一张。`;
  } else {
    state.message = `${p.name} draws.`;
    state.messageZh = `${p.nameZh} 摸牌。`;
  }
  return tile;
}

export function declareSelfWin(state: GameState, player: number): boolean {
  const p = state.players[player]!;
  if (!isWinningHand(p.hand, p.melds)) return false;
  const winKind = state.lastDraw?.kind;
  const res = toWinResult(
    player,
    null,
    true,
    p.hand,
    p.melds,
    p.seat,
    state.roundWind,
    state.dealer,
    winKind,
  );
  if (!res) return false;
  state.pendingHumanClaims = [];
  state.pendingAiClaims = [];
  state.phase = "over";
  state.winner = player;
  state.winResult = res;
  settle(state);
  const who = player === 0 ? "You win by self-draw" : `${p.name} wins by self-draw`;
  const zh = player === 0 ? "你自摸" : `${p.nameZh} 自摸`;
  const each = rollingPayout(state.stake, res.fan);
  state.message = `${who}! ${res.fan} fan — each other seat pays $${each}.`;
  state.messageZh = `${zh}！${res.fan}番 — 三家各付 $${each}。`;
  return true;
}

export function declareKong(state: GameState, kind: string, mode: "concealed" | "added"): boolean {
  if (state.phase !== "discard") return false;
  const p = state.players[state.current]!;
  if (mode === "concealed") {
    if (concealedKongKinds(p.hand).indexOf(kind) < 0) return false;
    const { taken, rest } = takeKind(p.hand, kind, 4);
    p.hand = sortTiles(rest);
    p.melds.push({ type: "kong", tiles: taken, concealed: true });
    const eggPay = settleEgg(state, state.current, "concealed");
    afterKong(state, state.current);
    eggNote(state, state.current, "concealed", eggPay);
    return true;
  } else {
    const m = p.melds.find((x) => x.type === "pung" && x.tiles[0]?.kind === kind);
    const t = p.hand.find((x) => x.kind === kind);
    if (!m || !t) return false;
    p.hand = p.hand.filter((x) => x.id !== t.id);
    m.type = "kong";
    m.tiles.push(t);
    const eggPay = settleEgg(state, state.current, "added");
    afterKong(state, state.current);
    eggNote(state, state.current, "added", eggPay);
    return true;
  }
}

export function aiPlayDiscard(state: GameState): number {
  const p = state.players[state.current]!;
  const sk = seatKind(p.seat);
  const rk = seatKind(state.roundWind);

  if (isWinningHand(p.hand, p.melds)) {
    declareSelfWin(state, state.current);
    return -1;
  }

  for (const k of concealedKongKinds(p.hand)) {
    if (aiShouldConcealedKong(p, k) && state.wall.length > 0) {
      declareKong(state, k, "concealed");
      if (state.phase === "over") return -1;
      if (isWinningHand(p.hand, p.melds)) {
        declareSelfWin(state, state.current);
        return -1;
      }
      break;
    }
  }

  const tile = chooseDiscard(p, sk, rk);
  applyDiscard(state, tile.id);
  return tile.id;
}

export function playerLabel(p: Player): string {
  return `${WIND_ZH[p.seat]} ${p.nameZh}`;
}

export function windLabel(w: Wind): string {
  return `${WIND_ZH[w]} ${WIND_EN[w]}`;
}

export function formatCash(n: number): string {
  return `$${n}`;
}

/** Unit-ish settle checks for Changchun rolling fan (non-dealer winner). */
export function selfTestSettle(): void {
  const state = createTable([100, 1000, 1000, 1000]);
  state.stake = 1;
  state.dealer = 0;

  // 自摸平胡 fan=2 → each pays 2
  state.players.forEach((p, i) => {
    p.cash = i === 0 ? 100 : 1000;
  });
  state.winResult = {
    winner: 1,
    loser: null,
    selfDraw: true,
    pairKind: "we",
    melds: [],
    concealed: [],
    fan: 2,
    lines: [
      { name: "Ping hu", nameZh: "平胡", fan: 1 },
      { name: "Self-draw", nameZh: "自摸", fan: 1 },
    ],
    payouts: [],
    stake: 0,
  };
  settle(state);
  const zimoPays = state.winResult.payouts.map((p) => p.amount).sort((a, b) => a - b);
  if (zimoPays.length !== 3 || zimoPays.some((a) => a !== 2)) {
    throw new Error(`settle test: 自摸平胡 each pay 2, got ${JSON.stringify(state.winResult.payouts)}`);
  }
  if (state.players[1]!.cash !== 1000 + 6) throw new Error("settle test: zimo winner cash");

  // 点炮平胡 fan=1 → discarder pays 2, others pay 1
  state.players.forEach((p, i) => {
    p.cash = i === 0 ? 100 : 1000;
  });
  state.justBeaten = [];
  state.winResult = {
    winner: 1,
    loser: 2,
    selfDraw: false,
    pairKind: "we",
    melds: [],
    concealed: [],
    fan: 1,
    lines: [{ name: "Ping hu", nameZh: "平胡", fan: 1 }],
    payouts: [],
    stake: 0,
  };
  settle(state);
  const byFrom = new Map(state.winResult.payouts.map((p) => [p.from, p.amount]));
  if (byFrom.get(2) !== 2) throw new Error(`settle test: discarder pay 2, got ${byFrom.get(2)}`);
  if (byFrom.get(0) !== 1) throw new Error(`settle test: other(human) pay 1, got ${byFrom.get(0)}`);
  if (byFrom.get(3) !== 1) throw new Error(`settle test: other pay 1, got ${byFrom.get(3)}`);
}
