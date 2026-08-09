import {
  isIosLikeBrowser,
  unlockScreenOrientation,
  type FullscreenHostDocument,
  type FullscreenHostElement,
} from "@/shared/lib/platform";

/**
 * Wraps the vendor-prefixed Fullscreen API and the "iOS refuses element
 * fullscreen" case, so the hook above only deals in enter / exit / is-active.
 */
export class FullscreenController {
  constructor(
    private readonly host: { current: HTMLDivElement | null },
  ) {}

  private get element() {
    return this.host.current as FullscreenHostElement | null;
  }

  /** iOS Safari never grants element fullscreen; callers fall back to CSS. */
  get supportsNative() {
    return !isIosLikeBrowser();
  }

  get isNativeActive() {
    const host = document as FullscreenHostDocument;
    const target = this.element;
    return (
      document.fullscreenElement === target ||
      host.webkitFullscreenElement === target
    );
  }

  async enterNative() {
    const target = this.element;
    if (!target) {
      return false;
    }

    if (target.requestFullscreen) {
      await target.requestFullscreen({ navigationUI: "hide" });
      return true;
    }

    if (target.webkitRequestFullscreen) {
      await target.webkitRequestFullscreen();
      return true;
    }

    return false;
  }

  async exitNative() {
    const host = document as FullscreenHostDocument;

    if (document.fullscreenElement && document.exitFullscreen) {
      await document.exitFullscreen();
    } else if (host.webkitFullscreenElement && host.webkitExitFullscreen) {
      await host.webkitExitFullscreen();
    }

    unlockScreenOrientation();
  }
}
