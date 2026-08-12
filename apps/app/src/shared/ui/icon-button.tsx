import type { MouseEvent, ReactNode } from "react";
import primitives from "./primitives.module.css";

/** Icon buttons use their label as the tooltip unless a caller opts out. */
export function IconButton({
  label,
  tooltip = label,
  tooltipAlign,
  children,
  className = "",
  isActive = false,
  isDisabled = false,
  isExpanded,
  isPressed,
  onClick,
  onDoubleClick,
}: {
  label: string;
  tooltip?: string | null;
  /** "end" keeps the bubble from running past the viewport's edge for a
   * button that sits at it — see `[data-tooltip-align="end"]` in globals.css. */
  tooltipAlign?: "end";
  children: ReactNode;
  className?: string;
  isActive?: boolean;
  isDisabled?: boolean;
  isExpanded?: boolean;
  isPressed?: boolean;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  onDoubleClick?: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const tooltipProps = tooltip
    ? {
        "data-tooltip": tooltip,
        "data-tooltip-align": tooltipAlign,
      }
    : undefined;

  return (
    <button
      className={`${primitives.iconButton} ${
        isActive ? primitives.active : ""
      } ${className}`.trim()}
      type="button"
      disabled={isDisabled}
      aria-label={label}
      aria-expanded={isExpanded}
      aria-pressed={isPressed}
      {...tooltipProps}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      {children}
    </button>
  );
}
