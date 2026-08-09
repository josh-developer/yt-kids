import { useEffect, useRef, useState } from "react";

const TOP_ZONE_PX = 24;
const HIDE_DELTA_PX = 8;

/** Hides the bar while scrolling down, brings it back on any upward scroll. */
export function useTopbarAutoHide() {
  const [isHidden, setIsHidden] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    lastScrollY.current = window.scrollY;

    function handleScroll() {
      const currentScrollY = window.scrollY;
      const delta = currentScrollY - lastScrollY.current;

      if (currentScrollY < TOP_ZONE_PX) {
        setIsHidden(false);
      } else if (delta > HIDE_DELTA_PX) {
        setIsHidden(true);
      } else if (delta < -HIDE_DELTA_PX) {
        setIsHidden(false);
      }

      lastScrollY.current = currentScrollY;
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return isHidden;
}
