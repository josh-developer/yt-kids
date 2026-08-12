import {
  FloatingArrow,
  FloatingPortal,
  arrow,
  autoUpdate,
  flip,
  offset,
  shift,
  useDismiss,
  useFloating,
  useFocus,
  useHover,
  useInteractions,
  useRole,
  type Placement,
} from "@floating-ui/react";
import {
  cloneElement,
  useId,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import styles from "./tooltip.module.css";

type TooltipChild = ReactElement<Record<string, unknown>>;

export function Tooltip({
  children,
  isDisabled = false,
  isOpen,
  label,
  placement = "top",
  role = "tooltip",
}: {
  children: ReactElement;
  isDisabled?: boolean;
  isOpen?: boolean;
  label: ReactNode;
  placement?: Placement;
  role?: "tooltip" | "status";
}) {
  const generatedId = useId();
  const [arrowElement, setArrowElement] = useState<SVGSVGElement | null>(null);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = isOpen !== undefined;
  const open = !isDisabled && Boolean(label) && (isOpen ?? uncontrolledOpen);

  const { context, floatingStyles, refs } = useFloating({
    open,
    onOpenChange: isControlled ? undefined : setUncontrolledOpen,
    placement,
    middleware: [
      offset(10),
      flip({ padding: 8 }),
      shift({ padding: 8 }),
      arrowElement ? arrow({ element: arrowElement, padding: 8 }) : null,
    ],
    whileElementsMounted: autoUpdate,
  });

  const hover = useHover(context, {
    delay: { open: 300, close: 70 },
    enabled: !isControlled,
    move: false,
  });
  const focus = useFocus(context, { enabled: !isControlled });
  const dismiss = useDismiss(context);
  const tooltipRole = useRole(context, { role: "tooltip" });
  const { getFloatingProps, getReferenceProps } = useInteractions([
    hover,
    focus,
    dismiss,
    tooltipRole,
  ]);

  const trigger = children as TooltipChild;
  const describedBy = open && role === "tooltip" ? generatedId : undefined;
  const triggerProps = getReferenceProps({
    ...trigger.props,
    ref: refs.setReference,
    "aria-describedby": describedBy,
  });

  return (
    <>
      {cloneElement(trigger, triggerProps)}
      {open ? (
        <FloatingPortal>
          <div
            {...getFloatingProps({
              className: styles.tooltip,
              id: generatedId,
              role,
              style: floatingStyles,
              ...(role === "status"
                ? { "aria-live": "polite" as const }
                : undefined),
            })}
          >
            {label}
            <FloatingArrow
              ref={setArrowElement}
              context={context}
              className={styles.arrow}
            />
          </div>
        </FloatingPortal>
      ) : null}
    </>
  );
}
