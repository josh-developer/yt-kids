import styles from "./switch.module.css";
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
    <label className={styles.switch}>
      <input checked={isChecked} type="checkbox" onChange={onToggle} />
      <span className={styles.switchTrack} aria-hidden="true" />
      <span className={styles.srOnly}>{label}</span>
    </label>
  );
}
