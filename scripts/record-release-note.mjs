import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const RELEASE_LOG_PATH = path.join(ROOT, "quality", "release-log.json");
const RELEASE_MD_PATH = path.join(ROOT, "quality", "RELEASE_NOTES.md");
const LATEST_REPORT_PATH = path.join(ROOT, "quality", "reports", "latest.json");
const ALLOWED = new Set(["bug", "issue", "feature", "functionality", "general"]);

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--category") out.category = argv[i + 1];
    if (arg === "--title") out.title = argv[i + 1];
    if (arg === "--details") out.details = argv[i + 1];
  }
  return out;
}

function nowIso() {
  return new Date().toISOString();
}

function nowId() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return [
    d.getUTCFullYear(),
    pad(d.getUTCMonth() + 1),
    pad(d.getUTCDate()),
    pad(d.getUTCHours()),
    pad(d.getUTCMinutes()),
    pad(d.getUTCSeconds())
  ].join("");
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function generateMarkdown(entries) {
  const lines = [
    "# Release Notes",
    "",
    "Process: `test -> fix -> record`",
    ""
  ];

  for (const entry of entries) {
    lines.push(`## ${entry.title}`);
    lines.push("");
    lines.push(`- ID: \`${entry.id}\``);
    lines.push(`- Date: ${entry.date}`);
    lines.push(`- Category: ${entry.category}`);
    lines.push(`- QA Report: [${entry.qaReport}](${entry.qaReport})`);
    lines.push(`- Details: ${entry.details}`);
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

const args = parseArgs(process.argv.slice(2));
if (!args.category || !ALLOWED.has(args.category)) {
  console.error("Missing or invalid --category. Allowed: bug, issue, feature, functionality, general");
  process.exit(1);
}
if (!args.title || args.title.trim().length === 0) {
  console.error("Missing --title");
  process.exit(1);
}
if (!args.details || args.details.trim().length === 0) {
  console.error("Missing --details");
  process.exit(1);
}
if (!fs.existsSync(LATEST_REPORT_PATH)) {
  console.error("Missing quality/reports/latest.json. Run `npm run quality:run` first.");
  process.exit(1);
}

const latest = readJson(LATEST_REPORT_PATH, null);
if (!latest?.reportPath) {
  console.error("Invalid latest quality report metadata. Run `npm run quality:run` again.");
  process.exit(1);
}

const existing = readJson(RELEASE_LOG_PATH, { version: 1, entries: [] });
const entries = Array.isArray(existing.entries) ? existing.entries : [];

const entry = {
  id: `rn-${nowId()}`,
  date: nowIso(),
  category: args.category,
  title: args.title.trim(),
  details: args.details.trim(),
  qaReport: latest.reportPath
};

entries.push(entry);
entries.sort((a, b) => (a.date < b.date ? 1 : -1));

writeJson(RELEASE_LOG_PATH, { version: 1, entries });
fs.writeFileSync(RELEASE_MD_PATH, generateMarkdown(entries), "utf8");

console.log(`Release note recorded: ${entry.id}`);
console.log(`Linked QA report: ${entry.qaReport}`);
