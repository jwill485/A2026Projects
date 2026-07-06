import { useEffect, useState } from "react";
import { fetchCombatRoster, fetchRanks } from "./lib/api";
import { buildRosterData } from "./lib/buildRoster";
import { makeBlankRoster, makeSoldier } from "./lib/rosterFactory";
import { addCompany, deleteSoldier, updateSoldier, type SoldierPatch } from "./lib/moveSoldier";
import { diffRosters } from "./lib/changelog";
import {
  loadStoredRoster,
  saveRoster,
  loadBaseline,
  saveBaseline,
  loadChangeLog,
  saveChangeLog,
  type ChangeLogEntry,
} from "./lib/persistence";
import { RosterTree, UnassignedPool } from "./components/RosterTree";
import { DragDropTree } from "./components/DragDropTree";
import { AnalyticsTab } from "./components/AnalyticsTab";
import { ChangeLogPanel } from "./components/ChangeLogPanel";
import type { RosterData } from "./types/roster";
import type { ApiRankExpanded } from "./types/api";
import "./App.css";

type Tab = "roster" | "dragdrop" | "analytics";

function App() {
  const [roster, setRoster] = useState<RosterData | null>(null);
  const [baseline, setBaseline] = useState<RosterData | null>(null);
  const [changeLog, setChangeLog] = useState<ChangeLogEntry[]>([]);
  const [showChangeLog, setShowChangeLog] = useState(false);
  const [ranks, setRanks] = useState<ApiRankExpanded[] | null>(null);
  const [rankOrder, setRankOrder] = useState<Map<string, number> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("roster");

  useEffect(() => {
    let cancelled = false;
    const stored = loadStoredRoster();
    setChangeLog(loadChangeLog());
    fetchRanks()
      .then((ranksResponse) => {
        if (cancelled) return undefined;
        const order = new Map(
          ranksResponse.ranks.map((rank) => [rank.rankId, rank.rankDisplayOrder]),
        );
        setRankOrder(order);
        setRanks(ranksResponse.ranks);
        if (stored) {
          setRoster(stored);
          const storedBaseline = loadBaseline() ?? stored;
          setBaseline(storedBaseline);
          saveBaseline(storedBaseline);
          return undefined;
        }
        return fetchCombatRoster().then((apiRoster) => {
          if (cancelled) return;
          const built = buildRosterData(apiRoster, order);
          setRoster(built);
          saveRoster(built);
          setBaseline(built);
          saveBaseline(built);
        });
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleChange(next: RosterData) {
    setRoster(next);
    saveRoster(next);
  }

  function handleStartBlank() {
    if (
      !window.confirm(
        "Start a blank roster? This replaces the current roster entirely — save or export anything you need first.",
      )
    ) {
      return;
    }
    const blank = makeBlankRoster();
    setRoster(blank);
    saveRoster(blank);
    setBaseline(blank);
    saveBaseline(blank);
  }

  function handleAddCompany(letter: string, name: string): boolean {
    if (!roster) return false;
    const result = addCompany(roster, letter, name);
    if (result.ok) handleChange(result.roster);
    return result.ok;
  }

  function handleAddSoldier(input: { realName: string; rankId: string; rankShort: string; rankFull: string; mos: string }) {
    if (!roster) return;
    const soldier = makeSoldier(input);
    const next = structuredClone(roster);
    // New soldiers land in a holding squad within Unassigned so they always have a home.
    let platoon = next.unassigned.platoons.find((p) => p.number === "0");
    if (!platoon) {
      platoon = { number: "0", leader: null, sergeant: null, squads: [] };
      next.unassigned.platoons.unshift(platoon);
    }
    let squad = platoon.squads.find((s) => s.number === "0");
    if (!squad) {
      squad = { number: "0", leader: null, members: [] };
      platoon.squads.unshift(squad);
    }
    squad.members.push(soldier);
    handleChange(next);
  }

  function handleEditSoldier(userId: string, patch: SoldierPatch) {
    if (!roster) return;
    handleChange(updateSoldier(roster, userId, patch));
  }

  function handleDeleteSoldier(userId: string) {
    if (!roster) return;
    if (!window.confirm("Delete this soldier? This cannot be undone (other than Revert).")) return;
    handleChange(deleteSoldier(roster, userId));
  }

  function handleRefresh() {
    if (!rankOrder) return;
    if (
      !window.confirm(
        "Refresh from the 7Cav API? This discards any manual moves you've made and rebuilds the roster from live data.",
      )
    ) {
      return;
    }
    Promise.all([fetchCombatRoster(), fetchRanks()])
      .then(([apiRoster, ranksResponse]) => {
        const order = new Map(
          ranksResponse.ranks.map((rank) => [rank.rankId, rank.rankDisplayOrder]),
        );
        setRankOrder(order);
        const built = buildRosterData(apiRoster, order);
        setRoster(built);
        saveRoster(built);
        setBaseline(built);
        saveBaseline(built);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }

  function handleRevert() {
    if (!baseline) return;
    if (
      !window.confirm(
        "Revert all changes since the last save? This discards moves you haven't saved yet.",
      )
    ) {
      return;
    }
    setRoster(baseline);
    saveRoster(baseline);
  }

  function handleSave() {
    if (!roster || !baseline) return;
    const changes = diffRosters(baseline, roster);
    if (changes.length === 0) {
      window.alert("No changes since the last save.");
      return;
    }
    const entry: ChangeLogEntry = { timestamp: new Date().toISOString(), changes };
    const updatedLog = [entry, ...changeLog];
    setChangeLog(updatedLog);
    saveChangeLog(updatedLog);
    setBaseline(roster);
    saveBaseline(roster);
    setShowChangeLog(true);
  }

  if (error) {
    return (
      <section id="center">
        <p className="vacant">Failed to load roster: {error}</p>
        <p>Is the backend running at http://localhost:8000?</p>
      </section>
    );
  }

  if (!roster || !rankOrder || !baseline || !ranks) {
    return (
      <section id="center">
        <p>Loading roster…</p>
      </section>
    );
  }

  const pendingChanges = diffRosters(baseline, roster).length;

  return (
    <section id="center" style={{ alignItems: "stretch", maxWidth: "900px" }}>
      <h1>2-7 Cavalry Battalion Roster</h1>
      <nav className="tab-bar">
        <div className="tab-group">
          <button className={tab === "roster" ? "active" : ""} onClick={() => setTab("roster")}>
            Battalion Roster
          </button>
          <button className={tab === "dragdrop" ? "active" : ""} onClick={() => setTab("dragdrop")}>
            Drag &amp; Drop
          </button>
          <button
            className={tab === "analytics" ? "active" : ""}
            onClick={() => setTab("analytics")}
          >
            Analytics
          </button>
        </div>
        <div className="action-group">
          <button className="refresh-btn" onClick={handleRefresh}>
            Refresh from API
          </button>
          <button className="blank-btn" onClick={handleStartBlank}>
            Start Blank Roster
          </button>
          <button onClick={handleSave} disabled={pendingChanges === 0}>
            Save Changes{pendingChanges > 0 ? ` (${pendingChanges})` : ""}
          </button>
          <button className="revert-btn" onClick={handleRevert} disabled={pendingChanges === 0}>
            Revert Changes
          </button>
          <button onClick={() => setShowChangeLog((v) => !v)}>
            Change Log ({changeLog.length})
          </button>
        </div>
      </nav>

      {showChangeLog && <ChangeLogPanel entries={changeLog} />}

      {tab === "roster" && (
        <>
          <RosterTree battalion={roster.battalion} />
          <UnassignedPool group={roster.unassigned} />
        </>
      )}
      {tab === "dragdrop" && (
        <DragDropTree
          roster={roster}
          onChange={handleChange}
          ranks={ranks}
          onAddCompany={handleAddCompany}
          onAddSoldier={handleAddSoldier}
          onEditSoldier={handleEditSoldier}
          onDeleteSoldier={handleDeleteSoldier}
        />
      )}
      {tab === "analytics" && <AnalyticsTab roster={roster} />}
    </section>
  );
}

export default App;
