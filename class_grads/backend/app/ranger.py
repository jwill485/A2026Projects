import re

# The 14 Hell Let Loose classes required for the WW2 Ranger Selection
# Requirement (user-defined battalion criteria, 2026-07-13 — see project
# memory "class-grads-ww2-ranger-selection"). Each canonical name maps to the
# wording variants actually found in live milpacs records — graduation text
# has been logged inconsistently over the years (typos, reordered words,
# old naming), so a strict-equality match would undercount real completions.
# Matching always additionally requires "Hell Let Loose" to appear in the
# record text, so a similarly-named class from a different game never counts.
REQUIRED_CLASSES: list[str] = [
    "Basic Infantry Combat Training Course",
    "Combat Lifesaver Course",
    "Commander's Course",
    "Advanced Infantry Training 1 Course",
    "Artillery Crewman Course",
    "Anti Tank Course",
    "Assault and Automatic Rifleman Course",
    "Machine Gunner Course",
    "Basic Recon Course",
    "Engineer and Support Course",
    "Advanced Infantry Training 2 Course",
    "Sniper Course",
    "Basic Leadership Course",
    "Advanced Leadership Course",
]

# Variant wordings found in the live data that should count toward each
# canonical class above. Hyphen/apostrophe/capitalization/whitespace
# differences are handled automatically by _normalize() below and don't need
# an entry here — only genuinely different wording does.
CLASS_VARIANTS: dict[str, list[str]] = {
    "Basic Infantry Combat Training Course": [
        "Basic Infantry Combat Training Course",
        "Basic Combat Infantry Course",
    ],
    "Combat Lifesaver Course": ["Combat Lifesaver Course"],
    "Commander's Course": ["Commander's Course"],
    "Advanced Infantry Training 1 Course": [
        "Advanced Infantry Training 1 Course",
        "Advanced Infantry Combat Training 1 Course",
        "Advanced Infantry Tactics 1 Course",
        "Advanced Infantry Tactics I",
    ],
    "Artillery Crewman Course": ["Artillery Crewman Course"],
    "Anti Tank Course": ["Anti Tank Course"],
    "Assault and Automatic Rifleman Course": ["Assault and Automatic Rifleman Course"],
    "Machine Gunner Course": [
        "Machine Gunner Course",
        "Machine Gun Course",
    ],
    "Basic Recon Course": ["Basic Recon Course"],
    "Engineer and Support Course": ["Engineer and Support Course"],
    "Advanced Infantry Training 2 Course": [
        "Advanced Infantry Training 2 Course",
        "Advanced Infantry Combat Training 2 Course",
        "Advanced Infantry Traininig 2 Course",  # typo as logged live
    ],
    "Sniper Course": ["Sniper Course"],
    "Basic Leadership Course": ["Basic Leadership Course"],
    "Advanced Leadership Course": ["Advanced Leadership Course"],
}


def _normalize(text: str) -> str:
    text = text.lower()
    text = re.sub(r"[-'’]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


_NORMALIZED_VARIANTS: dict[str, list[str]] = {
    canonical: [_normalize(v) for v in variants] for canonical, variants in CLASS_VARIANTS.items()
}


def ranger_status(graduations: list[dict]) -> dict:
    normalized_records = [_normalize(g["details"]) for g in graduations]
    hll_records = [r for r in normalized_records if "hell let loose" in r]

    def has_class(canonical: str) -> bool:
        variants = _NORMALIZED_VARIANTS[canonical]
        return any(variant in record for record in hll_records for variant in variants)

    missing = [c for c in REQUIRED_CLASSES if not has_class(c)]
    return {
        "requiredTotal": len(REQUIRED_CLASSES),
        "requiredCompleted": len(REQUIRED_CLASSES) - len(missing),
        "missingClasses": missing,
        "qualified": len(missing) == 0,
    }
