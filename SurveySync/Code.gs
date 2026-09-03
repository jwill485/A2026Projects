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

function normalizeChoice_(raw) {
  return CHOICE_TOKENS[raw.trim().toLowerCase()] || raw;
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

  const header = ["Username", "Real Name", "Rank", "MOS", "Position Title", "Responded"];
  sheet.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight("bold");
  sheet.setFrozenRows(1);

  const rows = troopers
    .map((t) => [t.username, t.realName, t.rankShort, t.mos, t.positionTitle, t.responded ? "Yes" : "No"])
    // Not-responded first, so the outstanding list is right at the top.
    .sort((a, b) => (a[5] === b[5] ? 0 : a[5] === "No" ? -1 : 1));

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, header.length).setValues(rows);

    // Quick visual scan: red = still needs to respond, green = done.
    const respondedCol = rows.map((r) => [r[5] === "Yes" ? "#d9ead3" : "#f4cccc"]);
    sheet.getRange(2, 6, rows.length, 1).setBackgrounds(respondedCol);
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
