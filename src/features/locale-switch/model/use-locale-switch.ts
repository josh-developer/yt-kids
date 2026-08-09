import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { routing, type AppLocale } from "@/shared/config/i18n/routing";
import { pathForRoute, type AppRoute } from "@/shared/lib/routing/app-routes";

/**
 * Switching language is a real navigation: the server owns the messages, the
 * `<html lang>` attribute and the NEXT_LOCALE cookie.
 */
export function useLocaleSwitch(route: AppRoute) {
  const locale = useLocale();
  const router = useRouter();
  const nextLocale: AppLocale =
    routing.locales.find((candidate) => candidate !== locale) ??
    routing.defaultLocale;

  return {
    locale,
    nextLocale,
    switchLocale: () => router.replace(pathForRoute(route, nextLocale)),
  };
}
