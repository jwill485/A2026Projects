import type { ChangeLogEntry } from "../lib/persistence";
import "./ChangeLogPanel.css";

function formatEntry(entry: ChangeLogEntry): string {
  const header = `Saved ${new Date(entry.timestamp).toLocaleString()}`;
  return [header, ...entry.changes.map((c) => `  - ${c}`)].join("\n");
}

function copyText(text: string): void {
  navigator.clipboard.writeText(text).catch(() => {});
}

export function ChangeLogPanel({
  entries,
  onClearAll,
  onDeleteEntry,
}: {
  entries: ChangeLogEntry[];
  onClearAll: () => void;
  onDeleteEntry: (timestamp: string) => void;
}) {
  if (entries.length === 0) {
    return <p className="changelog-empty">No saved changes yet.</p>;
  }
  return (
    <div className="changelog-panel">
      <div className="changelog-toolbar">
        <button onClick={onClearAll}>Clear All</button>
      </div>
      {entries.map((entry) => (
        <div className="changelog-entry" key={entry.timestamp}>
          <div className="changelog-entry-header">
            <span>{new Date(entry.timestamp).toLocaleString()}</span>
            <span className="changelog-entry-actions">
              <button onClick={() => copyText(formatEntry(entry))}>Copy</button>
              <button onClick={() => onDeleteEntry(entry.timestamp)}>Delete</button>
            </span>
          </div>
          <pre>{entry.changes.map((c) => `- ${c}`).join("\n")}</pre>
        </div>
      ))}
    </div>
  );
}
