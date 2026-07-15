import "./roster.css";
import RosterManagerApp from "./App";

// RosterManagerApp (the untouched copy of RosterManager's own App.tsx) was
// built to own the whole page, styled via :root/#root selectors. Wrapping it
// in .roster-app scopes that theme to this route instead of leaking it
// across the hub shell — see roster.css.
export default function RosterApp() {
  return (
    <div className="roster-app">
      <RosterManagerApp />
    </div>
  );
}
