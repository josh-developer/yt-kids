import type { routing } from "./src/shared/config/i18n/routing";
import type messages from "./messages/en.json";

declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
  }
}

declare module "react" {
  interface CSSProperties {
    // Inline styles pass design tokens through custom properties.
    [key: `--${string}`]: string | number | undefined;
  }
}

declare module "*.module.css" {
  const styles: Readonly<Record<string, string>>;
  export default styles;
}
