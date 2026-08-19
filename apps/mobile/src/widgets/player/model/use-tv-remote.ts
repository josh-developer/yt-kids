import { useTVEventHandler, type HWEvent } from "react-native";
import type { Player } from "./use-player";

/**
 * A long press seeks further than a tap. Roughly the web's ±15 turned into ±45.
 */
const LONG_SEEK_MULTIPLIER = 3;
/** What the dedicated transport keys move by, where a remote has them. */
const TRANSPORT_SEEK = 30;

/**
 * The remote, mapped onto the player.
 *
 * This is what `use-player-taps.ts` is for a finger. None of that translates: there is no
 * position to read a tap's side from, no double tap, and nothing to settle a first tap
 * against. A remote has named keys instead, so the mapping is a table rather than a
 * timing puzzle, and the conventions are the ones every other TV player uses — left and
 * right scrub, the middle button plays and pauses, up brings the controls back.
 *
 * `eventKeyAction` is the one detail worth care, and it is not what the documentation
 * reads like. Measured on an Android TV emulator: one press produces exactly **one** event,
 * and it carries `eventKeyAction: 1` — the key coming back *up*. There is no `0` to pair it
 * with. tvOS sends `-1` and means "once".
 *
 * So the guard drops `0` rather than `1`. Getting that backwards is silent and total: the
 * handler runs, matches nothing, and the remote appears dead while every other explanation
 * — a WebView eating keys, focus in the wrong place — looks far more likely. It cost an
 * afternoon. If a future version of the fork starts emitting the key-down too, this still
 * acts once, on the release.
 *
 * Every key shows the controls first. A viewer who presses anything is asking where they
 * are, and answering that before doing what they asked is why a TV player never seems to
 * act blindly.
 */
export function useTVRemote({
  player,
  isEnabled,
  onPrevious,
  onNext,
}: {
  player: Player;
  /** Off on anything but a television, and off while an end card owns the screen. */
  isEnabled: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  useTVEventHandler((event: HWEvent) => {
    // `0` is a key going down, which Android does not currently send and which would
    // pair with the release below if it ever did.
    if (!isEnabled || event.eventKeyAction === 0) {
      return;
    }

    switch (event.eventType) {
      case "select":
      case "playPause":
        player.togglePlayback();
        return;

      case "left":
        player.seekBy(-player.seekStep);
        return;
      case "right":
        player.seekBy(player.seekStep);
        return;

      case "longLeft":
        player.seekBy(-player.seekStep * LONG_SEEK_MULTIPLIER);
        return;
      case "longRight":
        player.seekBy(player.seekStep * LONG_SEEK_MULTIPLIER);
        return;

      case "rewind":
        player.seekBy(-TRANSPORT_SEEK);
        return;
      case "fastForward":
        player.seekBy(TRANSPORT_SEEK);
        return;

      /**
       * Up and down are the two halves of one idea: up asks for the controls, down puts
       * them away. Neither moves focus itself — the chrome is what focus goes to once it
       * is on screen, and there is nothing above the picture to go to.
       */
      case "up":
        player.toggleControls();
        return;
      case "down":
        player.hideControls();
        return;

      case "skipBackward":
        onPrevious();
        return;
      case "skipForward":
        onNext();
        return;

      default:
        // `pan`, `blur`, `focus` and whatever else a given remote emits. Nothing here
        // wants them, and a player that reacted to every unrecognised key would be a
        // player that jumped when someone adjusted the volume.
        return;
    }
  });
}
