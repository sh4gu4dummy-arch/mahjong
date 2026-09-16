import type { DongbeiFlags, FanLine, Meld, Tile, Wind, WinResult } from "./types";
import { isHonor, isSuited, parseKind } from "./tiles";
import { getRules } from "./rules";

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

/** Changchun-style legality; toggles from table rules. */
export function dongbeiLegal(concealed: Tile[], exposed: Meld[], pattern: Pattern): boolean {
  const f = dongbeiFlags(concealed, exposed, pattern);
  const rules = getRules();
  if (!rules.allowLiHu && !f.opened) return false;
  if (rules.requireKeOrDragonEyes && !f.hasKe && !f.dragonEyes) return false;
  if (rules.requireYaojiu && !f.yaojiu) return false;
  if (rules.requireThreeSuits && !f.threeSuits) return false;
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

/** Rolling-fan cash: stake * 2^(fan-1). Fan < 1 → 0. */
export function rollingPayout(stake: number, fan: number): number {
  if (stake <= 0 || fan < 1) return 0;
  return stake * 2 ** (fan - 1);
}

function removeOneKind(tiles: Tile[], kind: string): Tile[] | null {
  const idx = tiles.findIndex((t) => t.kind === kind);
  if (idx < 0) return null;
  return [...tiles.slice(0, idx), ...tiles.slice(idx + 1)];
}

/**
 * Detect 夹胡 as edge / middle / pair wait when the winning tile's role in a
 * formed pattern is 边张、嵌张、单吊、or 对倒.
 */
export function isJiaHu(concealedWithWin: Tile[], exposed: Meld[], winKind: string): boolean {
  const rest = removeOneKind(concealedWithWin, winKind);
  if (!rest) return false;
  if (!isWinningHand(concealedWithWin, exposed)) return false;
  const pattern = findPattern(concealedWithWin, exposed.length);
  if (!pattern) return false;

  const nInRest = rest.filter((t) => t.kind === winKind).length;

  // 单吊 — pair wait
  if (nInRest === 1 && pattern.pair === winKind) return true;

  // 对倒 — pung wait (pair wait of sorts)
  if (nInRest === 2 && pattern.concealedMelds.some((m) => m.type === "pung" && m.kinds[0] === winKind)) {
    return true;
  }

  // Chow roles: 夹张 / 边张
  for (const m of pattern.concealedMelds) {
    if (m.type !== "chow") continue;
    if (!m.kinds.includes(winKind)) continue;
    if (!isSuited(winKind)) continue;
    const vals = m.kinds.map((k) => Number(k.slice(1))).sort((a, b) => a - b);
    const winVal = Number(winKind.slice(1));
    // Middle nest
    if (winVal === vals[0]! + 1 && winVal === vals[2]! - 1) return true;
    // Edge: 3 of 123, or 7 of 789
    if (vals[0] === 1 && vals[1] === 2 && vals[2] === 3 && winVal === 3) return true;
    if (vals[0] === 7 && vals[1] === 8 && vals[2] === 9 && winVal === 7) return true;
  }
  return false;
}

export interface ScoreOpts {
  dealerWin?: boolean;
  winKind?: string;
}

export function scoreWin(
  concealed: Tile[],
  exposed: Meld[],
  _winnerSeat: Wind,
  _roundWind: Wind,
  selfDraw: boolean,
  opts: ScoreOpts = {},
): { fan: number; lines: FanLine[]; pattern: Pattern } | null {
  const pattern = findPattern(concealed, exposed.length);
  if (!pattern) return null;
  if (!dongbeiLegal(concealed, exposed, pattern)) return null;

  const flags = dongbeiFlags(concealed, exposed, pattern);
  const allMelds: { type: "chow" | "pung" | "kong"; kinds: string[] }[] = [
    ...pattern.concealedMelds,
    ...exposed.map((m) => ({
      type: m.type as "chow" | "pung" | "kong",
      kinds: m.tiles.map((t) => t.kind),
    })),
  ];

  const lines: FanLine[] = [];
  const add = (name: string, nameZh: string, fan: number) => lines.push({ name, nameZh, fan });

  // Money fans (长春滚番)
  add("Ping hu", "平胡", 1);
  if (selfDraw) add("Self-draw", "自摸", 1);
  if (opts.dealerWin) add("Dealer win", "庄胡", 1);
  if (!flags.opened) add("Closed hand", "立胡", 1);
  if (opts.winKind && isJiaHu(concealed, exposed, opts.winKind)) add("Edge/middle/pair wait", "夹胡", 1);

  const types = allMelds.map((m) => (m.type === "kong" ? "pung" : m.type));
  if (types.every((t) => t === "pung")) add("All pungs", "飘胡", 2);

  // Constraint checkmarks (0 fan — not cash)
  if (flags.hasKe) add("Has a pung", "有刻", 0);
  else add("Dragon eyes", "中发白将", 0);
  add("Terminal/honor", "带幺九", 0);
  add("Three suits", "三门齐", 0);
  if (flags.opened) add("Opened hand", "开门", 0);

  const fan = lines.reduce((s, l) => s + l.fan, 0);
  return { fan: Math.max(1, fan), lines, pattern };
}

export function toWinResult(
  winner: number,
  loser: number | null,
  selfDraw: boolean,
  concealed: Tile[],
  exposed: Meld[],
  winnerSeat: Wind,
  roundWind: Wind,
  dealer = 0,
  winKind?: string,
): WinResult | null {
  const scored = scoreWin(concealed, exposed, winnerSeat, roundWind, selfDraw, {
    dealerWin: winner === dealer,
    winKind,
  });
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

  // Closed hand with 三门齐 / 刻 / 幺九 — 立胡 allowed
  const closed = [...many("m1", 3, 0), ...many("m2", 3, 3), ...many("m3", 3, 6), ...many("s1", 3, 9), ...many("p1", 2, 12)];
  if (!isWinningHand(closed, [])) throw new Error("win test: closed 立胡 should win");

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

  // Concealed kong does not open — but 立胡 still wins when other constraints hold
  const ck: Meld = { type: "kong", tiles: many("m1", 4, 20), concealed: true };
  const afterCk = [...many("s1", 3, 0), ...many("p1", 3, 3), ...many("m2", 3, 6), ...many("we", 2, 9)];
  if (!isWinningHand(afterCk, [ck])) throw new Error("win test: 暗杠+立胡 should win");
  if (hasOpened([ck])) throw new Error("win test: 暗杠 must not count as 开门");

  // Rolling fan formula
  if (rollingPayout(1, 1) !== 1) throw new Error("roll: 1 fan → 1");
  if (rollingPayout(1, 2) !== 2) throw new Error("roll: 2 fan → 2");
  if (rollingPayout(1, 3) !== 4) throw new Error("roll: 3 fan → 4");
  if (rollingPayout(5, 2) !== 10) throw new Error("roll: stake5 × 2^1");

  // scoreWin: 自摸平胡 (non-dealer, opened, not 飘胡) → fan 2
  const mixed = [
    t("s1", 0), t("s2", 1), t("s3", 2),
    ...many("p1", 3, 3),
    t("m7", 6), t("m8", 7), t("m9", 8),
    t("we", 9), t("we", 10),
  ];
  const scoredZimo = scoreWin(mixed, [chow("m1", "m2", "m3", 20)], "S", "E", true, { dealerWin: false });
  if (!scoredZimo || scoredZimo.fan !== 2) {
    throw new Error(`win test: 自摸平胡 fan want 2 got ${scoredZimo?.fan} lines=${JSON.stringify(scoredZimo?.lines)}`);
  }

  // 点炮平胡 shared fan = 1 (放炮 applied in settle only)
  const scoredPao = scoreWin(mixed, [chow("m1", "m2", "m3", 20)], "S", "E", false, { dealerWin: false });
  if (!scoredPao || scoredPao.fan !== 1) throw new Error(`win test: 点炮平胡 fan want 1 got ${scoredPao?.fan}`);
}
