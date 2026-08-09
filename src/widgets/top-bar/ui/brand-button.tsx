"use client";

import { Play } from "lucide-react";
import { useTranslations } from "next-intl";

export function BrandButton({ onClick }: { onClick: () => void }) {
  const t = useTranslations("TopBar");

  return (
    <button
      className="brand"
      type="button"
      onClick={onClick}
      aria-label={t("goHome")}
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
  );
}
