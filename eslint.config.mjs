import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import boundaries from "eslint-plugin-boundaries";

/**
 * Feature-Sliced Design layers, outermost first. A layer may import from any
 * layer below it and from itself; never from a layer above.
 */
const LAYERS = ["app", "pages", "widgets", "features", "entities", "shared"];

const layerPolicies = LAYERS.map((layer, index) => ({
  from: { element: { type: layer } },
  allow: {
    to: { element: { types: { anyOf: LAYERS.slice(index) } } },
  },
}));

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["app/**/*.{ts,tsx}", "src/**/*.{ts,tsx}"],
    plugins: { boundaries },
    settings: {
      "boundaries/include": ["app/**/*", "src/**/*"],
      "boundaries/elements": [
        // The Next.js routing folder doubles as the FSD app layer.
        { type: "app", pattern: "app" },
        { type: "pages", pattern: "src/pages/*", capture: ["slice"] },
        { type: "widgets", pattern: "src/widgets/*", capture: ["slice"] },
        { type: "features", pattern: "src/features/*", capture: ["slice"] },
        { type: "entities", pattern: "src/entities/*", capture: ["slice"] },
        { type: "shared", pattern: "src/shared/*", capture: ["slice"] },
      ],
    },
    rules: {
      "boundaries/dependencies": ["error", { default: "disallow", policies: layerPolicies }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
