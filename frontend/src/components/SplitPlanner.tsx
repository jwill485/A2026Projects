import { useRef, useState } from "react";
import type { RosterData, Soldier } from "../types/roster";
import type { RosterSummary } from "../lib/persistence";
import { collectAllSoldiers, collectCompanySoldiers, computeLeadershipFillByCompany } from "../lib/analytics";
import { bucketByTier, TIER_BILLETS, TIER_LABELS, TIER_ORDER } from "../lib/leadership";
import { SPLIT_GROUPS } from "../lib/splitReorg";
import { parseSplitTagCsv, type SplitTagImportResult, type SplitTagRow } from "../lib/splitTagImport";
import "./SplitPlanner.css";

type PhaseState = "done" | "active" | "todo";

function PhaseChip({ state }: { state: PhaseState }) {
  const label = state === "done" ? "Done" : state === "active" ? "In progress" : "Not started";
  return <span className={`phase-chip phase-chip-${state}`}>{label}</span>;
}

function TierList({ soldiers }: { soldiers: Soldier[] }) {
  const buckets = bucketByTier(soldiers);
  return (
    <div className="tier-list">
      {TIER_ORDER.map((tier) => (
        <details key={tier} className="tier-row">
          <summary>
            <span className="tier-name">{TIER_LABELS[tier]}</span>
            <span className={`tier-count${tier !== "trooper" && buckets[tier].length === 0 ? " tier-count-zero" : ""}`}>
              {buckets[tier].length}
            </span>
            <span className="tier-billets">{TIER_BILLETS[tier]}</span>
          </summary>
          <ul>
            {buckets[tier].map((s) => (
              <li key={s.userId}>
                {s.rankShort} {s.realName}
              </li>
            ))}
            {buckets[tier].length === 0 && <li className="tier-empty">Nobody in this tier yet</li>}
          </ul>
        </details>
      ))}
    </div>
  );
}

export function SplitPlanner({
  roster,
  rosterList,
  activeConfiguration,
  loadRosterData,
  onCommitSplit,
  onOpenRoster,
  onStartSorting,
  onImportSplitTags,
}: {
  roster: RosterData;
  rosterList: RosterSummary[];
  activeConfiguration?: "old" | "new";
  loadRosterData: (id: string) => RosterData | null;
  onCommitSplit: () => void;
  onOpenRoster: (id: string) => void;
  onStartSorting: () => void;
  onImportSplitTags: (rows: SplitTagRow[]) => SplitTagImportResult | null;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importSummary, setImportSummary] = useState<string[] | null>(null);

  function handleTagFile(file: File) {
    file.text().then((text) => {
      const { rows, badLines } = parseSplitTagCsv(text);
      const lines: string[] = [];
      if (rows.length === 0) {
        lines.push(
          "No usable lines found. Expected two columns per line: trooper (username or real name), then N, HLLV, or HLLWW2.",
        );
      } else {
        const result = onImportSplitTags(rows);
        if (!result) return;
        lines.push(`${result.applied} tag${result.applied === 1 ? "" : "s"} applied.`);
        if (result.notFound.length > 0) {
          lines.push(`Not on this roster (skipped): ${result.notFound.join(", ")}`);
        }
        if (result.ambiguous.length > 0) {
          lines.push(
            `Name matches more than one trooper — use their username instead: ${result.ambiguous.join(", ")}`,
          );
        }
      }
      if (badLines.length > 0) {
        lines.push(
          `Unreadable line${badLines.length === 1 ? "" : "s"} (skipped): ${badLines
            .map((b) => `#${b.line} "${b.text}"`)
            .join(", ")}`,
        );
      }
      setImportSummary(lines);
    });
  }

  const everyone = collectAllSoldiers(roster);
  const groups = SPLIT_GROUPS.map((g) => ({
    ...g,
    members: everyone.filter((s) => s.splitStatus === g.status),
    summary: rosterList.find((r) => r.name === g.name),
  }));
  const taggedCount = groups.reduce((sum, g) => sum + g.members.length, 0);
  const neutralCount = everyone.length - taggedCount;

  const sortState: PhaseState =
    everyone.length > 0 && neutralCount === 0 ? "done" : taggedCount > 0 ? "active" : "todo";
  const commitState: PhaseState = groups.every((g) => g.summary)
    ? "done"
    : groups.some((g) => g.summary)
      ? "active"
      : "todo";

  const builds = groups
    .filter((g) => g.summary)
    .map((g) => {
      const data = loadRosterData(g.summary!.id);
      if (!data) return { ...g, data: null, hqFilled: 0, companies: 0, leadFilled: 0, leadTotal: 0, poolLeft: 0 };
      const hqFilled = [data.battalion.commander, data.battalion.executiveOfficer, data.battalion.sergeantMajor]
        .filter(Boolean).length;
      const fill = computeLeadershipFillByCompany(data);
      const leadFilled = fill.reduce((sum, f) => sum + f.filled, 0);
      const leadTotal = fill.reduce((sum, f) => sum + f.filled + f.vacant, 0);
      const poolLeft = collectCompanySoldiers(data.unassigned).length;
      return { ...g, data, hqFilled, companies: data.battalion.companies.length, leadFilled, leadTotal, poolLeft };
    });
  const buildState: PhaseState =
    builds.length === 0
      ? "todo"
      : builds.every((b) => b.hqFilled === 3 && b.companies > 0 && b.poolLeft === 0)
        ? "done"
        : "active";

  return (
    <div className="split-planner">
      {activeConfiguration === "new" && (
        <p className="planner-warning">
          You're viewing one of the split's <em>output</em> rosters. Sorting and committing happen on the
          source roster — switch to it in the roster dropdown to tag troopers.
        </p>
      )}

      <section className="phase-card">
        <header>
          <span className="phase-number">1</span>
          <h3>Sort troopers</h3>
          <PhaseChip state={sortState} />
        </header>
        <p>
          Tag every trooper for a battalion using the <strong>N / HLLV / HLLWW2</strong> toggle next to
          their name on the Battalion Roster or Drag &amp; Drop tab. Use the filter bar's{" "}
          <strong>split tag</strong> dropdown (set to "Neutral") to see only who's still undecided.
        </p>
        <div className="sort-counts">
          <span className="sort-count sort-neutral">{neutralCount} undecided</span>
          {groups.map((g) => (
            <span key={g.status} className={`sort-count sort-${g.status}`}>
              {g.members.length} → {g.name}
            </span>
          ))}
          <span className="sort-count sort-total">{everyone.length} total</span>
        </div>
        {activeConfiguration !== "new" && (
          <div className="sort-actions">
            {neutralCount > 0 && (
              <button className="add-btn start-sorting-btn" onClick={onStartSorting}>
                Start sorting ({neutralCount} to go) →
              </button>
            )}
            <button className="add-btn" onClick={() => fileInputRef.current?.click()}>
              Import tags from CSV…
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleTagFile(file);
                e.target.value = ""; // allow re-selecting the same file
              }}
            />
          </div>
        )}
        {importSummary && (
          <div className="import-summary">
            {importSummary.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        )}
      </section>

      <section className="phase-card">
        <header>
          <span className="phase-number">2</span>
          <h3>Review leadership</h3>
          <PhaseChip state={taggedCount > 0 ? "active" : "todo"} />
        </header>
        <p>
          What each battalion has to work with, by tier. A zero in Officers or Senior NCOs means that
          battalion can't fill its key billets yet — consider re-balancing tags before committing.
        </p>
        <div className="group-grid">
          {groups.map((g) => (
            <div key={g.status} className={`group-card group-${g.status}`}>
              <h4>
                {g.name} <span className="group-headcount">{g.members.length} tagged</span>
              </h4>
              {g.members.length > 0 ? (
                <TierList soldiers={g.members} />
              ) : (
                <p className="tier-empty">Nobody tagged for {g.name} yet.</p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="phase-card">
        <header>
          <span className="phase-number">3</span>
          <h3>Commit the split</h3>
          <PhaseChip state={commitState} />
        </header>
        <p>
          Creates (or refreshes) one roster per battalion. Everyone tagged for it lands in that roster's{" "}
          <strong>Unassigned pool</strong>, sorted by rank, under an empty battalion — structure comes in
          the next step. Safe to re-run as tags change; it overwrites the same two rosters.
        </p>
        <button className="add-btn commit-split-btn" onClick={onCommitSplit} disabled={taggedCount === 0}>
          {commitState === "todo" ? "Commit Split" : "Re-commit (update both rosters)"}
        </button>
      </section>

      <section className="phase-card">
        <header>
          <span className="phase-number">4</span>
          <h3>Build the battalions</h3>
          <PhaseChip state={buildState} />
        </header>
        <p>
          In each new roster: assign <strong>Battalion CO/XO/SGM</strong> first (drag from the Unassigned
          pool onto Battalion HQ), then <strong>+ Add Company</strong> for each company you have leadership
          for, fill its CO/XO/1SG, and build platoons and squads down from there.
        </p>
        {builds.length === 0 ? (
          <p className="tier-empty">Run Commit Split to create the battalion rosters first.</p>
        ) : (
          <div className="group-grid">
            {builds.map((b) => (
              <div key={b.status} className={`group-card group-${b.status}`}>
                <h4>{b.name}</h4>
                <ul className="build-stats">
                  <li className={b.hqFilled === 3 ? "stat-done" : ""}>Battalion HQ: {b.hqFilled}/3 filled</li>
                  <li className={b.companies > 0 ? "stat-done" : ""}>Companies created: {b.companies}</li>
                  <li className={b.leadTotal > 0 && b.leadFilled === b.leadTotal ? "stat-done" : ""}>
                    Company leadership: {b.leadFilled}/{b.leadTotal} filled
                  </li>
                  <li className={b.poolLeft === 0 ? "stat-done" : ""}>Still in pool: {b.poolLeft}</li>
                </ul>
                <button className="add-btn" onClick={() => onOpenRoster(b.summary!.id)}>
                  Open {b.name} in Drag &amp; Drop
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
