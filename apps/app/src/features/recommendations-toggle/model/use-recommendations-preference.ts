import { useEffect, useMemo, useState } from "react";
import { STORAGE_KEYS } from "@/shared/config/app-config";
import { createBrowserStore } from "@/shared/lib/storage/key-value-store";

/** Whether the watch page shows recommendations. Remembered per device. */
export function useRecommendationsPreference() {
  const store = useMemo(() => createBrowserStore(), []);
  const [isEnabled, setIsEnabled] = useState(true);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setIsEnabled(store.read(STORAGE_KEYS.recommendations) !== "off");
    });

    return () => window.cancelAnimationFrame(frame);
  }, [store]);

  function toggle() {
    setIsEnabled((current) => {
      const next = !current;
      store.write(STORAGE_KEYS.recommendations, next ? "on" : "off");
      return next;
    });
  }

  return { isEnabled, toggle };
}
