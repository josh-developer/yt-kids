import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "uz"],
  defaultLocale: "en",
  // Every URL carries its locale, so a shared link always opens in the
  // language it was shared in. The cookie only decides where `/` lands.
  localePrefix: "always",
});

export type AppLocale = (typeof routing.locales)[number];
