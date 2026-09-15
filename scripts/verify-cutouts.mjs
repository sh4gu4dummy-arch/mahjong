#!/usr/bin/env node
/**
 * Fail ship if shop/overlay PNGs still have an opaque rectangular plate.
 * Cutouts must be real alpha — never a JPEG-as-.png or grey/white box.
 */
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const TARGETS = [
  "public/props/beer.png",
  "public/props/coffee.png",
  "public/props/cigarette.png",
  "public/chars/player-full.png",
  "public/chars/opposite-full.png",
];

function fail(msg) {
  console.error(`FAIL ${msg}`);
  return false;
}

function check(rel) {
  const filePath = path.join(ROOT, rel);
  if (!fs.existsSync(filePath)) return fail(`${rel}: missing`);
  const head = fs.readFileSync(filePath).subarray(0, 3);
  // Catch JPEG (or other) files lying with a .png extension — root cause of the grey box.
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) {
    return fail(`${rel}: file is JPEG renamed as .png (opaque box). Re-export real RGBA PNG cutout.`);
  }
  if (!(head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e)) {
    return fail(`${rel}: not a PNG (bad magic)`);
  }
  let png;
  try {
    png = PNG.sync.read(fs.readFileSync(filePath));
  } catch (e) {
    return fail(`${rel}: PNG decode error: ${e.message}`);
  }
  const { width: w, height: h, data } = png;
  const a = (x, y) => data[(y * w + x) * 4 + 3];
  const corners = [a(0, 0), a(w - 1, 0), a(0, h - 1), a(w - 1, h - 1)];
  const border = [];
  const step = Math.max(1, Math.floor(Math.min(w, h) / 80));
  for (let x = 0; x < w; x += step) border.push(a(x, 0), a(x, h - 1));
  for (let y = 0; y < h; y += step) border.push(a(0, y), a(w - 1, y));
  const opaqueCorners = corners.filter((v) => v > 8).length;
  const opaqueBorder = border.filter((v) => v > 8).length / border.length;
  let content = 0;
  for (let i = 3; i < data.length; i += 16) if (data[i] > 8) content++;
  if (content < 10) return fail(`${rel}: empty image`);
  if (opaqueCorners >= 3 || opaqueBorder > 0.35) {
    return fail(
      `${rel}: opaque plate (corners ${opaqueCorners}/4, border ${(opaqueBorder * 100).toFixed(1)}%). Crop to transparent cutout.`,
    );
  }
  console.log(`ok   ${rel} ${w}x${h} corners=[${corners.join(",")}] borderOpaque=${(opaqueBorder * 100).toFixed(1)}%`);
  return true;
}

let ok = true;
for (const t of TARGETS) ok = check(t) && ok;
if (!ok) {
  console.error("\nCutout verification failed — do not ship boxed overlays.");
  process.exit(1);
}
console.log("\nAll cutouts pass.");
