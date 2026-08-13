// Generates the mobile app's icon assets from the shared mascot source.
// Run with `pnpm --filter mobile icons`; the PNGs it writes are committed.
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const OUT = new URL("../assets/", import.meta.url).pathname;
const SOURCE = new URL("../../app/public/brand-mascot-source.png", import.meta.url)
  .pathname;
const ADAPTIVE_SOURCE = new URL(
  "../../app/public/brand-mascot-animation.png",
  import.meta.url,
).pathname;
const CANVAS = 1024;

mkdirSync(OUT, { recursive: true });

const targets = [
  { name: "icon.png", source: SOURCE },
  { name: "adaptive-icon.png", source: ADAPTIVE_SOURCE },
  { name: "brand-mark.png", source: ADAPTIVE_SOURCE, size: 256 },
];

for (const target of targets) {
  const buffer = await sharp(target.source)
    .resize(target.size ?? CANVAS, target.size ?? CANVAS, { fit: "cover" })
    .png({ compressionLevel: 9, effort: 10, palette: true, quality: 95 })
    .toBuffer();
  writeFileSync(`${OUT}/${target.name}`, buffer);
  const meta = await sharp(buffer).metadata();
  console.log(
    `${target.name}: ${meta.width}x${meta.height} alpha=${Boolean(meta.hasAlpha)} ${(buffer.length / 1024).toFixed(0)}KB`,
  );
}
