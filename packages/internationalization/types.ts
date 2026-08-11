import type { Messages } from "@repo/messages";
import type { routing } from "./routing";

/**
 * Gives every `useTranslations`/`Link`/`redirect` call site typed message keys
 * and a typed locale. Loaded via the side-effect import in `routing.ts`, so
 * any file that touches the routing config picks the augmentation up.
 */
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: Messages;
  }
}
