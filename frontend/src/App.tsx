import { useEffect, useState } from "react";
import { fetchCombatRoster, fetchRanks } from "./lib/api";
import { buildRosterData } from "./lib/buildRoster";
import { loadStoredRoster, saveRoster } from "./lib/persistence";
import { RosterTree, UnassignedPool } from "./components/RosterTree";
import { DragDropTree } from "./components/DragDropTree";
import { AnalyticsTab } from "./components/AnalyticsTab";
import type { RosterData } from "./types/roster";
import "./App.css";

type Tab = "roster" | "dragdrop" | "analytics";

function App() {
  const [roster, setRoster] = useState<RosterData | null>(null);
  const [rankOrder, setRankOrder] = useState<Map<string, number> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("roster");

  useEffect(() => {
    const stored = loadStoredRoster();
    fetchRanks()
      .then((ranksResponse) => {
        const order = new Map(
          ranksResponse.ranks.map((rank) => [rank.rankId, rank.rankDisplayOrder]),
        );
        setRankOrder(order);
        if (stored) {
          setRoster(stored);
          return undefined;
        }
        return fetchCombatRoster().then((apiRoster) => {
          const built = buildRosterData(apiRoster, order);
          setRoster(built);
          saveRoster(built);
        });
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  function handleChange(next: RosterData) {
    setRoster(next);
    saveRoster(next);
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
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }

  if (error) {
    return (
      <section id="center">
        <p className="vacant">Failed to load roster: {error}</p>
        <p>Is the backend running at http://localhost:8000?</p>
      </section>
    );
  }

  if (!roster || !rankOrder) {
    return (
      <section id="center">
        <p>Loading roster…</p>
      </section>
    );
  }

  return (
    <section id="center" style={{ alignItems: "stretch", maxWidth: "900px" }}>
      <h1>2-7 Cavalry Battalion Roster</h1>
      <nav className="tab-bar">
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
        <button className="refresh-btn" onClick={handleRefresh}>
          Refresh from API
        </button>
      </nav>

      {tab === "roster" && (
        <>
          <RosterTree battalion={roster.battalion} />
          <UnassignedPool group={roster.unassigned} />
        </>
      )}
      {tab === "dragdrop" && <DragDropTree roster={roster} onChange={handleChange} />}
      {tab === "analytics" && <AnalyticsTab roster={roster} />}
    </section>
  );
}

export default App;
