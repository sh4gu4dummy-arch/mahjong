/** Premium traditional mahjong faces from FluffyStuff/riichi-mahjong-tiles (CC0). */

import type { Tile } from "../game/types";

/** Map game kind → Regular SVG filename (no extension). */
const KIND_FILE: Record<string, string> = {
  m1: "Man1", m2: "Man2", m3: "Man3", m4: "Man4", m5: "Man5",
  m6: "Man6", m7: "Man7", m8: "Man8", m9: "Man9",
  s1: "Sou1", s2: "Sou2", s3: "Sou3", s4: "Sou4", s5: "Sou5",
  s6: "Sou6", s7: "Sou7", s8: "Sou8", s9: "Sou9",
  p1: "Pin1", p2: "Pin2", p3: "Pin3", p4: "Pin4", p5: "Pin5",
  p6: "Pin6", p7: "Pin7", p8: "Pin8", p9: "Pin9",
  we: "Ton", ws: "Nan", ww: "Shaa", wn: "Pei",
  dr: "Chun", dg: "Hatsu", dw: "Haku",
};

const ARIA: Record<string, string> = {
  m1: "一万", m2: "二万", m3: "三万", m4: "四万", m5: "五万",
  m6: "六万", m7: "七万", m8: "八万", m9: "九万",
  s1: "一条", s2: "二条", s3: "三条", s4: "四条", s5: "五条",
  s6: "六条", s7: "七条", s8: "八条", s9: "九条",
  p1: "一筒", p2: "二筒", p3: "三筒", p4: "四筒", p5: "五筒",
  p6: "六筒", p7: "七筒", p8: "八筒", p9: "九筒",
  we: "东", ws: "南", ww: "西", wn: "北",
  dr: "红中", dg: "发财", dw: "白板",
};

export function tileAssetFile(tile: Tile): string {
  return KIND_FILE[tile.kind] ?? "Front";
}

export function tileFaceSvg(tile: Tile): string {
  const file = tileAssetFile(tile);
  const label = ARIA[tile.kind] ?? tile.kind;
  return `<img class="face-img" src="tiles/${file}.svg" alt="${label}" draggable="false" decoding="async" />`;
}

export function tileCssClass(tile: Tile): string {
  if (tile.suit === "man") return "man";
  if (tile.suit === "sou") return "sou";
  if (tile.suit === "pin") return "pin";
  if (tile.suit === "wind") return "wind";
  if (tile.value === 0) return "dragon-r";
  if (tile.value === 1) return "dragon-g";
  return "dragon-w";
}
