import { useEffect, useRef, useState } from "react";
import type { TouchEvent, TransitionEvent } from "react";

type SheetPhase = "closed" | "opening" | "open" | "closing";

/** How far the sheet's top edge must travel before release dismisses it. */
const DISMISS_VIEWPORT_RATIO = 0.5;

/**
 * Below this, a downward touchmove is a tap's natural jitter, not a drag.
 * Applying a live transform for it anyway was the bug: a tap on anything near
 * the top of the sheet sits exactly where the gesture arms (scrolled to the
 * top), and a couple of pixels of finger tremor were enough to move the sheet
 * under it. Mobile browsers read that as a drag and drop the synthetic click
 * that was supposed to follow, so the tap never reached the button. The player
 * that used to be the worst of those cases is now excluded outright — see
 * `handleTouchStart` — but the title, the channel row and the first
 * recommendations still land in this band.
 */
const DRAG_ACTIVATION_PX = 10;

/**
 * The widths that slide, matching the media query the transform and its
 * transition live in — see `watch-sheet.module.css`. Above it the sheet just
 * appears and disappears with the route.
 */
const SLIDING_WIDTHS = "(max-width: 1080px)";

/**
 * Where a phase mid-slide ends up when the slide is taken away: at whichever
 * end it was already heading for.
 */
function settle(phase: SheetPhase): SheetPhase {
  if (phase === "closing") {
    return "closed";
  }

  return phase === "opening" ? "open" : phase;
}

/**
 * Drives the watch page's slide-up/slide-down sheet.
 *
 * Opening and closing are the sheet's own business, not the router's: the
 * route changes the instant a video opens or the sheet is dismissed, but the
 * sheet keeps its last content on screen until its own animation ends, so a
 * swipe-down reads as one continuous motion rather than a jump cut to the
 * home page underneath.
 *
 * Switching between two videos without leaving the sheet — tapping a
 * recommendation — never touches `phase`: `isActive` was already true, so
 * the "just arrived" branch below does not fire and the content underneath
 * simply swaps.
 */
export function useWatchSheet({
  isActive,
  isDismissDisabled = false,
  onDismiss,
}: {
  isActive: boolean;
  isDismissDisabled?: boolean;
  onDismiss: () => void;
}) {
  const [phase, setPhase] = useState<SheetPhase>(isActive ? "open" : "closed");
  // Server-side there is no viewport to ask, and either guess would be wrong
  // half the time. Nothing depends on it until the sheet next opens or closes,
  // and `phase` starts at a state both layouts agree on.
  const [slides, setSlides] = useState(false);
  const wasActive = useRef(isActive);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const dragOffsetRef = useRef(0);
  const [dragOffset, setDragOffset] = useState(0);

  useEffect(() => {
    const query = window.matchMedia(SLIDING_WIDTHS);

    const sync = () => {
      setSlides(query.matches);

      // A sheet caught mid-slide by a resize past the breakpoint has lost the
      // transition whose `transitionend` was going to end its phase, so it is
      // settled by hand here. Without this a sheet resized while closing
      // would stay parked over the app, invisible and swallowing every click.
      if (!query.matches) {
        setPhase(settle);
      }
    };

    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (isActive && !wasActive.current) {
      // Arrived at a video from somewhere other than the sheet itself. Where
      // the sheet slides, that starts the transform at 100% one frame before
      // flipping it to 0, which is what makes it a slide rather than an
      // instant appearance; where it does not, arriving is the whole story.
      setPhase(slides ? "opening" : "open");
      wasActive.current = true;

      if (!slides) {
        return;
      }

      const frame = requestAnimationFrame(() => setPhase("open"));
      return () => cancelAnimationFrame(frame);
    }

    if (!isActive && wasActive.current) {
      // Left the watch route by something other than the swipe below — the
      // back button, the brand button — so a sliding sheet still owes the
      // slide-down before it disappears. One that does not slide is simply
      // gone: there is no transition left to raise the `transitionend` that
      // would otherwise be what takes it out of "closing".
      setPhase((current) =>
        current === "closed" ? current : slides ? "closing" : "closed",
      );
    }

    wasActive.current = isActive;
  }, [isActive, slides]);

  function handleTransitionEnd(event: TransitionEvent<HTMLDivElement>) {
    // The sheet has children with their own transitions; only its own
    // transform finishing means the slide-down is done.
    if (event.target !== event.currentTarget || event.propertyName !== "transform") {
      return;
    }

    setPhase((current) => (current === "closing" ? "closed" : current));
  }

  function updateDragOffset(offset: number) {
    dragOffsetRef.current = offset;
    setDragOffset(offset);
  }

  function dismissThresholdPx() {
    const viewportHeight =
      sheetRef.current?.ownerDocument.defaultView?.innerHeight ?? window.innerHeight;
    return viewportHeight * DISMISS_VIEWPORT_RATIO;
  }

  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    // The sheet is also its own scroll container. Only arm the dismiss
    // gesture when it is scrolled to the top — otherwise this touch is
    // scrolling the recommendations list, not pulling the sheet down. And
    // only where the sheet slides at all: a touchscreen wide enough to get
    // the desktop layout keeps its top bar, and dragging a sheet that cannot
    // animate back would leave it stuck open.
    if (
      isDismissDisabled ||
      !slides ||
      phase !== "open" ||
      (sheetRef.current?.scrollTop ?? 0) > 0
    ) {
      return;
    }

    // The video surface is not a handle. It has a full gesture vocabulary of
    // its own — tap to toggle the controls, double tap to seek, swipe down to
    // leave fullscreen — and it fills the top of the sheet, exactly where a
    // scrolled-to-top drag begins. Sharing those touches meant every gesture
    // aimed at the video also pulled the sheet. The attribute is set on the
    // player's own box in `widgets/player/ui/safe-youtube-player.tsx`.
    if (
      event.target instanceof Element &&
      event.target.closest("[data-player-surface]")
    ) {
      return;
    }

    dragStartY.current = event.touches[0].clientY;
  }

  function handleTouchMove(event: TouchEvent<HTMLDivElement>) {
    if (isDismissDisabled) {
      dragStartY.current = null;
      if (dragOffset !== 0) {
        updateDragOffset(0);
      }
      return;
    }

    if (dragStartY.current === null) {
      return;
    }

    const delta = event.touches[0].clientY - dragStartY.current;

    if (delta <= DRAG_ACTIVATION_PX) {
      // Still within a tap's natural jitter: leave the sheet untouched so no
      // re-render — and no transform a mobile browser would read as a drag —
      // stands between this touch and the click that is supposed to follow.
      if (dragOffset !== 0) {
        updateDragOffset(0);
      }
      return;
    }

    updateDragOffset(delta - DRAG_ACTIVATION_PX);
  }

  function releaseDrag() {
    if (isDismissDisabled) {
      dragStartY.current = null;
      updateDragOffset(0);
      return;
    }

    if (dragStartY.current === null) {
      return;
    }

    dragStartY.current = null;

    if (dragOffsetRef.current >= dismissThresholdPx()) {
      setPhase("closing");
      onDismiss();
    }

    updateDragOffset(0);
  }

  return {
    ref: sheetRef,
    isMounted: phase !== "closed",
    phase,
    isDragging: !isDismissDisabled && dragOffset > 0 && phase === "open",
    dragOffset,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: releaseDrag,
      onTouchCancel: releaseDrag,
      onTransitionEnd: handleTransitionEnd,
    },
  };
}
