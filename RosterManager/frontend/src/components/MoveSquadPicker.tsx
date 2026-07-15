import { useEffect, useState } from "react";
import type { RosterData } from "../types/roster";
import type { SquadLocation } from "../lib/moveSoldier";
import "./SoldierForm.css";
import "./CandidatePicker.css";

// Whole-squad drag (the ⠿ handle) only reaches platoons within the *same*
// company, since Structure only ever shows one company's platoons at a time
// — there's nowhere else to drop onto. This is the affordance for the
// cross-company case: pick a destination company + platoon instead of
// dragging. Mirrors CandidatePicker's modal-picker pattern.
export function MoveSquadPicker({
  roster,
  source,
  onMove,
  onAddPlatoon,
  onClose,
}: {
  roster: RosterData;
  source: SquadLocation;
  onMove: (destination: { company: string; platoon: string }) => void;
  onAddPlatoon: (company: string) => void;
  onClose: () => void;
}) {
  const destinationCompanies = roster.battalion.companies.filter(
    (c) => c.letter !== source.company && !c.staged,
  );
  const [companyLetter, setCompanyLetter] = useState(destinationCompanies[0]?.letter ?? "");
  const [platoonNumber, setPlatoonNumber] = useState<string>(
    destinationCompanies[0]?.platoons[0]?.number ?? "",
  );

  const destinationCompany = destinationCompanies.find((c) => c.letter === companyLetter);

  // Picks up a platoon just created via "+ Add Platoon" below (it lands at
  // the end of the list) without the user having to re-select it manually.
  useEffect(() => {
    const platoons = destinationCompany?.platoons ?? [];
    if (platoons.length > 0 && !platoons.some((p) => p.number === platoonNumber)) {
      setPlatoonNumber(platoons[platoons.length - 1].number);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destinationCompany?.platoons.length]);

  function handleCompanyChange(letter: string) {
    setCompanyLetter(letter);
    const company = destinationCompanies.find((c) => c.letter === letter);
    setPlatoonNumber(company?.platoons[0]?.number ?? "");
  }

  function handleAddPlatoon() {
    if (!companyLetter) return;
    onAddPlatoon(companyLetter);
  }

  return (
    <div className="soldier-form-backdrop" onClick={onClose}>
      <div className="candidate-picker" onClick={(e) => e.stopPropagation()}>
        <h3>Move Squad {source.squad} to another company</h3>
        {destinationCompanies.length === 0 ? (
          <p className="candidate-tier-note">
            No other (un-staged) companies to move this squad to — add one first.
          </p>
        ) : (
          <>
            <div className="candidate-controls">
              <label>
                Company:{" "}
                <select value={companyLetter} onChange={(e) => handleCompanyChange(e.target.value)}>
                  {destinationCompanies.map((c) => (
                    <option key={c.letter} value={c.letter}>
                      {c.name} Company ({c.letter})
                    </option>
                  ))}
                </select>
              </label>
              {destinationCompany && destinationCompany.platoons.length > 0 && (
                <label>
                  Platoon:{" "}
                  <select value={platoonNumber} onChange={(e) => setPlatoonNumber(e.target.value)}>
                    {destinationCompany.platoons.map((p) => (
                      <option key={p.number} value={p.number}>
                        Platoon {p.number}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            {destinationCompany && destinationCompany.platoons.length === 0 && (
              <p className="candidate-tier-note">
                {destinationCompany.name} ({destinationCompany.letter}) has no platoons yet.
              </p>
            )}
            <button className="add-btn" onClick={handleAddPlatoon} disabled={!companyLetter}>
              + Add Platoon to {companyLetter || "…"}
            </button>
          </>
        )}
        <div className="soldier-form-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="add-btn"
            disabled={!companyLetter || !platoonNumber}
            onClick={() => onMove({ company: companyLetter, platoon: platoonNumber })}
          >
            Move Squad
          </button>
        </div>
      </div>
    </div>
  );
}
