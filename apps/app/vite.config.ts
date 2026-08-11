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

// The banner is read by people in Tashkent, so stamp it in Tashkent time. An
// ISO string would be UTC — and CI runners are UTC too, so there is no host
// clock to fall back on — leaving the banner five hours behind every wall clock
// in the room. `sv-SE` is the locale that formats as `YYYY-MM-DD HH:mm:ss`.
const BUILD_TIME_ZONE = "Asia/Tashkent";

const buildTime = `${new Intl.DateTimeFormat("sv-SE", {
  timeZone: BUILD_TIME_ZONE,
  dateStyle: "short",
  timeStyle: "medium",
}).format(new Date())} UTC+5`;

export default defineConfig(async () => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    // Baked in at build time so the banner costs nothing at runtime and needs
    // no binding. `CLOUDFLARE_ENV` is the same variable that selects the
    // wrangler environment, so the banner can never disagree with the deploy.
    define: {
      __BUILD_TIME__: JSON.stringify(buildTime),
      __APP_ENV__: JSON.stringify(process.env.CLOUDFLARE_ENV ?? "development"),
    },
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
        // Bindings, routes and per-environment vars live in `wrangler.jsonc`
        // so CI deploys exactly what local builds produce. `CLOUDFLARE_ENV`
        // selects the environment; unset means the top level, i.e. local dev.
        configPath: "./wrangler.jsonc",
      }),
    ],
  };
});
