import { internationalizationMiddleware } from "@repo/internationalization/proxy";

export default internationalizationMiddleware;

export const config = {
  // Skip API routes, static assets, and the PWA files that must stay
  // locale-free (`/manifest.webmanifest`, icons, service worker).
  matcher: "/((?!api|_next|_vinext|.*\\..*).*)",
};
