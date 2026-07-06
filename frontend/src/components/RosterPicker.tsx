import { useState } from "react";
import type { RosterSummary } from "../lib/persistence";
import "./SoldierForm.css";

function NewRosterModal({
  onCancel,
  onSubmit,
}: {
  onCancel: () => void;
  onSubmit: (name: string, mode: "blank" | "duplicate") => void;
}) {
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"blank" | "duplicate">("blank");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit(name.trim(), mode);
  }

  return (
    <div className="soldier-form-backdrop" onClick={onCancel}>
      <form className="soldier-form" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h3>New Roster</h3>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>
        <label>
          Start from
          <select value={mode} onChange={(e) => setMode(e.target.value as "blank" | "duplicate")}>
            <option value="blank">Blank</option>
            <option value="duplicate">Duplicate current roster</option>
          </select>
        </label>
        <div className="soldier-form-actions">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" disabled={!name.trim()}>
            Create
          </button>
        </div>
      </form>
    </div>
  );
}

function RenameRosterModal({
  initialName,
  onCancel,
  onSubmit,
}: {
  initialName: string;
  onCancel: () => void;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState(initialName);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit(name.trim());
  }

  return (
    <div className="soldier-form-backdrop" onClick={onCancel}>
      <form className="soldier-form" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h3>Rename Roster</h3>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>
        <div className="soldier-form-actions">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" disabled={!name.trim()}>
            Save
          </button>
        </div>
      </form>
    </div>
  );
}

export function RosterPicker({
  rosterList,
  activeRosterId,
  onSwitch,
  onCreate,
  onRename,
  onDelete,
}: {
  rosterList: RosterSummary[];
  activeRosterId: string;
  onSwitch: (id: string) => void;
  onCreate: (name: string, mode: "blank" | "duplicate") => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const activeName = rosterList.find((r) => r.id === activeRosterId)?.name ?? "";

  return (
    <div className="roster-group">
      <select value={activeRosterId} onChange={(e) => onSwitch(e.target.value)}>
        {rosterList.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
      <button className="add-btn" onClick={() => setCreating(true)}>
        + New Roster
      </button>
      <button onClick={() => setRenaming(true)}>Rename</button>
      <button
        className="revert-btn"
        onClick={() => onDelete(activeRosterId)}
        disabled={rosterList.length <= 1}
      >
        Delete
      </button>

      {creating && (
        <NewRosterModal
          onCancel={() => setCreating(false)}
          onSubmit={(name, mode) => {
            onCreate(name, mode);
            setCreating(false);
          }}
        />
      )}
      {renaming && (
        <RenameRosterModal
          initialName={activeName}
          onCancel={() => setRenaming(false)}
          onSubmit={(name) => {
            onRename(activeRosterId, name);
            setRenaming(false);
          }}
        />
      )}
    </div>
  );
}
