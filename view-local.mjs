#!/usr/bin/env node
/**
 * Local offline viewer for AA Mahjong.
 * Usage: node view-local.mjs [--rebuild] [--port N] [--no-open]
 *
 * From a fresh clone: installs deps if needed, builds dist/ if missing,
 * then serves dist/ on http://127.0.0.1:4173 (or next free port).
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import net from "node:net";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.chdir(__dirname);

const args = process.argv.slice(2);
const forceRebuild = args.includes("--rebuild");
const noOpen = args.includes("--no-open");
const portIdx = args.indexOf("--port");
const preferredPort = portIdx >= 0 ? Number(args[portIdx + 1]) : 4173;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".wasm": "application/wasm",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json",
  ".txt": "text/plain; charset=utf-8",
};

function log(...m) {
  console.log(...m);
}

function run(cmd, cmdArgs, opts = {}) {
  log(`> ${cmd} ${cmdArgs.join(" ")}`);
  const r = spawnSync(cmd, cmdArgs, {
    stdio: "inherit",
    shell: process.platform === "win32",
    ...opts,
  });
  if (r.status !== 0) {
    console.error(`Command failed with exit ${r.status}: ${cmd} ${cmdArgs.join(" ")}`);
    process.exit(r.status ?? 1);
  }
}

function ensureInstall() {
  if (!fs.existsSync(path.join(__dirname, "node_modules"))) {
    log("node_modules missing — running npm install…");
    run("npm", ["install"]);
  } else {
    log("node_modules present.");
  }
}

function ensureBuild() {
  const index = path.join(__dirname, "dist", "index.html");
  if (forceRebuild || !fs.existsSync(index)) {
    log(forceRebuild ? "Rebuilding dist (--rebuild)…" : "dist/index.html missing — building…");
    run("npm", ["run", "build"]);
  } else {
    log("dist/ present — serving existing build (pass --rebuild to force).");
  }
}

function findFreePort(start) {
  return new Promise((resolve, reject) => {
    const tryPort = (p) => {
      const server = net.createServer();
      server.once("error", (err) => {
        if (err.code === "EADDRINUSE") tryPort(p + 1);
        else reject(err);
      });
      server.once("listening", () => {
        server.close(() => resolve(p));
      });
      server.listen(p, "127.0.0.1");
    };
    tryPort(start);
  });
}

function safeJoin(root, urlPath) {
  const decoded = decodeURIComponent((urlPath || "/").split("?")[0].split("#")[0]);
  const rel = decoded.replace(/^\/+/, "");
  const full = path.normalize(path.join(root, rel));
  if (!full.startsWith(root)) return null;
  return full;
}

function serveFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] || "application/octet-stream";
  const data = fs.readFileSync(filePath);
  res.writeHead(200, { "Content-Type": type, "Content-Length": data.length });
  res.end(data);
}

function openBrowser(url) {
  if (noOpen) return;
  const plat = process.platform;
  try {
    if (plat === "darwin") spawn("open", [url], { stdio: "ignore", detached: true }).unref();
    else if (plat === "win32") spawn("cmd", ["/c", "start", "", url], { stdio: "ignore", detached: true }).unref();
    else spawn("xdg-open", [url], { stdio: "ignore", detached: true }).unref();
  } catch {
    // ignore — user can open manually
  }
}

async function main() {
  log("AA Mahjong — local viewer");
  log(`Repo root: ${__dirname}`);
  ensureInstall();
  ensureBuild();

  const root = path.join(__dirname, "dist");
  const port = await findFreePort(Number.isFinite(preferredPort) ? preferredPort : 4173);
  const url = `http://127.0.0.1:${port}/`;

  const server = http.createServer((req, res) => {
    try {
      let filePath = safeJoin(root, req.url || "/");
      if (!filePath) {
        res.writeHead(403).end("Forbidden");
        return;
      }
      if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, "index.html");
      }
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        serveFile(res, filePath);
        return;
      }
      // SPA fallback
      const index = path.join(root, "index.html");
      if (fs.existsSync(index)) {
        serveFile(res, index);
        return;
      }
      res.writeHead(404).end("Not found");
    } catch (err) {
      console.error(err);
      res.writeHead(500).end("Server error");
    }
  });

  server.listen(port, "127.0.0.1", () => {
    log("");
    log("────────────────────────────────────────");
    log(`  Open:  ${url}`);
    log("  Stop:  Ctrl+C");
    log("────────────────────────────────────────");
    log("");
    openBrowser(url);
  });

  const shutdown = () => {
    log("\nShutting down…");
    server.close(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
