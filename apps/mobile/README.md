# mobile

The native client for [kidtube.uz](https://kidtube.uz). Its screens are React
Native — see `ARCHITECTURE.md` — and the one WebView left is the video itself, which
is the only supported way to play a YouTube embed.

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

**Navigation out of the player is refused.** `PlayerView`'s
`onShouldStartLoadWithRequest` allows the page's own document and the YouTube embed
hosts, nothing else. The web app works hard to make the player a closed room — no
YouTube chrome, no related grid, no clickable title — and one tap into Safari would
undo all of it.

Subframe requests are exempt, and must stay exempt. On iOS the callback fires for
iframes too, and the player _is_ a cross-origin YouTube iframe, so running the host
check on subframes blocks playback.

**`mediaPlaybackRequiresUserAction={false}`.** The web build spends real effort
working around WebKit's rule that only muted autoplay may start without a gesture.
In an app we own that rule is simply lifted, which is why video here starts with
sound.

## Why the APK is 31 MB and not 97

A universal APK carries a copy of every native library for four architectures. In this
app that is most of the download:

| slice                                   | size    |
| --------------------------------------- | ------- |
| `lib/x86_64`                            | 22.8 MB |
| `lib/x86`                               | 22.6 MB |
| `lib/arm64-v8a`                         | 21.3 MB |
| `lib/armeabi-v7a`                       | 14.7 MB |
| dex, unminified                         | 11.2 MB |
| assets (the JS bundle is 4.25 MB of it) | 4.3 MB  |

The two x86 slices exist for emulators; `armeabi-v7a` is for 32-bit phones, which no
current device is. Building for `arm64-v8a` alone drops 60 MB, and R8 takes the dex
from 11.2 MB to 3.6 MB:

```sh
cd android && ./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a
```

`reactNativeArchitectures` is the knob that works. `expo-build-properties` accepts an
`android.abiFilters`, and it does _not_ reach this — a build with it set still packed
all four. The minification comes from that plugin, though:
`enableProguardInReleaseBuilds` and `enableShrinkResourcesInReleaseBuilds`.

The `production-apk` profile passes the same flag through `gradleCommand`, so a cloud
build matches. A 32-bit device would need `armeabi-v7a` added back in both places.

## APK or AAB — pick the profile, not the artifact

`android.buildType` decides which Gradle task runs, and `distribution: internal`
does **not** imply an APK, which is easy to get wrong: an internal build left on
the default produces an `.aab` that cannot be installed.

| profile          | buildType                       | for                                                 |
| ---------------- | ------------------------------- | --------------------------------------------------- |
| `production`     | `app-bundle` → `.aab`           | Play Store. Bumps `versionCode` remotely.           |
| `production-apk` | `apk` → `.apk`                  | the same release build, installable. Does not bump. |
| `preview`        | `apk` → `.apk`                  | throwaway internal builds on the `preview` channel  |
| `development`    | (forced by `developmentClient`) | dev client                                          |

```sh
eas build --platform android --profile production-apk   # installable release
adb install <downloaded>.apk
```

`production-apk` extends `production`, so it keeps the same channel, environment
and signing key, and differs only in the two ways it must: it emits an APK, and
`autoIncrement` is off so a sideload build does not consume a Play `versionCode`.

To convert an `.aab` you already have instead of rebuilding, `bundletool` is the
only route — Play normally does this step for you:

```sh
brew install bundletool
bundletool build-apks --bundle=app.aab --output=app.apks --mode=universal \
  --ks=<keystore> --ks-key-alias=<alias>
unzip -p app.apks universal.apk > app.apk
```

That needs the signing keystore EAS is holding (`eas credentials`), so rebuilding
with `production-apk` is usually less work than getting the key out.

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

| package                | pin             | why                                                         |
| ---------------------- | --------------- | ----------------------------------------------------------- |
| `react`                | `19.2.3` exact  | what Expo Go for SDK 57 bundles; a mismatch is a red screen |
| `react-native-webview` | `13.16.1` exact | the only release whose types compile                        |

`react-native-webview` is back, and load-bearing: the player is YouTube's iframe API
in a WebView, which is the only supported way to play these videos.

`react-native-webview` declares `class WebView<P = undefined> extends
Component<WebViewProps & P>` from **13.16.2** onwards. `WebViewProps & undefined`
is `never`, so every prop fails to typecheck. Only 13.16.1 defaults that
parameter to `{}`:

| version | generic default | compiles |
| ------- | --------------- | -------- |
| 13.16.1 | `P = {}`        | yes      |
| 13.16.2 | `P = undefined` | no       |
| 14.0.1  | `P = undefined` | no       |

So the pin is exact, not a tilde and certainly not a caret. A tilde was tried and
did not hold: `~13.16.1` admitted 13.16.2, and the break resurfaced the next time
the lockfile was regenerated during a merge. Do not loosen it without checking
that declaration.

The workspace root uses `react@^19.2.8` for the web app. That is fine and not
worth reconciling — pnpm gives each package its own copy, and this one has to
match Expo Go rather than the web build.

## Hermes has no `Intl.PluralRules`

`src/shared/lib/i18n/intl-polyfill.ts` is imported first in `App.tsx`, before
anything that formats a message. It is not optional: `Settings.approvedCount` in
`@repo/messages` is an ICU plural, `intl-messageformat` needs `Intl.PluralRules`
to pick a branch, and Hermes ships without it — so the settings screen came up as
a red box with

```
Intl.PluralRules is not available in this environment.
```

The three `@formatjs` polyfills are each behind their own `shouldPolyfill()`, so a
runtime that has the real implementation loads none of them. `useTranslations`
also catches a formatting throw and falls back to plain `{name}` substitution,
which is the floor under the polyfill rather than a substitute for it.

A third locale needs its plural data added there as well as its catalog added to
`@repo/messages`.

## One patched dependency: expo-modules-jsi

`patches/expo-modules-jsi@57.0.4.patch`, wired up through `patchedDependencies` in
`pnpm-workspace.yaml`, changes exactly one expression:

```
- guard milliseconds.isFinite, abs(milliseconds) <= maxJavaScriptDateMilliseconds
+ guard milliseconds.isFinite, milliseconds.magnitude <= maxJavaScriptDateMilliseconds
```

Without it, no iOS build gets past `ExpoModulesJSI`:

```
JavaScriptCodable+Date.swift:53:50: type of expression is ambiguous without a
type annotation
```

The module builds with C++ interoperability, which imports the C `abs` overloads
alongside Swift's, and Swift 6.2.3 (Xcode 26.2) cannot choose between them for a
`Double`. The same expression compiles standalone, so it is the interop that does
it. `.magnitude` has one meaning and no overloads. 57.0.4 is the newest published
version, so there is nothing to upgrade to yet.

Delete the patch when a release fixes it upstream — pnpm fails loudly if the
version it names is no longer installed, which is the reminder. After patching,
`pod install` has to run again: the pnpm store path changes, and the Pods project
holds the old one.

## One local native module: system-volume

`modules/system-volume` is an Expo local module, Swift and Kotlin, and it exists for
iOS: WKWebView ignores an HTML5 `volume` assignment, so the player's volume slider
has nothing to move except the device's own volume. It also puts the iOS audio
session into `.playback`, without which the ringer switch silences every video.

Native code is not reloaded by Metro. After changing it:

```sh
npx expo prebuild --platform android && npx expo run:android
npx expo prebuild --platform ios && npx expo run:ios
```

A missing rebuild shows up as `Cannot find native module 'SystemVolume'`.

## Adding a workspace package needs Metro restarted

Metro resolves `@repo/*` through pnpm's symlinks and caches that resolution. Adding a
new workspace dependency while it is running gives you a one-module incremental
refresh against a resolver that has never seen the package — which surfaces as the app
sitting on its splash screen forever, with nothing in the log, because the import
resolved to nothing.

```sh
pkill -f "expo start" && pnpm --filter mobile dev -- --clear
```

Not a problem with the config below; just the order things have to happen in.

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

## App Store credentials live outside this repo

`eas.json` carries only the two identifiers that are safe in a public repo — the
App Store Connect app id and the Apple team id. The App Store Connect API key is
not here, and must not be: this repository is public, and the key's id and issuer
are two thirds of a credential whose third part is a file anyone can lose track of.
The path would be wrong on every machine but the one that downloaded it, besides.

`eas submit` reads the rest from the environment:

```sh
export EXPO_ASC_API_KEY_PATH=/path/to/AuthKey_XXXXXXXXXX.p8
export EXPO_ASC_KEY_ID=XXXXXXXXXX
export EXPO_ASC_ISSUER_ID=00000000-0000-0000-0000-000000000000
eas submit -p ios --profile production --latest
```

The same three variables let `eas build` create the distribution certificate and
provisioning profile without an Apple ID password or a 2FA prompt. Two more are
worth having on hand for that first run:

```sh
export EXPO_APPLE_TEAM_ID=MW937H8CVY EXPO_APPLE_TEAM_TYPE=INDIVIDUAL
export EXPO_NO_CAPABILITY_SYNC=1
```

`EXPO_NO_CAPABILITY_SYNC` is the one that is not obvious. EAS syncs the bundle id's
capabilities on every build, and Apple's API rejects the request it sends for a
capability that is off — `PUSH_NOTIFICATIONS: OFF` fails the whole build with
`Unexpected or invalid value at 'data.relationships.bundleIdCapabilities'`. This app
needs no capabilities at all, so the sync has nothing to do and is better skipped.

The key itself is generated at App Store Connect → Users and Access → Integrations,
with Admin access — App Manager cannot create certificates. Apple lets the `.p8`
be downloaded once, so a lost key means generating a new one.

## The iOS bundle identifier is not the Android package

iOS ships as `uz.kidtube.mobile`, Android as `uz.kidtube.app`. They disagree because
the App Store Connect record was created under the former, and a build whose
identifier does not match the record cannot be signed or submitted. Changing either
one to agree with the other would orphan a store listing; leave them as they are.
