import { NavLink, Route, Routes } from "react-router-dom";
import patchEmblem from "./assets/1cd-patch.png";
import GradsApp from "./grads/GradsApp";
import ProjectsApp from "./projects/ProjectsApp";
import RosterApp from "./roster/RosterApp";

const NAV_ITEMS = [
  { to: "/roster", label: "Roster Manager" },
  { to: "/grads", label: "Course Graduations" },
  { to: "/projects", label: "Unit Projects" },
];

function Home() {
  return (
    <div className="home">
      <h1>7Cav Apps</h1>
      <p className="home-intro">Pick a tool below.</p>
      <div className="home-cards">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} className="home-card">
            {item.label}
          </NavLink>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <div className="shell">
      <nav className="sidebar">
        <NavLink to="/" className="sidebar-brand">
          <img src={patchEmblem} alt="1st Cavalry Division patch" className="sidebar-emblem" />
          <span>7Cav Apps</span>
        </NavLink>
        <ul className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink to={item.to} className={({ isActive }) => (isActive ? "active" : "")}>
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <main className="shell-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/roster/*" element={<RosterApp />} />
          <Route path="/grads/*" element={<GradsApp />} />
          <Route path="/projects/*" element={<ProjectsApp />} />
        </Routes>
      </main>
    </div>
  );
}
