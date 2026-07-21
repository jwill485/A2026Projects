import { useEffect, useState } from "react";

const BACKEND_URL = import.meta.env.VITE_PROJECTS_BACKEND_URL || "http://localhost:8002";

interface Project {
  id: string;
  name: string;
}

// Framework-only: proves the hub can reach unit_projects' backend. No real
// data model yet -- see unit_projects_design_doc.md for what's still open
// (project fields, status workflow, whether owners link back to troopers).
export default function ProjectsApp() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/projects`)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json();
      })
      .then(setProjects)
      .catch((err) => setError(String(err)));
  }, []);

  return (
    <div className="home">
      <h1>Unit Projects</h1>
      {error && <p className="error">Failed to load: {error}</p>}
      {!error && projects === null && <p className="home-intro">Loading…</p>}
      {projects !== null && (
        <p className="home-intro">
          Connected to the backend — {projects.length} project{projects.length === 1 ? "" : "s"} so
          far. Nothing to manage yet; this is just the framework.
        </p>
      )}
    </div>
  );
}
