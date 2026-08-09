import type { MouseEvent, ReactNode } from "react";

/**
 * Every icon button in the app pairs an `aria-label` with the identical
 * `data-tooltip`. Doing that in one place keeps the two from drifting apart.
 */
export function IconButton({
  label,
  tooltip = label,
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
      className={`icon-button ${isActive ? "active" : ""} ${className}`.trim()}
      type="button"
      disabled={isDisabled}
      aria-label={label}
      aria-expanded={isExpanded}
      aria-pressed={isPressed}
      data-tooltip={tooltip}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      {children}
    </button>
  );
}
