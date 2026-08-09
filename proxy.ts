import createMiddleware from "next-intl/middleware";
import { routing } from "./src/shared/config/i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Skip API routes, static assets, and the PWA files that must stay
  // locale-free (`/manifest.webmanifest`, icons, service worker).
  matcher: "/((?!api|_next|_vinext|.*\\..*).*)",
};
