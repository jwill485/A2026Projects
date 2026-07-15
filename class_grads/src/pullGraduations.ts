import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { config } from "dotenv";
import type { ApiFullRoster } from "./types.ts";
import { classifyPosition } from "./scope.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "..", ".env") });

const MILPACS_API_KEY = process.env.MILPACS_API_KEY;
const MILPACS_BASE_URL = "https://api.7cav.us/api/v1";

interface Graduation {
  details: string;
  date: string;
}

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
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
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
    });
  }

  members.sort((a, b) => a.realName.localeCompare(b.realName));

  const outDir = path.join(__dirname, "..", "output");
  mkdirSync(outDir, { recursive: true });

  writeFileSync(path.join(outDir, "graduations.json"), JSON.stringify(members, null, 2));

  const csvRows = [
    "Username,RealName,Rank,Battalion,Company,PositionTitle,MOS,GraduationDetails,GraduationDate",
  ];
  for (const member of members) {
    const base = [
      member.username,
      member.realName,
      member.rank,
      member.battalion,
      member.company,
      member.positionTitle,
      member.mos,
    ];
    if (member.graduations.length === 0) {
      csvRows.push([...base, "", ""].map(csvEscape).join(","));
    } else {
      for (const grad of member.graduations) {
        csvRows.push([...base, grad.details, grad.date].map(csvEscape).join(","));
      }
    }
  }
  writeFileSync(path.join(outDir, "graduations.csv"), csvRows.join("\n") + "\n");

  const withGrads = members.filter((m) => m.graduations.length > 0).length;
  console.log(
    `${members.length} members in scope (1-7/2-7/3-7/ACD/Regiment), ${withGrads} with at least one graduation.`,
  );
  console.log(`Wrote output/graduations.json and output/graduations.csv`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
