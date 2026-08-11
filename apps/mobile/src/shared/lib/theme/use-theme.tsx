import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import { paletteFor, type Palette, type ThemeName } from "../../config/theme";

/**
 * The active palette, follows the OS.
 *
 * The web app publishes its theme as `data-theme` on the shell so any slice can
 * style itself without reaching for another slice; a context is the same idea in
 * React Native. It is a context rather than a bare `useColorScheme()` call at
 * each site so a future in-app theme toggle — the web has one — has somewhere to
 * override from, and so screens can be rendered under a fixed palette in tests.
 */
type ThemeValue = { name: ThemeName; colors: Palette };

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({
  children,
  override,
}: {
  children: ReactNode;
  override?: ThemeName;
}) {
  const scheme = useColorScheme();
  const name: ThemeName = override ?? (scheme === "dark" ? "dark" : "light");
  const value = useMemo(() => ({ name, colors: paletteFor(name) }), [name]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error("useTheme must be used inside a ThemeProvider");
  }

  return value;
}
