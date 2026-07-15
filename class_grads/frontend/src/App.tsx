import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import patchEmblem from "./assets/1cd-patch.png";
import { BATTALION_ORDER, COMPANY_LABELS, COMPANY_ORDER, TIER_LABELS, TIER_ORDER } from "./constants";
import { GroupsPanel } from "./GroupsPanel";
import type { Group, GroupRequirement, Member } from "./types";

const BACKEND_URL = "http://localhost:8000";
const ALL = "All";

// The built-in WW2 Ranger Selection Requirement is presented as just
// another selectable prerequisite set, alongside any custom groups — this
// is its fixed id in that selector (never collides with a real group id,
// which are opaque hex strings from uuid4).
const RANGER_ID = "ranger";
const RANGER_NAME = "WW2 Ranger Selection Requirement";

// A member missing this few requirements (but not zero) counts as "close"
// in the prerequisite-set filter.
const CLOSE_THRESHOLD = 3;

type SortKey =
  | "realName"
  | "rank"
  | "battalion"
  | "company"
  | "positionTitle"
  | "mos"
  | "graduations"
  | "prereq";
type SortDir = "asc" | "desc";
type StatusFilter = "All" | "qualified" | "notQualified" | "close";

// Normalized shape both `member.ranger` and a `member.groups[]` entry get
// mapped into, so the table/filter/sort code only has one shape to deal
// with regardless of which prerequisite set is currently selected.
interface PrereqStatus {
  requiredTotal: number;
  requiredCompleted: number;
  missing: string[];
  qualified: boolean;
}

const SORT_LABELS: Record<SortKey, string> = {
  realName: "Name",
  rank: "Rank",
  battalion: "Battalion",
  company: "Company",
  positionTitle: "Position",
  mos: "MOS",
  graduations: "Graduations",
  prereq: "Prerequisites",
};

function matchesSearch(member: Member, query: string): boolean {
  if (!query) return true;
  const haystack = [
    member.realName,
    member.username,
    member.rank,
    member.mos,
    member.battalion,
    member.positionTitle,
    ...member.graduations.map((g) => g.details),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function prereqStatusFor(member: Member, prereqId: string): PrereqStatus | null {
  if (prereqId === RANGER_ID) {
    return {
      requiredTotal: member.ranger.requiredTotal,
      requiredCompleted: member.ranger.requiredCompleted,
      missing: member.ranger.missingClasses,
      qualified: member.ranger.qualified,
    };
  }
  const group = member.groups.find((g) => g.id === prereqId);
  if (!group) return null;
  return {
    requiredTotal: group.requiredTotal,
    requiredCompleted: group.requiredCompleted,
    missing: group.missingLabels,
    qualified: group.qualified,
  };
}

function matchesPrereqStatus(status: PrereqStatus | null, filter: StatusFilter): boolean {
  if (filter === "All") return true;
  if (!status) return false;
  if (filter === "qualified") return status.qualified;
  if (filter === "notQualified") return !status.qualified;
  return !status.qualified && status.missing.length <= CLOSE_THRESHOLD;
}

function prereqBadgeClass(status: PrereqStatus): string {
  if (status.qualified) return "ranger-badge qualified";
  if (status.missing.length <= CLOSE_THRESHOLD) return "ranger-badge close";
  return "ranger-badge";
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

// Values like "1-7" or "8/14" look like dates to Excel/Sheets, which
// silently reformats them on open. A leading apostrophe forces text — both
// apps hide the apostrophe itself and just show the plain value.
function forceText(value: string): string {
  return `'${value}`;
}

// Exports exactly what the table is showing — current filter/search/sort
// order, one row per visible member — not the per-graduation breakdown from
// the expanded detail view.
function exportVisibleToCsv(members: Member[], prereqId: string, prereqColumnLabel: string) {
  const headers = ["Name", "Username", "Rank", "Battalion", "Company", "Position", "MOS", "Graduations", prereqColumnLabel];
  const rows = members.map((m) => {
    const status = prereqStatusFor(m, prereqId);
    return [
      m.realName,
      m.username,
      m.rank,
      forceText(m.battalion),
      COMPANY_LABELS[m.company] ?? m.company,
      m.positionTitle,
      m.mos,
      String(m.graduations.length),
      status ? forceText(`${status.requiredCompleted}/${status.requiredTotal}`) : "",
    ];
  });
  const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n") + "\n";
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `7cav-course-graduations-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function App() {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [battalionFilter, setBattalionFilter] = useState(ALL);
  const [companyFilter, setCompanyFilter] = useState(ALL);
  const [tierFilter, setTierFilter] = useState(ALL);
  const [classFilter, setClassFilter] = useState(ALL);
  const [prereqId, setPrereqId] = useState<string>(RANGER_ID);
  const [prereqStatusFilter, setPrereqStatusFilter] = useState<StatusFilter>("All");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("realName");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [showGroupsPanel, setShowGroupsPanel] = useState(false);

  const loadAll = useCallback(() => {
    return Promise.all([
      fetch(`${BACKEND_URL}/api/graduations`).then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json();
      }),
      fetch(`${BACKEND_URL}/api/groups`).then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json();
      }),
    ]).then(([membersData, groupsData]) => {
      setMembers(membersData);
      setGroups(groupsData);
    });
  }, []);

  useEffect(() => {
    loadAll().catch((err) => setError(String(err)));
  }, [loadAll]);

  async function createGroup(name: string, requirements: GroupRequirement[]) {
    await fetch(`${BACKEND_URL}/api/groups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, requirements }),
    });
    await loadAll();
  }

  async function updateGroup(id: string, name: string, requirements: GroupRequirement[]) {
    await fetch(`${BACKEND_URL}/api/groups/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, requirements }),
    });
    await loadAll();
  }

  async function deleteGroup(id: string) {
    await fetch(`${BACKEND_URL}/api/groups/${id}`, { method: "DELETE" });
    if (prereqId === id) setPrereqId(RANGER_ID);
    await loadAll();
  }

  const prereqOptions = useMemo(
    () => [{ id: RANGER_ID, name: RANGER_NAME }, ...groups.map((g) => ({ id: g.id, name: g.name }))],
    [groups],
  );
  const selectedPrereqName = prereqOptions.find((p) => p.id === prereqId)?.name ?? RANGER_NAME;

  const battalionOptions = useMemo(() => {
    if (!members) return [];
    const present = new Set(members.map((m) => m.battalion));
    return BATTALION_ORDER.filter((b) => present.has(b));
  }, [members]);

  const companyOptions = useMemo(() => {
    if (!members) return [];
    const present = new Set(members.map((m) => m.company));
    return COMPANY_ORDER.filter((c) => present.has(c));
  }, [members]);

  const classOptions = useMemo(() => {
    if (!members) return [];
    const present = new Set<string>();
    for (const m of members) for (const g of m.graduations) present.add(g.details);
    return [...present].sort((a, b) => a.localeCompare(b));
  }, [members]);

  const filtered = useMemo(() => {
    if (!members) return [];
    return members.filter(
      (m) =>
        matchesSearch(m, search) &&
        (battalionFilter === ALL || m.battalion === battalionFilter) &&
        (companyFilter === ALL || m.company === companyFilter) &&
        (tierFilter === ALL || m.tier === tierFilter) &&
        (classFilter === ALL || m.graduations.some((g) => g.details === classFilter)) &&
        matchesPrereqStatus(prereqStatusFor(m, prereqId), prereqStatusFilter),
    );
  }, [members, search, battalionFilter, companyFilter, tierFilter, classFilter, prereqId, prereqStatusFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let av: string | number;
      let bv: string | number;
      if (sortKey === "prereq") {
        av = prereqStatusFor(a, prereqId)?.requiredCompleted ?? 0;
        bv = prereqStatusFor(b, prereqId)?.requiredCompleted ?? 0;
      } else {
        switch (sortKey) {
          case "realName":
            av = a.realName.toLowerCase();
            bv = b.realName.toLowerCase();
            break;
          case "rank":
            av = a.rankOrder;
            bv = b.rankOrder;
            break;
          case "battalion":
            av = BATTALION_ORDER.indexOf(a.battalion);
            bv = BATTALION_ORDER.indexOf(b.battalion);
            break;
          case "company":
            av = COMPANY_ORDER.indexOf(a.company);
            bv = COMPANY_ORDER.indexOf(b.company);
            break;
          case "positionTitle":
            av = a.positionTitle.toLowerCase();
            bv = b.positionTitle.toLowerCase();
            break;
          case "mos":
            av = a.mos.toLowerCase();
            bv = b.mos.toLowerCase();
            break;
          case "graduations":
            av = a.graduations.length;
            bv = b.graduations.length;
            break;
        }
      }
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir, prereqId]);

  const totalGraduations = useMemo(
    () => (members ?? []).reduce((sum, m) => sum + m.graduations.length, 0),
    [members],
  );

  const prereqQualifiedCount = useMemo(
    () => (members ?? []).filter((m) => prereqStatusFor(m, prereqId)?.qualified).length,
    [members, prereqId],
  );

  const filtersActive =
    search !== "" ||
    battalionFilter !== ALL ||
    companyFilter !== ALL ||
    tierFilter !== ALL ||
    classFilter !== ALL ||
    prereqStatusFilter !== "All";

  function clearFilters() {
    setSearch("");
    setBattalionFilter(ALL);
    setCompanyFilter(ALL);
    setTierFilter(ALL);
    setClassFilter(ALL);
    setPrereqStatusFilter("All");
  }

  function toggle(userId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return null;
    return <span className="sort-arrow">{sortDir === "asc" ? "▲" : "▼"}</span>;
  }

  function sortableHeader(key: SortKey, label?: string) {
    return (
      <th className="sortable" onClick={() => handleSort(key)}>
        {label ?? SORT_LABELS[key]}
        {sortIndicator(key)}
      </th>
    );
  }

  return (
    <div className="page">
      <header>
        <div className="header-text">
          <h1>7Cav Course Graduations</h1>
          {members && (
            <p className="summary">
              {members.length} members · {totalGraduations} graduations · {prereqQualifiedCount}{" "}
              {selectedPrereqName} qualified
              {filtersActive && ` · showing ${filtered.length}`}
            </p>
          )}
        </div>
        <img src={patchEmblem} alt="1st Cavalry Division patch" className="emblem" />
      </header>

      {error && <p className="error">Failed to load: {error}</p>}
      {!members && !error && <p className="loading">Loading live roster data…</p>}

      {members && (
        <>
          <input
            className="search"
            type="text"
            placeholder="Search name, rank, MOS, position, or class…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="filter-bar">
            <label>
              Battalion
              <select value={battalionFilter} onChange={(e) => setBattalionFilter(e.target.value)}>
                <option value={ALL}>All</option>
                {battalionOptions.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Company
              <select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)}>
                <option value={ALL}>All</option>
                {companyOptions.map((c) => (
                  <option key={c} value={c}>
                    {COMPANY_LABELS[c] ?? c}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Rank tier
              <select value={tierFilter} onChange={(e) => setTierFilter(e.target.value)}>
                <option value={ALL}>All</option>
                {TIER_ORDER.map((t) => (
                  <option key={t} value={t}>
                    {TIER_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Graduated class
              <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
                <option value={ALL}>All</option>
                {classOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Prerequisite set
              <select
                value={prereqId}
                onChange={(e) => {
                  setPrereqId(e.target.value);
                  setPrereqStatusFilter("notQualified");
                }}
              >
                <option value={RANGER_ID}>{RANGER_NAME}</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Status
              <select
                value={prereqStatusFilter}
                onChange={(e) => setPrereqStatusFilter(e.target.value as StatusFilter)}
              >
                <option value="All">All</option>
                <option value="qualified">Qualified</option>
                <option value="notQualified">Not qualified</option>
                <option value="close">Close (missing ≤ {CLOSE_THRESHOLD})</option>
              </select>
            </label>

            {filtersActive && (
              <button type="button" className="clear-filters" onClick={clearFilters}>
                Clear filters
              </button>
            )}

            <button
              type="button"
              className="export-csv"
              onClick={() => exportVisibleToCsv(sorted, prereqId, selectedPrereqName)}
            >
              Export CSV ({sorted.length})
            </button>

            <button type="button" className="manage-groups" onClick={() => setShowGroupsPanel(true)}>
              Manage Groups{groups.length > 0 && ` (${groups.length})`}
            </button>
          </div>

          <table>
            <thead>
              <tr>
                <th></th>
                {sortableHeader("realName")}
                {sortableHeader("rank")}
                {sortableHeader("battalion")}
                {sortableHeader("company")}
                {sortableHeader("positionTitle")}
                {sortableHeader("mos")}
                {sortableHeader("graduations")}
                {sortableHeader("prereq", selectedPrereqName)}
              </tr>
            </thead>
            <tbody>
              {sorted.map((member) => {
                const isOpen = expanded.has(member.userId);
                const status = prereqStatusFor(member, prereqId);
                return (
                  <Fragment key={member.userId}>
                    <tr className="member-row" onClick={() => toggle(member.userId)}>
                      <td className="chevron">{isOpen ? "▾" : "▸"}</td>
                      <td>
                        {member.realName}{" "}
                        <span className="username">({member.username})</span>
                      </td>
                      <td>{member.rank}</td>
                      <td>{member.battalion}</td>
                      <td>{COMPANY_LABELS[member.company] ?? member.company}</td>
                      <td>{member.positionTitle}</td>
                      <td>{member.mos}</td>
                      <td>{member.graduations.length}</td>
                      <td>
                        {status && (
                          <span className={prereqBadgeClass(status)}>
                            {status.requiredCompleted}/{status.requiredTotal}
                          </span>
                        )}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="detail-row">
                        <td></td>
                        <td colSpan={8}>
                          <div className="detail-columns">
                            <div>
                              <h4>Graduations</h4>
                              {member.graduations.length === 0 ? (
                                <em>No graduation records</em>
                              ) : (
                                <ul>
                                  {member.graduations.map((g, i) => (
                                    <li key={i}>
                                      <span className="date">{g.date}</span> — {g.details}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                            <div>
                              <h4>WW2 Ranger Selection Requirement</h4>
                              {member.ranger.qualified ? (
                                <p className="ranger-qualified-note">
                                  Qualified — all {member.ranger.requiredTotal} classes complete.
                                </p>
                              ) : (
                                <>
                                  <p>
                                    {member.ranger.requiredCompleted}/{member.ranger.requiredTotal}{" "}
                                    complete. Missing:
                                  </p>
                                  <ul className="missing-list">
                                    {member.ranger.missingClasses.map((c) => (
                                      <li key={c}>{c}</li>
                                    ))}
                                  </ul>
                                </>
                              )}
                              {member.groups.length > 0 && (
                                <>
                                  <h4 className="custom-groups-heading">Custom Groups</h4>
                                  {member.groups.map((g) => (
                                    <div key={g.id} className="custom-group-status">
                                      <strong>{g.name}</strong>{" "}
                                      {g.qualified ? (
                                        <span className="ranger-qualified-note">
                                          Qualified ({g.requiredCompleted}/{g.requiredTotal})
                                        </span>
                                      ) : (
                                        <span>
                                          {g.requiredCompleted}/{g.requiredTotal} — missing:{" "}
                                          {g.missingLabels.join(", ")}
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>

          {filtered.length === 0 && <p className="empty">No members match the current filters.</p>}
        </>
      )}

      {showGroupsPanel && (
        <GroupsPanel
          groups={groups}
          classOptions={classOptions}
          onCreate={createGroup}
          onUpdate={updateGroup}
          onDelete={deleteGroup}
          onClose={() => setShowGroupsPanel(false)}
        />
      )}
    </div>
  );
}
