import { useState } from "react";
import type { Group, GroupRequirement } from "./types";

interface ClassMultiPickerProps {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}

function ClassMultiPicker({ options, selected, onChange }: ClassMultiPickerProps) {
  const [filter, setFilter] = useState("");
  const visible = options.filter((o) => o.toLowerCase().includes(filter.toLowerCase()));

  function toggle(cls: string) {
    if (selected.includes(cls)) onChange(selected.filter((c) => c !== cls));
    else onChange([...selected, cls]);
  }

  return (
    <div className="class-picker">
      <input
        type="text"
        className="class-picker-filter"
        placeholder="Filter classes…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <div className="class-picker-list">
        {visible.length === 0 && <p className="class-picker-empty">No matching classes.</p>}
        {visible.map((cls) => (
          <label key={cls} className="class-picker-row">
            <input type="checkbox" checked={selected.includes(cls)} onChange={() => toggle(cls)} />
            {cls}
          </label>
        ))}
      </div>
      {selected.length > 0 && (
        <p className="class-picker-selected-count">
          {selected.length} variant{selected.length === 1 ? "" : "s"} selected
        </p>
      )}
    </div>
  );
}

interface GroupEditorProps {
  classOptions: string[];
  initial?: Group;
  onSave: (name: string, requirements: GroupRequirement[]) => void;
  onCancel: () => void;
}

export function GroupEditor({ classOptions, initial, onSave, onCancel }: GroupEditorProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [requirements, setRequirements] = useState<GroupRequirement[]>(
    initial ? initial.requirements.map((r) => ({ ...r })) : [{ label: "", acceptedClasses: [] }],
  );

  function updateRequirement(index: number, patch: Partial<GroupRequirement>) {
    setRequirements((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addRequirement() {
    setRequirements((prev) => [...prev, { label: "", acceptedClasses: [] }]);
  }

  function removeRequirement(index: number) {
    setRequirements((prev) => prev.filter((_, i) => i !== index));
  }

  const canSave =
    name.trim() !== "" &&
    requirements.length > 0 &&
    requirements.every((r) => r.label.trim() !== "" && r.acceptedClasses.length > 0);

  return (
    <div className="group-editor">
      <label className="group-editor-name">
        Group name
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Sniper Qualification"
        />
      </label>

      <h4>Requirements</h4>
      {requirements.map((req, i) => (
        <div key={i} className="requirement-row">
          <div className="requirement-row-header">
            <input
              type="text"
              value={req.label}
              onChange={(e) => updateRequirement(i, { label: e.target.value })}
              placeholder="Requirement name (e.g. Sniper Course)"
            />
            {requirements.length > 1 && (
              <button type="button" className="remove-requirement" onClick={() => removeRequirement(i)}>
                Remove
              </button>
            )}
          </div>
          <p className="requirement-hint">
            Select every class-text variant that should satisfy this requirement — usually just one, but
            pick more than one if the same class has been logged under different wording.
          </p>
          <ClassMultiPicker
            options={classOptions}
            selected={req.acceptedClasses}
            onChange={(next) => updateRequirement(i, { acceptedClasses: next })}
          />
        </div>
      ))}
      <button type="button" className="add-requirement" onClick={addRequirement}>
        + Add requirement
      </button>

      <div className="group-editor-actions">
        <button
          type="button"
          className="save-group"
          disabled={!canSave}
          onClick={() => onSave(name.trim(), requirements)}
        >
          {initial ? "Save changes" : "Create group"}
        </button>
        <button type="button" className="cancel-group" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
