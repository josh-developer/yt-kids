import { useEffect, type RefObject } from "react";

export function useOutsidePointerDown<T extends HTMLElement>(
  ref: RefObject<T | null>,
  onOutsidePointerDown: () => void,
  isEnabled: boolean,
) {
  useEffect(() => {
    if (!isEnabled) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const root = ref.current;
      const target = event.target;

      if (!root || !(target instanceof Node) || root.contains(target)) {
        return;
      }

      onOutsidePointerDown();
    }

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [isEnabled, onOutsidePointerDown, ref]);
}
