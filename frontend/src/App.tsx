import { useEffect, useState } from "react";
import { fetchCombatRoster, fetchRanks } from "./lib/api";
import { buildRosterData } from "./lib/buildRoster";
import { makeBlankRoster, makeSoldier } from "./lib/rosterFactory";
import {
  addCompany,
  addSoldierToCompany,
  addSoldierToUnassigned,
  deleteSoldier,
  importCompany,
  updateSoldier,
  type SoldierPatch,
} from "./lib/moveSoldier";
import { collectAllSoldiers } from "./lib/analytics";
import { diffRosters } from "./lib/changelog";
import {
  listRosters,
  getActiveRosterId,
  setActiveRosterId,
  loadRoster,
  saveRoster,
  loadBaseline,
  saveBaseline,
  loadChangeLog,
  saveChangeLog,
  clearChangeLog,
  touchRoster,
  createRoster,
  renameRoster,
  setRosterConfiguration,
  deleteRoster,
  migrateLegacyStorage,
  type ChangeLogEntry,
  type RosterConfiguration,
  type RosterSummary,
} from "./lib/persistence";
import { RosterTree, UnassignedPool } from "./components/RosterTree";
import { DragDropTree } from "./components/DragDropTree";
import { AnalyticsTab } from "./components/AnalyticsTab";
import { ChangeLogPanel } from "./components/ChangeLogPanel";
import { RosterPicker } from "./components/RosterPicker";
import { OrgChart } from "./components/OrgChart";
import { RosterListView } from "./components/RosterListView";
import { RosterFilterBar } from "./components/RosterFilterBar";
import { EMPTY_FILTER, type RosterFilter } from "./lib/filterRoster";
import { buildSplitRoster, SPLIT_GROUPS } from "./lib/splitReorg";
import { applySplitTags, type SplitTagImportResult, type SplitTagRow } from "./lib/splitTagImport";
import { SplitPlanner } from "./components/SplitPlanner";
import type { Company, RosterData, Soldier, SplitStatus } from "./types/roster";
import type { ApiRankExpanded } from "./types/api";
import "./App.css";

type Tab = "roster" | "dragdrop" | "split" | "analytics";
type RosterView = "tree" | "orgchart" | "list";

function App() {
  const [rosterId, setRosterId] = useState<string | null>(null);
  const [rosterList, setRosterList] = useState<RosterSummary[]>([]);
  const [roster, setRoster] = useState<RosterData | null>(null);
  const [baseline, setBaseline] = useState<RosterData | null>(null);
  const [changeLog, setChangeLog] = useState<ChangeLogEntry[]>([]);
  const [showChangeLog, setShowChangeLog] = useState(false);
  const [ranks, setRanks] = useState<ApiRankExpanded[] | null>(null);
  const [rankOrder, setRankOrder] = useState<Map<string, number> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("split");
  const [rosterView, setRosterView] = useState<RosterView>("tree");
  const [rosterFilter, setRosterFilter] = useState<RosterFilter>(EMPTY_FILTER);

  function activateRoster(id: string) {
    setRosterView("tree");
    setRosterId(id);
    const loadedRoster = loadRoster(id);
    setRoster(loadedRoster);
    setBaseline(loadBaseline(id) ?? loadedRoster);
    setChangeLog(loadChangeLog(id));
    setActiveRosterId(id);
  }

  useEffect(() => {
    let cancelled = false;
    migrateLegacyStorage();
    const existing = listRosters();
    fetchRanks()
      .then((ranksResponse) => {
        if (cancelled) return undefined;
        const order = new Map(
          ranksResponse.ranks.map((rank) => [rank.rankId, rank.rankDisplayOrder]),
        );
        setRankOrder(order);
        setRanks(ranksResponse.ranks);
        if (existing.length > 0) {
          setRosterList(existing);
          const activeId = getActiveRosterId();
          activateRoster(existing.some((r) => r.id === activeId) ? activeId! : existing[0].id);
          return undefined;
        }
        return fetchCombatRoster().then((apiRoster) => {
          if (cancelled) return;
          const built = buildRosterData(apiRoster, order);
          const id = createRoster("2-7 Cavalry Battalion", built);
          setRosterList(listRosters());
          activateRoster(id);
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
    if (!rosterId) return;
    setRoster(next);
    saveRoster(rosterId, next);
  }

  function handleSwitchRoster(id: string) {
    activateRoster(id);
  }

  function handleCreateRoster(
    name: string,
    mode: "blank" | "duplicate",
    configuration: RosterConfiguration | undefined,
  ) {
    const starting = mode === "duplicate" && roster ? structuredClone(roster) : makeBlankRoster();
    const id = createRoster(name, starting, starting, configuration);
    setRosterList(listRosters());
    activateRoster(id);
  }

  function handleRenameRoster(id: string, name: string, configuration: RosterConfiguration | undefined) {
    renameRoster(id, name);
    setRosterConfiguration(id, configuration);
    setRosterList(listRosters());
  }

  function handleDeleteRoster(id: string) {
    if (rosterList.length <= 1) return;
    if (!window.confirm("Delete this roster? This cannot be undone.")) return;
    const remaining = rosterList.filter((r) => r.id !== id);
    deleteRoster(id);
    setRosterList(remaining);
    if (id === rosterId) activateRoster(remaining[0].id);
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
    handleChange(addSoldierToUnassigned(roster, soldier));
  }

  function handleImportSoldier(soldier: Soldier, targetLetter: string): boolean {
    if (!roster) return false;
    const alreadyPresent = collectAllSoldiers(roster).some((s) => s.userId === soldier.userId);
    if (alreadyPresent) return false;
    handleChange(addSoldierToCompany(roster, targetLetter, soldier));
    return true;
  }

  function handleImportCompany(company: Company): boolean {
    if (!roster) return false;
    const result = importCompany(roster, company);
    if (result.ok) handleChange(result.roster);
    return result.ok;
  }

  function handleEditSoldier(userId: string, patch: SoldierPatch) {
    if (!roster) return;
    handleChange(updateSoldier(roster, userId, patch));
  }

  function handleDeleteSoldier(userId: string) {
    if (!roster) return;
    if (!window.confirm("Delete this trooper? This cannot be undone (other than Revert).")) return;
    handleChange(deleteSoldier(roster, userId));
  }

  function handleSetSplitStatus(userId: string, status: SplitStatus) {
    if (!roster) return;
    handleChange(updateSoldier(roster, userId, { splitStatus: status }));
  }

  function handleImportSplitTags(rows: SplitTagRow[]): SplitTagImportResult | null {
    if (!roster) return null;
    const result = applySplitTags(roster, rows);
    if (result.applied > 0) handleChange(result.roster);
    return result;
  }

  function handleCommitSplit() {
    if (!roster) return;
    if (
      !window.confirm(
        "Commit the split? Everyone tagged HLLV or HLLWW2 lands in that battalion's Unassigned pool " +
          "(sorted by rank) under an empty battalion, ready for you to build structure around. " +
          "If the HLLV/HLLWW2 rosters already exist, their contents are replaced.",
      )
    ) {
      return;
    }
    for (const { name, status } of SPLIT_GROUPS) {
      const built = buildSplitRoster(roster, status, name, rankOrder ?? undefined);
      const existing = rosterList.find((r) => r.name === name);
      if (existing) {
        saveRoster(existing.id, built);
        saveBaseline(existing.id, built);
        setRosterConfiguration(existing.id, "new");
        touchRoster(existing.id);
      } else {
        createRoster(name, built, built, "new");
      }
    }
    setRosterList(listRosters());
    window.alert("HLLV and HLLWW2 rosters have been generated/updated.");
  }

  function handleOpenRosterBuild(id: string) {
    activateRoster(id);
    setTab("dragdrop");
  }

  function handleStartSorting() {
    // Pre-set the filter to undecided troopers so the tree acts as a work
    // queue: people disappear from view as they get tagged.
    setRosterFilter({ ...EMPTY_FILTER, splitTag: "neutral" });
    setTab("roster");
  }

  function handleRefresh() {
    if (!rankOrder || !rosterId) return;
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
        saveRoster(rosterId, built);
        setBaseline(built);
        saveBaseline(rosterId, built);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }

  function handleRevert() {
    if (!baseline || !rosterId) return;
    if (
      !window.confirm(
        "Revert all changes since the last save? This discards moves you haven't saved yet.",
      )
    ) {
      return;
    }
    setRoster(baseline);
    saveRoster(rosterId, baseline);
  }

  function handleSave() {
    if (!roster || !baseline || !rosterId) return;
    const changes = diffRosters(baseline, roster);
    if (changes.length === 0) {
      window.alert("No changes since the last save.");
      return;
    }
    const entry: ChangeLogEntry = { timestamp: new Date().toISOString(), changes };
    const updatedLog = [entry, ...changeLog];
    setChangeLog(updatedLog);
    saveChangeLog(rosterId, updatedLog);
    setBaseline(roster);
    saveBaseline(rosterId, roster);
    touchRoster(rosterId);
    setRosterList(listRosters());
    setShowChangeLog(true);
  }

  function handleClearChangeLog() {
    if (!rosterId) return;
    if (!window.confirm("Clear the entire change log? This cannot be undone.")) return;
    setChangeLog([]);
    clearChangeLog(rosterId);
  }

  function handleDeleteChangeLogEntry(timestamp: string) {
    if (!rosterId) return;
    const updated = changeLog.filter((entry) => entry.timestamp !== timestamp);
    setChangeLog(updated);
    saveChangeLog(rosterId, updated);
  }

  if (error) {
    return (
      <section id="center">
        <p className="vacant">Failed to load roster: {error}</p>
        <p>Is the backend running at http://localhost:8000?</p>
      </section>
    );
  }

  if (!roster || !rankOrder || !baseline || !ranks || !rosterId) {
    return (
      <section id="center">
        <p>Loading roster…</p>
      </section>
    );
  }

  const pendingChanges = diffRosters(baseline, roster).length;
  const activeConfiguration = rosterList.find((r) => r.id === rosterId)?.configuration;
  // Tagging only makes sense on the split's *source* roster — hide the
  // toggles entirely on rosters that are themselves split outputs.
  const splitStatusHandler = activeConfiguration === "new" ? undefined : handleSetSplitStatus;
  // The default pool wording is about B/ACD, which is wrong for a split
  // output where the pool holds this battalion's committed-but-unplaced troopers.
  const poolTitle = activeConfiguration === "new" ? "Pool" : undefined;
  const poolHint =
    activeConfiguration === "new"
      ? "Troopers committed to this battalion, sorted by rank — assign Battalion HQ first, then build companies around your leadership (see Split Planner)."
      : undefined;
  const mosOptions = [...new Set(collectAllSoldiers(roster).map((s) => s.mos))]
    .filter((mos) => mos.trim() !== "")
    .sort();

  return (
    <section id="center" style={{ alignItems: "stretch", maxWidth: "900px" }}>
      <h1>2-7 Cavalry Battalion Roster</h1>
      <nav className="tab-bar">
        <RosterPicker
          rosterList={rosterList}
          activeRosterId={rosterId}
          onSwitch={handleSwitchRoster}
          onCreate={handleCreateRoster}
          onRename={handleRenameRoster}
          onDelete={handleDeleteRoster}
        />
        <div className="tab-group">
          <button className={tab === "split" ? "active" : ""} onClick={() => setTab("split")}>
            Split Planner
          </button>
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

      {showChangeLog && (
        <ChangeLogPanel
          entries={changeLog}
          onClearAll={handleClearChangeLog}
          onDeleteEntry={handleDeleteChangeLogEntry}
        />
      )}

      {(tab === "roster" || tab === "dragdrop") && (
        <RosterFilterBar
          filter={rosterFilter}
          onChange={setRosterFilter}
          ranks={ranks}
          mosOptions={mosOptions}
        />
      )}

      {tab === "roster" && (
        <>
          {activeConfiguration && (
            <div className={`config-badge config-badge-${activeConfiguration}`}>
              Viewing: {activeConfiguration === "old" ? "Old Configuration (pre-split)" : "New Configuration (post-split)"}
            </div>
          )}
          <div className="roster-view-buttons" style={{ marginBottom: "0.8rem", display: "flex", gap: "0.5rem" }}>
            <button
              className="add-btn"
              onClick={() => setRosterView((v) => (v === "orgchart" ? "tree" : "orgchart"))}
              disabled={pendingChanges > 0}
              title={pendingChanges > 0 ? "Save or revert your changes first" : undefined}
            >
              {rosterView === "orgchart" ? "Hide Org Chart" : "Generate Org Chart"}
            </button>
            <button
              className="add-btn"
              onClick={() => setRosterView((v) => (v === "list" ? "tree" : "list"))}
            >
              {rosterView === "list" ? "Hide Roster List" : "Print Roster"}
            </button>
          </div>
          {rosterView === "orgchart" && pendingChanges === 0 ? (
            <OrgChart battalion={roster.battalion} unassigned={roster.unassigned} />
          ) : rosterView === "list" ? (
            <RosterListView battalion={roster.battalion} unassigned={roster.unassigned} />
          ) : (
            <>
              <RosterTree
                battalion={roster.battalion}
                filter={rosterFilter}
                onSetSplitStatus={splitStatusHandler}
              />
              <UnassignedPool
                group={roster.unassigned}
                filter={rosterFilter}
                onSetSplitStatus={splitStatusHandler}
                title={poolTitle}
                hint={poolHint}
              />
            </>
          )}
        </>
      )}
      {tab === "dragdrop" && (
        <DragDropTree
          roster={roster}
          rosterId={rosterId}
          onChange={handleChange}
          ranks={ranks}
          onAddCompany={handleAddCompany}
          onAddSoldier={handleAddSoldier}
          onEditSoldier={handleEditSoldier}
          onDeleteSoldier={handleDeleteSoldier}
          onImportSoldier={handleImportSoldier}
          onImportCompany={handleImportCompany}
          onSetSplitStatus={splitStatusHandler}
          filter={rosterFilter}
          unassignedHint={poolHint}
        />
      )}
      {tab === "split" && (
        <SplitPlanner
          roster={roster}
          rosterList={rosterList}
          activeConfiguration={activeConfiguration}
          loadRosterData={loadRoster}
          onCommitSplit={handleCommitSplit}
          onOpenRoster={handleOpenRosterBuild}
          onStartSorting={handleStartSorting}
          onImportSplitTags={handleImportSplitTags}
        />
      )}
      {tab === "analytics" && <AnalyticsTab roster={roster} />}
    </section>
  );
}

export default App;
