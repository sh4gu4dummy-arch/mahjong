import { defineConfig, type Plugin } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";

function staticAssetCacheHeaders(): Plugin {
  const middleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const path = (req.url ?? "").split("?")[0] ?? "";
    if (/\.(png|svg|jpe?g|webp|woff2?)$/i.test(path) || /\/(tiles|avatars|chars|props|bg)\//.test(path)) {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    } else if (/\/assets\/[^/]+-[A-Za-z0-9_-]+\.(js|css)$/.test(path)) {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    } else if (path.endsWith("sw.js")) {
      res.setHeader("Cache-Control", "no-cache");
    } else if (
      path === "/" ||
      path.endsWith(".html") ||
      path.endsWith(".js") ||
      path.endsWith(".css") ||
      path.endsWith(".ts")
    ) {
      res.setHeader("Cache-Control", "no-cache");
    }
    next();
  };
  return {
    name: "aa-static-asset-cache-headers",
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}

export default defineConfig(({ mode }) => {
  const isPlay = mode === "play";
  return {
    base: "./",
    plugins: [staticAssetCacheHeaders()],
    server: {
      host: true,
      port: 5173,
    },
    preview: {
      host: true,
      port: 4173,
      allowedHosts: true,
    },
    build: {
      outDir: isPlay ? "play" : "dist",
      emptyOutDir: true,
      // file:// needs a classic script (IIFE), not ES modules
      ...(isPlay
        ? {
            rollupOptions: {
              output: {
                format: "iife" as const,
                inlineDynamicImports: true,
                entryFileNames: "assets/[name]-[hash].js",
                chunkFileNames: "assets/[name]-[hash].js",
                assetFileNames: "assets/[name]-[hash][extname]",
              },
            },
          }
        : {}),
    },
  };
});
