import type { ChangeLogEntry } from "../lib/persistence";
import "./ChangeLogPanel.css";

function formatEntry(entry: ChangeLogEntry): string {
  const header = `Saved ${new Date(entry.timestamp).toLocaleString()}`;
  return [header, ...entry.changes.map((c) => `  - ${c}`)].join("\n");
}

function copyText(text: string): void {
  navigator.clipboard.writeText(text).catch(() => {});
}

export function ChangeLogPanel({ entries }: { entries: ChangeLogEntry[] }) {
  if (entries.length === 0) {
    return <p className="changelog-empty">No saved changes yet.</p>;
  }
  return (
    <div className="changelog-panel">
      {entries.map((entry) => (
        <div className="changelog-entry" key={entry.timestamp}>
          <div className="changelog-entry-header">
            <span>{new Date(entry.timestamp).toLocaleString()}</span>
            <button onClick={() => copyText(formatEntry(entry))}>Copy</button>
          </div>
          <pre>{entry.changes.map((c) => `- ${c}`).join("\n")}</pre>
        </div>
      ))}
    </div>
  );
}
