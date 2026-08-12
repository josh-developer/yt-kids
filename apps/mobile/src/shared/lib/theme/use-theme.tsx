import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useColorScheme } from "react-native";
import { paletteFor, type Palette, type ThemeName } from "../../config/theme";
import { STORAGE_KEYS } from "../../config/app-config";
import { readPreference, writePreference } from "../storage/preferences";

/**
 * The active palette: a stored choice if there is one, otherwise the device's.
 *
 * The same rule as the web's `useTheme` — "stored choice wins; otherwise the device
 * preference decides" — with one difference that matters. A phone can change its
 * appearance while the app is open, so as long as nobody has chosen explicitly, the
 * palette follows `useColorScheme()` live rather than being sampled once at start.
 * After a deliberate toggle it stops following, because a viewer who picked light
 * did not mean "light until sunset".
 */
type ThemeValue = {
  name: ThemeName;
  colors: Palette;
  isReady: boolean;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeValue | null>(null);

function isThemeName(value: string | null): value is ThemeName {
  return value === "light" || value === "dark";
}

export function ThemeProvider({
  children,
  override,
}: {
  children: ReactNode;
  /** Pins the palette, for rendering a screen under a known theme in a test. */
  override?: ThemeName;
}) {
  const scheme = useColorScheme();
  const [chosen, setChosen] = useState<ThemeName | null>(null);
  // The first paint waits for the stored choice: painting light and flipping to
  // dark is worse than a few hundred milliseconds of splash.
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const stored = await readPreference(STORAGE_KEYS.theme);
      if (cancelled) {
        return;
      }

      if (isThemeName(stored)) {
        setChosen(stored);
      }

      setIsReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = useCallback(() => {
    setChosen((current) => {
      // Nothing chosen yet means the device is deciding, so the first tap has to
      // move away from whatever the device currently says.
      const base = current ?? (scheme === "dark" ? "dark" : "light");
      const next: ThemeName = base === "dark" ? "light" : "dark";
      void writePreference(STORAGE_KEYS.theme, next);
      return next;
    });
  }, [scheme]);

  const name: ThemeName =
    override ?? chosen ?? (scheme === "dark" ? "dark" : "light");

  const value = useMemo(
    () => ({ name, colors: paletteFor(name), isReady, toggle }),
    [isReady, name, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error("useTheme must be used inside a ThemeProvider");
  }

  return value;
}
