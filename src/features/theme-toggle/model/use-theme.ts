import { useEffect, useMemo, useState } from "react";
import { STORAGE_KEYS } from "@/shared/config/app-config";
import { preferredDeviceTheme, type Theme } from "@/shared/lib/platform";
import { createBrowserStore } from "@/shared/lib/storage/key-value-store";

function isTheme(value: string | null): value is Theme {
  return value === "dark" || value === "light";
}

/** Stored choice wins; otherwise the device preference decides. */
export function useTheme() {
  const store = useMemo(() => createBrowserStore(), []);
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const stored = store.read(STORAGE_KEYS.theme);
      setTheme(isTheme(stored) ? stored : preferredDeviceTheme());
    });

    return () => window.cancelAnimationFrame(frame);
  }, [store]);

  function toggle() {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      store.write(STORAGE_KEYS.theme, next);
      return next;
    });
  }

  return { theme, toggle };
}
