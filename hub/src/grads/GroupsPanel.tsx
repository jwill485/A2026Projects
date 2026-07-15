import { useState } from "react";
import { GroupEditor } from "./GroupEditor";
import type { Group, GroupRequirement } from "./types";

interface GroupsPanelProps {
  groups: Group[];
  classOptions: string[];
  onCreate: (name: string, requirements: GroupRequirement[]) => Promise<void>;
  onUpdate: (id: string, name: string, requirements: GroupRequirement[]) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
}

export function GroupsPanel({ groups, classOptions, onCreate, onUpdate, onDelete, onClose }: GroupsPanelProps) {
  const [mode, setMode] = useState<"list" | "create" | string>("list");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const editingGroup = mode !== "list" && mode !== "create" ? groups.find((g) => g.id === mode) : undefined;

  async function handleSave(name: string, requirements: GroupRequirement[]) {
    if (mode === "create") await onCreate(name, requirements);
    else if (editingGroup) await onUpdate(editingGroup.id, name, requirements);
    setMode("list");
  }

  return (
    <div className="groups-panel-overlay" onClick={onClose}>
      <div className="groups-panel" onClick={(e) => e.stopPropagation()}>
        <div className="groups-panel-header">
          <h3>Custom Requirement Groups</h3>
          <button type="button" className="close-panel" onClick={onClose}>
            ✕
          </button>
        </div>

        {mode === "list" && (
          <>
            {groups.length === 0 && (
              <p className="groups-empty">
                No custom groups yet — create one to track any set of classes as a named
                qualification, the same way WW2 Ranger Selection Requirement works.
              </p>
            )}
            <ul className="groups-list">
              {groups.map((g) => (
                <li key={g.id}>
                  <div>
                    <strong>{g.name}</strong>
                    <span className="groups-list-count">
                      {" "}
                      · {g.requirements.length} requirement{g.requirements.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="groups-list-actions">
                    <button type="button" onClick={() => setMode(g.id)}>
                      Edit
                    </button>
                    {confirmDeleteId === g.id ? (
                      <>
                        <span className="confirm-delete-label">Delete?</span>
                        <button
                          type="button"
                          className="confirm-delete-yes"
                          onClick={async () => {
                            await onDelete(g.id);
                            setConfirmDeleteId(null);
                          }}
                        >
                          Yes
                        </button>
                        <button type="button" onClick={() => setConfirmDeleteId(null)}>
                          No
                        </button>
                      </>
                    ) : (
                      <button type="button" onClick={() => setConfirmDeleteId(g.id)}>
                        Delete
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <button type="button" className="new-group-button" onClick={() => setMode("create")}>
              + New Group
            </button>
          </>
        )}

        {mode !== "list" && (
          <GroupEditor
            classOptions={classOptions}
            initial={editingGroup}
            onSave={handleSave}
            onCancel={() => setMode("list")}
          />
        )}
      </div>
    </div>
  );
}
