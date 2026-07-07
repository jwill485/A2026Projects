import { useState } from "react";
import type { RosterData, Soldier } from "../types/roster";
import type { ApiRankExpanded } from "../types/api";
import type { SlotPath } from "../lib/moveSoldier";
import { collectAllSoldiers, collectCompanySoldiers } from "../lib/analytics";
import { describeSoldierLocations } from "../lib/changelog";
import { classifyTier, TIER_LABELS, type LeadershipTier } from "../lib/leadership";
import "./SoldierForm.css";
import "./CandidatePicker.css";

// Click-to-assign: the simple alternative to dragging. Opened from any vacant
// billet (or a squad's "+ assign trooper"), it lists candidates filtered to
// the leadership tier the billet calls for — rank-sorted, pool members first,
// with MOS, current spot, and squad practice time visible — and one click
// places the person. The tier filter is a default, not a rule: "Show all
// ranks" lifts it.

// Which tiers a billet normally draws from (null = anyone).
const SLOT_TIERS: Record<SlotPath["kind"], LeadershipTier[] | null> = {
  battalionCommander: ["officer"],
  battalionXO: ["officer"],
  battalionSGM: ["seniorNco"],
  companyCommander: ["officer"],
  companyXO: ["officer"],
  company1SG: ["seniorNco"],
  platoonLeader: ["officer"],
  platoonSergeant: ["seniorNco"],
  squadLeader: ["juniorNco"],
  squadMember: null,
};

export function describeSlot(destination: SlotPath): string {
  switch (destination.kind) {
    case "battalionCommander":
      return "Battalion — Commanding Officer";
    case "battalionXO":
      return "Battalion — Executive Officer";
    case "battalionSGM":
      return "Battalion — Sergeant Major";
    case "companyCommander":
      return `Company ${destination.company} — Commanding Officer`;
    case "companyXO":
      return `Company ${destination.company} — Executive Officer`;
    case "company1SG":
      return `Company ${destination.company} — First Sergeant`;
    case "platoonLeader":
      return `${destination.company} / Platoon ${destination.platoon} — Platoon Leader`;
    case "platoonSergeant":
      return `${destination.company} / Platoon ${destination.platoon} — Platoon Sergeant`;
    case "squadLeader":
      return `${destination.company} / Plt ${destination.platoon} / Sqd ${destination.squad} — Squad Leader`;
    case "squadMember":
      return `${destination.company} / Plt ${destination.platoon} / Sqd ${destination.squad} — Member`;
  }
}

function practiceTimeByUser(roster: RosterData): Map<string, string> {
  const map = new Map<string, string>();
  for (const company of [...roster.battalion.companies, roster.unassigned]) {
    for (const platoon of company.platoons) {
      for (const squad of platoon.squads) {
        const time = (squad.practiceTime ?? "").trim();
        if (time === "") continue;
        if (squad.leader) map.set(squad.leader.userId, time);
        for (const member of squad.members) map.set(member.userId, time);
      }
    }
  }
  return map;
}

export function CandidatePicker({
  roster,
  ranks,
  destination,
  onAssign,
  onClose,
}: {
  roster: RosterData;
  ranks: ApiRankExpanded[];
  destination: SlotPath;
  onAssign: (userId: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);

  const tiers = SLOT_TIERS[destination.kind];
  const rankOrder = new Map(ranks.map((r) => [r.rankId, r.rankDisplayOrder]));
  const locations = describeSoldierLocations(roster);
  const practiceTimes = practiceTimeByUser(roster);
  const poolIds = new Set(collectCompanySoldiers(roster.unassigned).map((s) => s.userId));

  const query = search.trim().toLowerCase();
  const candidates = collectAllSoldiers(roster)
    .filter((s) => showAll || tiers === null || tiers.includes(classifyTier(s)))
    .filter(
      (s) =>
        query === "" ||
        s.realName.toLowerCase().includes(query) ||
        s.username.toLowerCase().includes(query) ||
        s.mos.toLowerCase().includes(query),
    )
    .sort((a, b) => {
      const poolDiff = Number(poolIds.has(b.userId)) - Number(poolIds.has(a.userId));
      if (poolDiff !== 0) return poolDiff;
      const orderA = rankOrder.get(a.rankId) ?? Number.MAX_SAFE_INTEGER;
      const orderB = rankOrder.get(b.rankId) ?? Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      return a.realName.localeCompare(b.realName);
    });

  function rowFor(soldier: Soldier) {
    const inPool = poolIds.has(soldier.userId);
    const location = locations.get(soldier.userId)?.label ?? "—";
    const time = practiceTimes.get(soldier.userId);
    return (
      <li key={soldier.userId} className="candidate-row">
        <span className="candidate-name">
          {soldier.rankShort} {soldier.realName}
          {soldier.username && <span className="candidate-username"> ({soldier.username})</span>}
        </span>
        <span className="candidate-meta">
          {soldier.mos || "—"}
          {time ? ` · ${time}` : ""}
        </span>
        <span className={`candidate-location${inPool ? " candidate-pool" : ""}`}>
          {inPool ? "In the pool" : location}
        </span>
        <button onClick={() => onAssign(soldier.userId)}>Assign</button>
      </li>
    );
  }

  return (
    <div className="soldier-form-backdrop" onClick={onClose}>
      <div className="candidate-picker" onClick={(e) => e.stopPropagation()}>
        <h3>Assign: {describeSlot(destination)}</h3>
        <p className="candidate-tier-note">
          {tiers === null || showAll
            ? "Showing everyone."
            : `Showing ${tiers.map((t) => TIER_LABELS[t]).join(" / ")} — the tier this billet draws from.`}
        </p>
        <div className="candidate-controls">
          <input
            className="import-search"
            placeholder="Search name, username, or MOS…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          {tiers !== null && (
            <label className="candidate-showall">
              <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />{" "}
              Show all ranks
            </label>
          )}
        </div>
        <ul className="candidate-list">
          {candidates.map(rowFor)}
          {candidates.length === 0 && (
            <li className="candidate-empty">
              Nobody matches{tiers !== null && !showAll ? " — try “Show all ranks”" : ""}.
            </li>
          )}
        </ul>
        <button className="add-btn" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
