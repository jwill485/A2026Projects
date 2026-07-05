import { createContext, useContext, type ReactNode } from "react";
import { DndContext, useDraggable, useDroppable, type DragEndEvent } from "@dnd-kit/core";
import type { Battalion, Company, Platoon, RosterData, Soldier, Squad } from "../types/roster";
import { isSlotOccupied, moveSoldier, addPlatoon, addSquad, type SlotPath } from "../lib/moveSoldier";
import "./RosterTree.css";
import "./DragDropTree.css";

function slotId(destination: SlotPath): string {
  return JSON.stringify(destination);
}

interface Actions {
  onAddPlatoon: (company: string) => void;
  onAddSquad: (company: string, platoon: string) => void;
}

const ActionsContext = createContext<Actions | null>(null);

function useActions(): Actions {
  const ctx = useContext(ActionsContext);
  if (!ctx) throw new Error("ActionsContext missing");
  return ctx;
}

function DraggableSoldier({ soldier }: { soldier: Soldier }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: soldier.userId,
  });
  return (
    <span
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`draggable-soldier${isDragging ? " dragging" : ""}`}
    >
      {soldier.rankShort} {soldier.realName}
      <span className="soldier-username"> ({soldier.username})</span>
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

export function DragDropTree({
  roster,
  onChange,
}: {
  roster: RosterData;
  onChange: (roster: RosterData) => void;
}) {
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const destination = over.data.current?.destination as SlotPath | undefined;
    if (!destination) return;
    const userId = String(active.id);
    const result = moveSoldier(roster, userId, destination);
    if (result.ok) onChange(result.roster);
  }

  const actions: Actions = {
    onAddPlatoon: (company) => onChange(addPlatoon(roster, company)),
    onAddSquad: (company, platoon) => onChange(addSquad(roster, company, platoon)),
  };

  return (
    <ActionsContext.Provider value={actions}>
      <DndContext onDragEnd={handleDragEnd}>
        <BattalionHQ battalion={roster.battalion} />
        {roster.battalion.companies.map((company) => (
          <DragDropCompany key={company.letter} company={company} />
        ))}
        <div className="unassigned-pool">
          <h3>Unassigned</h3>
          <p className="unassigned-hint">
            From B/ACD — drag soldiers into Charlie Company (or anywhere else) to reassign them.
          </p>
          <DragDropCompany company={roster.unassigned} />
        </div>
      </DndContext>
    </ActionsContext.Provider>
  );
}
