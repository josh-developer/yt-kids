import type { MouseEvent, ReactNode } from "react";
import primitives from "./primitives.module.css";
import { Tooltip } from "./tooltip";

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
  tooltip?: string | null;
  children: ReactNode;
  className?: string;
  isActive?: boolean;
  isDisabled?: boolean;
  isExpanded?: boolean;
  isPressed?: boolean;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  onDoubleClick?: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const button = (
    <button
      className={`${primitives.iconButton} ${
        isActive ? primitives.active : ""
      } ${className}`.trim()}
      type="button"
      disabled={isDisabled}
      aria-label={label}
      aria-expanded={isExpanded}
      aria-pressed={isPressed}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      {children}
    </button>
  );

  return tooltip ? <Tooltip label={tooltip}>{button}</Tooltip> : button;
}
