import type { Claim, Player, Tile } from "./types";
import { countKind, isHonor, isSuited, parseKind } from "./tiles";
import { chowOptions } from "./claims";
import { hasOpened, isYaojiuKind, wouldWinWith } from "./win";

function neighborScore(hand: Tile[], tile: Tile): number {
  if (!isSuited(tile.kind)) return 0;
  const { value } = parseKind(tile.kind);
  const suit = tile.kind[0]!;
  let s = 0;
  for (const t of hand) {
    if (t.id === tile.id || t.kind[0] !== suit) continue;
    const d = Math.abs(t.value - value);
    if (d === 0) s += 12;
    else if (d === 1) s += 8;
    else if (d === 2) s += 3;
  }
  return s;
}

function suitsIn(player: Player): Set<string> {
  const s = new Set<string>();
  for (const t of player.hand) if (t.kind[0] === "m" || t.kind[0] === "s" || t.kind[0] === "p") s.add(t.kind[0]!);
  for (const m of player.melds) for (const t of m.tiles) {
    if (t.kind[0] === "m" || t.kind[0] === "s" || t.kind[0] === "p") s.add(t.kind[0]!);
  }
  return s;
}

function suitCount(player: Player, suit: string, ignoreId?: number): number {
  let n = 0;
  for (const t of player.hand) if (t.id !== ignoreId && t.kind[0] === suit) n++;
  for (const m of player.melds) for (const t of m.tiles) if (t.kind[0] === suit) n++;
  return n;
}

function hasYaojiu(player: Player, ignoreId?: number): boolean {
  const tiles = [...player.hand, ...player.melds.flatMap((m) => m.tiles)];
  return tiles.some((t) => t.id !== ignoreId && isYaojiuKind(t.kind));
}

function hasKeShape(player: Player, ignoreId?: number): boolean {
  const c: Record<string, number> = {};
  for (const t of player.hand) if (t.id !== ignoreId) c[t.kind] = (c[t.kind] ?? 0) + 1;
  if (Object.values(c).some((n) => n >= 3)) return true;
  return player.melds.some((m) => m.type === "pung" || m.type === "kong");
}

/** Soft AI keep-score: near-optimal, diluted Northeast planning (casual table mate). */
export function tileKeepScore(hand: Tile[], tile: Tile, seatKind: string, roundKind: string, player: Player): number {
  const copies = countKind(hand, tile.kind);
  let s = neighborScore(hand, tile);
  if (copies >= 2) s += 14;
  if (copies >= 3) s += 22; // never casually break an obvious pung
  if (isHonor(tile.kind)) {
    if (copies === 1) s -= 4; // slightly less eager to dump lone honors
    if (tile.kind === "dr" || tile.kind === "dg" || tile.kind === "dw") s += copies >= 2 ? 8 : 1;
    if (tile.kind === seatKind || tile.kind === roundKind) s += copies >= 2 ? 5 : 0;
  }
  // Mild yaojiu awareness — sometimes keeps an awkward honor one turn too long via noise elsewhere
  if (isYaojiuKind(tile.kind) && !hasYaojiu(player, tile.id)) s += 6;
  const suits = suitsIn(player);
  if ((tile.kind[0] === "m" || tile.kind[0] === "s" || tile.kind[0] === "p") && suits.size <= 3) {
    const onlyThis = suitCount(player, tile.kind[0]!, tile.id);
    // Weaker 三门齐 bias — mild hesitation in suit choice
    if (onlyThis === 0) s += 5;
    else if (onlyThis <= 2 && suits.size === 3) s += 2;
  }
  return s;
}

/**
 * Tip keep-score: stronger than soft AI.
 * Prioritizes 三门齐 · 刻 · 幺九 · 开门 · safer discards.
 */
export function tipKeepScore(hand: Tile[], tile: Tile, seatKind: string, roundKind: string, player: Player): number {
  const copies = countKind(hand, tile.kind);
  let s = neighborScore(hand, tile);
  if (copies >= 2) s += 16;
  if (copies >= 3) s += 28;

  if (isHonor(tile.kind)) {
    if (copies === 1) s -= 10;
    if (tile.kind === "dr" || tile.kind === "dg" || tile.kind === "dw") s += copies >= 2 ? 14 : -2;
    if (tile.kind === seatKind || tile.kind === roundKind) s += copies >= 2 ? 10 : -2;
  }

  // 幺九: protect last terminal/honor hard
  if (isYaojiuKind(tile.kind) && !hasYaojiu(player, tile.id)) s += 18;

  // 有刻: protect tiles that form/keep a pung shape
  if (!hasKeShape(player, tile.id) && copies >= 2) s += 12;
  if (copies >= 3) s += 6;

  // 三门齐: strongly protect last tiles of a needed suit
  const suit = tile.kind[0];
  if (suit === "m" || suit === "s" || suit === "p") {
    const onlyThis = suitCount(player, suit, tile.id);
    const suits = suitsIn(player);
    if (onlyThis === 0) s += 20;
    else if (onlyThis === 1 && suits.size >= 2) s += 10;
    else if (onlyThis <= 3 && suits.size === 3) s += 4;
  }

  // 开门: if not opened, prefer keeping chow/pung material over orphans
  if (!hasOpened(player.melds)) {
    if (copies >= 2) s += 6;
    if (isSuited(tile.kind) && neighborScore(hand, tile) >= 8) s += 5;
    if (isSuited(tile.kind) && neighborScore(hand, tile) === 0 && copies === 1) s -= 4;
  }

  // Safer discards: middle tiles with no neighbors are slightly preferred to dump;
  // edge terminals that aren't the last yaojiu are safer dumps than connected middles
  if (isSuited(tile.kind) && copies === 1 && neighborScore(hand, tile) === 0) {
    const v = tile.value;
    if (v === 1 || v === 9) s -= 3;
    else if (v === 2 || v === 8) s -= 1;
    else s -= 2; // orphan middle — tip prefers dumping these
  }

  return s;
}

type Ranked = { tile: Tile; score: number };

function rankDiscards(
  player: Player,
  seatKind: string,
  roundKind: string,
  scoreFn: typeof tileKeepScore,
): Ranked[] {
  const ranked = player.hand.map((tile) => ({
    tile,
    score: scoreFn(player.hand, tile, seatKind, roundKind, player),
  }));
  ranked.sort((a, b) => a.score - b.score || a.tile.id - b.tile.id);
  return ranked;
}

/** Soft AI discard: usually near-best; small natural slips, never sabotage. */
export function chooseDiscard(player: Player, seatKind: string, roundKind: string): Tile {
  const ranked = rankDiscards(player, seatKind, roundKind, tileKeepScore);
  if (ranked.length === 1) return ranked[0]!.tile;

  // Never break an obvious pung (3+ copies) — filter those out of error candidates
  const safe = ranked.filter((r) => countKind(player.hand, r.tile.kind) < 3);
  const pool = safe.length ? safe : ranked;

  const roll = Math.random();
  // ~72% optimal, ~20% 2nd-best (dump slightly useful / keep awkward honor), ~8% 3rd
  let pick = 0;
  if (roll > 0.72 && pool.length > 1) pick = 1;
  if (roll > 0.92 && pool.length > 2) pick = 2;
  return pool[pick]!.tile;
}

/** Tip discard: stronger Northeast hand-building than soft AI. No randomness. */
export function chooseTipDiscard(player: Player, seatKind: string, roundKind: string): Tile {
  const ranked = rankDiscards(player, seatKind, roundKind, tipKeepScore);
  return ranked[0]!.tile;
}

export function aiWantWin(player: Player, tile: Tile): boolean {
  // Never pass on a clear free win
  return wouldWinWith(player.hand, tile, player.melds);
}

export function aiWantPung(player: Player, tile: Tile): boolean {
  if (countKind(player.hand, tile.kind) < 2) return false;
  // Always pung honors / when not yet opened (helps 开门 + 有刻)
  if (!hasOpened(player.melds)) return true;
  if (isHonor(tile.kind)) return true;

  const seq = neighborScore(
    player.hand.filter((t) => t.kind !== tile.kind),
    tile,
  );
  // Skip pung that smashes a strong sequence — looks thoughtful
  if (seq >= 16) return false;

  // Sometimes claim a pung that doesn't help much (casual over-call) ~18%
  if (seq >= 8 && Math.random() < 0.18) return true;

  // Mild skip on low-value suited pungs when already have ke shape ~22%
  if (hasKeShape(player) && !isYaojiuKind(tile.kind) && Math.random() < 0.22) return false;

  return true;
}

export function aiWantKong(player: Player, tile: Tile): boolean {
  return countKind(player.hand, tile.kind) >= 3;
}

export function aiWantChow(player: Player, tile: Tile): boolean | ChowPick {
  const opts = chowOptions(player.hand, tile);
  if (!opts.length) return false;
  const opened = hasOpened(player.melds);
  const scored = opts.map((o) => {
    let s = opened ? 4 : 10;
    for (const x of o.tiles) {
      if (countKind(player.hand, x.kind) >= 2) s -= opened ? 3 : 1;
    }
    return { o, s };
  });
  scored.sort((a, b) => b.s - a.s);
  const best = scored[0]!;

  // Need 开门: take a reasonable chow
  if (!opened) {
    // Skip only truly terrible chows that eat pair material
    if (best.s < 0) return false;
    return best.o;
  }

  // Already open: skip low-value chows often (casual — ~35%)
  if (best.s < 2) return false;
  if (best.s < 5 && Math.random() < 0.35) return false;
  return best.o;
}

type ChowPick = { tiles: [Tile, Tile]; claimed: Tile };

export function pickAiClaim(player: Player, index: number, tile: Tile, canChow: boolean): Claim | null {
  if (aiWantWin(player, tile)) return { player: index, type: "win" };
  if (aiWantKong(player, tile)) return { player: index, type: "kong" };
  if (aiWantPung(player, tile)) return { player: index, type: "pung" };
  if (canChow) {
    const ch = aiWantChow(player, tile);
    if (ch && typeof ch === "object") return { player: index, type: "chow", chow: ch };
  }
  return null;
}

export function aiShouldConcealedKong(_player: Player, kind: string): boolean {
  // Prefer konging honors; sometimes skip a suited 暗杠 (~25%) — mild hesitation
  if (isHonor(kind)) return true;
  return Math.random() >= 0.25;
}
