#!/usr/bin/env node
/**
 * Vite still emits type="module" even for IIFE output. Strip it (and crossorigin)
 * and add defer so the classic script waits for #app (modules are deferred by default;
 * classic scripts in <head> otherwise race ahead of <body>).
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const htmlPath = resolve("play/index.html");
if (!existsSync(htmlPath)) {
  console.error("fix-play-html: play/index.html missing — run build:play first");
  process.exit(1);
}

let html = readFileSync(htmlPath, "utf8");
const before = html;

html = html.replace(
  /<script\s+type="module"\s+crossorigin\s+src="(\.\/assets\/[^"]+\.js)"><\/script>/,
  '<script defer src="$1"></script>',
);
html = html.replace(
  /<script\s+type="module"\s+src="(\.\/assets\/[^"]+\.js)"\s*crossorigin\s*><\/script>/,
  '<script defer src="$1"></script>',
);
html = html.replace(
  /<script\s+type="module"\s+src="(\.\/assets\/[^"]+\.js)"><\/script>/,
  '<script defer src="$1"></script>',
);
// If already classic without defer, add it
html = html.replace(
  /<script\s+src="(\.\/assets\/[^"]+\.js)"><\/script>/,
  '<script defer src="$1"></script>',
);
html = html.replace(/<link rel="stylesheet" crossorigin href=/g, '<link rel="stylesheet" href=');

if (html === before && !/<script defer src="\.\/assets\//.test(html)) {
  console.error("fix-play-html: could not find script to rewrite");
  console.error(html);
  process.exit(1);
}

writeFileSync(htmlPath, html);
console.log("fix-play-html: classic deferred script in play/index.html");

const jsMatch = html.match(/src="(\.\/assets\/[^"]+\.js)"/);
if (jsMatch) {
  const js = readFileSync(resolve("play", jsMatch[1].replace(/^\.\//, "")), "utf8");
  if (!js.trimStart().startsWith("(function") && !js.includes("!function")) {
    console.warn("fix-play-html: warning — JS may not be IIFE:", js.slice(0, 80));
  } else {
    console.log("fix-play-html: confirmed IIFE bundle");
  }
}
