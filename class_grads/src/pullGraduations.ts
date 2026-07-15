import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { config } from "dotenv";
import type { ApiFullRoster } from "./types.ts";
import { classifyPosition } from "./scope.ts";
import { rangerStatus, type Graduation, type RangerStatus } from "./ranger.ts";
import { computeGroupStatus, loadGroups, type GroupStatus } from "./groups.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..");
config({ path: path.join(REPO_ROOT, ".env") });

const MILPACS_API_KEY = process.env.MILPACS_API_KEY;
const MILPACS_BASE_URL = "https://api.7cav.us/api/v1";

interface MemberGraduations {
  userId: string;
  username: string;
  realName: string;
  rank: string;
  positionTitle: string;
  mos: string;
  battalion: string;
  company: string;
  graduations: Graduation[];
  ranger: RangerStatus;
  groups: GroupStatus[];
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

// A leading apostrophe forces spreadsheet apps to treat a cell as plain
// text (both hide the apostrophe itself). Needed for two different Excel/
// Sheets quirks: (1) unconditionally, for values like "1-7" or "8/14" that
// get silently reformatted as dates, and (2) for any value starting with
// =, +, -, @, tab, or CR, which spreadsheet apps may instead evaluate as a
// formula — milpacs records (real names, position titles, class text) are
// entered by many people over the years, so this isn't just theoretical.
function forceText(value: string): string {
  return `'${value}`;
}

const FORMULA_INJECTION_RE = /^[=+\-@\t\r]/;

function csvCell(value: string): string {
  return FORMULA_INJECTION_RE.test(value) ? forceText(value) : value;
}

async function main() {
  if (!MILPACS_API_KEY) {
    throw new Error("MILPACS_API_KEY is not set. Add it to class_grads/.env");
  }

  const response = await fetch(`${MILPACS_BASE_URL}/roster/ROSTER_TYPE_COMBAT`, {
    headers: { Authorization: `Bearer ${MILPACS_API_KEY}` },
  });
  if (!response.ok) {
    throw new Error(`Roster request failed: ${response.status} ${response.statusText}`);
  }
  const roster = (await response.json()) as ApiFullRoster;
  const storedGroups = loadGroups(REPO_ROOT);

  const members: MemberGraduations[] = [];
  for (const profile of Object.values(roster.profiles)) {
    const classification = classifyPosition(profile.primary?.positionTitle);
    if (!profile.user || !classification) continue;

    const graduations = profile.records
      .filter((r) => r.recordType === "RECORD_TYPE_GRADUATION")
      .map((r) => ({ details: r.recordDetails, date: r.recordDate }))
      .sort((a, b) => a.date.localeCompare(b.date));

    members.push({
      userId: profile.user.userId,
      username: profile.user.username,
      realName: profile.realName,
      rank: profile.rank?.rankShort ?? "",
      positionTitle: profile.primary?.positionTitle ?? "",
      mos: profile.mos || "Unknown",
      battalion: classification.battalion,
      company: classification.company,
      graduations,
      ranger: rangerStatus(graduations),
      groups: storedGroups.map((g) => computeGroupStatus(graduations, g)),
    });
  }

  members.sort((a, b) => a.realName.localeCompare(b.realName));

  const outDir = path.join(REPO_ROOT, "output");
  mkdirSync(outDir, { recursive: true });

  writeFileSync(path.join(outDir, "graduations.json"), JSON.stringify(members, null, 2));

  const groupColumns = storedGroups.map((g) => g.name);
  const csvRows = [
    [
      "Username",
      "RealName",
      "Rank",
      "Battalion",
      "Company",
      "PositionTitle",
      "MOS",
      "RangerCompleted",
      "RangerTotal",
      "RangerQualified",
      ...groupColumns.map(csvCell),
      "GraduationDetails",
      "GraduationDate",
    ]
      .map(csvEscape)
      .join(","),
  ];
  for (const member of members) {
    const groupValues = member.groups.map((g) => forceText(`${g.requiredCompleted}/${g.requiredTotal}`));
    const base = [
      csvCell(member.username),
      csvCell(member.realName),
      csvCell(member.rank),
      forceText(member.battalion),
      csvCell(member.company),
      csvCell(member.positionTitle),
      csvCell(member.mos),
      String(member.ranger.requiredCompleted),
      String(member.ranger.requiredTotal),
      member.ranger.qualified ? "Yes" : "No",
      ...groupValues,
    ];
    if (member.graduations.length === 0) {
      csvRows.push([...base, "", ""].map(csvEscape).join(","));
    } else {
      for (const grad of member.graduations) {
        csvRows.push([...base, csvCell(grad.details), grad.date].map(csvEscape).join(","));
      }
    }
  }
  writeFileSync(path.join(outDir, "graduations.csv"), csvRows.join("\n") + "\n");

  const withGrads = members.filter((m) => m.graduations.length > 0).length;
  const rangerQualified = members.filter((m) => m.ranger.qualified).length;
  console.log(
    `${members.length} members in scope (1-7/2-7/3-7/ACD/Regiment), ${withGrads} with at least one graduation.`,
  );
  console.log(`${rangerQualified} qualified for WW2 Ranger Selection Requirement.`);
  if (storedGroups.length > 0) {
    console.log(`Included ${storedGroups.length} Custom Group(s): ${groupColumns.join(", ")}`);
  }
  console.log(`Wrote output/graduations.json and output/graduations.csv`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
