// Generates the Open Graph card from the shared mascot source.
// Run with `pnpm --filter app og-image`; the PNG it writes is committed.
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const OUT = new URL("../public/og-image.png", import.meta.url).pathname;
const SOURCE = new URL("../public/brand-mascot-source.png", import.meta.url)
  .pathname;

// The standard large-card canvas; also declared in `@repo/seo`'s metadata.
const WIDTH = 1200;
const HEIGHT = 630;
// The app's warm background token (`--kid-bg-top` / theme-color).
const BACKGROUND = "#fff9e8";
const MASCOT_SIZE = 460;

const mascot = await sharp(SOURCE)
  .resize(MASCOT_SIZE, MASCOT_SIZE, { fit: "cover" })
  .png()
  .toBuffer();

const buffer = await sharp({
  create: {
    width: WIDTH,
    height: HEIGHT,
    channels: 3,
    background: BACKGROUND,
  },
})
  .composite([
    {
      input: mascot,
      left: Math.round((WIDTH - MASCOT_SIZE) / 2),
      top: Math.round((HEIGHT - MASCOT_SIZE) / 2),
    },
  ])
  .png({ compressionLevel: 9, effort: 10, palette: true, quality: 95 })
  .toBuffer();

writeFileSync(OUT, buffer);
const meta = await sharp(buffer).metadata();
console.log(
  `og-image.png: ${meta.width}x${meta.height} ${(buffer.length / 1024).toFixed(0)}KB`,
);
