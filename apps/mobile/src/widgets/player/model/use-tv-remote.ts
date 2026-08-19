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
 * `eventKeyAction` is the one detail worth care. Android sends each press twice, `0` for
 * the key going down and `1` for it coming back up; tvOS sends `-1` and means "once". Only
 * the key-up is dropped, so a held arrow repeats at the system's own rate, which is what
 * makes scrubbing feel like scrubbing rather than a series of jumps.
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
    // Android reports the release of every key as a second event; acting on both would
    // seek twice for one press.
    if (!isEnabled || event.eventKeyAction === 1) {
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
