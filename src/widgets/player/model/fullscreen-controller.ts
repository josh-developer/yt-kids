import {
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

  /**
   * Asked of the element rather than of the user agent. iPhone Safari exposes
   * neither request method and falls back to the CSS fullscreen, while iPadOS
   * — which a user-agent check would lump in with it — does support the real
   * thing and now gets it.
   */
  get supportsNative() {
    const target = this.element;
    if (!target) {
      return false;
    }

    const canRequest = Boolean(
      target.requestFullscreen || target.webkitRequestFullscreen,
    );
    const isEnabled =
      document.fullscreenEnabled ?? Boolean(target.webkitRequestFullscreen);

    return canRequest && isEnabled;
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
