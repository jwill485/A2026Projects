import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import "./projects.css";
import { PRIORITY_LABELS, PRIORITY_ORDER, STATUS_LABELS, STATUS_ORDER } from "./constants";
import { ProjectEditor } from "./ProjectEditor";
import type { Project, ProjectInput, Status, Priority } from "./types";

const BACKEND_URL = import.meta.env.VITE_PROJECTS_BACKEND_URL || "http://localhost:8002";
const ALL = "All";

type SortKey = "name" | "status" | "priority" | "owner" | "category" | "targetDate";
type SortDir = "asc" | "desc";

const SORT_LABELS: Record<SortKey, string> = {
  name: "Name",
  status: "Status",
  priority: "Priority",
  owner: "Owner",
  category: "Category",
  targetDate: "Target Date",
};

function matchesSearch(project: Project, query: string): boolean {
  if (!query) return true;
  const haystack = [project.name, project.description, project.owner, project.category]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function statusBadgeClass(status: Status): string {
  return `status-badge status-${status}`;
}

function priorityBadgeClass(priority: Priority): string {
  return `priority-badge priority-${priority}`;
}

export default function ProjectsApp() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [priorityFilter, setPriorityFilter] = useState(ALL);
  const [categoryFilter, setCategoryFilter] = useState(ALL);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editorMode, setEditorMode] = useState<"none" | "new" | string>("none");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const loadAll = useCallback(() => {
    return fetch(`${BACKEND_URL}/api/projects`)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json();
      })
      .then(setProjects);
  }, []);

  useEffect(() => {
    loadAll().catch((err) => setError(String(err)));
  }, [loadAll]);

  async function createProject(input: ProjectInput) {
    await fetch(`${BACKEND_URL}/api/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    setEditorMode("none");
    await loadAll();
  }

  async function updateProject(id: string, input: ProjectInput) {
    await fetch(`${BACKEND_URL}/api/projects/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    setEditorMode("none");
    await loadAll();
  }

  async function deleteProject(id: string) {
    await fetch(`${BACKEND_URL}/api/projects/${id}`, { method: "DELETE" });
    setConfirmDeleteId(null);
    await loadAll();
  }

  const categoryOptions = useMemo(() => {
    if (!projects) return [];
    const present = new Set(projects.map((p) => p.category).filter((c) => c !== ""));
    return [...present].sort((a, b) => a.localeCompare(b));
  }, [projects]);

  const filtered = useMemo(() => {
    if (!projects) return [];
    return projects.filter(
      (p) =>
        matchesSearch(p, search) &&
        (statusFilter === ALL || p.status === statusFilter) &&
        (priorityFilter === ALL || p.priority === priorityFilter) &&
        (categoryFilter === ALL || p.category === categoryFilter),
    );
  }, [projects, search, statusFilter, priorityFilter, categoryFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let av: string | number;
      let bv: string | number;
      switch (sortKey) {
        case "status":
          av = STATUS_ORDER.indexOf(a.status);
          bv = STATUS_ORDER.indexOf(b.status);
          break;
        case "priority":
          av = PRIORITY_ORDER.indexOf(a.priority);
          bv = PRIORITY_ORDER.indexOf(b.priority);
          break;
        case "owner":
          av = a.owner.toLowerCase();
          bv = b.owner.toLowerCase();
          break;
        case "category":
          av = a.category.toLowerCase();
          bv = b.category.toLowerCase();
          break;
        case "targetDate":
          av = a.targetDate ?? "";
          bv = b.targetDate ?? "";
          break;
        default:
          av = a.name.toLowerCase();
          bv = b.name.toLowerCase();
      }
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const filtersActive =
    search !== "" || statusFilter !== ALL || priorityFilter !== ALL || categoryFilter !== ALL;

  function clearFilters() {
    setSearch("");
    setStatusFilter(ALL);
    setPriorityFilter(ALL);
    setCategoryFilter(ALL);
  }

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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

  function sortableHeader(key: SortKey) {
    return (
      <th className="sortable" onClick={() => handleSort(key)}>
        {SORT_LABELS[key]}
        {sortIndicator(key)}
      </th>
    );
  }

  const editingProject = editorMode !== "none" && editorMode !== "new" ? projects?.find((p) => p.id === editorMode) : undefined;

  return (
    <div className="page">
      <header>
        <div className="header-text">
          <h1>Unit Projects</h1>
          {projects && (
            <p className="summary">
              {projects.length} project{projects.length === 1 ? "" : "s"}
              {filtersActive && ` · showing ${filtered.length}`}
            </p>
          )}
        </div>
      </header>

      {error && <p className="error">Failed to load: {error}</p>}
      {!projects && !error && <p className="loading">Loading projects…</p>}

      {projects && (
        <>
          <input
            className="search"
            type="text"
            placeholder="Search name, description, owner, or category…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="filter-bar">
            <label>
              Status
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value={ALL}>All</option>
                {STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Priority
              <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
                <option value={ALL}>All</option>
                {PRIORITY_ORDER.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABELS[p]}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Category
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value={ALL}>All</option>
                {categoryOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            {filtersActive && (
              <button type="button" className="clear-filters" onClick={clearFilters}>
                Clear filters
              </button>
            )}

            <button type="button" className="new-project-button" onClick={() => setEditorMode("new")}>
              + New Project
            </button>
          </div>

          <table>
            <thead>
              <tr>
                <th></th>
                {sortableHeader("name")}
                {sortableHeader("status")}
                {sortableHeader("priority")}
                {sortableHeader("owner")}
                {sortableHeader("category")}
                {sortableHeader("targetDate")}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((project) => {
                const isOpen = expanded.has(project.id);
                return (
                  <Fragment key={project.id}>
                    <tr className="member-row" onClick={() => toggle(project.id)}>
                      <td className="chevron">{isOpen ? "▾" : "▸"}</td>
                      <td>{project.name}</td>
                      <td>
                        <span className={statusBadgeClass(project.status)}>{STATUS_LABELS[project.status]}</span>
                      </td>
                      <td>
                        <span className={priorityBadgeClass(project.priority)}>
                          {PRIORITY_LABELS[project.priority]}
                        </span>
                      </td>
                      <td>{project.owner}</td>
                      <td>{project.category}</td>
                      <td>{project.targetDate ?? "—"}</td>
                      <td className="project-row-actions" onClick={(e) => e.stopPropagation()}>
                        <button type="button" onClick={() => setEditorMode(project.id)}>
                          Edit
                        </button>
                        {confirmDeleteId === project.id ? (
                          <>
                            <span className="confirm-delete-label">Delete?</span>
                            <button
                              type="button"
                              className="confirm-delete-yes"
                              onClick={() => deleteProject(project.id)}
                            >
                              Yes
                            </button>
                            <button type="button" onClick={() => setConfirmDeleteId(null)}>
                              No
                            </button>
                          </>
                        ) : (
                          <button type="button" onClick={() => setConfirmDeleteId(project.id)}>
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="detail-row">
                        <td></td>
                        <td colSpan={7}>
                          {project.description ? (
                            <p>{project.description}</p>
                          ) : (
                            <em>No description</em>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>

          {filtered.length === 0 && <p className="empty">No projects match the current filters.</p>}
        </>
      )}

      {editorMode !== "none" && (
        <div className="groups-panel-overlay" onClick={() => setEditorMode("none")}>
          <div className="groups-panel" onClick={(e) => e.stopPropagation()}>
            <div className="groups-panel-header">
              <h3>{editorMode === "new" ? "New Project" : "Edit Project"}</h3>
              <button type="button" className="close-panel" onClick={() => setEditorMode("none")}>
                ✕
              </button>
            </div>
            <ProjectEditor
              initial={editingProject}
              onSave={(input) => (editorMode === "new" ? createProject(input) : updateProject(editorMode, input))}
              onCancel={() => setEditorMode("none")}
            />
          </div>
        </div>
      )}
    </div>
  );
}
