import { SESSION_KEYS } from "@/shared/config/app-config";
import {
  createSessionStore,
  type KeyValueStore,
} from "@/shared/lib/storage/key-value-store";

/**
 * What happened last time this tab tried to open a video with sound.
 *
 * - `granted` — the viewer asked for sound and got it. Keep building embeds
 *   with `mute=0`; the gesture that bought it covers the ones that follow.
 * - `refused` — an embed built with `mute=0` never started, so the gesture did
 *   not carry as far as it seemed to. Back to muted.
 * - `silenced` — the viewer muted on purpose.
 */
export type SoundOutcome = "granted" | "refused" | "silenced";

const OUTCOMES: readonly string[] = [
  "granted",
  "refused",
  "silenced",
] satisfies SoundOutcome[];

/**
 * Whether the next embed should be built with sound, and the record of how
 * that has gone in this tab.
 *
 * Sound at start is a property of the embed document rather than a switch that
 * can be thrown afterwards. Every audio command reaches the frame by
 * `postMessage` and user activation does not cross an origin boundary, so a
 * later `unMute` is something WebKit refuses without saying so — the only way
 * to get sound is to build the iframe with `mute=0` in the first place.
 *
 * Whether the browser then allows that embed to start is a question only the
 * browser can answer, and only by answering it: it either starts or it sits
 * there silent. Chrome and Firefox grant it once the viewer has interacted
 * with the origin, which by the time anyone reaches a video they have. iOS
 * Safari grants it only to a frame created inside a gesture — true of a tap on
 * a card or on Next, false of a cold load. So the first unmuted embed of a tab
 * is a question being asked, and this is where the answer is kept.
 *
 * A refusal is remembered so only one video per tab pays the wait. It does not
 * outlive the viewer asking for sound themselves: that rebuild happens inside
 * their tap, which is exactly the case the refusal never applied to.
 *
 * Follows the tab rather than the device, like the rest of the player's state —
 * autoplay permission is a property of this browsing session, not of the user.
 */
export class SoundPreference {
  constructor(private readonly store: KeyValueStore = createSessionStore()) {}

  /** What this tab knows so far, or `null` if nothing has been tried yet. */
  read(): SoundOutcome | null {
    const stored = this.store.read(SESSION_KEYS.playerSound);
    return stored && OUTCOMES.includes(stored) ? (stored as SoundOutcome) : null;
  }

  save(outcome: SoundOutcome) {
    this.store.write(SESSION_KEYS.playerSound, outcome);
  }

  /**
   * Whether the next embed has to be built muted. Everything except a recorded
   * `granted` is, including having tried nothing yet.
   *
   * Opening the first video of a tab with sound and seeing what happens is a
   * bet that cannot be made, because losing it does not cost sound — it costs
   * the video. An iPhone refuses an embed built with `mute=0` by ignoring
   * `playVideo`, and it keeps ignoring it: every later press of play is
   * another postMessage with no gesture behind it, so the frame stays dead for
   * good rather than merely silent. iPad grants the same embed, because
   * iPadOS Safari follows the desktop autoplay rules — which is exactly why
   * this cannot be settled by trying it.
   *
   * So the first video plays muted, with the sound button offering the trade,
   * and one tap buys sound for the rest of the tab: that rebuild happens
   * inside the viewer's gesture, which is the one thing every browser honours.
   */
  shouldStartMuted() {
    return this.read() !== "granted";
  }
}
