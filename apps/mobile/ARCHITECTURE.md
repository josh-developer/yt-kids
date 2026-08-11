# apps/mobile architecture

A native client for kidtube.uz. Not a WebView — the shell that was one is gone.

## Layers

The web app is organised by [Feature-Sliced Design][fsd] and enforces it with
`eslint-plugin-boundaries`. This app mirrors it, so a screen can be read across
both codebases without relearning where things live:

```
App.tsx                 providers, font/preference gate, the screen
src/
  pages/home/           a screen, composed of widgets
  widgets/
    top-bar/            wordmark, actions, search; hides on scroll
    video-grid/         the list, and the scroll reveal
  features/
    theme-toggle/       light/dark button
    locale-switch/      en/uz button
  entities/video/       card, thumbnail, avatar — one video, everywhere
  shared/
    api/                thumbnail URLs
    config/             design tokens, storage keys, site URL
    lib/format/         data → localized display strings
    lib/i18n/           catalogs, ICU, active locale
    lib/storage/        the two persisted preferences
    lib/theme/          active palette
    ui/                 icon button
```

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

## Performance

**Thumbnails go through the site's proxy**, `\`${SITE_URL}/_thumb/<id>/card\``, not
`i.ytimg.com`. Verified against production: a request advertising AVIF returns
`image/avif` at 11.6KB where the JPEG is ~24KB, with
`cache-control: public, max-age=2592000`. A third of the bytes and a month of
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
value, because it needs the *previous* offset to get a direction from — a derived
value only ever sees the current one and the delta would be zero every frame. Doing
it with React state would mean a `setState` per scroll frame, which puts a header
animation on the JS thread, precisely where it must not be.

`scrollY` is owned by the screen, not the list: two things read it, and a shared
value passed to a child as a prop must not be mutated there — which the React
Compiler's `immutability` rule enforces, correctly.

## Not here yet

- **The watch screen.** Tapping a card is inert. Deliberately not a WebView
  stopgap: this app is being taken off WebView, and that is the hardest kind of
  temporary to remove.
- **Search.** The field is presentational. Wiring it needs the query filtering in
  the web app's `video-library.ts`, which is worth porting rather than reinventing.
- **Parent settings.** The `+` button is wired but inert; the screen is its own job.
- **The library.** The web keeps a parent-curated selection in `localStorage`; this
  screen shows the whole catalog. Needs a storage decision first.
- **The doodle layer.** The web lays two fixed SVG layers over the gradient. A
  full-screen decorative layer under a scrolling list is a performance decision
  worth measuring, not assuming.
