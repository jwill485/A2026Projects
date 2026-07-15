import { useMemo, useRef, useState } from "react";
import type { RosterData, Soldier, SplitStatus, Squad } from "../types/roster";
import type { RosterSummary } from "../lib/persistence";
import type { SquadLocation } from "../lib/moveSoldier";
import {
  collectAllSoldiers,
  collectCompanySoldiers,
  computeLeadershipFillByCompany,
  computeSquadMos,
} from "../lib/analytics";
import { bucketByTier, TIER_BILLETS, TIER_LABELS, TIER_ORDER } from "../lib/leadership";
import { CHARLIE_LETTER, intactExcludedLetters, SPLIT_GROUPS } from "../lib/splitReorg";
import { suggestCompanies, type SuggestedCompany } from "../lib/buildSuggestions";
import { parseSplitTagCsv, type SplitTagImportResult, type SplitTagRow } from "../lib/splitTagImport";
import { SuggestionPreview } from "./SuggestionPreview";
import "./SplitPlanner.css";

type PhaseState = "done" | "active" | "todo";

function PhaseChip({ state }: { state: PhaseState }) {
  const label = state === "done" ? "Done" : state === "active" ? "In progress" : "Not started";
  return <span className={`phase-chip phase-chip-${state}`}>{label}</span>;
}

function TierList({ roster, soldiers }: { roster: RosterData; soldiers: Soldier[] }) {
  // bucketByTier walks the whole roster tree — memoized so it only re-runs
  // when this group's tagged membership or the roster itself changes, not
  // on every unrelated re-render (e.g. typing in a search box elsewhere).
  const buckets = useMemo(() => bucketByTier(roster, soldiers), [roster, soldiers]);
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

function PracticeRow({
  location,
  squad,
  onSetPracticeTime,
}: {
  location: SquadLocation;
  squad: Squad;
  onSetPracticeTime: (location: SquadLocation, time: string) => void;
}) {
  const mos = computeSquadMos(squad);
  return (
    <div className="practice-row">
      <span className="practice-unit">
        Plt {location.platoon} / Sqd {location.squad}
      </span>
      <span className="practice-mos">
        {mos.length > 0 ? mos.map((m) => `${m.label} ×${m.value}`).join(" · ") : "empty"}
      </span>
      <input
        className="practice-input"
        type="text"
        placeholder="e.g. Tue 1900 EST"
        value={squad.practiceTime ?? ""}
        onChange={(e) => onSetPracticeTime(location, e.target.value)}
      />
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
  onRandomizeSplitTags,
  onSetPracticeTime,
  onAcceptPracticeTimes,
  onBeginEditPracticeTimes,
  onSavePracticeTimes,
  onAcceptLeadership,
  onSetIntactTransfer,
  onApplySuggestion,
}: {
  roster: RosterData;
  rosterList: RosterSummary[];
  activeConfiguration?: "old" | "new";
  loadRosterData: (id: string) => RosterData | null;
  onCommitSplit: () => void;
  onOpenRoster: (id: string) => void;
  onStartSorting: () => void;
  onImportSplitTags: (rows: SplitTagRow[]) => SplitTagImportResult | null;
  onRandomizeSplitTags: () => void;
  onSetPracticeTime: (location: SquadLocation, time: string) => void;
  onAcceptPracticeTimes: () => void;
  onBeginEditPracticeTimes: () => void;
  onSavePracticeTimes: () => void;
  onAcceptLeadership: () => void;
  onSetIntactTransfer: (letter: string, status: SplitStatus | null) => void;
  onApplySuggestion: (targetId: string, suggestions: SuggestedCompany[]) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importSummary, setImportSummary] = useState<string[] | null>(null);
  const [editingTimes, setEditingTimes] = useState(false);

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

  const everyone = useMemo(() => collectAllSoldiers(roster), [roster]);
  const groups = useMemo(
    () =>
      SPLIT_GROUPS.map((g) => ({
        ...g,
        members: everyone.filter((s) => s.splitStatus === g.status),
        summary: rosterList.find((r) => r.name === g.name),
      })),
    [everyone, rosterList],
  );
  const taggedCount = groups.reduce((sum, g) => sum + g.members.length, 0);
  const neutralCount = everyone.length - taggedCount;

  const sortState: PhaseState =
    everyone.length > 0 && neutralCount === 0 ? "done" : taggedCount > 0 ? "active" : "todo";
  const commitState: PhaseState = groups.every((g) => g.summary)
    ? "done"
    : groups.some((g) => g.summary)
      ? "active"
      : "todo";

  // Reads+parses HLLV/HLLWW2 from localStorage — memoized so it only re-runs
  // when this roster's groups/tags or the roster list actually change
  // (switching the active roster or an explicit save both change one of
  // those), not on every unrelated re-render.
  const builds = useMemo(
    () =>
      groups
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
        }),
    [groups, loadRosterData],
  );
  const buildState: PhaseState =
    builds.length === 0
      ? "todo"
      : builds.every((b) => b.hqFilled === 3 && b.companies > 0 && b.poolLeft === 0)
        ? "done"
        : "active";

  // suggestCompanies clusters/bins the whole source roster by practice time
  // and classifies leadership tiers — heavy enough to be worth hoisting out
  // of the JSX .map() below and memoizing, since this ran fresh on every
  // render for both battalions otherwise.
  const buildSuggestions = useMemo(() => {
    const map = new Map<SplitStatus, { companies: SuggestedCompany[]; warnings: string[] }>();
    for (const b of builds) {
      // Suggestions come from the SOURCE roster's tags + practice times, so
      // they're only meaningful when planning from it.
      map.set(
        b.status,
        b.data && activeConfiguration !== "new"
          ? suggestCompanies(roster, b.status, {
              excludeCompanies: intactExcludedLetters(roster, b.status),
              usedLetters: b.data.battalion.companies.map((c) => c.letter),
            })
          : { companies: [], warnings: [] },
      );
    }
    return map;
  }, [builds, roster, activeConfiguration]);

  // B/ACD (the Unassigned pool) practices too — findCompany resolves its
  // "UNASSIGNED" letter the same as any company, so its squads join in.
  const practiceCompanies = [...roster.battalion.companies, roster.unassigned];
  const allSquads = practiceCompanies.flatMap((company) =>
    company.platoons.flatMap((platoon) =>
      platoon.squads.map((squad) => ({
        location: { company: company.letter, platoon: platoon.number, squad: squad.number },
        squad,
      })),
    ),
  );
  const timedCount = allSquads.filter((s) => (s.squad.practiceTime ?? "").trim() !== "").length;
  const practiceState: PhaseState = roster.practiceTimesConfirmed
    ? "done"
    : timedCount > 0 || editingTimes
      ? "active"
      : "todo";
  const leadershipState: PhaseState = roster.leadershipAccepted
    ? "done"
    : taggedCount > 0
      ? "active"
      : "todo";

  // Commit Split stays locked until sorting is finished and both sign-offs
  // are in — the blockers list doubles as the explanation shown to the user.
  const commitBlockers: string[] = [];
  if (everyone.length === 0) commitBlockers.push("Nobody is on this roster yet");
  else if (neutralCount > 0) commitBlockers.push(`${neutralCount} troopers are still undecided (phase 1)`);
  if (!roster.practiceTimesConfirmed) commitBlockers.push("Practice times haven't been accepted (phase 2)");
  if (!roster.leadershipAccepted) commitBlockers.push("Leadership review hasn't been accepted (phase 3)");

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
            <button
              className="add-btn"
              onClick={onRandomizeSplitTags}
              title="Test helper: coin-flip every trooper onto HLLV or HLLWW2 so you can play with the later phases"
            >
              🎲 Random tags (test)
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
        {activeConfiguration !== "new" && roster.battalion.companies.length > 0 && (
          <div className="intact-transfers">
            <p className="intact-transfers-hint">
              Send a whole company <strong>intact</strong> to a battalion instead of sorting it
              trooper by trooper — Commit carries its structure, leadership, and practice times
              straight over instead of through that battalion's pool.
              {roster.battalion.companies.some((c) => c.letter === CHARLIE_LETTER) &&
                " Charlie (C/2-7) also pulls B/ACD along with it, since that's where its real people currently live."}
            </p>
            {roster.battalion.companies.map((company) => {
              const current = (roster.intactTransfers ?? []).find((t) => t.letter === company.letter)?.status ?? "";
              return (
                <label key={company.letter} className="intact-flag">
                  {company.name} Company ({company.letter}){" "}
                  <select
                    value={current}
                    onChange={(e) =>
                      onSetIntactTransfer(company.letter, (e.target.value || null) as SplitStatus | null)
                    }
                  >
                    <option value="">Keep individual tags</option>
                    {SPLIT_GROUPS.map((g) => (
                      <option key={g.status} value={g.status}>
                        Send intact to {g.name}
                      </option>
                    ))}
                  </select>
                </label>
              );
            })}
          </div>
        )}
      </section>

      <section className="phase-card">
        <header>
          <span className="phase-number">2</span>
          <h3>Practice times</h3>
          <PhaseChip state={practiceState} />
        </header>
        <p>
          Record when each current squad practices, with its MOS makeup alongside — so the Unit
          Builder step can keep squads that train together (or share a specialty) intact. Times are
          free text, saved as you type, and don't count as pending changes.
        </p>
        {allSquads.length === 0 ? (
          <p className="tier-empty">
            No squads on this roster yet — this phase reads the active roster's squads.
          </p>
        ) : (
          <>
            <div className="sort-counts">
              <span className="sort-count">
                {timedCount}/{allSquads.length} squads have a practice time
              </span>
              {roster.practiceTimesConfirmed && (
                <span className="sort-count signoff-ok">Accepted ✓</span>
              )}
            </div>
            {activeConfiguration !== "new" && !editingTimes && (
              <>
                <p className="signoff-question">
                  Accept the current practice times, or edit them first?
                </p>
                <div className="sort-actions">
                  <button
                    className="add-btn"
                    onClick={onAcceptPracticeTimes}
                    disabled={roster.practiceTimesConfirmed}
                  >
                    Accept current practice times
                  </button>
                  <button
                    className="add-btn"
                    onClick={() => {
                      onBeginEditPracticeTimes();
                      setEditingTimes(true);
                    }}
                  >
                    Edit practice times
                  </button>
                </div>
              </>
            )}
            {editingTimes && (
              <>
                <div className="practice-list">
                  {practiceCompanies.map((company) =>
                    company.platoons.some((p) => p.squads.length > 0) ? (
                      <div key={company.letter} className="practice-company">
                        <h4>
                          {company.letter === "UNASSIGNED"
                            ? "Unassigned"
                            : `${company.name} Company (${company.letter})`}
                        </h4>
                        {company.platoons.flatMap((platoon) =>
                          platoon.squads.map((squad) => (
                            <PracticeRow
                              key={`${platoon.number}-${squad.number}`}
                              location={{
                                company: company.letter,
                                platoon: platoon.number,
                                squad: squad.number,
                              }}
                              squad={squad}
                              onSetPracticeTime={onSetPracticeTime}
                            />
                          )),
                        )}
                      </div>
                    ) : null,
                  )}
                </div>
                <button
                  className="add-btn save-times-btn"
                  onClick={() => {
                    onSavePracticeTimes();
                    setEditingTimes(false);
                  }}
                >
                  Save practice times
                </button>
              </>
            )}
          </>
        )}
      </section>

      <section className="phase-card">
        <header>
          <span className="phase-number">3</span>
          <h3>Review leadership</h3>
          <PhaseChip state={leadershipState} />
        </header>
        <p>
          What each battalion has to work with, by tier. A zero in Officers or Senior NCOs means that
          battalion can't fill its key billets yet — consider re-balancing tags before committing.
          When both battalions look workable, click <strong>Accept</strong> below — Commit Split stays
          locked until you do, and re-tagging anyone clears the acceptance.
        </p>
        <div className="group-grid">
          {groups.map((g) => (
            <div key={g.status} className={`group-card group-${g.status}`}>
              <h4>
                {g.name} <span className="group-headcount">{g.members.length} tagged</span>
              </h4>
              {g.members.length > 0 ? (
                <TierList roster={roster} soldiers={g.members} />
              ) : (
                <p className="tier-empty">Nobody tagged for {g.name} yet.</p>
              )}
            </div>
          ))}
        </div>
        {activeConfiguration !== "new" && (
          <button
            className={`add-btn accept-leadership-btn${roster.leadershipAccepted ? " accepted" : ""}`}
            onClick={onAcceptLeadership}
            disabled={taggedCount === 0 || roster.leadershipAccepted}
          >
            {roster.leadershipAccepted ? "Leadership review accepted ✓" : "Accept leadership review"}
          </button>
        )}
      </section>

      <section className="phase-card">
        <header>
          <span className="phase-number">4</span>
          <h3>Commit the split</h3>
          <PhaseChip state={commitState} />
        </header>
        <p>
          Creates (or refreshes) one roster per battalion. Everyone tagged for it lands in that roster's{" "}
          <strong>Unassigned pool</strong>, sorted by rank, under an empty battalion — structure comes in
          the next step. Safe to re-run as tags change; it overwrites the same two rosters.
        </p>
        <button
          className="add-btn commit-split-btn"
          onClick={onCommitSplit}
          disabled={commitBlockers.length > 0}
        >
          {commitState === "todo" ? "Commit Split" : "Re-commit (update both rosters)"}
        </button>
        {commitBlockers.length > 0 && (
          <ul className="commit-blockers">
            {commitBlockers.map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="phase-card">
        <header>
          <span className="phase-number">5</span>
          <h3>Unit Builder</h3>
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
            {builds.map((b) => {
              const { companies: suggestions, warnings: suggestionWarnings } = buildSuggestions.get(b.status) ?? {
                companies: [],
                warnings: [],
              };
              return (
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
                  <SuggestionPreview
                    battalionName={b.name}
                    status={b.status}
                    suggestions={suggestions}
                    warnings={suggestionWarnings}
                    onApply={() => onApplySuggestion(b.summary!.id, suggestions)}
                    applyLabel={`Apply suggested structure to ${b.name}`}
                  />
                  <button className="add-btn" onClick={() => onOpenRoster(b.summary!.id)}>
                    Open {b.name} in Drag &amp; Drop
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
