"use client";

import { useEffect } from "react";

export function PwaRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    if (process.env.NODE_ENV !== "production") {
      // The service worker is cache-first for same-origin GETs, which in dev
      // includes Vite's module URLs. After a dependency re-optimization it
      // would keep serving the previous React copy, and every hook would then
      // read a null dispatcher. Tear down anything a previous session left.
      void navigator.serviceWorker
        .getRegistrations()
        .then((registrations) =>
          Promise.all(
            registrations.map((registration) => registration.unregister()),
          ),
        );

      if ("caches" in window) {
        void caches
          .keys()
          .then((keys) => Promise.all(keys.map((key) => caches.delete(key))));
      }

      return;
    }

    const canRegister =
      window.location.protocol === "https:" ||
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    if (!canRegister) {
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // PWA install still works without offline caching.
    });
  }, []);

  return null;
}
