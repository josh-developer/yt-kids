/** Checkbox styled as a track and knob; the label is for screen readers. */
export function Switch({
  isChecked,
  label,
  onToggle,
}: {
  isChecked: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <label className="switch">
      <input checked={isChecked} type="checkbox" onChange={onToggle} />
      <span className="switch-track" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </label>
  );
}
