import type { VacancyChain } from "../lib/splitReorg";
import "./VacancyChainList.css";

// Shown on HLLV's Unit Builder card in place of SuggestionPreview (HLLV
// mirrors the current structure rather than being built from a pool, so
// there's no structure to suggest) — lists every leadership billet that
// just opened up because its holder left for HLLWW2, plus the units
// underneath it that now need attention.
export function VacancyChainList({ chains }: { chains: VacancyChain[] }) {
  if (chains.length === 0) {
    return <p className="vacancy-chain-empty">No new leadership vacancies from the split.</p>;
  }
  return (
    <details className="vacancy-chain-block" open>
      <summary>
        ⚠ New leadership vacancies — {chains.length} billet{chains.length === 1 ? "" : "s"} opened by the split
      </summary>
      <ul className="vacancy-chain-list">
        {chains.map((chain) => (
          <li key={chain.billetLabel}>
            <span className="vacancy-chain-billet">{chain.billetLabel}</span>
            {chain.affectedUnits.length > 0 && (
              <ul className="vacancy-chain-affected">
                {chain.affectedUnits.map((unit) => (
                  <li key={unit}>{unit}</li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}
