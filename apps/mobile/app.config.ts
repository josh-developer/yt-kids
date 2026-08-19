import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * `app.json`, plus whatever a television build needs on top of it.
 *
 * The static file stays the source of truth for everything both targets share — the name,
 * the bundle identifiers, the update channel, the blocked permissions. This file only ever
 * *adds*, and only when `EXPO_TV` is set, so a phone prebuild produces byte-for-byte what
 * it produced before this existed.
 *
 * One project rather than two. `react-native-tvos` is a superset of React Native that
 * builds for phone and for TV from the same source, so the difference between the two
 * artifacts is native configuration — a launcher intent, a banner, an ABI list — and
 * native configuration is generated. There is no second app to keep in step.
 *
 *     npx expo prebuild --clean                 # phone and tablet
 *     EXPO_TV=1 npx expo prebuild --clean       # Android TV and Fire TV
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const isTV = process.env.EXPO_TV === "1" || process.env.EXPO_TV === "true";

  const plugins = [
    ...(config.plugins ?? []),
    [
      "@react-native-tvos/config-tv",
      {
        isTV,
        /**
         * `false`, so one artifact installs on a phone and a television alike.
         *
         * `true` would mark the build TV-only. Play still lists an app for the TV form
         * factor on the strength of the leanback *launcher intent* and the banner, both of
         * which the plugin writes either way, so requiring the feature buys nothing here
         * and costs the ability to sideload a build onto a phone to check it.
         */
        androidTVRequired: false,
        androidTVBanner: "./assets/tv-banner.png",
        androidTVIcon: "./assets/tv-icon.png",
        /** Flipper is gone from React Native at this version; its leftovers break the build. */
        removeFlipperOnAndroid: true,
      },
    ],
  ];

  if (!isTV) {
    return { ...config, plugins } as ExpoConfig;
  }

  return {
    ...config,
    plugins: plugins.map(withTVBuildProperties),
    android: {
      ...config.android,
      /**
       * A television is landscape and stays landscape. The plugin also strips
       * `screenOrientation` from the manifest, since a TV activity that asks for one is an
       * activity the system has to fight.
       */
      screenOrientation: "landscape",
    },
  } as ExpoConfig;
};

/**
 * Widens the ABI list for the TV build, and only for it.
 *
 * `buildArchs` is the key `expo-build-properties` reads — it writes
 * `reactNativeArchitectures` into `gradle.properties`. `abiFilters`, which this config
 * carried for a while, is not an option the plugin has ever had, so it was silently
 * ignored and every prebuild produced all four ABIs.
 *
 * The phone build ships `arm64-v8a` alone, which is right for phones — 32-bit Android
 * phones are long gone and the filter is what keeps the APK at 31MB. Televisions are not
 * phones: **every Fire TV stick is `armeabi-v7a`**, and a good deal of the cheaper Android
 * TV and Google TV hardware is too. Shipping arm64 alone would leave most of the market
 * unable to install the app, with no error to explain why — the device simply would not see
 * it in the store.
 *
 * `x86` and `x86_64` are left out on purpose. They exist almost only on emulators, and the
 * TV emulator images that matter run under `arm64-v8a` on an Apple Silicon machine.
 */
function withTVBuildProperties(plugin: unknown) {
  if (!Array.isArray(plugin) || plugin[0] !== "expo-build-properties") {
    return plugin;
  }

  const [name, options] = plugin as [string, { android?: Record<string, unknown> }];

  return [
    name,
    {
      ...options,
      android: {
        ...options.android,
        buildArchs: ["arm64-v8a", "armeabi-v7a"],
      },
    },
  ];
}
