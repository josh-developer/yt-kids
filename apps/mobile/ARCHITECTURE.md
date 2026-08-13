# apps/mobile architecture

A native client for kidtube.uz. Not a WebView — the shell that was one is gone.

## Layers

The web app is organised by [Feature-Sliced Design][fsd] and enforces it with
`eslint-plugin-boundaries`. This app mirrors it, so a screen can be read across
both codebases without relearning where things live:

```
App.tsx                 providers, Intl polyfill, font/preference gate
src/
  app/navigation.tsx    the routes
  pages/
    home/               the feed
    settings/           the parent screen: approve or hide videos
    watch/              the player, as a sheet over whichever screen is up
  widgets/
    top-bar/            wordmark, actions, search; hides on scroll
    video-grid/         the list, and the scroll reveal
    player/             the control chrome over the video
  features/
    theme-toggle/       light/dark button
    locale-switch/      en/uz button
    video-search/       the search field, its button and its clear
  entities/
    video/              card, thumbnail, avatar — one video, everywhere
    library/            which videos are approved, and persisting that
  shared/
    api/                thumbnail URLs
    config/             design tokens, storage keys, site URL
    lib/format/         data → localized display strings, query matching
    lib/i18n/           catalogs, ICU, active locale
    lib/storage/        the persisted preferences
    lib/theme/          active palette
    ui/                 icon button
```

Navigation is a native stack — `@react-navigation/native-stack`, which is
`react-native-screens` underneath. Three routes: `Home`, `Settings`, and `Watch` as a
transparent modal with the stack's own animation switched off, because the sheet
animates itself and two animations on one transition is how a slide becomes a stutter.

It was two pieces of `useState` in `App.tsx` before, which worked and was the wrong
shape: the back gesture and the hardware back button had to be reimplemented, every
screen stayed mounted whether or not it was visible, and there was nowhere for a deep
link to arrive. The native stack also _detaches_ a route that is not on top, so the
home grid stops existing while settings is up rather than sitting behind it holding a
few hundred rows.

The library is created in `App.tsx` and handed to the navigator as a prop. Calling
`useLibrary()` per route would give each one its own copy of what a parent has hidden.

`features/` exists for the same reason it does on the web: a toggle is a user
action with its own state, not a piece of a widget's layout, and the header should
not know how a theme is stored.

The rule is the web's: a layer may import from layers below it and from itself,
never from above. `entities/video` knows nothing about the grid that renders it.

Boundaries are not lint-enforced here yet — the web app's `boundaries` config is
tied to its own directory patterns. Worth adding once there is a second screen.

[fsd]: https://feature-sliced.design/

## The design system is copied, not shared

`shared/config/theme.ts` holds the tokens from `apps/app/app/globals.css`. That
file stays the source of truth; a difference here is a bug here.

They are copied because the web holds them as CSS custom properties, which
nothing in React Native can read. Sharing them properly means moving the tokens
into a `@repo/*` package and rewriting the web app's token layer to consume it —
a real change to a working app, and a separate job from this screen. `@repo/catalog`
was the same argument and did get extracted, because data is portable in a way
CSS variables are not.

`light` defines the token set and `dark` is typed from its keys, so a token added
to one theme and forgotten in the other fails to compile.

### Fonts

Nunito, at 400/600/700/800/900.

The web's stack is `"Avenir Next Rounded", "Nunito", "Trebuchet MS", …`. Avenir
Next Rounded is an Apple system face — no Android equivalent, and no web download
— so Nunito is the font the design actually ships to most viewers, and using it on
both platforms is what makes them match rather than merely rhyme.

Loading is gated behind the splash screen. Card titles are Nunito 800; rendering
them in the system face first and swapping would reflow every card on the first
screen.

## Lists: `FlashList`, and why the reveal changed

Both long lists — the home grid and the settings list, each 400-odd rows — are
`FlashList`. `FlatList` mounts and unmounts rows as its window moves, so a fast flick
is a stream of mounts, which is what "scrolling feels heavy" was made of on a
mid-range phone. `FlashList` keeps a pool of views and rebinds them. Version 2 measures
rows itself, so there is nothing to estimate.

Two things follow from a recycling list and are easy to get wrong:

- Row spacing lives on the row, not as a `gap` on the content container. A recycling
  list lays each row out on its own, so a container `gap` has nothing to apply to.
- The card reveal is a Reanimated `entering` animation now, not a scroll-driven one.
  The old version read the list's `scrollY` in every mounted card's `useAnimatedStyle`,
  which described where each card really was and survived recycling perfectly — and
  cost one worklet per mounted card per frame, every frame of every scroll. `entering`
  runs once, natively, and leaves nothing running. A row scrolled back to animates
  again; that is the price and it is worth it.

## Performance

**Thumbnails go through the site's proxy**, `\`${SITE_URL}/_thumb/<id>/card\``, not
`i.ytimg.com`. Verified against production: a request advertising AVIF returns
`image/avif`at 11.6KB where the JPEG is ~24KB, with`cache-control: public, max-age=2592000`. A third of the bytes and a month of
cache, per card.

**`expo-image` with `cachePolicy="memory-disk"`.** Disk matters more than memory
here: the catalog is static, so a thumbnail fetched once should never be fetched
again, across launches. `recyclingKey` stops a recycled row showing the previous
video's picture for a frame.

**`FlatList`, deliberately configured.** 367 videos, each row holding an image, so
a `ScrollView` is not an option. `getItemLayout` is the important one — rows are a
fixed height, so the list is told rather than left to measure, which makes both
scroll-to-offset and the reveal animation's arithmetic exact. `removeClippedSubviews`
frees offscreen native views; rows have no state to lose.

**`memo` on the card.** The list re-renders as the header animates; without it
every visible row would re-render on every scroll frame.

## The scroll reveal

`widgets/video-grid/ui/card-reveal.tsx`, driven by scroll position rather than by
mount.

That distinction is the whole design. In a virtualised list rows mount when the
windowing logic decides to, not when they become visible — so a mount-triggered
fade plays at the wrong time, often offscreen where nobody sees it, and again when
a row is recycled. Reading position means the animation always describes where the
card actually is, and scrolling back to a row finds it already settled.

Every frame runs on the UI thread through Reanimated, so it survives a fast flick
while images are still decoding.

`react-native-worklets` is a **direct** dependency on purpose. `babel-preset-expo`
adds the worklets babel plugin only if it can resolve `react-native-worklets/plugin`
from the project, and under pnpm a transitive dependency of Reanimated is not
reachable from here. Left transitive, the plugin is silently skipped and every
animation fails at runtime with nothing to point at. Same class of failure as
`babel-preset-expo` itself, which is documented in the README.

## Theme and locale

Both are persisted preferences that follow the device until someone chooses
otherwise, and both gate the first frame.

**Theme.** The web's rule is "stored choice wins; otherwise the device preference
decides", and that is the rule here — with one addition. A phone can change its
appearance while the app is open, so until a deliberate toggle the palette follows
`useColorScheme()` live rather than being sampled at launch. After a toggle it stops
following, because a viewer who picked light did not mean "light until sunset".

**Locale.** `en` and `uz`, from the same `@repo/internationalization` catalogs the
website serves — imported, not copied, so a string corrected on the web is corrected
here. Only the JSON is taken; `next-intl` is tied to Next's request lifecycle.

Formatting goes through `intl-messageformat`, which is the engine `next-intl` uses
underneath. That is deliberate rather than convenient: `LocaleSwitcher.name` is
`{locale, select, en {English} uz {O'zbekcha} other {{locale}}}`, and hand-rolling a
subset of ICU to read it is exactly how two platforms drift apart. Formatters are
cached per locale and message id, because constructing one parses the pattern and a
card renders a view count on every scroll frame.

View counts are bucketed in `lib/format/use-video-labels.ts` and separators come
from the catalog's `Format` namespace, not from `Intl`. Both copy the web, and the
web has a reason: the Workers runtime ships ICU with English locale data only, so it
accepts `uz` and then formats it like `en`. Matching the arithmetic is what keeps the
two byte-identical rather than merely close.

Switching locale is local state here. On the web it is a real navigation — the
server owns the messages, `<html lang>` and the cookie — but the catalogs are in
this bundle, so there is nothing to fetch and nothing to route.

**Both are read before the first paint**, alongside the fonts. Each would otherwise
show the wrong thing and correct itself: the system face before Nunito reflows every
title, light before a stored dark, English before a stored Uzbek.

## The header hides itself

`widgets/top-bar/model/use-auto-hide.ts`, a port of the web's `useTopbarAutoHide`
with its thresholds intact — 24px of top zone, and an 8px deadband that stops a
jittery finger flickering the bar.

It floats above the list rather than scrolling with it, which is what lets it move
under its own animation; the web does the same with `position: sticky` and a
`translateY(-100%)`. The list is padded by the bar's height instead of carrying it as
a header.

The whole decision runs on the UI thread. `useAnimatedReaction` rather than a derived
value, because it needs the _previous_ offset to get a direction from — a derived
value only ever sees the current one and the delta would be zero every frame. Doing
it with React state would mean a `setState` per scroll frame, which puts a header
animation on the JS thread, precisely where it must not be.

`scrollY` is owned by the screen, not the list: two things read it, and a shared
value passed to a child as a prop must not be mutated there — which the React
Compiler's `immutability` rule enforces, correctly.

## The watch sheet

A sheet, not a screen: it mounts over whatever is behind it, animates up from the
bottom, and the way back is to drag it down. No header, no grabber and no black
band above the video — the picture starts at the top of the screen with the status
bar over it, which is what a phone player looks like.

The drag works from anywhere: the video, the title, the channel row, or the
recommendations while they are scrolled to the top. That last clause is what makes
one gesture serve two purposes — the sheet claims a touch only when the list below
has nothing left to scroll up, so a drag dismisses and a drag inside a scrolled
list scrolls.

Release is a decision between distance and velocity: a quarter of the screen, or a
flick that also travelled 40px. Velocity alone dismissed on a plain tap, because a
touch that goes down and up in a few milliseconds reports a velocity in the
thousands.

## Why the player uses React Native's responder system, not Gesture Handler

The video is a WebView, and a WebView takes touches in native code before Gesture
Handler's per-view recognisers see them. Measured, not assumed: a `Gesture.Tap()`
attached to a transparent view directly over the WebView never fired, while an
`onTouchEnd` on the same view did — because the responder system dispatches from
the root view rather than per view.

So everything that has to work over the video is built on the responder system:

- `model/use-player-taps.ts` — one tap toggles the controls, two on a side seek
  ±15s. A settle window (320ms) holds the toggle back until a second tap cannot be
  coming, which is the web's `CLICK_SETTLE_MS` trick with a longer fuse: 220ms was
  short enough that a real thumb's double tap toggled the controls twice on its way
  to the seek.
- The sheet's dismiss drag is a `PanResponder`, claimed in the **capture** phase.
  A `ScrollView` that already holds the responder refuses to give it back, so
  asking afterwards never wins; and once claimed the sheet refuses termination and
  blocks the native responder, or Android keeps scrolling underneath the drag.

Inside the page, a transparent `#shield` div covers the iframe. The WebView still
receives the touch, and the shield is what stops the embed acting on it — without
it, taps meant for the app's controls brought up YouTube's own title bar, its
watch-on-YouTube link, and seeks from its progress bar.

## The player

`widgets/player` owns the video and everything over it. One component, `PlayerView`,
holds the WebView, its ref, the commands and the chrome, because a ref that crosses
a component boundary is a ref read during someone else's render — which the React
Compiler flags, correctly.

- `model/player-bridge.ts` builds the page and the command envelopes. The page
  loads YouTube's iframe API, exposes `window.kidtube` for the app to call through
  `injectJavaScript`, and reports state, position and errors back through
  `ReactNativeWebView.postMessage`. Its own 250ms clock sends the time, so the app
  never asks.
- `model/use-player.ts` is what the app believes about playback: status, position,
  duration, the controls' visibility and their auto-hide.
- `ui/player-transport.tsx` is the web's `BigPlayButton` and `SideNavButtons`: play
  in the middle of the picture on its red-to-orange gradient, previous and next at
  the edges. `ui/player-chrome.tsx` is the progress bar and the strip — play, mute,
  the volume stepper and meter, repeat, full screen. That is exactly what the web
  shows under 720px, where `.footerTransportControls` is `display: none` because
  those controls have moved onto the picture and the ±15 steps are the double tap.
  Both files carry the CSS values they came from.
- The lock button is the web's `.playerLockButton` and behaves the same way: a
  locked player stops answering taps on the picture, and the lock is the one control
  that stays visible so there is a way back out.
- `ui/player-view.tsx` also draws the web's `.youtubeTitleCover` — the gradient over
  the top of the embed that hides YouTube's own title bar. That bar links out of the
  app, and it is what flashes over the picture after a programmatic play or seek.
- `ui/up-next-card.tsx` is the web's `UpNextOverlay`: the next video, a four-second
  ring, and buttons to watch again or go now. It covers the surface when a video
  ends, which is also the only way to be rid of the embed's own replay button.

### The embed has to be told where it is

`origin` and the WebView's `baseUrl` are both the site's own URL, and that is not
cosmetic: an injected page has no origin to report, and YouTube answers a request
without one by refusing to play — error 150 or 152, "this video is unavailable",
however embeddable the video is. The site's origin is the honest answer and the one
already serving these embeds in production.

### Sound on iOS, and volume on both

Two separate things used to leave iOS silent. A browser will not autoplay with
sound, which is why the web starts muted; a WKWebView configured with
`mediaPlaybackRequiresUserAction={false}` will, so the player starts unmuted and
`startsMuted` exists only as a fallback that is undone the moment playback starts.
And the default audio session is silenced by the ringer switch whatever the player
does, which `modules/system-volume`'s `configureForPlayback` fixes by asking for
`.playback`.

That local native module is also the volume slider. WKWebView ignores an HTML5
`volume` assignment — the property is read-only on iOS — so the only volume there
is is the device's, set through `MPVolumeView`'s embedded slider. Android could
have had a player-local volume through the iframe API; it uses `AudioManager` on
the same 0-to-1 contract instead, so the slider means one thing on both platforms
and the hardware keys agree with it.

### Full screen

The button sits after repeat, as on the web. Full screen is landscape: the sheet
locks the orientation while it is on and releases it on the way out, the list
underneath is unmounted, the status bar hides, and the stage drops its 16:9 ratio
to take the window. The lock is only ever applied _entering_ full screen — locking
portrait on mount cost an activity restart on Android, which looked like the video
refusing to open.

## The library, and what "approved" is stored as

`entities/library` holds the parent's curation. The stored value is the set of
**hidden** ids, never the approved ones — so an empty store means "nothing
hidden", a fresh install shows the whole catalog, and a release that adds videos
to `@repo/catalog` makes them visible with no migration. The web made the
opposite choice and needs the migration; this is the one deliberate divergence.

The settings screen is a screen rather than the web's panel-inside-the-shell,
because a phone has no room for a panel beside anything.

## Not here yet

- **A native video surface.** Playback is the YouTube iframe in a WebView, which is
  the only supported way to play these videos; scraping stream URLs would break
  both the terms and, sooner, itself. The cost is the embed's transient title bar
  after a programmatic play or seek, which no parameter turns off.
- **The rest of parent settings.** The web's panel also adds a video by URL,
  exports and imports the library as a transfer code, approves or hides
  everything at once, and resets to defaults. Each needs library model that is
  not ported yet.
- **Series-aware recommendations.** `entities/library/recommendations.ts` ports the
  branch of the web's `recommendationGroupsFor` that runs when a video has no
  series: the next few in order, then a deterministic shuffle. The web also groups
  by title similarity, which needs a signature comparison that is not ported.
- **The doodle layer.** The web lays two fixed SVG layers over the gradient. A
  full-screen decorative layer under a scrolling list is a performance decision
  worth measuring, not assuming.
- **`expo-system-ui` and a configured splash.** `app.json` sets
  `backgroundColor`, which iOS ignores without that package, so a cold start
  flashes white before the first paint. Both are native config, so both want a
  rebuild rather than a hot reload.
