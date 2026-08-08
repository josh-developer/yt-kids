"use client";

import { Languages, Moon, Play, Plus, RotateCcw, Search, Sun } from "lucide-react";
import type { CopyText } from "../lib/copy";
import type { AppRoute, Language, Theme } from "../lib/types";

export function TopBar({
  copy,
  homeQuery,
  isHidden,
  language,
  theme,
  view,
  onHome,
  onSearchSubmit,
  onHomeQueryChange,
  onSettings,
  onShuffle,
  onThemeToggle,
  onLanguageToggle,
}: {
  copy: CopyText;
  homeQuery: string;
  isHidden: boolean;
  language: Language;
  theme: Theme;
  view: AppRoute["view"];
  onHome: () => void;
  onSearchSubmit: () => void;
  onHomeQueryChange: (value: string) => void;
  onSettings: () => void;
  onShuffle: () => void;
  onThemeToggle: () => void;
  onLanguageToggle: () => void;
}) {
  return (
    <header className={`topbar ${isHidden ? "topbar-hidden" : ""}`}>
      <button
        className="brand"
        type="button"
        onClick={onHome}
        aria-label={copy.goHome}
      >
        <span className="brand-mark">
          <Play size={18} fill="currentColor" />
        </span>
        <span className="brand-name" aria-label="KidTube">
          <span className="brand-kid" aria-hidden="true">
            <span className="brand-letter brand-letter-k">K</span>
            <span className="brand-letter brand-letter-i">i</span>
            <span className="brand-letter brand-letter-d">d</span>
          </span>
          <span className="brand-tube">Tube</span>
        </span>
      </button>

      <div className="top-search-slot">
        <form
          className="search-wrap"
          onSubmit={(event) => {
            event.preventDefault();
            onSearchSubmit();
          }}
        >
          <input
            value={homeQuery}
            onChange={(event) => onHomeQueryChange(event.target.value)}
            placeholder={copy.searchApprovedVideos}
            aria-label={copy.searchApprovedVideos}
          />
          <button
            className="search-button"
            type="submit"
            aria-label={copy.search}
            data-tooltip={copy.search}
          >
            <Search size={20} />
          </button>
        </form>
      </div>

      <div className="top-actions">
        <button
          className="icon-button"
          type="button"
          onClick={onShuffle}
          aria-label={copy.shuffleHome}
          data-tooltip={copy.shuffleHome}
        >
          <RotateCcw size={19} />
        </button>
        <button
          className="icon-button"
          type="button"
          onClick={onThemeToggle}
          aria-label={theme === "dark" ? copy.useLightMode : copy.useDarkMode}
          data-tooltip={theme === "dark" ? copy.useLightMode : copy.useDarkMode}
        >
          {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
        </button>
        <button
          className={`icon-button ${view === "settings" ? "active" : ""}`}
          type="button"
          onClick={onSettings}
          aria-label={copy.parentSettings}
          data-tooltip={copy.parentSettings}
        >
          <Plus size={19} />
        </button>
        <button
          className="language-button"
          type="button"
          onClick={onLanguageToggle}
          aria-label={copy.switchLanguage}
          data-tooltip={copy.switchLanguage}
        >
          <Languages size={18} />
          <span>{language === "en" ? "UZ" : "EN"}</span>
        </button>
      </div>
    </header>
  );
}
