/** Traditional Northeast-style mahjong tile faces as inline SVG. */

import type { Tile } from "../game/types";

const VB = 'viewBox="0 0 60 84"';
const NS = 'xmlns="http://www.w3.org/2000/svg"';

function svg(inner: string, aria: string): string {
  return `<svg class="face-svg" ${NS} ${VB} aria-hidden="true" focusable="false" role="img"><title>${aria}</title>${inner}</svg>`;
}

/** Concentric circle-dot used on 筒. */
function pinDot(cx: number, cy: number, r = 7, variant = 0): string {
  const outer = variant % 2 === 0 ? "#1a4f9c" : "#1a7a3c";
  const mid = variant % 2 === 0 ? "#3d7fd4" : "#3caa5e";
  const core = variant % 3 === 0 ? "#c41e3a" : variant % 3 === 1 ? "#1a4f9c" : "#1a7a3c";
  return `
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${outer}"/>
    <circle cx="${cx}" cy="${cy}" r="${r * 0.68}" fill="#f7f1e1"/>
    <circle cx="${cx}" cy="${cy}" r="${r * 0.52}" fill="${mid}"/>
    <circle cx="${cx}" cy="${cy}" r="${r * 0.28}" fill="${core}"/>
    <circle cx="${cx}" cy="${cy}" r="${r * 0.12}" fill="#f7f1e1"/>
  `;
}

function pinOne(): string {
  // Large center flower-circle
  return `
    <circle cx="30" cy="42" r="18" fill="#1a4f9c"/>
    <circle cx="30" cy="42" r="14" fill="#f7f1e1"/>
    <circle cx="30" cy="42" r="11" fill="#3d7fd4"/>
    <circle cx="30" cy="42" r="7" fill="#c41e3a"/>
    <circle cx="30" cy="42" r="3.5" fill="#f7f1e1"/>
    <circle cx="30" cy="42" r="1.6" fill="#1a4f9c"/>
  `;
}

const PIN_POS: Record<number, [number, number][]> = {
  2: [
    [30, 24],
    [30, 60],
  ],
  3: [
    [16, 20],
    [30, 42],
    [44, 64],
  ],
  4: [
    [18, 24],
    [42, 24],
    [18, 60],
    [42, 60],
  ],
  5: [
    [18, 22],
    [42, 22],
    [30, 42],
    [18, 62],
    [42, 62],
  ],
  6: [
    [18, 18],
    [42, 18],
    [18, 42],
    [42, 42],
    [18, 66],
    [42, 66],
  ],
  7: [
    [18, 16],
    [42, 16],
    [18, 42],
    [30, 42],
    [42, 42],
    [18, 68],
    [42, 68],
  ],
  8: [
    [18, 14],
    [42, 14],
    [18, 33],
    [42, 33],
    [18, 52],
    [42, 52],
    [18, 71],
    [42, 71],
  ],
  9: [
    [15, 16],
    [30, 16],
    [45, 16],
    [15, 42],
    [30, 42],
    [45, 42],
    [15, 68],
    [30, 68],
    [45, 68],
  ],
};

function facePin(n: number): string {
  if (n === 1) return svg(pinOne(), `一筒`);
  const pts = PIN_POS[n] ?? [];
  const r = n >= 8 ? 5.2 : n >= 6 ? 5.8 : 6.8;
  const dots = pts.map(([x, y], i) => pinDot(x, y, r, i)).join("");
  return svg(dots, `${"一二三四五六七八九"[n - 1]}筒`);
}

/** Bamboo stalk with joints. */
function bamboo(x: number, y0: number, y1: number, lean = 0): string {
  const mid = (y0 + y1) / 2;
  const x0 = x + lean * 0.15;
  const x1 = x - lean * 0.15;
  return `
    <path d="M ${x0} ${y0} Q ${x + lean} ${mid} ${x1} ${y1}" fill="none" stroke="#1a7a32" stroke-width="3.2" stroke-linecap="round"/>
    <path d="M ${x0} ${y0} Q ${x + lean} ${mid} ${x1} ${y1}" fill="none" stroke="#4caf50" stroke-width="1.6" stroke-linecap="round"/>
    <ellipse cx="${x}" cy="${y0 + 4}" rx="2.4" ry="1.5" fill="#c8e6a0" stroke="#1a7a32" stroke-width="0.6"/>
    <ellipse cx="${x}" cy="${mid}" rx="2.4" ry="1.5" fill="#c8e6a0" stroke="#1a7a32" stroke-width="0.6"/>
    <ellipse cx="${x}" cy="${y1 - 4}" rx="2.4" ry="1.5" fill="#c8e6a0" stroke="#1a7a32" stroke-width="0.6"/>
  `;
}

function birdSou(): string {
  // Classic 一条: bird perched on a bamboo
  return `
    ${bamboo(30, 48, 76, 0)}
    <ellipse cx="30" cy="30" rx="11" ry="9" fill="#2d6cdf"/>
    <ellipse cx="30" cy="28" rx="8" ry="6.5" fill="#5b8fef"/>
    <circle cx="34" cy="26" r="1.6" fill="#1a1208"/>
    <path d="M18 32 Q12 28 14 22 Q22 24 24 30 Z" fill="#1a4f9c"/>
    <path d="M38 34 Q48 36 44 44 Q36 40 34 36 Z" fill="#c41e3a"/>
    <path d="M26 36 L30 42 L34 36 Z" fill="#f0d78a"/>
    <path d="M22 18 Q30 10 38 18 Q30 22 22 18 Z" fill="#1a7a32"/>
    <circle cx="30" cy="16" r="2" fill="#c41e3a"/>
  `;
}

function faceSou(n: number): string {
  if (n === 1) return svg(birdSou(), "一条");
  let stalks = "";
  if (n === 2) {
    stalks = bamboo(22, 14, 70, -2) + bamboo(38, 14, 70, 2);
  } else if (n === 3) {
    stalks = bamboo(16, 14, 70, -3) + bamboo(30, 14, 70, 0) + bamboo(44, 14, 70, 3);
  } else if (n === 4) {
    stalks =
      bamboo(18, 12, 40, -2) +
      bamboo(42, 12, 40, 2) +
      bamboo(18, 44, 72, -2) +
      bamboo(42, 44, 72, 2);
  } else if (n === 5) {
    stalks =
      bamboo(16, 12, 38, -2) +
      bamboo(44, 12, 38, 2) +
      bamboo(30, 28, 56, 0) +
      bamboo(16, 48, 74, -2) +
      bamboo(44, 48, 74, 2);
  } else if (n === 6) {
    stalks =
      bamboo(16, 12, 40, -2) +
      bamboo(30, 12, 40, 0) +
      bamboo(44, 12, 40, 2) +
      bamboo(16, 46, 74, -2) +
      bamboo(30, 46, 74, 0) +
      bamboo(44, 46, 74, 2);
  } else if (n === 7) {
    stalks =
      bamboo(16, 10, 34, -2) +
      bamboo(30, 10, 34, 0) +
      bamboo(44, 10, 34, 2) +
      bamboo(30, 36, 52, 0) +
      bamboo(16, 54, 76, -2) +
      bamboo(30, 54, 76, 0) +
      bamboo(44, 54, 76, 2);
  } else if (n === 8) {
    stalks =
      bamboo(14, 10, 38, -1) +
      bamboo(26, 10, 38, 0) +
      bamboo(34, 10, 38, 0) +
      bamboo(46, 10, 38, 1) +
      bamboo(14, 46, 76, -1) +
      bamboo(26, 46, 76, 0) +
      bamboo(34, 46, 76, 0) +
      bamboo(46, 46, 76, 1);
  } else {
    stalks =
      bamboo(14, 8, 32, -1) +
      bamboo(30, 8, 32, 0) +
      bamboo(46, 8, 32, 1) +
      bamboo(14, 34, 56, -1) +
      bamboo(30, 34, 56, 0) +
      bamboo(46, 34, 56, 1) +
      bamboo(14, 58, 78, -1) +
      bamboo(30, 58, 78, 0) +
      bamboo(46, 58, 78, 1);
  }
  return svg(stalks, `${"一二三四五六七八九"[n - 1]}条`);
}

const MAN_NUM = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];

function faceMan(n: number): string {
  const num = MAN_NUM[n - 1]!;
  // Traditional red calligraphy numeral + 万
  const inner = `
    <text x="30" y="40" text-anchor="middle" dominant-baseline="middle"
      font-family="'Noto Serif SC','Songti SC',serif" font-weight="700"
      font-size="36" fill="#c41e3a">${num}</text>
    <text x="30" y="68" text-anchor="middle" dominant-baseline="middle"
      font-family="'Noto Serif SC','Songti SC',serif" font-weight="700"
      font-size="18" fill="#c41e3a">万</text>
  `;
  return svg(inner, `${num}万`);
}

function faceWind(ch: string, name: string): string {
  const inner = `
    <text x="30" y="46" text-anchor="middle" dominant-baseline="middle"
      font-family="'Noto Serif SC','Songti SC',serif" font-weight="700"
      font-size="44" fill="#1a2030">${ch}</text>
  `;
  return svg(inner, name);
}

function faceDragonR(): string {
  return svg(
    `<text x="30" y="46" text-anchor="middle" dominant-baseline="middle"
      font-family="'Noto Serif SC','Songti SC',serif" font-weight="700"
      font-size="46" fill="#c41e3a">中</text>`,
    "红中",
  );
}

function faceDragonG(): string {
  return svg(
    `<text x="30" y="46" text-anchor="middle" dominant-baseline="middle"
      font-family="'Noto Serif SC','Songti SC',serif" font-weight="700"
      font-size="46" fill="#1a7a32">发</text>`,
    "发财",
  );
}

function faceDragonW(): string {
  // Empty framed white dragon — classic 白板
  return svg(
    `<rect x="10" y="14" width="40" height="56" rx="3" ry="3"
      fill="none" stroke="#2a3a6a" stroke-width="3.5"/>
     <rect x="14" y="18" width="32" height="48" rx="2" ry="2"
      fill="none" stroke="#2a3a6a" stroke-width="1.2"/>`,
    "白板",
  );
}

export function tileFaceSvg(tile: Tile): string {
  if (tile.suit === "pin") return facePin(tile.value);
  if (tile.suit === "sou") return faceSou(tile.value);
  if (tile.suit === "man") return faceMan(tile.value);
  if (tile.suit === "wind") {
    const ch = ["东", "南", "西", "北"][tile.value]!;
    return faceWind(ch, ch);
  }
  if (tile.value === 0) return faceDragonR();
  if (tile.value === 1) return faceDragonG();
  return faceDragonW();
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
