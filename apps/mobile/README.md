# mobile

An Expo shell around [kidtube.uz](https://kidtube.uz). One `WebView`, no second
implementation of anything — the site is the app.

```sh
pnpm --filter mobile dev        # Metro only — runs in Expo Go, no native build
pnpm --filter mobile ios        # expo run:ios — prebuilds and compiles natively
pnpm --filter mobile android    # expo run:android — same, needs ANDROID_HOME
pnpm --filter mobile typecheck
```

`dev` is the fast loop: Expo Go already bundles every native module this app uses,
so nothing has to be compiled. `ios` and `android` are the slow, faithful ones —
`expo prebuild` generates `ios/`/`android/` (both gitignored, since EAS
regenerates them in the cloud) and Gradle or Xcode builds a real app.

An Android build needs the SDK on the path, which is not exported by default:

```sh
export ANDROID_HOME=~/Library/Android/sdk
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
```

Point it somewhere else with `EXPO_PUBLIC_SITE_URL` (Expo inlines
`EXPO_PUBLIC_*` at bundle time):

```sh
EXPO_PUBLIC_SITE_URL=http://192.168.1.20:5173 pnpm --filter mobile ios
```

## Decisions worth knowing before changing things

**Top-level navigation is fenced to the site's own host.** `isAllowedSiteUrl`
derives the fence from `SITE_URL`, so an override moves it rather than locking
itself out. Everything else is refused outright, not handed to the system
browser — the web app works hard to make the player a closed room (no YouTube
chrome, no related grid, no clickable title), and one tap into Safari would undo
all of it.

Subframe requests are exempt, and must stay exempt. On iOS
`onShouldStartLoadWithRequest` fires for iframes too, and the player *is* a
cross-origin `youtube-nocookie` iframe, so running the host check on subframes
blocks playback. Android only reports main-frame navigations there.

**`mediaPlaybackRequiresUserAction={false}`.** The web build spends real effort
working around WebKit's rule that only muted autoplay may start without a
gesture — carrying the mute state in the embed URL, rebuilding the iframe inside
the tap that asks for sound. In a shell we own, that rule is simply lifted, so
video here can start with sound on its own. If the web workaround is ever
revisited, this app does not need it.

**Only the top safe-area edge is inset.** The site positions its own player
controls against the bottom and already pads them with
`env(safe-area-inset-bottom)`. Insetting the bottom here as well pays for the
home indicator twice.

## eas.json pins a minimum CLI, and it will reject an old one

`cli.version` is `>= 21.7.0`. A globally installed `eas-cli` below that fails
before doing anything:

```
You are on eas-cli@14.4.0 which does not satisfy the CLI version constraint
defined in eas.json (>= 21.7.0)
```

`npm install -g eas-cli` fixes it. The floor is not decoration: this project was
initialised, linked and configured for EAS Update entirely with 21.7.x, and
eas-cli 14 predates SDK 57, so pointing it at this config is a good way to get
confusing failures rather than an honest one.

## Two pinned versions, on purpose

| package | pin | why |
| --- | --- | --- |
| `react` | `19.2.3` exact | what Expo Go for SDK 57 bundles; a mismatch is a red screen |
| `react-native-webview` | `~13.16.1` | what Expo Go bundles, and `14.0.1`'s types are broken |

`react-native-webview@14.0.1` declares `class WebView<P = undefined> extends
Component<WebViewProps & P>`. `WebViewProps & undefined` is `never`, so every
prop fails to typecheck. `13.16.1` defaults the parameter to `{}` and resolves
correctly. A caret range here would float to 14 and break the build, which is
why the range is a tilde.

The workspace root uses `react@^19.2.8` for the web app. That is fine and not
worth reconciling — pnpm gives each package its own copy, and this one has to
match Expo Go rather than the web build.

## metro.config.js earns its keep

Metro's defaults are wrong in a pnpm workspace twice over: it watches only the
project folder (so shared-package edits never trigger a rebuild), and it walks
parent directories for `node_modules` (so it can reach a second React through a
symlink and bundle both — which surfaces as hooks reading a null dispatcher, not
as a resolution error). The config watches the workspace root, names both
`node_modules` roots, and disables the parent walk.

## The Expo CLI rewrites this directory's tsconfig.json

`expo start` normalises `tsconfig.json#include` and strips comments while doing
it. Explanations belong here, not there. The shared preset it extends lives at
`packages/typescript-config/expo.json`, and exists because React Native needs
`module: preserve`, `moduleResolution: bundler`, and the `react-native` custom
condition, none of which the repo's NodeNext `base.json` provides.
