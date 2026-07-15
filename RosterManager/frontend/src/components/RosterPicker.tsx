import { useState } from "react";
import type { RosterConfiguration, RosterSummary } from "../lib/persistence";
import "./SoldierForm.css";

function configurationLabel(configuration: RosterConfiguration | undefined): string {
  if (configuration === "old") return "Old";
  if (configuration === "new") return "New";
  return "";
}

function ConfigurationSelect({
  value,
  onChange,
}: {
  value: RosterConfiguration | "";
  onChange: (value: RosterConfiguration | undefined) => void;
}) {
  return (
    <label>
      Configuration
      <select
        value={value}
        onChange={(e) => onChange((e.target.value || undefined) as RosterConfiguration | undefined)}
      >
        <option value="">None</option>
        <option value="old">Old (pre-split)</option>
        <option value="new">New (post-split)</option>
      </select>
    </label>
  );
}

function NewRosterModal({
  onCancel,
  onSubmit,
}: {
  onCancel: () => void;
  onSubmit: (name: string, mode: "blank" | "duplicate", configuration: RosterConfiguration | undefined) => void;
}) {
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"blank" | "duplicate">("blank");
  const [configuration, setConfiguration] = useState<RosterConfiguration | "">("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit(name.trim(), mode, configuration || undefined);
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
        <ConfigurationSelect value={configuration} onChange={(v) => setConfiguration(v ?? "")} />
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
  initialConfiguration,
  onCancel,
  onSubmit,
}: {
  initialName: string;
  initialConfiguration: RosterConfiguration | undefined;
  onCancel: () => void;
  onSubmit: (name: string, configuration: RosterConfiguration | undefined) => void;
}) {
  const [name, setName] = useState(initialName);
  const [configuration, setConfiguration] = useState<RosterConfiguration | "">(initialConfiguration ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit(name.trim(), configuration || undefined);
  }

  return (
    <div className="soldier-form-backdrop" onClick={onCancel}>
      <form className="soldier-form" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h3>Edit Roster</h3>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>
        <ConfigurationSelect value={configuration} onChange={(v) => setConfiguration(v ?? "")} />
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
  onCreate: (name: string, mode: "blank" | "duplicate", configuration: RosterConfiguration | undefined) => void;
  onRename: (id: string, name: string, configuration: RosterConfiguration | undefined) => void;
  onDelete: (id: string) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const active = rosterList.find((r) => r.id === activeRosterId);

  return (
    <div className="roster-group">
      <select value={activeRosterId} onChange={(e) => onSwitch(e.target.value)}>
        {rosterList.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
            {r.configuration ? ` (${configurationLabel(r.configuration)})` : ""}
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
          onSubmit={(name, mode, configuration) => {
            onCreate(name, mode, configuration);
            setCreating(false);
          }}
        />
      )}
      {renaming && active && (
        <RenameRosterModal
          initialName={active.name}
          initialConfiguration={active.configuration}
          onCancel={() => setRenaming(false)}
          onSubmit={(name, configuration) => {
            onRename(activeRosterId, name, configuration);
            setRenaming(false);
          }}
        />
      )}
    </div>
  );
}
