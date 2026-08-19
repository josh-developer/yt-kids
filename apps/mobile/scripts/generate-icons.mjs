// Generates the mobile app's icon assets from the shared mascot source.
// Run with `pnpm --filter mobile icons`; the PNGs it writes are committed.
import { Buffer } from "node:buffer";
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
  // Android TV's launcher icon: square, and larger than a phone's because the
  // launcher draws it at a distance. https://developer.android.com/design/ui/tv
  { name: "tv-icon.png", source: ADAPTIVE_SOURCE, size: 336 },
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

/*
 * The Android TV banner: 320x180, and the only thing the TV launcher shows for the app —
 * there is no separate label under it, which is why the name has to be *in* the image.
 *
 * A placeholder, deliberately: the type is whatever bold sans the rendering machine
 * happens to have, because Nunito is a bundled TTF that librsvg has no way to load. Good
 * enough to install and launch with, and the first thing to replace with a designed asset
 * before a store submission.
 */
const BANNER = { width: 320, height: 180 };
const MASCOT = 132;

const mascot = await sharp(ADAPTIVE_SOURCE)
  .resize(MASCOT, MASCOT, { fit: "cover" })
  .toBuffer();

const wordmark = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${BANNER.width}" height="${BANNER.height}">
     <defs>
       <linearGradient id="wash" x1="0" y1="0" x2="0" y2="1">
         <stop offset="0%" stop-color="#fff4ef"/>
         <stop offset="48%" stop-color="#f2fbff"/>
         <stop offset="100%" stop-color="#f4fff8"/>
       </linearGradient>
     </defs>
     <rect width="100%" height="100%" fill="url(#wash)"/>
     <g font-family="sans-serif" font-weight="900" font-size="34">
       <text x="156" y="102" fill="#fbbc04">K</text>
       <text x="180" y="102" fill="#22c55e">i</text>
       <text x="192" y="102" fill="#38bdf8">d</text>
       <text x="214" y="102" fill="#ff7d69">Tube</text>
     </g>
   </svg>`,
);

const banner = await sharp(wordmark)
  .composite([{ input: mascot, top: 24, left: 16 }])
  .png({ compressionLevel: 9, effort: 10 })
  .toBuffer();

writeFileSync(`${OUT}/tv-banner.png`, banner);
const bannerMeta = await sharp(banner).metadata();
console.log(
  `tv-banner.png: ${bannerMeta.width}x${bannerMeta.height} ${(banner.length / 1024).toFixed(0)}KB`,
);
