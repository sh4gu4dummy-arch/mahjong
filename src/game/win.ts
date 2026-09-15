import type { DongbeiFlags, FanLine, Meld, Tile, Wind, WinResult } from "./types";
import { isHonor, isSuited, parseKind } from "./tiles";

type MeldsNeed = { type: "chow" | "pung"; kinds: string[] };

export interface Pattern {
  pair: string;
  concealedMelds: MeldsNeed[];
}

function firstKind(c: Record<string, number>): string | null {
  const keys = Object.keys(c)
    .filter((k) => (c[k] ?? 0) > 0)
    .sort();
  return keys[0] ?? null;
}

function tryForm(c: Record<string, number>, meldsLeft: number, pair: string | null, acc: MeldsNeed[]): Pattern | null {
  const k = firstKind(c);
  if (!k) return pair && meldsLeft === 0 ? { pair, concealedMelds: [...acc] } : null;

  const n = c[k] ?? 0;

  if (!pair && n >= 2) {
    c[k] = n - 2;
    const r = tryForm(c, meldsLeft, k, acc);
    c[k] = n;
    if (r) return r;
  }

  if (meldsLeft > 0 && n >= 3) {
    c[k] = n - 3;
    acc.push({ type: "pung", kinds: [k, k, k] });
    const r = tryForm(c, meldsLeft - 1, pair, acc);
    acc.pop();
    c[k] = n;
    if (r) return r;
  }

  if (meldsLeft > 0 && isSuited(k)) {
    const { value } = parseKind(k);
    if (value <= 7) {
      const k2 = `${k[0]}${value + 1}`;
      const k3 = `${k[0]}${value + 2}`;
      if ((c[k2] ?? 0) > 0 && (c[k3] ?? 0) > 0) {
        c[k] = n - 1;
        c[k2] = (c[k2] ?? 0) - 1;
        c[k3] = (c[k3] ?? 0) - 1;
        acc.push({ type: "chow", kinds: [k, k2, k3] });
        const r = tryForm(c, meldsLeft - 1, pair, acc);
        acc.pop();
        c[k] = n;
        c[k2] = (c[k2] ?? 0) + 1;
        c[k3] = (c[k3] ?? 0) + 1;
        if (r) return r;
      }
    }
  }

  return null;
}

export function findPattern(concealed: Tile[], exposedCount: number): Pattern | null {
  const needMelds = 4 - exposedCount;
  const needTiles = needMelds * 3 + 2;
  if (concealed.length !== needTiles) return null;
  const c: Record<string, number> = {};
  for (const t of concealed) c[t.kind] = (c[t.kind] ?? 0) + 1;
  return tryForm(c, needMelds, null, []);
}

export function hasOpened(exposed: Meld[]): boolean {
  return exposed.some((m) => !m.concealed);
}

export function isYaojiuKind(kind: string): boolean {
  if (isHonor(kind)) return true;
  const v = Number(kind.slice(1));
  return v === 1 || v === 9;
}

export function isDragonKind(kind: string): boolean {
  return kind === "dr" || kind === "dg" || kind === "dw";
}

function allKinds(concealed: Tile[], exposed: Meld[]): string[] {
  return [...concealed.map((t) => t.kind), ...exposed.flatMap((m) => m.tiles.map((t) => t.kind))];
}

export function dongbeiFlags(concealed: Tile[], exposed: Meld[], pattern: Pattern | null = null): DongbeiFlags {
  const opened = hasOpened(exposed);
  const kinds = allKinds(concealed, exposed);
  const yaojiu = kinds.some(isYaojiuKind);
  const suits = new Set(kinds.filter((k) => k[0] === "m" || k[0] === "s" || k[0] === "p").map((k) => k[0]));
  const threeSuits = suits.has("m") && suits.has("s") && suits.has("p");

  const exposedKe = exposed.some((m) => m.type === "pung" || m.type === "kong");
  const concealedKe = pattern
    ? pattern.concealedMelds.some((m) => m.type === "pung")
    : (() => {
        const c: Record<string, number> = {};
        for (const t of concealed) c[t.kind] = (c[t.kind] ?? 0) + 1;
        return Object.values(c).some((n) => n >= 3);
      })();
  const hasKe = exposedKe || concealedKe;
  const dragonEyes = pattern
    ? isDragonKind(pattern.pair)
    : (() => {
        const c: Record<string, number> = {};
        for (const t of concealed) if (isDragonKind(t.kind)) c[t.kind] = (c[t.kind] ?? 0) + 1;
        return Object.values(c).some((n) => n >= 2);
      })();
  return { opened, hasKe, dragonEyes, yaojiu, threeSuits };
}

export function dongbeiLegal(concealed: Tile[], exposed: Meld[], pattern: Pattern): boolean {
  const f = dongbeiFlags(concealed, exposed, pattern);
  if (!f.opened) return false;
  if (!f.hasKe && !f.dragonEyes) return false;
  if (!f.yaojiu) return false;
  if (!f.threeSuits) return false;
  return true;
}

export function isWinningHand(concealed: Tile[], exposed: Meld[]): boolean {
  const pattern = findPattern(concealed, exposed.length);
  if (!pattern) return false;
  return dongbeiLegal(concealed, exposed, pattern);
}

export function wouldWinWith(hand: Tile[], extra: Tile, exposed: Meld[]): boolean {
  return isWinningHand([...hand, extra], exposed);
}

export function scoreWin(
  concealed: Tile[],
  exposed: Meld[],
  _winnerSeat: Wind,
  _roundWind: Wind,
  selfDraw: boolean,
): { fan: number; lines: FanLine[]; pattern: Pattern } | null {
  const pattern = findPattern(concealed, exposed.length);
  if (!pattern) return null;
  if (!dongbeiLegal(concealed, exposed, pattern)) return null;

  const allMelds: { type: "chow" | "pung" | "kong"; kinds: string[] }[] = [
    ...pattern.concealedMelds,
    ...exposed.map((m) => ({
      type: m.type as "chow" | "pung" | "kong",
      kinds: m.tiles.map((t) => t.kind),
    })),
  ];

  const lines: FanLine[] = [];
  const add = (name: string, nameZh: string, fan: number) => lines.push({ name, nameZh, fan });

  add("Opened hand", "开门", 0);
  if (dongbeiFlags(concealed, exposed, pattern).hasKe) add("Has a pung", "有刻", 0);
  else add("Dragon eyes", "中发白将", 0);
  add("Terminal/honor", "带幺九", 0);
  add("Three suits", "三门齐", 0);

  for (const m of allMelds) {
    if (m.type === "chow") continue;
    const k = m.kinds[0]!;
    if (k === "dr") add("Red dragon pung", "红中刻", 1);
    if (k === "dg") add("Green dragon pung", "发财刻", 1);
    if (k === "dw") add("White dragon pung", "白板刻", 1);
  }

  const types = allMelds.map((m) => (m.type === "kong" ? "pung" : m.type));
  if (types.every((t) => t === "pung")) add("All pungs", "对对胡", 2);

  if (selfDraw) add("Self-draw", "自摸", 1);

  const fan = Math.max(1, lines.reduce((s, l) => s + l.fan, 0));
  if (!lines.some((l) => l.fan > 0)) add("Basic win", "基本胡", 1);

  return { fan, lines, pattern };
}

export function toWinResult(
  winner: number,
  loser: number | null,
  selfDraw: boolean,
  concealed: Tile[],
  exposed: Meld[],
  winnerSeat: Wind,
  roundWind: Wind,
): WinResult | null {
  const scored = scoreWin(concealed, exposed, winnerSeat, roundWind, selfDraw);
  if (!scored) return null;
  return {
    winner,
    loser,
    selfDraw,
    pairKind: scored.pattern.pair,
    melds: exposed,
    concealed: [...concealed],
    fan: scored.fan,
    lines: scored.lines,
    payouts: [],
    stake: 0,
  };
}

export function selfTestWin(): void {
  const t = (kind: string, id: number): Tile => {
    const { suit, value } = parseKind(kind);
    return { id, kind, suit, value };
  };
  const many = (kind: string, n: number, start: number) =>
    Array.from({ length: n }, (_, i) => t(kind, start + i));
  const pung = (kind: string, start: number, concealed = false): Meld => ({
    type: "pung",
    tiles: many(kind, 3, start),
    concealed,
  });
  const chow = (a: string, b: string, c: string, start: number): Meld => ({
    type: "chow",
    tiles: [t(a, start), t(b, start + 1), t(c, start + 2)],
    concealed: false,
  });

  // Concealed all-pungs: no 开门
  const closed = [...many("m1", 3, 0), ...many("m2", 3, 3), ...many("m3", 3, 6), ...many("s1", 3, 9), ...many("p1", 2, 12)];
  if (isWinningHand(closed, [])) throw new Error("win test: closed hand must fail 开门");

  // Opened pung + three suits + yaojiu
  const rest = [...many("s1", 3, 0), ...many("p1", 3, 3), ...many("m2", 3, 6), ...many("we", 2, 9)];
  if (!isWinningHand(rest, [pung("m1", 20)])) throw new Error("win test: opened 三门齐 failed");

  // All chows, man pair, opened — no 刻 and not dragon eyes
  const chows = [
    t("s1", 0), t("s2", 1), t("s3", 2),
    t("p1", 3), t("p2", 4), t("p3", 5),
    t("m7", 6), t("m8", 7), t("m9", 8),
    t("m5", 9), t("m5", 10),
  ];
  if (isWinningHand(chows, [chow("m1", "m2", "m3", 20)])) throw new Error("win test: no 刻 should fail");

  // All chows + 中 pair substitutes 刻
  const dragonEyes = [
    t("s1", 0), t("s2", 1), t("s3", 2),
    t("p1", 3), t("p2", 4), t("p3", 5),
    t("m7", 6), t("m8", 7), t("m9", 8),
    t("dr", 9), t("dr", 10),
  ];
  if (!isWinningHand(dragonEyes, [chow("m1", "m2", "m3", 20)])) throw new Error("win test: 中发白将 failed");

  // Missing a suit
  const twoSuits = [...many("s1", 3, 0), ...many("s2", 3, 3), ...many("m2", 3, 6), ...many("we", 2, 9)];
  if (isWinningHand(twoSuits, [pung("m1", 20)])) throw new Error("win test: missing suit should fail");

  // No 幺九 (2-8 only)
  const noYao = [...many("s2", 3, 0), ...many("p2", 3, 3), ...many("m2", 3, 6), ...many("m5", 2, 9)];
  if (isWinningHand(noYao, [pung("m3", 20)])) throw new Error("win test: no 幺九 should fail");

  // Concealed kong does not open
  const ck: Meld = { type: "kong", tiles: many("m1", 4, 20), concealed: true };
  const afterCk = [...many("s1", 3, 0), ...many("p1", 3, 3), ...many("m2", 3, 6), ...many("we", 2, 9)];
  if (isWinningHand(afterCk, [ck])) throw new Error("win test: 暗杠 must not count as 开门");
}
