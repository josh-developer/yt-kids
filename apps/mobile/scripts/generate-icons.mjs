// Generates the mobile app's icon assets from the web app's vector source.
// Run with `pnpm --filter mobile icons`; the PNGs it writes are committed.
// `Buffer` is imported rather than taken off the global: the lint config here is
// the React Native one, where Node's globals are correctly absent.
import { Buffer } from "node:buffer";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const OUT = new URL("../assets/", import.meta.url).pathname;
const CANVAS = 1024;
const CREAM = "#FFF9E8";

/** The artwork minus its background plate, copied from apps/app/public/pwa-icon.svg. */
const GLYPH = `
  <path d="M116 145C116 111.863 142.863 85 176 85H336C369.137 85 396 111.863 396 145V367C396 400.137 369.137 427 336 427H176C142.863 427 116 400.137 116 367V145Z" fill="#FF0033"/>
  <path d="M196 198C196 184.144 211.005 175.484 223.005 182.412L318.005 237.263C330.005 244.191 330.005 261.511 318.005 268.439L223.005 323.29C211.005 330.218 196 321.558 196 307.702V198Z" fill="white"/>
  <circle cx="145" cy="125" r="25" fill="#FBBC04"/>
  <circle cx="367" cy="125" r="25" fill="#22C55E"/>
  <circle cx="367" cy="387" r="25" fill="#38BDF8"/>
  <path d="M150 365C181 402 223 421 276 421" stroke="#FBBC04" stroke-width="18" stroke-linecap="round"/>
  <path d="M130 241C109 226 100 203 104 174" stroke="#38BDF8" stroke-width="16" stroke-linecap="round" stroke-dasharray="2 34"/>
`;

/**
 * Bounding box of GLYPH in the source's 512 coordinate space, including stroke
 * width and round caps. Measured from the path data rather than guessed: the
 * dashed blue stroke reaches x=96 and the yellow arc's cap reaches y=430, both
 * further out than the red plate.
 */
const BOX = { minX: 96, minY: 85, maxX: 396, maxY: 430 };
const boxWidth = BOX.maxX - BOX.minX;
const boxHeight = BOX.maxY - BOX.minY;
const boxCentreX = (BOX.minX + BOX.maxX) / 2;
const boxCentreY = (BOX.minY + BOX.maxY) / 2;

const boxDiagonal = Math.hypot(boxWidth, boxHeight);

/**
 * @param coverage share of the canvas the artwork may span
 * @param fitDiagonal measure the artwork by its diagonal rather than its longest
 *   side. Android masks an adaptive icon to a *circle* of 66% diameter, and a
 *   tall rectangle's corners leave that circle while its width and height both
 *   still fit — which is how the first attempt got the badge's corners and two of
 *   its dots shaved off. iOS masks a full-bleed square, so there the longest side
 *   is the right measure.
 */
function scaledGlyphSvg(coverage, fitDiagonal = false) {
  const extent = fitDiagonal ? boxDiagonal : Math.max(boxWidth, boxHeight);
  const scale = (CANVAS * coverage) / extent;
  const half = CANVAS / 2;

  // `fill="none"` is load-bearing, not tidiness: the arc and the dashed line are
  // stroke-only paths, and without it they inherit the default black fill and
  // render as filled blobs behind the stroke. The source SVG sets it on its root.
  return `<svg width="${CANVAS}" height="${CANVAS}" viewBox="0 0 ${CANVAS} ${CANVAS}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(${half} ${half}) scale(${scale}) translate(${-boxCentreX} ${-boxCentreY})">${GLYPH}</g>
</svg>`;
}

mkdirSync(OUT, { recursive: true });

const targets = [
  {
    name: "icon.png",
    // iOS applies its own rounded mask and rejects alpha, so this is a full
    // opaque square. 0.62 leaves the breathing room a home-screen icon wants.
    svg: scaledGlyphSvg(0.62),
    flatten: true,
  },
  {
    name: "adaptive-icon.png",
    // The artwork's diagonal set to 0.88 of the safe circle's diameter: corners
    // clear a strict circular mask with a little room to spare, and the badge
    // still reads at the same weight as the launcher icons beside it. Measured
    // against the circle rather than the canvas, because 66% of the canvas is all
    // that survives any mask. Transparent, so the mask and the background colour
    // underneath do the framing.
    svg: scaledGlyphSvg(0.66 * 0.88, true),
    flatten: false,
  },
];

for (const target of targets) {
  // Rasterised well above the target and scaled back down: `density` multiplies
  // the SVG's declared size, so it has to be resized to land on 1024, and
  // supersampling first buys smoother edges on the circles and round caps.
  let pipeline = sharp(Buffer.from(target.svg), { density: 384 }).resize(
    CANVAS,
    CANVAS,
    { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } },
  );
  if (target.flatten) {
    pipeline = pipeline.flatten({ background: CREAM });
  }
  const buffer = await pipeline.png({ compressionLevel: 9 }).toBuffer();
  writeFileSync(`${OUT}/${target.name}`, buffer);
  const meta = await sharp(buffer).metadata();
  console.log(
    `${target.name}: ${meta.width}x${meta.height} alpha=${Boolean(meta.hasAlpha)} ${(buffer.length / 1024).toFixed(0)}KB`,
  );
}
