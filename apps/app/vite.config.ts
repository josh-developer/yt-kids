import { fileURLToPath } from "node:url";
import vinext from "vinext";
import { defineConfig } from "vite";

// next-intl ships `createNextIntlPlugin`, which only wires the request config
// through webpack/turbopack aliases. vinext runs on Vite, so we do the same
// alias here by hand: `next-intl/config` must resolve to the request config.
const nextIntlRequestConfig = fileURLToPath(
  new URL(
    "../../packages/internationalization/request.ts",
    import.meta.url,
  ),
);

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

const localBindingConfig = {
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"],
  // Transcodes proxied YouTube thumbnails to AVIF/WebP. Requires Images
  // transformations enabled for the account; the worker falls back to the
  // original JPEG when the binding is missing.
  images: { binding: "IMAGES" },
};

export default defineConfig(async () => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    // The RSC graph references next-intl's client provider by its real file
    // path, so the browser must not get a second, pre-bundled copy: two module
    // instances mean two `IntlContext`s and "No intl context found" on every
    // `useTranslations` call.
    optimizeDeps: {
      exclude: ["next-intl", "use-intl"],
    },
    resolve: {
      dedupe: ["next-intl", "use-intl", "react", "react-dom"],
      alias: {
        // Mirrors the tsconfig `@/*` path. Declared here too so resolution does
        // not depend on when a tool last read tsconfig.json.
        "@/": `${fileURLToPath(new URL("./src", import.meta.url))}/`,
        "next-intl/config": nextIntlRequestConfig,
      },
    },
    server: {
      allowedHosts: [
        ".loca.lt",
        ".trycloudflare.com",
        ".ngrok-free.dev",
        ".ngrok-free.app",
        ".ngrok.app",
        ".ngrok.io",
      ],
      ...(isCodexSeatbeltSandbox
        ? { watch: { useFsEvents: false, usePolling: true } }
        : undefined),
    },
    plugins: [
      vinext(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        config: localBindingConfig,
      }),
    ],
  };
});
