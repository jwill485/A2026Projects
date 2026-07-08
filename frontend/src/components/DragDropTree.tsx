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
  setCompanyStaged,
  type SlotPath,
  type SoldierPatch,
} from "../lib/moveSoldier";
import {
  collectAllSoldiers,
  collectCompanySoldiers,
  computeMosBreakdown,
  computeSquadMos,
  practiceTimeByUser,
} from "../lib/analytics";
import { classifyTier, TIER_LABELS, TIER_ORDER, type LeadershipTier } from "../lib/leadership";
import { INTACT_TRANSFER } from "../lib/splitReorg";
import { suggestCompanies, applySuggestedCompanies } from "../lib/buildSuggestions";
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
import { CandidatePicker } from "./CandidatePicker";
import { LeadershipStrip, type StripBillet } from "./LeadershipStrip";
import { SuggestionPreview } from "./SuggestionPreview";
import "./RosterTree.css";
import "./DragDropTree.css";

// --- Selection (drives the Unit Detail panel) -------------------------------

type SelectedUnit =
  | { kind: "battalion" }
  | { kind: "company"; company: string }
  | { kind: "platoon"; company: string; platoon: string }
  | { kind: "squad"; company: string; platoon: string; squad: string };

interface Actions {
  onAddPlatoon: (company: string) => void;
  onAddSquad: (company: string, platoon: string) => void;
  onDeletePlatoon: (company: string, platoon: string) => void;
  onDeleteSquad: (company: string, platoon: string, squad: string) => void;
  onRequestEdit: (soldier: Soldier) => void;
  onDeleteSoldier: (userId: string) => void;
  onSetSplitStatus?: (userId: string, status: SplitStatus) => void;
  onRequestAssign: (destination: SlotPath) => void;
  onSelectUnit: (unit: SelectedUnit) => void;
  onToggleStaged: (letter: string) => void;
  // Whether the currently-displayed (active) company is staged/complete —
  // the Structure column only ever shows one company at a time, so this is
  // enough to gate every drop target and structural button inside it.
  locked: boolean;
  filter: RosterFilter;
}

const ActionsContext = createContext<Actions | null>(null);

function useActions(): Actions {
  const ctx = useContext(ActionsContext);
  if (!ctx) throw new Error("ActionsContext missing");
  return ctx;
}

// A small "ⓘ" button next to a unit's header — sets the Unit Detail panel's
// selection without toggling the <details> it sits inside (stopPropagation).
function DetailButton({ unit }: { unit: SelectedUnit }) {
  const { onSelectUnit } = useActions();
  return (
    <button
      type="button"
      className="icon-btn detail-btn"
      title="Show details for this unit"
      onClick={(e) => {
        e.stopPropagation();
        onSelectUnit(unit);
      }}
    >
      ⓘ
    </button>
  );
}

function DraggableSoldier({ soldier }: { soldier: Soldier }) {
  const { onRequestEdit, onDeleteSoldier, onSetSplitStatus, filter } = useActions();
  // A unique per-instance id, not soldier.userId: the same person can be
  // rendered twice at once (the Pool panel plus wherever they're dragged
  // from) — dnd-kit requires unique draggable ids, so the real id travels
  // via `data` instead.
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
  // A unique per-instance id, not a serialized destination — dnd-kit requires
  // unique droppable ids too, and the real target travels via `data`.
  const dropId = useId();
  const { setNodeRef, isOver } = useDroppable({
    id: dropId,
    data: { destination },
  });
  const { filter, onRequestAssign, locked } = useActions();
  const className = [
    "drop-slot",
    isOver && (occupied || locked) ? "drop-blocked" : "",
    isOver && !occupied && !locked ? "drop-ok" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <span ref={setNodeRef} className={className}>
      {soldier ? (
        <DraggableSoldier soldier={soldier} />
      ) : (
        <button
          type="button"
          className={`vacant vacant-slot-btn${filter.vacantOnly ? " filter-match" : ""}`}
          title={locked ? "Un-stage this company to assign billets" : "Click to pick someone for this billet (or drag a trooper here)"}
          disabled={locked}
          onClick={() => onRequestAssign(destination)}
        >
          {emptyLabel}
        </button>
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
  const { onRequestAssign, locked } = useActions();
  return (
    <ul ref={setNodeRef} className={`member-list drop-slot${isOver ? (locked ? " drop-blocked" : " drop-ok") : ""}`}>
      {members.map((member) => (
        <li key={member.userId}>
          <DraggableSoldier soldier={member} />
        </li>
      ))}
      <li>
        <button
          type="button"
          className="assign-member-btn"
          title={locked ? "Un-stage this company to assign troopers" : "Pick a trooper for this squad from a list"}
          disabled={locked}
          onClick={() => onRequestAssign(destination)}
        >
          + assign trooper
        </button>
      </li>
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
  const { locked } = useActions();
  const dragId = useId();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: dragId,
    data: { kind: "squad", company, platoon, squadNumber },
    disabled: locked,
  });
  return (
    <span
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`squad-drag-handle${isDragging ? " dragging" : ""}${locked ? " locked" : ""}`}
      title={locked ? "Company is staged — un-stage it to move squads" : "Drag to move the whole squad to another platoon in this company"}
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
  const { onDeleteSquad, onRequestAssign, locked } = useActions();
  const leaderDest: SlotPath = { kind: "squadLeader", company, platoon, squad: squad.number };
  const memberDest: SlotPath = { kind: "squadMember", company, platoon, squad: squad.number };
  const isEmpty = squad.leader === null && squad.members.length === 0;
  const headcount = squad.members.length + (squad.leader ? 1 : 0);
  const mos = computeSquadMos(squad);
  const strip: StripBillet[] = [
    {
      label: "SL",
      filled: squad.leader !== null,
      detail: squad.leader ? `${squad.leader.rankShort} ${squad.leader.realName}` : undefined,
      onClick: squad.leader === null ? () => onRequestAssign(leaderDest) : undefined,
    },
  ];
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
        <LeadershipStrip billets={strip} />
        <span className="count-badge">{headcount}</span>
        {mos.length > 0 && (
          <span className="mos-tally" title="MOS makeup">
            {mos.map((m) => `${m.label}×${m.value}`).join(" · ")}
          </span>
        )}
        <DetailButton unit={{ kind: "squad", company, platoon, squad: squad.number }} />
        <button
          type="button"
          className="icon-btn icon-btn-danger"
          title={locked ? "Un-stage this company first" : isEmpty ? "Remove this squad" : "Move everyone out first"}
          disabled={!isEmpty || locked}
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
  const { locked } = useActions();
  const dropId = useId();
  const { setNodeRef, isOver } = useDroppable({
    id: dropId,
    data: { kind: "platoonSquadList", company, platoon },
  });
  return (
    <div ref={setNodeRef} className={`squad-list-drop-zone${isOver ? (locked ? " drop-blocked" : " drop-ok") : ""}`}>
      {children}
      {/* A persistent, always-visible target: the gaps between existing
          squad cards are too thin to reliably hit, and this platoon might
          have no squads yet at all. */}
      {!locked && (
        <div className="squad-drop-hint">⠿ Drop a squad here to move it into Platoon {platoon}</div>
      )}
    </div>
  );
}

function DragDropPlatoon({ platoon, company }: { platoon: Platoon; company: string }) {
  const { onAddSquad, onDeletePlatoon, onRequestAssign, filter, locked } = useActions();
  const leaderDest: SlotPath = { kind: "platoonLeader", company, platoon: platoon.number };
  const sergeantDest: SlotPath = { kind: "platoonSergeant", company, platoon: platoon.number };
  // Includes PL/PSG themselves, not just squad members — matches the Detail
  // panel's headcount (collectCompanySoldiers), which does the same.
  const total =
    (platoon.leader ? 1 : 0) +
    (platoon.sergeant ? 1 : 0) +
    platoon.squads.reduce((sum, s) => sum + s.members.length + (s.leader ? 1 : 0), 0);
  const isEmpty =
    platoon.leader === null &&
    platoon.sergeant === null &&
    platoon.squads.every((s) => s.leader === null && s.members.length === 0);
  const squads = isFilterActive(filter)
    ? platoon.squads.filter((s) => squadHasMatch(s, filter))
    : platoon.squads;
  const strip: StripBillet[] = [
    {
      label: "PL",
      filled: platoon.leader !== null,
      detail: platoon.leader ? `${platoon.leader.rankShort} ${platoon.leader.realName}` : undefined,
      onClick: platoon.leader === null ? () => onRequestAssign(leaderDest) : undefined,
    },
    {
      label: "PSG",
      filled: platoon.sergeant !== null,
      detail: platoon.sergeant ? `${platoon.sergeant.rankShort} ${platoon.sergeant.realName}` : undefined,
      onClick: platoon.sergeant === null ? () => onRequestAssign(sergeantDest) : undefined,
    },
  ];
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
        <LeadershipStrip billets={strip} />
        <span className="count-badge">{total}</span>
        <DetailButton unit={{ kind: "platoon", company, platoon: platoon.number }} />
        <button
          type="button"
          className="icon-btn icon-btn-danger"
          title={
            locked
              ? "Un-stage this company first"
              : isEmpty
                ? "Remove this platoon"
                : "Move everyone out of it (and its squads) first"
          }
          disabled={!isEmpty || locked}
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
      <button className="add-btn" disabled={locked} onClick={() => onAddSquad(company, platoon.number)}>
        + Add Squad
      </button>
    </details>
  );
}

function DragDropCompany({ company }: { company: Company }) {
  const { onAddPlatoon, onRequestAssign, onToggleStaged, filter, locked } = useActions();
  const coDest: SlotPath = { kind: "companyCommander", company: company.letter };
  const xoDest: SlotPath = { kind: "companyXO", company: company.letter };
  const sgtDest: SlotPath = { kind: "company1SG", company: company.letter };
  // Same tally as the Detail panel (collectCompanySoldiers): CO/XO/1SG,
  // every platoon's PL/PSG, and every squad's leader + members.
  const total = collectCompanySoldiers(company).length;
  const platoons = isFilterActive(filter)
    ? company.platoons.filter((p) => platoonHasMatch(p, filter))
    : company.platoons;
  const strip: StripBillet[] = [
    {
      label: "CO",
      filled: company.commander !== null,
      detail: company.commander ? `${company.commander.rankShort} ${company.commander.realName}` : undefined,
      onClick: company.commander === null ? () => onRequestAssign(coDest) : undefined,
    },
    {
      label: "XO",
      filled: company.executiveOfficer !== null,
      detail: company.executiveOfficer
        ? `${company.executiveOfficer.rankShort} ${company.executiveOfficer.realName}`
        : undefined,
      onClick: company.executiveOfficer === null ? () => onRequestAssign(xoDest) : undefined,
    },
    {
      label: "1SG",
      filled: company.firstSergeant !== null,
      detail: company.firstSergeant
        ? `${company.firstSergeant.rankShort} ${company.firstSergeant.realName}`
        : undefined,
      onClick: company.firstSergeant === null ? () => onRequestAssign(sgtDest) : undefined,
    },
  ];
  return (
    <details className={`tree-node company-node${company.staged ? " staged" : ""}`} open>
      <summary>
        {company.name} Company ({company.letter}){company.staged && <span className="staged-badge">STAGED</span>} — CO:{" "}
        <DroppableSlot
          destination={coDest}
          occupied={company.commander !== null}
          emptyLabel="VACANT"
          soldier={company.commander}
        />
        <LeadershipStrip billets={strip} />
        <span className="count-badge">{total}</span>
        <DetailButton unit={{ kind: "company", company: company.letter }} />
        <button
          type="button"
          className={`add-btn stage-toggle-btn${company.staged ? " staged" : ""}`}
          title={
            company.staged
              ? "Un-stage: allow edits and drops again"
              : "Mark complete: locks structure and moves it to the Staged section"
          }
          onClick={(e) => {
            e.stopPropagation();
            onToggleStaged(company.letter);
          }}
        >
          {company.staged ? "🔓 Un-stage" : "✅ Mark complete"}
        </button>
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
      <button className="add-btn" disabled={locked} onClick={() => onAddPlatoon(company.letter)}>
        + Add Platoon
      </button>
    </details>
  );
}

function BattalionHQ({ battalion }: { battalion: Battalion }) {
  const { onRequestAssign } = useActions();
  const strip: StripBillet[] = [
    {
      label: "CO",
      filled: battalion.commander !== null,
      detail: battalion.commander ? `${battalion.commander.rankShort} ${battalion.commander.realName}` : undefined,
      onClick: battalion.commander === null ? () => onRequestAssign({ kind: "battalionCommander" }) : undefined,
    },
    {
      label: "XO",
      filled: battalion.executiveOfficer !== null,
      detail: battalion.executiveOfficer
        ? `${battalion.executiveOfficer.rankShort} ${battalion.executiveOfficer.realName}`
        : undefined,
      onClick: battalion.executiveOfficer === null ? () => onRequestAssign({ kind: "battalionXO" }) : undefined,
    },
    {
      label: "SGM",
      filled: battalion.sergeantMajor !== null,
      detail: battalion.sergeantMajor
        ? `${battalion.sergeantMajor.rankShort} ${battalion.sergeantMajor.realName}`
        : undefined,
      onClick: battalion.sergeantMajor === null ? () => onRequestAssign({ kind: "battalionSGM" }) : undefined,
    },
  ];
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
        <LeadershipStrip billets={strip} />
        <DetailButton unit={{ kind: "battalion" }} />
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

// --- Pool panel --------------------------------------------------------------

function DroppablePool({ children }: { children: ReactNode }) {
  const dropId = useId();
  const { setNodeRef, isOver } = useDroppable({
    id: dropId,
    data: { destination: { kind: "unassignedPool" } },
  });
  return (
    <div ref={setNodeRef} className={`pool-list drop-slot${isOver ? " drop-ok" : ""}`}>
      {children}
    </div>
  );
}

function PoolPanel({ roster }: { roster: RosterData }) {
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<LeadershipTier | "">("");
  const [mosFilter, setMosFilter] = useState("");
  const [timeFilter, setTimeFilter] = useState("");

  const people = collectCompanySoldiers(roster.unassigned);
  const times = practiceTimeByUser(roster);
  const mosOptions = [...new Set(people.map((p) => p.mos).filter((m) => m.trim() !== ""))].sort();
  const timeOptions = [...new Set(people.map((p) => times.get(p.userId)).filter((t): t is string => !!t))].sort();

  const query = search.trim().toLowerCase();
  const filtered = people.filter((p) => {
    if (tierFilter && classifyTier(p) !== tierFilter) return false;
    if (mosFilter && p.mos !== mosFilter) return false;
    if (timeFilter && times.get(p.userId) !== timeFilter) return false;
    if (query && !p.realName.toLowerCase().includes(query) && !p.username.toLowerCase().includes(query)) {
      return false;
    }
    return true;
  });

  return (
    <div className="pool-panel">
      <h3>
        Pool <span className="count-badge">{filtered.length}/{people.length}</span>
      </h3>
      <div className="pool-filters">
        <input
          type="text"
          placeholder="Search name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={tierFilter} onChange={(e) => setTierFilter(e.target.value as LeadershipTier | "")}>
          <option value="">All tiers</option>
          {TIER_ORDER.map((t) => (
            <option key={t} value={t}>
              {TIER_LABELS[t]}
            </option>
          ))}
        </select>
        <select value={mosFilter} onChange={(e) => setMosFilter(e.target.value)}>
          <option value="">All MOS</option>
          {mosOptions.map((mos) => (
            <option key={mos} value={mos}>
              {mos}
            </option>
          ))}
        </select>
        {timeOptions.length > 0 && (
          <select value={timeFilter} onChange={(e) => setTimeFilter(e.target.value)}>
            <option value="">Any practice time</option>
            {timeOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        )}
      </div>
      <DroppablePool>
        {filtered.map((soldier) => (
          <div key={soldier.userId} className="pool-row">
            <DraggableSoldier soldier={soldier} />
            <span className="pool-meta">
              {soldier.mos || "—"}
              {times.get(soldier.userId) ? ` · ${times.get(soldier.userId)}` : ""}
            </span>
          </div>
        ))}
        {filtered.length === 0 && <p className="pool-empty">Nobody matches this filter.</p>}
      </DroppablePool>
    </div>
  );
}

// --- Unit detail panel -------------------------------------------------------

function MosList({ people }: { people: Soldier[] }) {
  const mos = computeMosBreakdown(people);
  if (mos.length === 0) return <p className="detail-empty">Nobody here yet.</p>;
  return (
    <ul className="detail-mos-list">
      {mos.map((m) => (
        <li key={m.label}>
          {m.label} <span className="count-badge">{m.value}</span>
        </li>
      ))}
    </ul>
  );
}

function DetailPanel({ roster, selected }: { roster: RosterData; selected: SelectedUnit | null }) {
  if (!selected) {
    return (
      <div className="detail-panel">
        <h3>Unit Detail</h3>
        <p className="detail-empty">Click the ⓘ on any company, platoon, or squad to see it here.</p>
      </div>
    );
  }

  if (selected.kind === "battalion") {
    const b = roster.battalion;
    return (
      <div className="detail-panel">
        <h3>{b.designation} Battalion HQ</h3>
        <ul className="detail-fill-list">
          <li className={b.commander ? "stat-done" : ""}>CO: {b.commander ? b.commander.realName : "vacant"}</li>
          <li className={b.executiveOfficer ? "stat-done" : ""}>
            XO: {b.executiveOfficer ? b.executiveOfficer.realName : "vacant"}
          </li>
          <li className={b.sergeantMajor ? "stat-done" : ""}>
            SGM: {b.sergeantMajor ? b.sergeantMajor.realName : "vacant"}
          </li>
        </ul>
      </div>
    );
  }

  const company = roster.battalion.companies.find((c) => c.letter === selected.company);
  if (!company) return null;

  if (selected.kind === "company") {
    const people = collectCompanySoldiers(company);
    return (
      <div className="detail-panel">
        <h3>
          {company.name} Company ({company.letter})
        </h3>
        <ul className="detail-fill-list">
          <li className={company.commander ? "stat-done" : ""}>
            CO: {company.commander ? company.commander.realName : "vacant"}
          </li>
          <li className={company.executiveOfficer ? "stat-done" : ""}>
            XO: {company.executiveOfficer ? company.executiveOfficer.realName : "vacant"}
          </li>
          <li className={company.firstSergeant ? "stat-done" : ""}>
            1SG: {company.firstSergeant ? company.firstSergeant.realName : "vacant"}
          </li>
        </ul>
        <p className="detail-headcount">
          Headcount: {people.length} · Platoons: {company.platoons.length}
        </p>
        <h4>MOS makeup</h4>
        <MosList people={people} />
      </div>
    );
  }

  const platoon = company.platoons.find((p) => p.number === selected.platoon);
  if (!platoon) return null;

  if (selected.kind === "platoon") {
    const people = [
      ...(platoon.leader ? [platoon.leader] : []),
      ...(platoon.sergeant ? [platoon.sergeant] : []),
      ...platoon.squads.flatMap((s) => [...(s.leader ? [s.leader] : []), ...s.members]),
    ];
    return (
      <div className="detail-panel">
        <h3>
          {company.name} ({company.letter}) — Platoon {platoon.number}
        </h3>
        <ul className="detail-fill-list">
          <li className={platoon.leader ? "stat-done" : ""}>
            PL: {platoon.leader ? platoon.leader.realName : "vacant"}
          </li>
          <li className={platoon.sergeant ? "stat-done" : ""}>
            PSG: {platoon.sergeant ? platoon.sergeant.realName : "vacant"}
          </li>
        </ul>
        <p className="detail-headcount">
          Headcount: {people.length} · Squads: {platoon.squads.length}
        </p>
        <h4>MOS makeup</h4>
        <MosList people={people} />
      </div>
    );
  }

  const squad = platoon.squads.find((s) => s.number === selected.squad);
  if (!squad) return null;
  const people = [...(squad.leader ? [squad.leader] : []), ...squad.members];
  return (
    <div className="detail-panel">
      <h3>
        {company.name} ({company.letter}) — Plt {platoon.number} / Sqd {squad.number}
      </h3>
      <ul className="detail-fill-list">
        <li className={squad.leader ? "stat-done" : ""}>SL: {squad.leader ? squad.leader.realName : "vacant"}</li>
      </ul>
      <p className="detail-headcount">
        Headcount: {people.length}
        {squad.practiceTime ? ` · Practice: ${squad.practiceTime}` : ""}
      </p>
      <h4>MOS makeup</h4>
      <MosList people={people} />
    </div>
  );
}

// --- Main structure panel ----------------------------------------------------

function companyOptions(roster: RosterData): { value: string; label: string; staged: boolean }[] {
  return roster.battalion.companies.map((c) => ({
    value: c.letter,
    label: `${c.name} Company (${c.letter})`,
    staged: c.staged === true,
  }));
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
  sourceRosterForSuggestions = null,
  suggestionStatus = null,
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
  // When set (viewing a split-output roster with a resolvable source), the
  // toolbar offers "Suggest structure" using the SOURCE roster's tags +
  // practice times — see App.tsx for how these are resolved.
  sourceRosterForSuggestions?: RosterData | null;
  suggestionStatus?: SplitStatus | null;
}) {
  const options = companyOptions(roster);
  const [activeLetter, setActiveLetter] = useState<string>(() => options[0]?.value ?? "");
  const [editingSoldier, setEditingSoldier] = useState<Soldier | null>(null);
  const [creatingSoldier, setCreatingSoldier] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importingCompany, setImportingCompany] = useState(false);
  const [assigning, setAssigning] = useState<SlotPath | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<SelectedUnit | null>(null);
  const [newCompanyLetter, setNewCompanyLetter] = useState("");
  const [newCompanyName, setNewCompanyName] = useState("");

  // Switching to a *different named roster* can leave the previously-active
  // company letter invalid (a blank/custom roster with different company
  // codes, or none at all yet).
  useEffect(() => {
    const validLetters = options.map((o) => o.value);
    if (!validLetters.includes(activeLetter)) {
      setActiveLetter(validLetters[0] ?? "");
    }
    setSelectedUnit(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rosterId]);

  const activeCompany = roster.battalion.companies.find((c) => c.letter === activeLetter) ?? null;

  const suggestions =
    sourceRosterForSuggestions && suggestionStatus
      ? suggestCompanies(sourceRosterForSuggestions, suggestionStatus, {
          excludeCompanies:
            sourceRosterForSuggestions.sendCharlieToHllv && suggestionStatus === INTACT_TRANSFER.status
              ? [INTACT_TRANSFER.letter, sourceRosterForSuggestions.unassigned.letter]
              : [],
          usedLetters: roster.battalion.companies.map((c) => c.letter),
        })
      : { companies: [], warnings: [] };

  function handleApplySuggestions() {
    const applied = applySuggestedCompanies(roster, suggestions.companies);
    onChange(applied);
    // Jump straight to the first newly-created company so the result is
    // immediately visible instead of leaving the switcher on an empty one.
    const newLetters = suggestions.companies.map((c) => c.letter);
    if (newLetters.length > 0) setActiveLetter(newLetters[0]);
  }

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
      setActiveLetter(letter);
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
    onRequestAssign: setAssigning,
    onSelectUnit: setSelectedUnit,
    onToggleStaged: (letter) => {
      const target = roster.battalion.companies.find((c) => c.letter === letter);
      onChange(setCompanyStaged(roster, letter, !target?.staged));
    },
    locked: activeCompany?.staged === true,
    filter,
  };

  return (
    <ActionsContext.Provider value={actions}>
      <DndContext onDragEnd={handleDragEnd}>
        <BattalionHQ battalion={roster.battalion} />

        <div className="dnd-toolbar">
          <label>
            Building:{" "}
            <select value={activeLetter} onChange={(e) => setActiveLetter(e.target.value)}>
              {options.length === 0 && <option value="">No companies yet</option>}
              <optgroup label="Active">
                {options
                  .filter((o) => !o.staged)
                  .map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
              </optgroup>
              {options.some((o) => o.staged) && (
                <optgroup label="Staged / Complete">
                  {options
                    .filter((o) => o.staged)
                    .map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                </optgroup>
              )}
            </select>
          </label>

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

        {suggestions.companies.length > 0 && (
          <SuggestionPreview
            battalionName={roster.battalion.designation}
            status={suggestionStatus!}
            suggestions={suggestions.companies}
            warnings={suggestions.warnings}
            onApply={handleApplySuggestions}
          />
        )}

        <div className="dnd-workbench">
          <PoolPanel roster={roster} />
          <div className="dnd-structure">
            {activeCompany ? (
              <DragDropCompany company={activeCompany} />
            ) : (
              <p className="tier-empty">
                No companies yet — use + Add Company, + Import Company, or apply a suggested structure above.
              </p>
            )}
          </div>
          <DetailPanel roster={roster} selected={selectedUnit} />
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
          onImport={(soldier) => onImportSoldier(soldier, roster.unassigned.letter)}
          onClose={() => setImporting(false)}
        />
      )}
      {importingCompany && (
        <ImportCompanyPicker
          existingLetters={new Set([...roster.battalion.companies.map((c) => c.letter), roster.unassigned.letter])}
          onImport={(company) => {
            const ok = onImportCompany(company);
            if (ok) setActiveLetter(company.letter);
            return ok;
          }}
          onClose={() => setImportingCompany(false)}
        />
      )}
      {assigning && (
        <CandidatePicker
          roster={roster}
          ranks={ranks}
          destination={assigning}
          onAssign={(userId) => {
            const result = moveSoldier(roster, userId, assigning);
            if (result.ok) onChange(result.roster);
            setAssigning(null);
          }}
          onClose={() => setAssigning(null)}
        />
      )}
    </ActionsContext.Provider>
  );
}
