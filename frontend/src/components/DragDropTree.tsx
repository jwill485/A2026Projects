import { createContext, useContext, useState } from "react";
import { DndContext, useDraggable, useDroppable, type DragEndEvent } from "@dnd-kit/core";
import type { Battalion, Company, Platoon, RosterData, Soldier, Squad } from "../types/roster";
import type { ApiRankExpanded } from "../types/api";
import { moveSoldier, addPlatoon, addSquad, type SlotPath, type SoldierPatch } from "../lib/moveSoldier";
import { SoldierForm, type SoldierFormValues } from "./SoldierForm";
import "./RosterTree.css";
import "./DragDropTree.css";

function slotId(destination: SlotPath): string {
  return JSON.stringify(destination);
}

interface Actions {
  onAddPlatoon: (company: string) => void;
  onAddSquad: (company: string, platoon: string) => void;
  onRequestEdit: (soldier: Soldier) => void;
  onDeleteSoldier: (userId: string) => void;
}

const ActionsContext = createContext<Actions | null>(null);

function useActions(): Actions {
  const ctx = useContext(ActionsContext);
  if (!ctx) throw new Error("ActionsContext missing");
  return ctx;
}

function DraggableSoldier({ soldier }: { soldier: Soldier }) {
  const { onRequestEdit, onDeleteSoldier } = useActions();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: soldier.userId,
  });
  return (
    <span className="draggable-soldier-wrapper">
      <span
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        className={`draggable-soldier${isDragging ? " dragging" : ""}`}
      >
        {soldier.rankShort} {soldier.realName}
        {soldier.username && <span className="soldier-username"> ({soldier.username})</span>}
      </span>
      <button
        type="button"
        className="icon-btn"
        title="Edit soldier"
        onClick={(e) => {
          e.stopPropagation();
          onRequestEdit(soldier);
        }}
      >
        ✎
      </button>
      <button
        type="button"
        className="icon-btn icon-btn-danger"
        title="Delete soldier"
        onClick={(e) => {
          e.stopPropagation();
          onDeleteSoldier(soldier.userId);
        }}
      >
        ✕
      </button>
    </span>
  );
}

function DroppableSlot({
  destination,
  occupied,
  emptyLabel,
  soldier,
}: {
  destination: SlotPath;
  occupied: boolean;
  emptyLabel: string;
  soldier: Soldier | null;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: slotId(destination),
    data: { destination },
  });
  const className = [
    "drop-slot",
    isOver && occupied ? "drop-blocked" : "",
    isOver && !occupied ? "drop-ok" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <span ref={setNodeRef} className={className}>
      {soldier ? <DraggableSoldier soldier={soldier} /> : <span className="vacant">{emptyLabel}</span>}
    </span>
  );
}

function DroppableMemberList({
  destination,
  members,
}: {
  destination: SlotPath;
  members: Soldier[];
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: slotId(destination),
    data: { destination },
  });
  return (
    <ul ref={setNodeRef} className={`member-list drop-slot${isOver ? " drop-ok" : ""}`}>
      {members.map((member) => (
        <li key={member.userId}>
          <DraggableSoldier soldier={member} />
        </li>
      ))}
      {members.length === 0 && <li className="vacant">Drop soldiers here</li>}
    </ul>
  );
}

function DragDropSquad({
  squad,
  company,
  platoon,
}: {
  squad: Squad;
  company: string;
  platoon: string;
}) {
  const leaderDest: SlotPath = { kind: "squadLeader", company, platoon, squad: squad.number };
  const memberDest: SlotPath = { kind: "squadMember", company, platoon, squad: squad.number };
  return (
    <details className="tree-node squad-node" open>
      <summary>
        Squad {squad.number} — Leader:{" "}
        <DroppableSlot
          destination={leaderDest}
          occupied={squad.leader !== null}
          emptyLabel="VACANT"
          soldier={squad.leader}
        />
        <span className="count-badge">{squad.members.length + (squad.leader ? 1 : 0)}</span>
      </summary>
      <DroppableMemberList destination={memberDest} members={squad.members} />
    </details>
  );
}

function DragDropPlatoon({ platoon, company }: { platoon: Platoon; company: string }) {
  const { onAddSquad } = useActions();
  const leaderDest: SlotPath = { kind: "platoonLeader", company, platoon: platoon.number };
  const sergeantDest: SlotPath = { kind: "platoonSergeant", company, platoon: platoon.number };
  const total = platoon.squads.reduce(
    (sum, s) => sum + s.members.length + (s.leader ? 1 : 0),
    0,
  );
  return (
    <details className="tree-node platoon-node" open>
      <summary>
        Platoon {platoon.number} — PL:{" "}
        <DroppableSlot
          destination={leaderDest}
          occupied={platoon.leader !== null}
          emptyLabel="VACANT"
          soldier={platoon.leader}
        />{" "}
        | PSG:{" "}
        <DroppableSlot
          destination={sergeantDest}
          occupied={platoon.sergeant !== null}
          emptyLabel="VACANT"
          soldier={platoon.sergeant}
        />
        <span className="count-badge">{total}</span>
      </summary>
      {platoon.squads.map((squad) => (
        <DragDropSquad key={squad.number} squad={squad} company={company} platoon={platoon.number} />
      ))}
      <button className="add-btn" onClick={() => onAddSquad(company, platoon.number)}>
        + Add Squad
      </button>
    </details>
  );
}

function DragDropCompany({ company }: { company: Company }) {
  const { onAddPlatoon } = useActions();
  const coDest: SlotPath = { kind: "companyCommander", company: company.letter };
  const xoDest: SlotPath = { kind: "companyXO", company: company.letter };
  const sgtDest: SlotPath = { kind: "company1SG", company: company.letter };
  const total = company.platoons.reduce(
    (sum, p) =>
      sum + p.squads.reduce((s2, sq) => s2 + sq.members.length + (sq.leader ? 1 : 0), 0),
    0,
  );
  return (
    <details className="tree-node company-node" open>
      <summary>
        {company.name} Company ({company.letter}) — CO:{" "}
        <DroppableSlot
          destination={coDest}
          occupied={company.commander !== null}
          emptyLabel="VACANT"
          soldier={company.commander}
        />
        <span className="count-badge">{total}</span>
      </summary>
      <div className="company-hq-row">
        XO:{" "}
        <DroppableSlot
          destination={xoDest}
          occupied={company.executiveOfficer !== null}
          emptyLabel="VACANT"
          soldier={company.executiveOfficer}
        />{" "}
        | 1SG:{" "}
        <DroppableSlot
          destination={sgtDest}
          occupied={company.firstSergeant !== null}
          emptyLabel="VACANT"
          soldier={company.firstSergeant}
        />
      </div>
      {company.platoons.map((platoon) => (
        <DragDropPlatoon key={platoon.number} platoon={platoon} company={company.letter} />
      ))}
      <button className="add-btn" onClick={() => onAddPlatoon(company.letter)}>
        + Add Platoon
      </button>
    </details>
  );
}

function BattalionHQ({ battalion }: { battalion: Battalion }) {
  return (
    <details className="tree-node battalion-node" open>
      <summary>
        {battalion.designation} Cavalry Battalion — CO:{" "}
        <DroppableSlot
          destination={{ kind: "battalionCommander" }}
          occupied={battalion.commander !== null}
          emptyLabel="VACANT"
          soldier={battalion.commander}
        />
      </summary>
      <div className="company-hq-row">
        XO:{" "}
        <DroppableSlot
          destination={{ kind: "battalionXO" }}
          occupied={battalion.executiveOfficer !== null}
          emptyLabel="VACANT"
          soldier={battalion.executiveOfficer}
        />{" "}
        | SGM:{" "}
        <DroppableSlot
          destination={{ kind: "battalionSGM" }}
          occupied={battalion.sergeantMajor !== null}
          emptyLabel="VACANT"
          soldier={battalion.sergeantMajor}
        />
      </div>
    </details>
  );
}

function paneOptions(roster: RosterData): { value: string; label: string }[] {
  return [
    ...roster.battalion.companies.map((c) => ({
      value: c.letter,
      label: `${c.name} Company (${c.letter})`,
    })),
    { value: roster.unassigned.letter, label: "Unassigned (B/ACD)" },
  ];
}

function findPane(roster: RosterData, letter: string): Company {
  return roster.battalion.companies.find((c) => c.letter === letter) ?? roster.unassigned;
}

function PaneColumn({ company }: { company: Company }) {
  const isUnassigned = company.letter === "UNASSIGNED";
  return (
    <div className={`kanban-column${isUnassigned ? " unassigned-pool" : ""}`}>
      {isUnassigned && (
        <p className="unassigned-hint">
          From B/ACD — drag soldiers into Charlie Company (or anywhere else) to reassign them.
        </p>
      )}
      <DragDropCompany company={company} />
    </div>
  );
}

export function DragDropTree({
  roster,
  onChange,
  ranks,
  onAddCompany,
  onAddSoldier,
  onEditSoldier,
  onDeleteSoldier,
}: {
  roster: RosterData;
  onChange: (roster: RosterData) => void;
  ranks: ApiRankExpanded[];
  onAddCompany: (letter: string, name: string) => boolean;
  onAddSoldier: (values: SoldierFormValues) => void;
  onEditSoldier: (userId: string, patch: SoldierPatch) => void;
  onDeleteSoldier: (userId: string) => void;
}) {
  const options = paneOptions(roster);
  const [leftLetter, setLeftLetter] = useState("C");
  const [rightLetter, setRightLetter] = useState(roster.unassigned.letter);
  const [editingSoldier, setEditingSoldier] = useState<Soldier | null>(null);
  const [creatingSoldier, setCreatingSoldier] = useState(false);
  const [newCompanyLetter, setNewCompanyLetter] = useState("");
  const [newCompanyName, setNewCompanyName] = useState("");

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const destination = over.data.current?.destination as SlotPath | undefined;
    if (!destination) return;
    const userId = String(active.id);
    const result = moveSoldier(roster, userId, destination);
    if (result.ok) onChange(result.roster);
  }

  function handleAddCompanySubmit() {
    const letter = newCompanyLetter.trim().toUpperCase();
    const name = newCompanyName.trim();
    if (!letter || !name) return;
    const ok = onAddCompany(letter, name);
    if (ok) {
      setNewCompanyLetter("");
      setNewCompanyName("");
    } else {
      window.alert(`A company with code "${letter}" already exists.`);
    }
  }

  const actions: Actions = {
    onAddPlatoon: (company) => onChange(addPlatoon(roster, company)),
    onAddSquad: (company, platoon) => onChange(addSquad(roster, company, platoon)),
    onRequestEdit: (soldier) => setEditingSoldier(soldier),
    onDeleteSoldier,
  };

  return (
    <ActionsContext.Provider value={actions}>
      <DndContext onDragEnd={handleDragEnd}>
        <BattalionHQ battalion={roster.battalion} />

        <div className="kanban-toolbar">
          <div className="kanban-selectors">
            <label>
              Left pane:{" "}
              <select value={leftLetter} onChange={(e) => setLeftLetter(e.target.value)}>
                {options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Right pane:{" "}
              <select value={rightLetter} onChange={(e) => setRightLetter(e.target.value)}>
                {options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="add-company-form">
            <input
              placeholder="Code (e.g. D)"
              value={newCompanyLetter}
              onChange={(e) => setNewCompanyLetter(e.target.value)}
              maxLength={8}
            />
            <input
              placeholder="Name (e.g. Dog)"
              value={newCompanyName}
              onChange={(e) => setNewCompanyName(e.target.value)}
            />
            <button className="add-btn" onClick={handleAddCompanySubmit}>
              + Add Company
            </button>
          </div>

          <button className="add-btn" onClick={() => setCreatingSoldier(true)}>
            + Add Soldier
          </button>
        </div>

        <div className="kanban-columns">
          <PaneColumn company={findPane(roster, leftLetter)} />
          <PaneColumn company={findPane(roster, rightLetter)} />
        </div>
      </DndContext>

      {creatingSoldier && (
        <SoldierForm
          ranks={ranks}
          title="Add Soldier"
          onCancel={() => setCreatingSoldier(false)}
          onSubmit={(values) => {
            onAddSoldier(values);
            setCreatingSoldier(false);
          }}
        />
      )}
      {editingSoldier && (
        <SoldierForm
          ranks={ranks}
          initial={editingSoldier}
          title="Edit Soldier"
          onCancel={() => setEditingSoldier(null)}
          onSubmit={(values) => {
            onEditSoldier(editingSoldier.userId, values);
            setEditingSoldier(null);
          }}
        />
      )}
    </ActionsContext.Provider>
  );
}
