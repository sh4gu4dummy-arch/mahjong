import type { Suit, Tile, Wind } from "./types";

const NUMS = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];
export const WINDS: Wind[] = ["E", "S", "W", "N"];
export const WIND_ZH: Record<Wind, string> = { E: "东", S: "南", W: "西", N: "北" };
export const WIND_EN: Record<Wind, string> = { E: "East", S: "South", W: "West", N: "North" };
export const DRAGON_ZH = { R: "中", G: "发", Wh: "白" } as const;

export function kindOf(suit: Suit, value: number): string {
  if (suit === "man") return `m${value}`;
  if (suit === "sou") return `s${value}`;
  if (suit === "pin") return `p${value}`;
  if (suit === "wind") return `w${"eswn"[value]}`;
  return `d${"rgw"[value]}`;
}

export function parseKind(kind: string): { suit: Suit; value: number } {
  const t = kind[0];
  if (t === "m") return { suit: "man", value: Number(kind.slice(1)) };
  if (t === "s") return { suit: "sou", value: Number(kind.slice(1)) };
  if (t === "p") return { suit: "pin", value: Number(kind.slice(1)) };
  if (t === "w") {
    const i = "eswn".indexOf(kind[1]);
    return { suit: "wind", value: i };
  }
  const i = "rgw".indexOf(kind[1]);
  return { suit: "dragon", value: i };
}

export function isSuited(kind: string): boolean {
  return kind[0] === "m" || kind[0] === "s" || kind[0] === "p";
}

export function isHonor(kind: string): boolean {
  return kind[0] === "w" || kind[0] === "d";
}

export function sameKind(a: Tile, b: Tile): boolean {
  return a.kind === b.kind;
}

export function countKind(tiles: Tile[], kind: string): number {
  return tiles.filter((t) => t.kind === kind).length;
}

export function takeKind(tiles: Tile[], kind: string, n: number): { taken: Tile[]; rest: Tile[] } {
  const taken: Tile[] = [];
  const rest: Tile[] = [];
  for (const t of tiles) {
    if (t.kind === kind && taken.length < n) taken.push(t);
    else rest.push(t);
  }
  return { taken, rest };
}

export function takeIds(tiles: Tile[], ids: number[]): { taken: Tile[]; rest: Tile[] } {
  const set = new Set(ids);
  const taken: Tile[] = [];
  const rest: Tile[] = [];
  for (const t of tiles) {
    if (set.has(t.id)) taken.push(t);
    else rest.push(t);
  }
  return { taken, rest };
}

export function sortTiles(tiles: Tile[]): Tile[] {
  const order: Record<string, number> = { m: 0, s: 1, p: 2, w: 3, d: 4 };
  return [...tiles].sort((a, b) => {
    const sa = order[a.kind[0]] ?? 9;
    const sb = order[b.kind[0]] ?? 9;
    if (sa !== sb) return sa - sb;
    if (a.value !== b.value) return a.value - b.value;
    return a.id - b.id;
  });
}

export function tileLabel(tile: Tile): { main: string; sub: string; css: string } {
  if (tile.suit === "man") return { main: NUMS[tile.value - 1], sub: "万", css: "man" };
  if (tile.suit === "sou") return { main: NUMS[tile.value - 1], sub: "条", css: "sou" };
  if (tile.suit === "pin") return { main: NUMS[tile.value - 1], sub: "筒", css: "pin" };
  if (tile.suit === "wind") {
    const ch = ["东", "南", "西", "北"][tile.value];
    return { main: ch, sub: "", css: "wind" };
  }
  if (tile.value === 0) return { main: "中", sub: "", css: "dragon-r" };
  if (tile.value === 1) return { main: "发", sub: "", css: "dragon-g" };
  return { main: "白", sub: "", css: "dragon-w" };
}

export function tileName(tile: Tile): string {
  const l = tileLabel(tile);
  return l.sub ? `${l.main}${l.sub}` : l.main;
}

export function kindName(kind: string): string {
  const { suit, value } = parseKind(kind);
  return tileName({ id: -1, kind, suit, value });
}

export function windOfSeat(i: number): Wind {
  return WINDS[i]!;
}

export function nextSeat(i: number): number {
  return (i + 1) % 4;
}

export function buildFullSet(): Tile[] {
  const tiles: Tile[] = [];
  let id = 0;
  const push = (suit: Suit, value: number, copies: number) => {
    const kind = kindOf(suit, value);
    for (let c = 0; c < copies; c++) {
      tiles.push({ id: id++, kind, suit, value });
    }
  };
  for (const suit of ["man", "sou", "pin"] as Suit[]) {
    for (let v = 1; v <= 9; v++) push(suit, v, 4);
  }
  for (let v = 0; v < 4; v++) push("wind", v, 4);
  for (let v = 0; v < 3; v++) push("dragon", v, 4);
  return tiles;
}

export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export function countsOf(tiles: Tile[]): Record<string, number> {
  const c: Record<string, number> = {};
  for (const t of tiles) c[t.kind] = (c[t.kind] ?? 0) + 1;
  return c;
}

export function cloneCounts(c: Record<string, number>): Record<string, number> {
  return { ...c };
}
