import type { MouseEvent, ReactNode } from "react";
import primitives from "./primitives.module.css";

/**
 * Every icon button in the app pairs an `aria-label` with the identical
 * `data-tooltip`. Doing that in one place keeps the two from drifting apart.
 */
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
  tooltip?: string;
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
      data-tooltip={tooltip}
      data-tooltip-align={tooltipAlign}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      {children}
    </button>
  );
}
