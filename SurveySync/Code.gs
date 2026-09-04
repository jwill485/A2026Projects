/**
 * Survey Roster Sync
 * ------------------
 * Pulls the live 2-7 Cavalry roster from the public 7Cav MILPACS API,
 * writes it into a "Roster" tab flagged Yes/No for survey response, and
 * writes completion + preference breakdowns into an "Analytics" tab.
 *
 * SETUP (one time):
 *   1. Open this Sheet's Extensions > Apps Script (this file is Code.gs).
 *   2. Project Settings (gear icon, left sidebar) > Script Properties >
 *      Add script property: key = MILPACS_API_KEY, value = <your 7Cav API key>.
 *   3. Edit the CONFIG block below so RESPONSES_SHEET_NAME,
 *      RESPONSES_NAME_COLUMN_HEADER, and RESPONSES_CHOICE_COLUMN_HEADER
 *      match your actual Form-responses tab.
 *   4. Save, reload the spreadsheet. A "Roster Sync" menu appears in the
 *      menu bar — click Refresh Now. The first run will prompt you to
 *      authorize the script (it needs permission to make external requests
 *      and edit the sheet) — that's Google's normal one-time consent screen.
 *   5. Optionally click Roster Sync > Enable Hourly Auto-Refresh so the
 *      response status stays current through the day on its own.
 */

// ---------------------------------------------------------------------------
// CONFIG — edit these to match your spreadsheet.
// ---------------------------------------------------------------------------
const CONFIG = {
  // Tab this script writes the per-trooper roster + response status into.
  ROSTER_SHEET_NAME: "Roster",

  // Tab this script writes completion + preference breakdowns into.
  ANALYTICS_SHEET_NAME: "Analytics",

  // Tab this script writes the WW2 unit hand-off layout into.
  WW2_HANDOFF_SHEET_NAME: "WW2 Handoff",

  // The existing tab Google Forms writes responses into. Typically
  // "Form Responses 1" unless you renamed it.
  RESPONSES_SHEET_NAME: "Form Responses",

  // Exact header text of the response sheet's name question. Matched
  // case-insensitively.
  RESPONSES_NAME_COLUMN_HEADER: "Name (Rnk.Last.F)",

  // Exact header text of the response sheet's game-preference question.
  RESPONSES_CHOICE_COLUMN_HEADER: "Which game do you prefer to have as your Primary AO Going forward?",

  // Which 7Cav roster to pull. "ROSTER_TYPE_COMBAT" is the live combat
  // roster (what RosterManager itself imports from) — change only if you
  // need a different roster.
  ROSTER_TYPE: "ROSTER_TYPE_COMBAT",
};

const API_BASE = "https://api.7cav.us/api/v1";
const MILPACS_PROFILE_BASE = "https://7cav.us/rosters/profile/";
const COMPANY_NAMES = { A: "Able", B: "Baker", C: "Charlie", E: "Easy" };

// Position titles read "{role} {squad}/{platoon}/{company}/{battalion}",
// trimmed to whichever prefix applies to that role's echelon, e.g.
// "Commander C/2-7" (company HQ) or "Section Leader 1/1/B/2-7" (squad).
const BATTALION_HQ_RE = /^(\d-7) (Commanding Officer|Executive Officer|Sergeant Major)$/;
const COMPANY_HQ_RE = /^(Commander|Executive Officer|First Sergeant) ([A-Za-z])\/([\w-]+)$/;
const PLATOON_HQ_RE = /^(Platoon Leader|Platoon Sergeant) (\d+)\/([A-Za-z])\/([\w-]+)$/;
const SQUAD_RE = /^(Section Leader|Assistant Section Leader|Trooper) (\d+)\/(\d+)\/([A-Za-z])\/([\w-]+)$/;

// Echelon groups for the "By Leadership Level & Choice" table -- battalion
// HQ, company HQ, platoon HQ, and squad-level split into its leadership
// (Section Leader/Assistant Section Leader) vs. rank-and-file Trooper.
const LEVEL_GROUP_ORDER = ["battalion", "company", "platoon", "sectionStaff", "trooper"];
const LEVEL_GROUP_LABELS = {
  battalion: "Battalion",
  company: "Company",
  platoon: "Platoon",
  sectionStaff: "Section Staff",
  trooper: "Trooper",
};

// Survey answer text -> normalized choice key.
const CHOICE_TOKENS = {
  "hell let loose vietnam": "hllv",
  hllv: "hllv",
  "hell let loose ww2": "hllww2",
  hllww2: "hllww2",
};

// ---------------------------------------------------------------------------
// Menu
// ---------------------------------------------------------------------------
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Roster Sync")
    .addItem("Refresh Now", "syncRoster")
    .addItem("Enable Hourly Auto-Refresh", "enableHourlyTrigger")
    .addItem("Disable Auto-Refresh", "disableAutoRefresh")
    .addToUi();
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------
function syncRoster() {
  const apiKey = PropertiesService.getScriptProperties().getProperty("MILPACS_API_KEY");
  if (!apiKey) {
    SpreadsheetApp.getUi().alert(
      'No API key found. Go to Project Settings > Script Properties and add ' +
        'MILPACS_API_KEY with your 7Cav API key.',
    );
    return;
  }

  const profiles = fetchRosterProfiles_(apiKey);
  const responses = collectResponses_();

  const troopers = profiles
    .map(toTrooperRow_)
    .filter((t) => t !== null)
    .map((t) => {
      const key = t.username.toLowerCase();
      const rawChoice = responses.get(key);
      return {
        ...t,
        // C/2-7's shell is currently empty in the live roster while its
        // real people sit under B/ACD (see RosterManager's own
        // split-planner notes on this) -- treat anyone actually filed
        // under Charlie as already covered rather than chasing a
        // response from them. This only affects completion tracking; it
        // never fabricates a game choice for the preference breakdown.
        responded: t.isCharlie || responses.has(key),
        choice: rawChoice ? normalizeChoice_(rawChoice) : undefined,
      };
    });

  writeRosterSheet_(troopers);
  writeAnalyticsSheet_(troopers);
  writeWw2HandoffSheet_(troopers);

  const notResponded = troopers.filter((t) => !t.responded).length;
  SpreadsheetApp.getUi().alert(
    `Synced ${troopers.length} troopers. ${notResponded} have not responded yet.`,
  );
}

// ---------------------------------------------------------------------------
// 7Cav API
// ---------------------------------------------------------------------------
function fetchRosterProfiles_(apiKey) {
  const response = UrlFetchApp.fetch(`${API_BASE}/roster/${CONFIG.ROSTER_TYPE}/lite`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    muteHttpExceptions: true,
  });
  if (response.getResponseCode() !== 200) {
    throw new Error(
      `7Cav API request failed (${response.getResponseCode()}): ${response.getContentText()}`,
    );
  }
  const body = JSON.parse(response.getContentText());
  return Object.values(body.profiles || {});
}

function toTrooperRow_(profile) {
  if (!profile.user || !profile.primary) return null;
  const title = profile.primary.positionTitle;
  if (title.indexOf("2-7") === -1) return null;
  const path = parsePath_(title);
  return {
    userId: profile.user.userId,
    username: profile.user.username,
    realName: profile.realName,
    rankShort: (profile.rank && profile.rank.rankShort) || "",
    mos: profile.mos || "Unknown",
    positionTitle: title,
    path: path,
    isCharlie: path.company === "C",
  };
}

// A title that doesn't match any of the four known shapes gets level
// "unknown" (role kept as the raw title so it's still visible) rather than
// silently mis-parsed into a made-up company/platoon/squad.
function parsePath_(title) {
  let m = title.match(BATTALION_HQ_RE);
  if (m) return { level: "battalion", role: m[2] };

  m = title.match(COMPANY_HQ_RE);
  if (m) return { level: "company", company: m[2], role: m[1] };

  m = title.match(PLATOON_HQ_RE);
  if (m) return { level: "platoon", company: m[3], platoon: m[2], role: m[1] };

  m = title.match(SQUAD_RE);
  if (m) return { level: "squad", company: m[4], platoon: m[3], squad: m[2], role: m[1] };

  return { level: "unknown", role: title };
}

// ---------------------------------------------------------------------------
// Survey responses
// ---------------------------------------------------------------------------
function findColumnIndex_(header, headerText, sheetName) {
  const idx = header.indexOf(headerText.trim().toLowerCase());
  if (idx === -1) {
    throw new Error(
      `No column header matching "${headerText}" found in "${sheetName}". ` +
        `Check the matching CONFIG entry against your actual sheet.`,
    );
  }
  return idx;
}

// Company/Platoon/Squad read "HQ" when a trooper's billet sits at or above
// that column's echelon (e.g. a Company Commander has no platoon, so the
// Platoon and Squad columns both read "HQ" rather than a blank cell that
// looks like missing data). An unrecognized title (level "unknown") stays
// blank in all three -- nothing is actually known about its structure.
const ECHELON_ORDER = { battalion: 0, company: 1, platoon: 2, squad: 3 };
function echelonField_(path, column) {
  if (path.level === "unknown") return "";
  if (ECHELON_ORDER[path.level] < ECHELON_ORDER[column]) return "HQ";
  return path[column] || "";
}

function normalizeChoice_(raw) {
  return CHOICE_TOKENS[raw.trim().toLowerCase()] || raw;
}

// Human-readable form of a trooper's normalized choice for the Roster tab.
function displayChoice_(choice) {
  if (choice === "hllv") return "HLLV";
  if (choice === "hllww2") return "HLLWW2";
  return choice || "";
}

function milpacsProfileUrl_(t) {
  return `${MILPACS_PROFILE_BASE}${t.userId}/`;
}

// Returns a Map from roster username (lowercased) to the respondent's raw
// choice text. The survey names people "Rank.Last.F" (e.g. "Pfc.Melon.DJ")
// rather than the bare "Last.F" username, so the leading rank segment is
// tried both present and stripped when building the key.
function collectResponses_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.RESPONSES_SHEET_NAME);
  if (!sheet) {
    throw new Error(
      `No tab named "${CONFIG.RESPONSES_SHEET_NAME}" found. Update RESPONSES_SHEET_NAME in CONFIG.`,
    );
  }
  const data = sheet.getDataRange().getValues();
  if (data.length === 0) return new Map();

  const header = data[0].map((h) => String(h).trim().toLowerCase());
  const nameCol = findColumnIndex_(header, CONFIG.RESPONSES_NAME_COLUMN_HEADER, CONFIG.RESPONSES_SHEET_NAME);
  const choiceCol = findColumnIndex_(header, CONFIG.RESPONSES_CHOICE_COLUMN_HEADER, CONFIG.RESPONSES_SHEET_NAME);

  const responses = new Map();
  for (let i = 1; i < data.length; i++) {
    const rawName = String(data[i][nameCol] || "").trim();
    if (rawName === "") continue;
    const rawChoice = String(data[i][choiceCol] || "").trim();
    for (const candidate of nameCandidates_(rawName)) {
      responses.set(candidate.toLowerCase(), rawChoice);
    }
  }
  return responses;
}

function nameCandidates_(name) {
  const parts = name.split(".");
  return parts.length > 1 ? [name, parts.slice(1).join(".")] : [name];
}

// ---------------------------------------------------------------------------
// Writing the Roster tab
// ---------------------------------------------------------------------------
function writeRosterSheet_(troopers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.ROSTER_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(CONFIG.ROSTER_SHEET_NAME);
  sheet.clear();

  const header = [
    "Username",
    "Real Name",
    "Rank",
    "MOS",
    "Position Title",
    "Company",
    "Platoon",
    "Squad",
    "Responded",
    "Choice",
    "MILPACS Profile",
  ];
  sheet.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight("bold");
  sheet.setFrozenRows(1);

  const respondedColIndex = 8; // 0-based index into each row array below
  const rows = troopers
    .map((t) => [
      t.username,
      t.realName,
      t.rankShort,
      t.mos,
      t.positionTitle,
      echelonField_(t.path, "company"),
      echelonField_(t.path, "platoon"),
      echelonField_(t.path, "squad"),
      t.responded ? "Yes" : "No",
      displayChoice_(t.isCharlie ? "hllv" : t.choice),
      milpacsProfileUrl_(t),
    ])
    // Not-responded first, so the outstanding list is right at the top.
    .sort((a, b) => (a[respondedColIndex] === b[respondedColIndex] ? 0 : a[respondedColIndex] === "No" ? -1 : 1));

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, header.length).setValues(rows);

    // Quick visual scan: red = still needs to respond, green = done.
    const respondedCol = rows.map((r) => [r[respondedColIndex] === "Yes" ? "#d9ead3" : "#f4cccc"]);
    sheet.getRange(2, respondedColIndex + 1, rows.length, 1).setBackgrounds(respondedCol);
  }

  sheet.autoResizeColumns(1, header.length);
}

// ---------------------------------------------------------------------------
// Writing the Analytics tab
// ---------------------------------------------------------------------------
// Rolls troopers up into squad/platoon/company completion rates. Company
// HQ staff (Commander/XO/1SG) count toward their company only; platoon HQ
// staff (PL/PSG) count toward their company and platoon; squad-level
// people (SL/ASL/Trooper) count toward all three. Battalion HQ (and any
// title that didn't match a known shape) belongs to none of the three and
// gets its own line so nobody silently drops out of the totals.
function aggregate_(troopers) {
  const companies = new Map();
  const platoons = new Map();
  const squads = new Map();
  const battalionHQ = { total: 0, responded: 0 };

  // extra carries only the identifying fields for a *new* map entry's seed
  // object -- responded is applied separately so it never gets baked into
  // that seed as a boolean instead of accumulating as a count.
  function bump(map, key, extra, responded) {
    if (!map.has(key)) map.set(key, Object.assign({ total: 0, responded: 0 }, extra));
    const entry = map.get(key);
    entry.total += 1;
    if (responded) entry.responded += 1;
  }

  troopers.forEach((t) => {
    const p = t.path;
    if (!p.company) {
      battalionHQ.total += 1;
      if (t.responded) battalionHQ.responded += 1;
      return;
    }
    bump(companies, p.company, { company: p.company }, t.responded);
    if (p.level === "platoon" || p.level === "squad") {
      bump(platoons, `${p.company}/${p.platoon}`, { company: p.company, platoon: p.platoon }, t.responded);
    }
    if (p.level === "squad") {
      bump(
        squads,
        `${p.company}/${p.platoon}/${p.squad}`,
        { company: p.company, platoon: p.platoon, squad: p.squad },
        t.responded,
      );
    }
  });

  return { companies, platoons, squads, battalionHQ };
}

// Which echelon group a trooper's billet falls into, for the leadership
// level x choice table. Squad-level splits into its leadership (Section
// Leader/Assistant Section Leader) vs. plain Trooper; an unrecognized
// title (path.level "unknown") is left out rather than guessed into a
// group.
function levelGroup_(path) {
  if (path.level === "battalion") return "battalion";
  if (path.level === "company") return "company";
  if (path.level === "platoon") return "platoon";
  if (path.level === "squad") return path.role === "Trooper" ? "trooper" : "sectionStaff";
  return null;
}

// Cross-tab of echelon level x game choice. C/2-7 counts as HLLV here
// unconditionally (a deliberate call, distinct from the completion tables'
// "counts as done but no fabricated answer" treatment) since Charlie's
// destination is already settled regardless of what any individual there
// actually answered. There's no "Other" bucket -- the form is a two-option
// radio button, so anything that isn't a recognized HLLV/HLLWW2 answer
// (including no answer at all) folds into Not Responded.
function aggregateLevelChoice_(troopers) {
  const table = {};
  LEVEL_GROUP_ORDER.forEach((g) => {
    table[g] = { hllv: 0, hllww2: 0, notResponded: 0, total: 0 };
  });

  troopers.forEach((t) => {
    const group = levelGroup_(t.path);
    if (!group) return;
    const choice = t.isCharlie ? "hllv" : t.choice;
    const row = table[group];
    row.total += 1;
    if (choice === "hllv") row.hllv += 1;
    else if (choice === "hllww2") row.hllww2 += 1;
    else row.notResponded += 1;
  });

  return table;
}

function companyLabel_(letter) {
  return COMPANY_NAMES[letter] ? `${letter} (${COMPANY_NAMES[letter]})` : letter;
}

function pct_(responded, total) {
  return total === 0 ? 0 : responded / total;
}

function pctColor_(fraction) {
  if (fraction >= 1) return "#d9ead3"; // green — fully done
  if (fraction >= 0.5) return "#fff2cc"; // yellow — partway
  return "#f4cccc"; // red — mostly outstanding
}

// Writes one titled table starting at startRow; returns the next free row.
// pctCol (1-based column number) is optional -- pass it only when that
// column holds a 0-1 fraction that should render as a percentage with
// green/yellow/red shading; omit it for a plain count table.
function writeTable_(sheet, startRow, title, header, dataRows, pctCol) {
  sheet.getRange(startRow, 1).setValue(title).setFontWeight("bold").setFontSize(12);
  const headerRow = startRow + 1;
  sheet.getRange(headerRow, 1, 1, header.length).setValues([header]).setFontWeight("bold");

  if (dataRows.length > 0) {
    const firstDataRow = headerRow + 1;
    sheet.getRange(firstDataRow, 1, dataRows.length, header.length).setValues(dataRows);

    if (pctCol) {
      sheet.getRange(firstDataRow, pctCol, dataRows.length, 1).setNumberFormat("0%");
      const colors = dataRows.map((r) => [pctColor_(r[pctCol - 1])]);
      sheet.getRange(firstDataRow, pctCol, dataRows.length, 1).setBackgrounds(colors);
    }
  }

  return headerRow + dataRows.length + 2; // +1 for header, +1 blank line before next table
}

function writeAnalyticsSheet_(troopers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.ANALYTICS_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(CONFIG.ANALYTICS_SHEET_NAME);
  sheet.clear();

  const { companies, platoons, squads, battalionHQ } = aggregate_(troopers);
  const overallTotal = troopers.length;
  const overallResponded = troopers.filter((t) => t.responded).length;

  let row = writeTable_(
    sheet,
    1,
    "Overall",
    ["Unit", "Total", "Responded", "% Complete"],
    [
      ["2-7 Cavalry (all)", overallTotal, overallResponded, pct_(overallResponded, overallTotal)],
      ["Battalion HQ", battalionHQ.total, battalionHQ.responded, pct_(battalionHQ.responded, battalionHQ.total)],
    ],
    4,
  );

  const companyRows = Array.from(companies.values())
    .sort((a, b) => a.company.localeCompare(b.company))
    .map((e) => [companyLabel_(e.company), e.total, e.responded, pct_(e.responded, e.total)]);
  row = writeTable_(sheet, row, "By Company", ["Company", "Total", "Responded", "% Complete"], companyRows, 4);

  const platoonRows = Array.from(platoons.values())
    .sort((a, b) => a.company.localeCompare(b.company) || Number(a.platoon) - Number(b.platoon))
    .map((e) => [companyLabel_(e.company), e.platoon, e.total, e.responded, pct_(e.responded, e.total)]);
  row = writeTable_(
    sheet,
    row,
    "By Platoon",
    ["Company", "Platoon", "Total", "Responded", "% Complete"],
    platoonRows,
    5,
  );

  const squadRows = Array.from(squads.values())
    .sort(
      (a, b) =>
        a.company.localeCompare(b.company) ||
        Number(a.platoon) - Number(b.platoon) ||
        Number(a.squad) - Number(b.squad),
    )
    .map((e) => [companyLabel_(e.company), e.platoon, e.squad, e.total, e.responded, pct_(e.responded, e.total)]);
  row = writeTable_(
    sheet,
    row,
    "By Squad",
    ["Company", "Platoon", "Squad", "Total", "Responded", "% Complete"],
    squadRows,
    6,
  );

  const levelTable = aggregateLevelChoice_(troopers);
  const levelRows = LEVEL_GROUP_ORDER.map((g) => {
    const r = levelTable[g];
    return [LEVEL_GROUP_LABELS[g], r.hllv, r.hllww2, r.notResponded, r.total];
  });
  writeTable_(
    sheet,
    row,
    "By Leadership Level & Choice",
    ["Level", "HLLV", "HLLWW2", "Not Responded", "Total"],
    levelRows,
  );

  sheet.autoResizeColumns(1, 6);
}

// ---------------------------------------------------------------------------
// Writing the WW2 Handoff tab
// ---------------------------------------------------------------------------
// A trooper counts for the WW2 handoff only if they personally chose
// HLLWW2 -- Charlie's forced-HLLV override (see syncRoster) means nobody
// there ever counts here, even if they literally answered HLLWW2, since
// Charlie's destination is already settled.
function isWw2Bound_(t) {
  return !t.isCharlie && t.choice === "hllww2";
}

function ww2PersonDisplay_(t) {
  return t ? `${t.rankShort}.${t.username}` : "VACANT";
}

// Fixed template per un-combined squad: Section Leader, Assistant Section
// Leader, then 10 numbered member slots (3 through 12) -- matches a
// full-strength squad regardless of how many people currently fill it.
// Member slots beyond the current headcount are left blank rather than
// "VACANT": unlike SL/ASL, there's no real per-slot identity behind a
// squad's member list (it's just an array), so an empty slot here is
// padding, not a known vacancy.
const WW2_MEMBER_SLOTS = 10;

// Companies/platoons whose WW2-bound squad-level people get pooled
// together and re-chunked into fresh squads (max WW2_COMBINE_MAX each)
// instead of kept under their original squad -- these units share a
// single practice time, so they're being planned as one group rather than
// squad-by-squad. platoon: null means the whole company (every platoon).
// Anything not matched here is left grouped by its real current
// Company/Platoon/Squad, unchanged.
const WW2_COMBINE_MAX = 13;
const WW2_COMBINE_RULES = [
  { company: "A", platoon: null, spTime: "8pm EST Thursday" },
  { company: "B", platoon: "1", spTime: "10pm EST Wednesday" },
  { company: "B", platoon: "2", spTime: "8pm EST Wednesday" },
  { company: "E", platoon: "2", spTime: "9pm EST Monday" },
  { company: "E", platoon: "3", spTime: "Sunday 7pm EST" },
];

// Per-squad practice-time labels for a platoon that otherwise keeps its
// real squad structure (unlike WW2_COMBINE_RULES, which flattens and
// rechunks) -- times are assigned to that platoon's squads in squad-number
// order. A platoon with more squads than times listed just leaves the
// remainder blank.
const WW2_SQUAD_SP_TIMES = {
  "E/1": ["Thursday 9pm EST", "Thursday 10pm EST"],
};

function matchCombineRule_(path) {
  return (
    WW2_COMBINE_RULES.find((r) => r.company === path.company && (r.platoon === null || r.platoon === path.platoon)) ||
    null
  );
}

function chunkArray_(items, maxSize) {
  const chunks = [];
  for (let i = 0; i < items.length; i += maxSize) chunks.push(items.slice(i, i + maxSize));
  return chunks;
}

// One row-block's worth of side-by-side squads. `flat` squads (from a
// combine rule) have no SL/ASL -- old leadership doesn't carry over into a
// freshly pooled-and-rechunked group, so everyone is just a plain numbered
// member, 1 through WW2_COMBINE_MAX. Non-flat squads are real, unchanged
// squads with their actual Section Leader/Assistant Section Leader.
function buildCombinedGroups_(bound) {
  const pools = new Map(); // rule -> troopers[]
  const leftover = [];
  bound.forEach((t) => {
    const rule = matchCombineRule_(t.path);
    if (!rule) {
      leftover.push(t);
      return;
    }
    if (!pools.has(rule)) pools.set(rule, []);
    pools.get(rule).push(t);
  });

  const groups = [];
  WW2_COMBINE_RULES.forEach((rule) => {
    const pool = pools.get(rule);
    if (!pool || pool.length === 0) return;
    // Sorted by original squad, so a fresh chunk boundary is at least as
    // likely to land between old squads as through the middle of one.
    pool.sort((a, b) => Number(a.path.squad) - Number(b.path.squad) || a.username.localeCompare(b.username));
    const title =
      rule.platoon === null
        ? `${companyLabel_(rule.company)} — Combined`
        : `${companyLabel_(rule.company)} — Platoon ${rule.platoon} (Combined)`;
    groups.push({
      title,
      spTime: rule.spTime,
      squadBlocks: chunkArray_(pool, WW2_COMBINE_MAX).map((members) => ({
        flat: true,
        leader: null,
        assistantLeader: null,
        members,
      })),
    });
  });

  return { groups, leftover };
}

// Everything not swept up by a combine rule: grouped by real current
// Company/Platoon, each squad kept separate with its actual SL/ASL, same
// as before combine rules existed.
function buildNormalGroups_(leftover) {
  const byUnit = new Map(); // "company/platoon" -> { company, platoon, squads: Map<squadNumber, {...}> }
  leftover.forEach((t) => {
    const key = `${t.path.company}/${t.path.platoon}`;
    if (!byUnit.has(key)) byUnit.set(key, { company: t.path.company, platoon: t.path.platoon, squads: new Map() });
    const unit = byUnit.get(key);
    if (!unit.squads.has(t.path.squad)) {
      unit.squads.set(t.path.squad, { leader: null, assistantLeader: null, members: [] });
    }
    const squad = unit.squads.get(t.path.squad);
    if (t.path.role === "Section Leader") squad.leader = t;
    else if (t.path.role === "Assistant Section Leader") squad.assistantLeader = t;
    else squad.members.push(t);
  });

  return Array.from(byUnit.values())
    .sort((a, b) => a.company.localeCompare(b.company) || Number(a.platoon) - Number(b.platoon))
    .map((unit) => {
      const squadNumbers = Array.from(unit.squads.keys()).sort((a, b) => Number(a) - Number(b));
      const spTimes = WW2_SQUAD_SP_TIMES[`${unit.company}/${unit.platoon}`] || null;
      return {
        title: `${companyLabel_(unit.company)} — Platoon ${unit.platoon}`,
        spTime: null,
        squadBlocks: squadNumbers.map((num, i) => ({
          flat: false,
          ...unit.squads.get(num),
          spTime: spTimes ? spTimes[i] || null : null,
        })),
      };
    });
}

// Only squad-level people can appear in the squad-shaped row-blocks below
// -- Battalion/Company HQ staff don't fit that layout and are left out of
// this tab entirely. Platoon staff (Platoon Leader/Sergeant) get their own
// simple list up top instead (see writeWw2HandoffSheet_).
function groupWw2Handoff_(troopers) {
  const bound = troopers.filter((t) => t.path.level === "squad" && isWw2Bound_(t));
  const { groups: combined, leftover } = buildCombinedGroups_(bound);
  return [...combined, ...buildNormalGroups_(leftover)];
}

function ww2PlatoonStaffRows_(troopers) {
  return troopers
    .filter((t) => t.path.level === "platoon" && isWw2Bound_(t))
    .sort(
      (a, b) =>
        a.path.company.localeCompare(b.path.company) ||
        Number(a.path.platoon) - Number(b.path.platoon) ||
        a.path.role.localeCompare(b.path.role),
    )
    .map((t) => [
      companyLabel_(t.path.company),
      `Platoon ${t.path.platoon}`,
      t.path.role,
      ww2PersonDisplay_(t),
      milpacsProfileUrl_(t),
    ]);
}

function writeWw2HandoffSheet_(troopers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.WW2_HANDOFF_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(CONFIG.WW2_HANDOFF_SHEET_NAME);
  sheet.clear();

  let row = 1;
  let maxCol = 1;

  // Platoon Leaders/Sergeants going WW2 -- listed together up top since
  // they don't belong to any squad and so don't fit the section-block
  // layout below.
  const staffRows = ww2PlatoonStaffRows_(troopers);
  sheet.getRange(row, 1).setValue("Platoon Staff").setFontWeight("bold").setFontSize(12);
  row += 1;
  const staffHeader = ["Company", "Platoon", "Role", "Name", "MILPACS Profile"];
  sheet.getRange(row, 1, 1, staffHeader.length).setValues([staffHeader]).setFontWeight("bold");
  row += 1;
  if (staffRows.length > 0) {
    sheet.getRange(row, 1, staffRows.length, staffHeader.length).setValues(staffRows);
    row += staffRows.length;
  }
  row += 1; // blank spacer row before the squad section-blocks
  maxCol = Math.max(maxCol, staffHeader.length);

  const groups = groupWw2Handoff_(troopers);
  const BLOCK_WIDTH = 4; // Label + Name + MILPACS Profile columns, plus one blank spacer column

  groups.forEach((group) => {
    sheet.getRange(row, 1).setValue(group.title).setFontWeight("bold").setFontSize(12);
    row += 1;
    if (group.spTime) {
      sheet.getRange(row, 1).setValue(`SP: ${group.spTime}`).setFontStyle("italic");
      row += 1;
    }

    // A per-squad SP time (e.g. Easy Platoon 1's two squads on different
    // nights) gets its own row under every squad's header in this
    // row-block, blank for any squad without one, so SL:/ASL: still lines
    // up across squads that don't have an override.
    const hasSquadSpTimes = group.squadBlocks.some((sb) => sb.spTime);

    const headerRow = row;
    const spTimeRow = hasSquadSpTimes ? row + 1 : null;
    const dataStartRow = row + (hasSquadSpTimes ? 2 : 1);
    let blockDataRows = 0;

    group.squadBlocks.forEach((squad, i) => {
      const col = 1 + i * BLOCK_WIDTH;
      maxCol = Math.max(maxCol, col + 2);

      sheet.getRange(headerRow, col + 1).setValue(`${String.fromCharCode(65 + i)} Section`).setFontWeight("bold");
      if (hasSquadSpTimes) {
        sheet
          .getRange(spTimeRow, col + 1)
          .setValue(squad.spTime ? `SP: ${squad.spTime}` : "")
          .setFontStyle("italic");
      }

      const dataRows = [];
      if (squad.flat) {
        for (let slot = 0; slot < WW2_COMBINE_MAX; slot++) {
          const member = squad.members[slot];
          dataRows.push([String(slot + 1), member ? ww2PersonDisplay_(member) : "", member ? milpacsProfileUrl_(member) : ""]);
        }
      } else {
        dataRows.push(["SL:", ww2PersonDisplay_(squad.leader), squad.leader ? milpacsProfileUrl_(squad.leader) : ""]);
        dataRows.push([
          "ASL:",
          ww2PersonDisplay_(squad.assistantLeader),
          squad.assistantLeader ? milpacsProfileUrl_(squad.assistantLeader) : "",
        ]);
        for (let slot = 0; slot < WW2_MEMBER_SLOTS; slot++) {
          const member = squad.members[slot];
          dataRows.push([String(slot + 3), member ? ww2PersonDisplay_(member) : "", member ? milpacsProfileUrl_(member) : ""]);
        }
      }
      blockDataRows = Math.max(blockDataRows, dataRows.length);
      sheet.getRange(dataStartRow, col, dataRows.length, 3).setValues(dataRows);
    });

    row = dataStartRow + blockDataRows + 1; // blank spacer row before next group
  });

  sheet.autoResizeColumns(1, maxCol);
}

// ---------------------------------------------------------------------------
// Hourly auto-refresh
// ---------------------------------------------------------------------------
function enableHourlyTrigger() {
  disableAutoRefresh();
  ScriptApp.newTrigger("syncRoster").timeBased().everyHours(1).create();
  SpreadsheetApp.getUi().alert("Hourly auto-refresh enabled — this Sheet will refresh itself every hour.");
}

function disableAutoRefresh() {
  ScriptApp.getProjectTriggers().forEach((t) => {
    if (t.getHandlerFunction() === "syncRoster") ScriptApp.deleteTrigger(t);
  });
}
