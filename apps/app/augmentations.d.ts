// Module file (the import matters): `declare module "react"` only augments —
// rather than shadows — react's types when this file is itself a module.
import "react";

declare module "react" {
  interface CSSProperties {
    // Inline styles pass design tokens through custom properties.
    [key: `--${string}`]: string | number | undefined;
  }
}
