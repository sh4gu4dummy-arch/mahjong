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

function hasYaojiu(player: Player, ignoreId?: number): boolean {
  const tiles = [...player.hand, ...player.melds.flatMap((m) => m.tiles)];
  return tiles.some((t) => t.id !== ignoreId && isYaojiuKind(t.kind));
}

export function tileKeepScore(hand: Tile[], tile: Tile, seatKind: string, roundKind: string, player: Player): number {
  const copies = countKind(hand, tile.kind);
  let s = neighborScore(hand, tile);
  if (copies >= 2) s += 14;
  if (copies >= 3) s += 20;
  if (isHonor(tile.kind)) {
    if (copies === 1) s -= 6;
    if (tile.kind === "dr" || tile.kind === "dg" || tile.kind === "dw") s += copies >= 2 ? 10 : 0;
    if (tile.kind === seatKind || tile.kind === roundKind) s += copies >= 2 ? 6 : -1;
  }
  if (isYaojiuKind(tile.kind) && !hasYaojiu(player, tile.id)) s += 10;
  const suits = suitsIn(player);
  if ((tile.kind[0] === "m" || tile.kind[0] === "s" || tile.kind[0] === "p") && suits.size <= 3) {
    const onlyThis = player.hand.filter((x) => x.kind[0] === tile.kind[0] && x.id !== tile.id).length
      + player.melds.flatMap((m) => m.tiles).filter((x) => x.kind[0] === tile.kind[0]).length;
    if (onlyThis === 0) s += 12;
  }
  return s;
}

export function chooseDiscard(player: Player, seatKind: string, roundKind: string): Tile {
  const { hand } = player;
  let worst = hand[0]!;
  let worstScore = Infinity;
  for (const t of hand) {
    const s = tileKeepScore(hand, t, seatKind, roundKind, player);
    if (s < worstScore || (s === worstScore && t.id < worst.id)) {
      worstScore = s;
      worst = t;
    }
  }
  return worst;
}

export function aiWantWin(player: Player, tile: Tile): boolean {
  return wouldWinWith(player.hand, tile, player.melds);
}

export function aiWantPung(player: Player, tile: Tile): boolean {
  if (countKind(player.hand, tile.kind) < 2) return false;
  if (!hasOpened(player.melds)) return true;
  if (isHonor(tile.kind)) return true;
  const seq = neighborScore(player.hand.filter((t) => t.kind !== tile.kind), tile);
  if (seq >= 16) return false;
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
  if (!opened) return best.o;
  if (best.s < 2) return false;
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
  // 暗杠 does not open; still useful for 有刻
  return isHonor(kind) || true;
}
