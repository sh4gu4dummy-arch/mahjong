import type { ChowOption, Claim, Player, Tile } from "./types";
import { countKind, isSuited, parseKind } from "./tiles";
import { wouldWinWith } from "./win";

export function chowOptions(hand: Tile[], claimed: Tile): ChowOption[] {
  if (!isSuited(claimed.kind)) return [];
  const { value } = parseKind(claimed.kind);
  const suit = claimed.kind[0]!;
  const has = (v: number) => hand.find((t) => t.kind === `${suit}${v}`) ?? null;
  const opts: ChowOption[] = [];

  const tryPair = (a: number, b: number) => {
    const ta = has(a);
    const tb = has(b);
    if (!ta || !tb || ta.id === tb.id) return;
    opts.push({ tiles: [ta, tb], claimed });
  };

  if (value >= 3) tryPair(value - 2, value - 1);
  if (value >= 2 && value <= 8) tryPair(value - 1, value + 1);
  if (value <= 7) tryPair(value + 1, value + 2);
  return opts;
}

export function canPung(hand: Tile[], claimed: Tile): boolean {
  return countKind(hand, claimed.kind) >= 2;
}

export function canMeldKong(hand: Tile[], claimed: Tile): boolean {
  return countKind(hand, claimed.kind) >= 3;
}

export function concealedKongKinds(hand: Tile[]): string[] {
  const c: Record<string, number> = {};
  for (const t of hand) c[t.kind] = (c[t.kind] ?? 0) + 1;
  return Object.keys(c).filter((k) => (c[k] ?? 0) >= 4);
}

export function addedKongTiles(player: Player): Tile[] {
  const out: Tile[] = [];
  for (const m of player.melds) {
    if (m.type !== "pung") continue;
    const k = m.tiles[0]!.kind;
    const t = player.hand.find((x) => x.kind === k);
    if (t) out.push(t);
  }
  return out;
}

export function claimsForPlayer(
  player: Player,
  playerIndex: number,
  discarded: Tile,
  discarder: number,
  nextPlayer: number,
): Claim[] {
  if (playerIndex === discarder) return [];
  const claims: Claim[] = [];
  if (wouldWinWith(player.hand, discarded, player.melds)) {
    claims.push({ player: playerIndex, type: "win" });
  }
  if (canMeldKong(player.hand, discarded)) {
    claims.push({ player: playerIndex, type: "kong" });
  }
  if (canPung(player.hand, discarded)) {
    claims.push({ player: playerIndex, type: "pung" });
  }
  if (playerIndex === nextPlayer) {
    for (const chow of chowOptions(player.hand, discarded)) {
      claims.push({ player: playerIndex, type: "chow", chow });
    }
  }
  return claims;
}

const RANK: Record<string, number> = { win: 4, kong: 3, pung: 2, chow: 1 };

export function bestClaim(claims: Claim[], discarder: number): Claim | null {
  if (!claims.length) return null;
  const max = Math.max(...claims.map((c) => RANK[c.type] ?? 0));
  const top = claims.filter((c) => RANK[c.type] === max);
  top.sort((a, b) => {
    const da = (a.player - discarder + 4) % 4;
    const db = (b.player - discarder + 4) % 4;
    return da - db;
  });
  return top[0] ?? null;
}

/** True if the human's claim could actually win the priority fight. */
export function humanClaimRelevant(human: Claim[], others: Claim[]): boolean {
  if (!human.length) return false;
  const bestOther = others.length ? Math.max(...others.map((c) => RANK[c.type] ?? 0)) : 0;
  const bestHuman = Math.max(...human.map((c) => RANK[c.type] ?? 0));
  return bestHuman >= bestOther;
}
