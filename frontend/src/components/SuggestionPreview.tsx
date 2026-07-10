import type { SplitStatus } from "../types/roster";
import { STRUCTURE_RULES, type SuggestedCompany } from "../lib/buildSuggestions";
import "./SuggestionPreview.css";

// Shared by the Split Planner's Unit Builder phase and the Drag & Drop
// "Suggest structure" toolbar action — same preview, same apply button,
// just wired to whichever roster is the actual apply target.
export function SuggestionPreview({
  battalionName,
  status,
  suggestions,
  warnings,
  onApply,
  applyLabel = "Apply suggested structure",
}: {
  battalionName: string;
  status: SplitStatus;
  suggestions: SuggestedCompany[];
  warnings: string[];
  onApply: () => void;
  applyLabel?: string;
}) {
  const rules = STRUCTURE_RULES[status];
  if (suggestions.length === 0) return null;
  return (
    <details className="suggestion-block">
      <summary>
        💡 Suggested structure — {suggestions.length} {suggestions.length === 1 ? "company" : "companies"} from
        practice times
      </summary>
      {rules && (
        <p className="suggestion-hint">
          Old squads kept intact, grouped into companies by practice time, sized to {battalionName}'s structure
          standards (min {rules.minSquadsPerPlatoon} squads/platoon, min {rules.minPlatoonsPerCompany}{" "}
          platoons/company, max {rules.maxCompanies} compan{rules.maxCompanies === 1 ? "y" : "ies"}) and checked
          against available leadership. Applying places the squads and leaves every leadership billet vacant for
          you to fill.
        </p>
      )}
      {warnings.length > 0 && (
        <ul className="suggestion-warnings">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
      {suggestions.map((sc) => (
        <div key={sc.letter} className="suggestion-company">
          <h5>
            {sc.name} Company ({sc.letter}) — {sc.practiceTimes.join(" · ")} · {sc.headcount} troopers
          </h5>
          {sc.platoons.map((sp) => (
            <div key={sp.number} className="suggestion-platoon">
              Platoon {sp.number}
              <ul>
                {sp.squads.map((ss) => (
                  <li key={ss.sourceLabel}>
                    from {ss.sourceLabel} —{" "}
                    {(ss.leader ? 1 : 0) + (ss.assistantLeader ? 1 : 0) + ss.members.length} troopers ·{" "}
                    {ss.mos.map((m) => `${m.label} ×${m.value}`).join(" · ")}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ))}
      <button className="add-btn" onClick={onApply}>
        {applyLabel}
      </button>
    </details>
  );
}
