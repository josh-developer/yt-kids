import { defineRouting } from "next-intl/routing";
import { DEFAULT_LOCALE, LOCALES } from "@repo/messages";
import "./types";

export const routing = defineRouting({
  // One source of truth, shared with the native app: see `@repo/messages`.
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  // Every URL carries its locale, so a shared link always opens in the
  // language it was shared in. The cookie only decides where `/` lands.
  localePrefix: "always",
});

export type AppLocale = (typeof routing.locales)[number];
