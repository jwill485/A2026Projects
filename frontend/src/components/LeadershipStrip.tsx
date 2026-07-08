import "./LeadershipStrip.css";

// The always-visible fill indicator shown on every company/platoon/squad
// header in the Drag & Drop rework: a row of billet dots (filled/vacant)
// instead of leadership completeness being something you have to expand a
// tree or visit Analytics to see. Vacant dots are clickable — same
// candidate-picker assignment as a vacant slot's own button — so the strip
// doubles as a shortcut, not just a readout.
export interface StripBillet {
  label: string;
  filled: boolean;
  // Who's there (filled) or what to show on hover (vacant); omit for none.
  detail?: string;
  onClick?: () => void;
}

export function LeadershipStrip({ billets }: { billets: StripBillet[] }) {
  return (
    <span className="leadership-strip">
      {billets.map((b) => (
        <button
          key={b.label}
          type="button"
          className={`strip-dot${b.filled ? " strip-filled" : " strip-vacant"}`}
          title={b.detail ? `${b.label}: ${b.detail}` : b.filled ? b.label : `${b.label}: vacant — click to assign`}
          onClick={
            b.onClick
              ? (e) => {
                  // These dots sit inside a <summary> — stop the click from
                  // also toggling that <details> open/closed.
                  e.stopPropagation();
                  b.onClick!();
                }
              : undefined
          }
          disabled={!b.onClick}
        >
          <span className="strip-symbol">{b.filled ? "●" : "○"}</span>
          <span className="strip-label">{b.label}</span>
        </button>
      ))}
    </span>
  );
}
