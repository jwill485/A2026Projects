import { createContext, useContext, useEffect, useId, useState, type ReactNode } from "react";
import { DndContext, useDraggable, useDroppable, type DragEndEvent } from "@dnd-kit/core";
import type { Battalion, Company, Platoon, RosterData, Soldier, SplitStatus, Squad } from "../types/roster";
import type { ApiRankExpanded } from "../types/api";
import {
  moveSoldier,
  moveSquad,
  addPlatoon,
  addSquad,
  deletePlatoon,
  deleteSquad,
  type SlotPath,
  type SoldierPatch,
} from "../lib/moveSoldier";
import { collectAllSoldiers } from "../lib/analytics";
import {
  EMPTY_FILTER,
  isFilterActive,
  matchesSoldier,
  platoonHasMatch,
  squadHasMatch,
  type RosterFilter,
} from "../lib/filterRoster";
import { SoldierForm, type SoldierFormValues } from "./SoldierForm";
import { ImportSoldierPicker } from "./ImportSoldierPicker";
import { ImportCompanyPicker } from "./ImportCompanyPicker";
import { SplitStatusToggle } from "./SplitStatusToggle";
import "./RosterTree.css";
import "./DragDropTree.css";

interface Actions {
  onAddPlatoon: (company: string) => void;
  onAddSquad: (company: string, platoon: string) => void;
  onDeletePlatoon: (company: string, platoon: string) => void;
  onDeleteSquad: (company: string, platoon: string, squad: string) => void;
  onRequestEdit: (soldier: Soldier) => void;
  onDeleteSoldier: (userId: string) => void;
  onSetSplitStatus?: (userId: string, status: SplitStatus) => void;
  filter: RosterFilter;
}

const ActionsContext = createContext<Actions | null>(null);

function useActions(): Actions {
  const ctx = useContext(ActionsContext);
  if (!ctx) throw new Error("ActionsContext missing");
  return ctx;
}

function DraggableSoldier({ soldier }: { soldier: Soldier }) {
  const { onRequestEdit, onDeleteSoldier, onSetSplitStatus, filter } = useActions();
  // A unique per-instance id, not soldier.userId: the same person can be
  // rendered twice at once (both panes pointed at the same company/pool,
  // which is the default with zero companies) — dnd-kit requires unique
  // draggable ids, so the real id travels via `data` instead.
  const dragId = useId();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: dragId,
    data: { kind: "soldier", userId: soldier.userId },
  });
  const matched = isFilterActive(filter) && matchesSoldier(soldier, filter);
  return (
    <span className="draggable-soldier-wrapper">
      <span
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        className={`draggable-soldier${isDragging ? " dragging" : ""}${matched ? " filter-match" : ""}`}
      >
        {soldier.rankShort} {soldier.realName}
        {soldier.username && <span className="soldier-username"> ({soldier.username})</span>}
      </span>
      {onSetSplitStatus && (
        <SplitStatusToggle
          status={soldier.splitStatus ?? "neutral"}
          onChange={(next) => onSetSplitStatus(soldier.userId, next)}
        />
      )}
      <button
        type="button"
        className="icon-btn"
        title="Edit trooper"
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
        title="Delete trooper"
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
  // A unique per-instance id, not slotId(destination): the same billet can
  // be rendered twice at once (both panes pointed at the same company),
  // and dnd-kit requires unique droppable ids too — the real target travels
  // via `data` instead.
  const dropId = useId();
  const { setNodeRef, isOver } = useDroppable({
    id: dropId,
    data: { destination },
  });
  const { filter } = useActions();
  const className = [
    "drop-slot",
    isOver && occupied ? "drop-blocked" : "",
    isOver && !occupied ? "drop-ok" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <span ref={setNodeRef} className={className}>
      {soldier ? (
        <DraggableSoldier soldier={soldier} />
      ) : (
        <span className={`vacant${filter.vacantOnly ? " filter-match" : ""}`}>{emptyLabel}</span>
      )}
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
  const dropId = useId();
  const { setNodeRef, isOver } = useDroppable({
    id: dropId,
    data: { destination },
  });
  return (
    <ul ref={setNodeRef} className={`member-list drop-slot${isOver ? " drop-ok" : ""}`}>
      {members.map((member) => (
        <li key={member.userId}>
          <DraggableSoldier soldier={member} />
        </li>
      ))}
      {members.length === 0 && <li className="vacant">Drop troopers here</li>}
    </ul>
  );
}

function SquadDragHandle({
  company,
  platoon,
  squadNumber,
}: {
  company: string;
  platoon: string;
  squadNumber: string;
}) {
  const dragId = useId();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: dragId,
    data: { kind: "squad", company, platoon, squadNumber },
  });
  return (
    <span
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`squad-drag-handle${isDragging ? " dragging" : ""}`}
      title="Drag to move the whole squad to another platoon"
    >
      ⠿ Squad {squadNumber}
    </span>
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
  const { onDeleteSquad } = useActions();
  const leaderDest: SlotPath = { kind: "squadLeader", company, platoon, squad: squad.number };
  const memberDest: SlotPath = { kind: "squadMember", company, platoon, squad: squad.number };
  const isEmpty = squad.leader === null && squad.members.length === 0;
  return (
    <details className="tree-node squad-node" open>
      <summary>
        <SquadDragHandle company={company} platoon={platoon} squadNumber={squad.number} /> — Leader:{" "}
        <DroppableSlot
          destination={leaderDest}
          occupied={squad.leader !== null}
          emptyLabel="VACANT"
          soldier={squad.leader}
        />
        <span className="count-badge">{squad.members.length + (squad.leader ? 1 : 0)}</span>
        <button
          type="button"
          className="icon-btn icon-btn-danger"
          title={isEmpty ? "Remove this squad" : "Move everyone out first"}
          disabled={!isEmpty}
          onClick={(e) => {
            e.stopPropagation();
            onDeleteSquad(company, platoon, squad.number);
          }}
        >
          ✕
        </button>
      </summary>
      <DroppableMemberList destination={memberDest} members={squad.members} />
    </details>
  );
}

function DroppableSquadList({
  company,
  platoon,
  children,
}: {
  company: string;
  platoon: string;
  children: ReactNode;
}) {
  const dropId = useId();
  const { setNodeRef, isOver } = useDroppable({
    id: dropId,
    data: { kind: "platoonSquadList", company, platoon },
  });
  return (
    <div ref={setNodeRef} className={`squad-list-drop-zone${isOver ? " drop-ok" : ""}`}>
      {children}
      {/* A persistent, always-visible target: the gaps between existing
          squad cards are too thin to reliably hit, and this platoon might
          have no squads yet at all. */}
      <div className="squad-drop-hint">⠿ Drop a squad here to move it into Platoon {platoon}</div>
    </div>
  );
}

function DragDropPlatoon({ platoon, company }: { platoon: Platoon; company: string }) {
  const { onAddSquad, onDeletePlatoon, filter } = useActions();
  const leaderDest: SlotPath = { kind: "platoonLeader", company, platoon: platoon.number };
  const sergeantDest: SlotPath = { kind: "platoonSergeant", company, platoon: platoon.number };
  const total = platoon.squads.reduce(
    (sum, s) => sum + s.members.length + (s.leader ? 1 : 0),
    0,
  );
  const isEmpty =
    platoon.leader === null &&
    platoon.sergeant === null &&
    platoon.squads.every((s) => s.leader === null && s.members.length === 0);
  const squads = isFilterActive(filter)
    ? platoon.squads.filter((s) => squadHasMatch(s, filter))
    : platoon.squads;
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
        <button
          type="button"
          className="icon-btn icon-btn-danger"
          title={isEmpty ? "Remove this platoon" : "Move everyone out of it (and its squads) first"}
          disabled={!isEmpty}
          onClick={(e) => {
            e.stopPropagation();
            onDeletePlatoon(company, platoon.number);
          }}
        >
          ✕
        </button>
      </summary>
      <DroppableSquadList company={company} platoon={platoon.number}>
        {squads.map((squad) => (
          <DragDropSquad key={squad.number} squad={squad} company={company} platoon={platoon.number} />
        ))}
      </DroppableSquadList>
      <button className="add-btn" onClick={() => onAddSquad(company, platoon.number)}>
        + Add Squad
      </button>
    </details>
  );
}

function DragDropCompany({ company }: { company: Company }) {
  const { onAddPlatoon, filter } = useActions();
  const coDest: SlotPath = { kind: "companyCommander", company: company.letter };
  const xoDest: SlotPath = { kind: "companyXO", company: company.letter };
  const sgtDest: SlotPath = { kind: "company1SG", company: company.letter };
  const total = company.platoons.reduce(
    (sum, p) =>
      sum + p.squads.reduce((s2, sq) => s2 + sq.members.length + (sq.leader ? 1 : 0), 0),
    0,
  );
  const platoons = isFilterActive(filter)
    ? company.platoons.filter((p) => platoonHasMatch(p, filter))
    : company.platoons;
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
      {platoons.map((platoon) => (
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

function PaneColumn({ company, unassignedHint }: { company: Company; unassignedHint: string }) {
  const isUnassigned = company.letter === "UNASSIGNED";
  return (
    <div className={`kanban-column${isUnassigned ? " unassigned-pool" : ""}`}>
      {isUnassigned && <p className="unassigned-hint">{unassignedHint}</p>}
      <DragDropCompany company={company} />
    </div>
  );
}

export function DragDropTree({
  roster,
  rosterId,
  onChange,
  ranks,
  onAddCompany,
  onAddSoldier,
  onEditSoldier,
  onDeleteSoldier,
  onImportSoldier,
  onImportCompany,
  onSetSplitStatus,
  filter = EMPTY_FILTER,
  unassignedHint = "From B/ACD — drag troopers into Charlie Company (or anywhere else) to reassign them.",
}: {
  roster: RosterData;
  rosterId: string;
  onChange: (roster: RosterData) => void;
  ranks: ApiRankExpanded[];
  onAddCompany: (letter: string, name: string) => boolean;
  onAddSoldier: (values: SoldierFormValues) => void;
  onEditSoldier: (userId: string, patch: SoldierPatch) => void;
  onDeleteSoldier: (userId: string) => void;
  onImportSoldier: (soldier: Soldier, targetLetter: string) => boolean;
  onImportCompany: (company: Company) => boolean;
  onSetSplitStatus?: (userId: string, status: SplitStatus) => void;
  filter?: RosterFilter;
  unassignedHint?: string;
}) {
  const options = paneOptions(roster);
  const [leftLetter, setLeftLetter] = useState(
    () => paneOptions(roster)[0]?.value ?? roster.unassigned.letter,
  );
  const [rightLetter, setRightLetter] = useState(roster.unassigned.letter);
  const [editingSoldier, setEditingSoldier] = useState<Soldier | null>(null);
  const [creatingSoldier, setCreatingSoldier] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importingCompany, setImportingCompany] = useState(false);
  const [newCompanyLetter, setNewCompanyLetter] = useState("");
  const [newCompanyName, setNewCompanyName] = useState("");

  // Switching to a *different named roster* can leave the previously-selected
  // pane letters invalid (a blank/custom roster with different company codes)
  // or, since "Unassigned" always exists, silently collapse both panes onto
  // it. Reconcile only on an actual roster switch (not on every edit within
  // the same roster — that would fight the deliberate "same company on both
  // sides" use case during a drag session).
  useEffect(() => {
    const validLetters = options.map((o) => o.value);
    const validSet = new Set(validLetters);
    let nextLeft = validSet.has(leftLetter) ? leftLetter : (validLetters[0] ?? roster.unassigned.letter);
    let nextRight = validSet.has(rightLetter) ? rightLetter : roster.unassigned.letter;
    if (nextLeft === nextRight && validLetters.length > 1) {
      const alt = validLetters.find((v) => v !== nextLeft);
      if (alt) nextRight = alt;
    }
    setLeftLetter(nextLeft);
    setRightLetter(nextRight);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rosterId]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeData = active.data.current;
    const overData = over.data.current;

    if (activeData?.kind === "squad") {
      if (overData?.kind !== "platoonSquadList") return;
      const result = moveSquad(
        roster,
        { company: activeData.company, platoon: activeData.platoon, squad: activeData.squadNumber },
        { company: overData.company, platoon: overData.platoon },
      );
      if (result.ok) onChange(result.roster);
      return;
    }

    const destination = overData?.destination as SlotPath | undefined;
    if (!destination) return;
    const userId = activeData?.userId as string | undefined;
    if (!userId) return;
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
    onDeletePlatoon: (company, platoon) => {
      const result = deletePlatoon(roster, company, platoon);
      if (result.ok) onChange(result.roster);
    },
    onDeleteSquad: (company, platoon, squad) => {
      const result = deleteSquad(roster, company, platoon, squad);
      if (result.ok) onChange(result.roster);
    },
    onRequestEdit: (soldier) => setEditingSoldier(soldier),
    onDeleteSoldier,
    onSetSplitStatus,
    filter,
  };

  return (
    <ActionsContext.Provider value={actions}>
      <DndContext onDragEnd={handleDragEnd}>
        <BattalionHQ battalion={roster.battalion} />

        <div className="kanban-toolbar">
          <div className="kanban-selectors">
            <label>
              Other (left):{" "}
              <select value={leftLetter} onChange={(e) => setLeftLetter(e.target.value)}>
                {options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Building (right — new troopers land here):{" "}
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
            + Add Trooper
          </button>
          <button className="add-btn" onClick={() => setImporting(true)}>
            + Import Trooper
          </button>
          <button className="add-btn" onClick={() => setImportingCompany(true)}>
            + Import Company
          </button>
        </div>

        <div className="kanban-columns">
          <PaneColumn company={findPane(roster, leftLetter)} unassignedHint={unassignedHint} />
          <PaneColumn company={findPane(roster, rightLetter)} unassignedHint={unassignedHint} />
        </div>
      </DndContext>

      {creatingSoldier && (
        <SoldierForm
          ranks={ranks}
          title="Add Trooper"
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
          title="Edit Trooper"
          onCancel={() => setEditingSoldier(null)}
          onSubmit={(values) => {
            onEditSoldier(editingSoldier.userId, values);
            setEditingSoldier(null);
          }}
        />
      )}
      {importing && (
        <ImportSoldierPicker
          existingIds={new Set(collectAllSoldiers(roster).map((s) => s.userId))}
          onImport={(soldier) => onImportSoldier(soldier, rightLetter)}
          onClose={() => setImporting(false)}
        />
      )}
      {importingCompany && (
        <ImportCompanyPicker
          existingLetters={new Set([...roster.battalion.companies.map((c) => c.letter), roster.unassigned.letter])}
          onImport={onImportCompany}
          onClose={() => setImportingCompany(false)}
        />
      )}
    </ActionsContext.Provider>
  );
}
