# Phone, tablet, TV

A plan for taking `apps/mobile` — today a phone app — to tablets and to the
living room, and what it costs.

Read `ARCHITECTURE.md` first. This document only describes what changes.

## The verdict, up front

| Target | Feasible | Why |
| --- | --- | --- |
| Tablet — iPad, Android | **Yes, today** | Layout work only. Same binary, no fork, no native change. |
| Android TV / Google TV / Fire TV | **Yes** | `react-native-tvos` + `@react-native-tvos/config-tv`. Real work, no blockers. |
| Apple TV — tvOS | **Playback is blocked** | tvOS has no web view. |

### Why Apple TV is blocked, and why native code does not fix it

Everything this app plays is the YouTube iframe API inside a `WebView`
(`widgets/player/model/player-bridge.ts`). tvOS ships no `WKWebView`, no
`UIWebView` and no browser — Apple has never put a web view in the tvOS SDK.
The dependency agrees: `react-native-webview.podspec` declares

```ruby
s.platforms = { :ios => ios_platform, :osx => "10.13", :visionos => "1.0" }
```

with `:tvos` conspicuously absent, while every other native dependency in the
app does list it — `react-native-screens` (15.1), `react-native-svg` (12.4),
`react-native-reanimated` (9.0), `expo-image` (16.4),
`react-native-gesture-handler` (11.0). The WebView is the one hole, and it is
the one that matters.

**Writing the app in Swift would not change this.** The constraint is not React
Native's abstraction — it is that the platform has no web view to embed and
YouTube publishes no tvOS player SDK. The remaining route would be resolving
stream URLs directly, which `ARCHITECTURE.md` has already ruled out: it breaks
the terms and, sooner than that, breaks itself.

Kotlin *is* useful on Android TV, but for one small thing — see
[The WebView will steal the D-pad](#the-webview-will-steal-the-d-pad).

If Apple TV is wanted later, the honest options are:

1. A browse-only tvOS app that hands playback to the YouTube tvOS app via a
   `youtube://` deep link. This forfeits the closed room the whole product is
   built to be — the child lands in YouTube's own app, with its own
   recommendations. A product decision, not a technical one.
2. A different video source, licensed.
3. Skip it.

Recommendation: **Android TV first.** It is the overwhelming majority of the
installed base in the target market, and every line written for it — the focus
system, the metrics layer, the remote transport — is the line Apple TV would
need anyway if the situation ever changes.

## Two axes, not one device

The app currently assumes one device. The fix is not a `isTablet` boolean; it is
two independent axes, because they genuinely vary independently:

- **Input modality** — `pointer` (a finger) or `focus` (a D-pad). This drives
  *behaviour*: gestures, dismissal, hit targets, what a control even is.
- **Size class** — `compact`, `regular`, `expanded`, `tv`. This drives *layout*:
  columns, scale, spacing, whether two panes fit.

A Fire TV is focus + tv. An iPad is pointer + expanded. A phone in landscape is
pointer + regular. One enum cannot say that, and trying makes every component
read `Platform.isTV ? … : width > 900 ? …`, twenty times over.

New: `src/shared/lib/device/use-device.ts`, provided once in `App.tsx` beside
the theme and locale providers.

```ts
export type Input = "pointer" | "focus";
export type SizeClass = "compact" | "regular" | "expanded" | "tv";
```

TV comes from `Platform.isTV`, which exists in the pinned React Native
(`Libraries/Utilities/Platform.d.ts:31`). Size class comes from the shortest
side of `useWindowDimensions()` at 600/840dp — **except on TV, which is forced
regardless of width.**

That exception is not tidiness. A 1080p Android TV reports **960×540 dp** at
density 2.0, and a 4K panel usually reports the same. Run that through the
current `use-grid-columns.ts` and 960 sits below `WIDE_MIN = 1081`, so a
television gets `CARD_MIN = 260` and a three-column layout sized for a tablet
held at arm's length. TV must never be inferred from a dp width.

## The token layer

`shared/config/theme.ts` exports flat constants — `space`, `size`, `radius`,
`type` — imported statically in about twenty files. A television needs roughly
1.6× the type and much larger targets, so those constants have to vary.

They must also stay greppable against `apps/app/app/globals.css`, which
`ARCHITECTURE.md` names as the source of truth. So: **keep `theme.ts` exactly as
it is, as the phone baseline**, and add a derived layer beside it.

`shared/config/metrics.ts`, read through `useMetrics()`:

```ts
const SCALE: Record<SizeClass, number> = {
  compact: 1,      // the baseline theme.ts already holds
  regular: 1.06,
  expanded: 1.12,
  tv: 1.6,
};
```

With three rules baked in rather than left to each caller:

- **Type has floors, not just a multiplier.** TV body never below 24dp, card
  title never below 32dp. A scale factor alone leaves the 12px duration badge at
  19px, which is unreadable across a room.
- **`size.tapTarget`** — 42 phone (today's `IconButton`), 48 tablet, 64 TV. A
  focus target wants to be larger than a touch target, and its focus ring larger
  still.
- **`safe`** — overscan. **`useSafeAreaInsets()` returns zeroes on a TV**, so
  the 5%/3% margin Android TV requires has to be explicit: `paddingHorizontal:
  48, paddingVertical: 27` at 960×540dp. Without it the grid bleeds off the
  edge of the panel on any set with overscan still enabled, which is most of
  them.

Migration is incremental — `theme.ts`'s exports stay valid throughout, so files
move from the static import to `useMetrics()` one at a time.

## Layout per class

`use-grid-columns.ts` is rewritten against the size class rather than raw width:

| Class | Columns | Gap | Notes |
| --- | --- | --- | --- |
| compact | 1 | 16 | Unchanged from today. |
| regular | 2 | 18 | Tablet portrait, phone landscape. |
| expanded | 3 | 18 | Tablet landscape. |
| tv | 4, or 5 past 1200dp | 32 | Fixed, never derived from width. |

Four columns across 960dp less 96dp of overscan is a 216dp card — 432 physical
pixels at 1080p, which is the right size to read from a sofa.

Two more things stop being true once there is room:

- **Settings becomes two panes on `expanded`.** `ARCHITECTURE.md` justifies the
  full-screen settings screen with "a phone has no room for a panel beside
  anything". A tablet does, and the web app's panel layout is already designed.
- **Watch stops being a bottom sheet on `expanded`.** A sheet rising from the
  floor of a 1024pt screen is a long way for a thumb and looks wrong. A centred
  modal, or a side-by-side player and recommendation column, is the tablet
  shape.

## The TV interaction model

This is most of the work. Every interaction in the app is currently a finger.

### Focus-aware primitives

New `shared/ui/focusable.tsx`, wrapping `Pressable` — under
`react-native-tvos`, `Pressable` gains `onFocus`, `onBlur` and
`hasTVPreferredFocus`. It drives the same Reanimated shared value that `pressed`
drives today, so the existing animation code survives:

- pointer: scale **0.98** on press-in, as now.
- focus: scale **1.08**, a 4dp `buttonActive` ring, raised elevation.

One component, one branch, and `VideoCard` and `IconButton` keep their current
structure.

### What needs a focus branch

| File | Change |
| --- | --- |
| `entities/video/ui/video-card.tsx` | Focus scale and ring; `hasTVPreferredFocus` on the first card. |
| `shared/ui/icon-button.tsx` | Focus ring, 64dp on TV. |
| `widgets/top-bar/model/use-auto-hide.ts` | Hiding on scroll is meaningless with a remote. On TV the bar shows when focus is inside it and hides when focus enters the grid — driven by focus, not `scrollY`. |
| `features/video-search` | Inline filtering under a system IME is bad on TV. Make the field a focusable button that opens a dedicated search screen. |
| `shared/ui/bottom-sheet.tsx` | On TV, render as a centred dialog inside a `TVFocusGuideView` with `trapFocus*`. A grabber and a drag-to-dismiss are dead controls. |
| `pages/watch/ui/watch-sheet.tsx` | The `PanResponder` dismiss is dead. On TV, Watch is a plain full-screen route and Back/Menu exits. |
| `features/library-transfer/ui/parent-actions.tsx` | Typing a transfer code on a remote is punishing. Show the code as a QR on TV; keep entry on phone and tablet. |

### The player, on a remote

`use-player-taps.ts` — one tap toggles, two on a side seek — has no analogue
with a D-pad. Add `widgets/player/model/use-tv-remote.ts` on `useTVEventHandler`:

| Key | Action |
| --- | --- |
| `select`, `playPause` | Play / pause |
| `left`, `right` | Seek ∓ the existing `seekStep` (15s) |
| `up`, `down` | Reveal the controls and move focus into them |
| `fastForward`, `rewind` | ±30s |
| `back`, `menu` | Controls visible → hide them; hidden → leave |

`player-chrome.tsx` and `player-transport.tsx` then need focusable buttons in an
explicit order, since the remote has to be able to reach the progress bar, mute,
repeat and full screen — a finger could simply land on them.

Three controls stop making sense and should be hidden on TV: **full screen** (it
already is), the **lock button** (nothing to lock out — there is no surface to
touch), and the **volume stepper** (see below).

### FlashList and the D-pad — the known risk

`@shopify/flash-list@2.0.2` is pure JavaScript — it ships no `ios/` or
`android/` directory — so it recycles React views and the platform's focus
engine sees the real native views underneath. Two hazards follow:

1. **Focus lost on recycle.** A focused row scrolls out, its view is rebound to
   different data, and Android's focus engine drops focus to the root. The user
   is stranded with a remote that does nothing.
2. **Focus search off the edge of the window.** Pressing down at the boundary of
   the virtualised window finds no view, because the next row is not mounted
   yet.

Mitigations, in the order to try them: wrap the list in a `TVFocusGuideView`
with `autoFocus`; add explicit `nextFocusUp`/`nextFocusDown` where the grid
meets the header; and failing both, **fall back to `FlatList` on TV** with
`removeClippedSubviews={false}` and a generous `windowSize`. The recycling
argument in `ARCHITECTURE.md` was made against a mid-range phone; a television
has far more memory and a D-pad cannot flick.

**Budget real device time here.** This is the single most likely thing to
overrun.

### The WebView will steal the D-pad

Android TV's WebView is focusable. Once focus enters it, the arrow keys go to
the YouTube iframe — its own controls, its own title bar, its own way out of the
app — instead of to the player chrome. This is precisely the leak the `#shield`
div already fights for touch, arriving through a different door.

First try the JavaScript side: `focusable={false}` and
`importantForAccessibility="no-hide-descendants"` on the `WebView`.

That is frequently not enough, because a WebView manages its own internal focus.
The fix is a **small Kotlin Expo module** — perhaps forty lines — that calls
`setDescendantFocusability(ViewGroup.FOCUS_BLOCK_DESCENDANTS)` on the WebView's
parent and `setFocusable(false)` on the WebView itself.

This is the native code the project actually needs, and the pattern is already
in the repo: `modules/system-volume` is a local Expo module with Kotlin and
Swift halves. A second one sits beside it.

### Volume, orientation, wake

- **`modules/system-volume`** — the iOS half is `MPVolumeView`, which does not
  exist on tvOS; moot, since tvOS is out of scope. On Android TV `AudioManager`
  works, but volume belongs to the television or the receiver and to the
  remote's own volume keys. Hide the in-app stepper on TV and let the hardware
  own it.
- **`expo-screen-orientation`** — a television is landscape, permanently. The
  full-screen orientation lock in `watch-sheet.tsx` must be skipped on TV.
- **`expo-keep-awake`** — still wanted, unchanged.

## Build and packaging

`apps/mobile/android/` and `apps/mobile/ios/` are **gitignored**
(`.gitignore:29-30`), so the project already runs Continuous Native Generation
through `expo prebuild`. That is exactly what the TV path needs — there is no
committed native directory to clobber, and the TV variant is another prebuild
rather than a second checked-in project.

One app directory, two prebuild outputs:

1. `pnpm add -D @react-native-tvos/config-tv` in `apps/mobile` (peer:
   `expo >= 52`; the app is on 57). Add it to `app.json`'s `plugins`.
2. Alias React Native to the fork for TV builds. **`react-native-tvos@0.86.2-0`
   exists and matches the pinned `react-native@0.86.2` exactly** — the same
   React Native version, so this is an alias, not an upgrade.
3. `EXPO_TV=1 npx expo prebuild --clean` regenerates `android/` with the
   leanback configuration; leave the variable unset for phone and tablet builds.
4. `app.json` gains a TV branch: a 320×180 `android.banner` (Play requires it),
   `<uses-feature android:name="android.software.leanback" android:required="true">`,
   `<uses-feature android:name="android.hardware.touchscreen" android:required="false">`,
   and a `LEANBACK_LAUNCHER` intent filter. The config plugin writes most of it.
5. `eas.json` gains `preview-tv` and `production-tv` profiles carrying
   `EXPO_TV=1`.

Two things in the current configuration need attention while in there:

- **`abiFilters: ["arm64-v8a"]`** in the `expo-build-properties` block must
  widen for TV. Many Android TV boxes and every Fire TV stick are
  `armeabi-v7a`, and a number are `x86`. Shipping arm64-only would silently
  exclude most of the television market. Add `armeabi-v7a` at minimum on the TV
  profile.
- **`expo-build-properties` is listed twice** in `app.json`'s `plugins` — once
  bare, once configured. Harmless today, worth removing.

Store-side, a TV app needs its own banner, TV screenshots and the leanback
declaration, and a kids-targeted TV app inherits Play's Families policy on top
of that. The package name can stay the same.

## Phasing

| Phase | Work | Estimate |
| --- | --- | --- |
| **1. Device foundation** | `use-device.ts`, `metrics.ts`, rewritten `use-grid-columns.ts`. No visible change — `compact` scale is 1, so the phone renders identically. | 2–3 d |
| **2. Tablet** | Grid columns, scaled metrics, two-pane settings, watch as a centred modal on `expanded`. Ships in the existing binary; no fork, no native change. | 3–5 d |
| **3. TV foundation** | Fork alias, `config-tv`, prebuild, EAS profiles, first boot on a real Android TV. Nothing works well yet; the goal is a running app. | 3–4 d |
| **4. TV focus system** | `focusable.tsx`, card and button focus states, header focus behaviour, grid focus, sheet → dialog. | 5–8 d |
| **5. TV player** | Remote transport, chrome focus order, the Kotlin focus-block module, hiding the controls that no longer apply. | 4–6 d |
| **6. Polish and ship** | Overscan audit on a real panel, ABI widening, banner art, Play TV listing. | 3–5 d |

**Phase 2 is the one to do first.** It is the lowest risk, needs no fork and no
native change, and it is immediately visible to every tablet owner who already
has the app.

Apple TV is not scheduled. It would block at Phase 5.

## Decisions, settled

1. **Apple TV** — dropped. Not built, not scheduled.
2. **Fire TV** — in scope. The TV build must ship `armeabi-v7a` alongside
   `arm64-v8a`; every Fire TV stick is 32-bit ARM.
3. **Tablet watch layout** — player and recommendations side by side.
4. **TV search** — a dedicated search screen, reached from a focusable button in
   the header. No inline filtering behind a system IME.

## Progress

**Phase 1 — device foundation: done.**
`shared/lib/device/use-device.tsx` (two axes: `DeviceKind` and `SizeClass`),
`shared/config/metrics.ts` (per-device scale, type floors, `overscanY`,
`useStyles`), and `use-grid-columns.ts` rewritten against the size class.
`theme.ts` is untouched, so its parity with `globals.css` still holds.

**Phase 2 — tablet: done.** Every component reads its sizes through `useMetrics`.
The header's search field moves inline on a wide window, the watch screen becomes
two columns, settings lays its rows two across, and sheets cap at 560pt. Ships in
the existing binary — no fork, no native change, no new dependency.

See `ARCHITECTURE.md`, *Phone, tablet, television*, for what the two layers are and
why they are two.

**Phase 3 onwards — TV: not started.**
