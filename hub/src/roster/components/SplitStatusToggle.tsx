import type { SplitStatus } from "../types/roster";
import "./SplitStatusToggle.css";

const OPTIONS: { value: SplitStatus; label: string; title: string }[] = [
  { value: "neutral", label: "N", title: "Neutral (undecided)" },
  { value: "hllv", label: "HLLV", title: "Assign to HLLV" },
  { value: "hllww2", label: "HLLWW2", title: "Assign to HLLWW2" },
];

export function SplitStatusToggle({
  status,
  onChange,
}: {
  status: SplitStatus;
  onChange: (next: SplitStatus) => void;
}) {
  return (
    <span className="split-status-toggle">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`split-status-btn split-status-${opt.value}${status === opt.value ? " active" : ""}`}
          title={opt.title}
          onClick={(e) => {
            e.stopPropagation();
            onChange(opt.value);
          }}
        >
          {opt.label}
        </button>
      ))}
    </span>
  );
}
