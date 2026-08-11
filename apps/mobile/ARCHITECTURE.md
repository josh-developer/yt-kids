# apps/mobile architecture

A native client for kidtube.uz. Not a WebView — the shell that was one is gone.

## Layers

The web app is organised by [Feature-Sliced Design][fsd] and enforces it with
`eslint-plugin-boundaries`. This app mirrors it, so a screen can be read across
both codebases without relearning where things live:

```
App.tsx                 fonts, providers, the screen
src/
  pages/home/           a screen, composed of widgets
  widgets/
    top-bar/            wordmark + search affordance
    video-grid/         the list, and the scroll reveal
  entities/video/       card, thumbnail, avatar — one video, everywhere
  shared/
    api/                thumbnail URLs
    config/             design tokens, site URL
    lib/format/         data → display strings
    lib/theme/          active palette
```

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

## Not here yet

- **The watch screen.** Tapping a card is inert. Deliberately not a WebView
  stopgap: this app is being taken off WebView, and that is the hardest kind of
  temporary to remove.
- **Search.** The field is presentational. Wiring it needs the query filtering in
  the web app's `video-library.ts`, which is worth porting rather than reinventing.
- **The library.** The web keeps a parent-curated selection in `localStorage`; this
  screen shows the whole catalog. Needs a storage decision first.
- **i18n.** Strings in `lib/format/video-labels.ts` are the Uzbek ones, in one
  place, ready to become catalog lookups. The web resolves them through `next-intl`.
- **The doodle layer.** The web lays two fixed SVG layers over the gradient. A
  full-screen decorative layer under a scrolling list is a performance decision
  worth measuring, not assuming.
