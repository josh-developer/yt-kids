/**
 * The web app's design tokens, translated for React Native.
 *
 * Values are copied from `apps/app/app/globals.css`, which stays the source of
 * truth — the web app is the design that exists, and a divergence here is a bug
 * here. They are copied rather than shared because the web side holds them as CSS
 * custom properties, which nothing in React Native can read; extracting them into
 * a `@repo/*` package would mean rewriting the web app's entire token layer, and
 * that is a separate job from building this screen.
 *
 * Same reason the shape is flat and literal: a token here should be greppable
 * against the CSS it came from.
 */

/**
 * Both palettes, so dark mode stays a token swap exactly as it is on the web.
 *
 * `light` defines the token set and `dark` is typed against its keys, so a token
 * added to one and forgotten in the other is a type error rather than a colour
 * that silently falls through in one theme.
 */
const light = {
  kidBgTop: "#fff9e8",
  kidBgMid: "#f2fbff",
  kidBgBottom: "#f6fff1",
  surface: "#ffffff",
  surfaceSoft: "#fff4cf",
  surfaceTint: "#e8f7ff",
  line: "#eadfcb",
  text: "#0f0f0f",
  textSoft: "#5c6170",
  buttonSoft: "#e8f0fe",
  buttonSoftHover: "#d2e3fc",
  buttonInk: "#065fd4",
  buttonActive: "#065fd4",
  brandRed: "#ff3157",
  brandYellow: "#ffd84d",
  brandGreen: "#25a85a",
  brandBlue: "#2878ff",
  /** `.videoCard` background: `rgba(255, 255, 255, 0.78)`. */
  card: "rgba(255, 255, 255, 0.78)",
  cardBorder: "rgba(255, 255, 255, 0.7)",
  shadow: "rgba(49, 71, 93, 0.09)",
} as const;

/** Every token, with values free to differ between themes. */
export type Palette = Record<keyof typeof light, string>;

const dark: Palette = {
  kidBgTop: "#18191f",
  kidBgMid: "#121a20",
  kidBgBottom: "#171b15",
  surface: "#202026",
  surfaceSoft: "#30281d",
  surfaceTint: "#1c2b32",
  line: "#37312b",
  text: "#f3f3f3",
  textSoft: "#c8c3ba",
  buttonSoft: "#263850",
  buttonSoftHover: "#344f73",
  buttonInk: "#8ab4f8",
  buttonActive: "#8ab4f8",
  brandRed: "#ff5a73",
  brandYellow: "#ffd95c",
  brandGreen: "#3dd179",
  brandBlue: "#69a3ff",
  card: "rgba(32, 32, 38, 0.78)",
  cardBorder: "rgba(255, 255, 255, 0.04)",
  shadow: "rgba(0, 0, 0, 0.24)",
} as const;

export const palettes = { light, dark };
export type ThemeName = keyof typeof palettes;

/**
 * The wordmark's per-letter colours, which are literals in `top-bar.module.css`
 * rather than tokens — they do not change between themes there either.
 */
export const BRAND_LETTERS = [
  { text: "K", color: "#fbbc04" },
  { text: "i", color: "#22c55e" },
  { text: "d", color: "#38bdf8" },
  { text: "Tube", color: "#ff0033" },
] as const;

/** `.brandMark` gradient: `linear-gradient(135deg, var(--brand-red), #ff7147)`. */
export const BRAND_MARK_GRADIENT = ["#ff3157", "#ff7147"] as const;

/**
 * `.thumbnail`'s placeholder, which the web draws as a gradient over `#dddddd`
 * so a card never shows a bare grey hole while its image loads.
 */
export const THUMBNAIL_PLACEHOLDER_GRADIENT = [
  "rgba(255, 49, 87, 0.2)",
  "rgba(37, 168, 90, 0.16)",
] as const;

/**
 * Nunito, at the weights the web actually asks for. The web's stack is
 * `"Avenir Next Rounded", "Nunito", …`: Avenir Next Rounded is an Apple system
 * face with no Android equivalent and no web download, so Nunito is the font the
 * design really ships, and using it on both platforms is what makes them match.
 */
export const fonts = {
  regular: "Nunito_400Regular",
  semibold: "Nunito_600SemiBold",
  bold: "Nunito_700Bold",
  /** `.videoTitle`, `.duration`, `.muted` emphasis all sit at 800. */
  extrabold: "Nunito_800ExtraBold",
  /** `.brandName` and `.avatar` are 900. */
  black: "Nunito_900Black",
} as const;

export const type = {
  /** `.videoTitle`: 800, line-height 1.25, clamped to two lines. */
  cardTitle: { fontFamily: fonts.extrabold, fontSize: 16, lineHeight: 20 },
  /** `.muted`: 14px, line-height 1.35. */
  muted: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 19 },
  /** `.duration`: 12px, 800. */
  duration: { fontFamily: fonts.extrabold, fontSize: 12, lineHeight: 14 },
  /** `.brandName`: 24px, 900, line-height 1. */
  brand: { fontFamily: fonts.black, fontSize: 24, lineHeight: 26 },
  avatar: { fontFamily: fonts.black, fontSize: 16, lineHeight: 20 },
} as const;

export const space = {
  /** `.videoCard { padding: 8px }`. */
  card: 8,
  /** `.videoMeta { gap: 10px; padding-top: 10px }`. */
  meta: 10,
  /** The `<= 720px` grid: one column, `gap: 16px`. */
  gridGap: 16,
  screenX: 12,
} as const;

export const radius = {
  card: 8,
  thumbnail: 8,
  duration: 4,
  /** `.avatar { border-radius: 50% }` at 38px. */
  avatar: 19,
  brandMark: 8,
} as const;

export const size = {
  /** `.videoMeta` reserves a 38px column; `.avatar` fills it. */
  avatar: 38,
  brandMarkWidth: 46,
  brandMarkHeight: 34,
  topBarHeight: 64,
} as const;

export function paletteFor(theme: ThemeName): Palette {
  return palettes[theme];
}
