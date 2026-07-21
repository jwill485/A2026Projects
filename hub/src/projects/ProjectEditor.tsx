import { useState } from "react";
import { PRIORITY_LABELS, PRIORITY_ORDER, STATUS_LABELS, STATUS_ORDER } from "./constants";
import type { Priority, Project, ProjectInput, Status } from "./types";

interface ProjectEditorProps {
  initial?: Project;
  onSave: (input: ProjectInput) => void;
  onCancel: () => void;
}

export function ProjectEditor({ initial, onSave, onCancel }: ProjectEditorProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [status, setStatus] = useState<Status>(initial?.status ?? "planning");
  const [owner, setOwner] = useState(initial?.owner ?? "");
  const [priority, setPriority] = useState<Priority>(initial?.priority ?? "medium");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [targetDate, setTargetDate] = useState(initial?.targetDate ?? "");

  const canSave = name.trim() !== "";

  function handleSave() {
    onSave({
      name: name.trim(),
      description: description.trim(),
      status,
      owner: owner.trim(),
      priority,
      category: category.trim(),
      targetDate: targetDate.trim() || null,
    });
  }

  return (
    <div className="project-editor">
      <label className="project-field">
        Name
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Fall Recruiting Drive"
        />
      </label>

      <label className="project-field">
        Description
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
      </label>

      <div className="project-field-row">
        <label className="project-field">
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value as Status)}>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="project-field">
          Priority
          <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
            {PRIORITY_ORDER.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="project-field-row">
        <label className="project-field">
          Owner
          <input
            type="text"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            placeholder="e.g. Cameron.W"
          />
        </label>
        <label className="project-field">
          Category
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. Recruiting"
          />
        </label>
      </div>

      <label className="project-field">
        Target Date
        <input type="date" value={targetDate ?? ""} onChange={(e) => setTargetDate(e.target.value)} />
      </label>

      <div className="project-editor-actions">
        <button type="button" className="save-project" disabled={!canSave} onClick={handleSave}>
          {initial ? "Save changes" : "Create project"}
        </button>
        <button type="button" className="cancel-project" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
