import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { MESSAGES } from "@repo/messages";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    // Indexed from a static map rather than `await import(\`./messages/${locale}.json\`)`.
    // Both catalogs are a few kilobytes and both already ship to the client, so the
    // dynamic import bought nothing and cost every bundler a path it cannot analyse.
    messages: MESSAGES[locale],
  };
});
