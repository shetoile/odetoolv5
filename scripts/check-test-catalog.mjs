import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CATALOG_PATH = path.join(ROOT, "quality", "test-catalog.json");
const RELEASE_LOG_PATH = path.join(ROOT, "quality", "release-log.json");
const ALLOWED_CATEGORIES = new Set(["bug", "issue", "feature", "functionality", "general"]);

function fail(message) {
  console.error(message);
  process.exit(1);
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

if (!fs.existsSync(CATALOG_PATH)) {
  fail(`Missing test catalog: ${CATALOG_PATH}`);
}
if (!fs.existsSync(RELEASE_LOG_PATH)) {
  fail(`Missing release log: ${RELEASE_LOG_PATH}`);
}

const releaseLog = readJson(RELEASE_LOG_PATH);
const releaseEntries = Array.isArray(releaseLog.entries) ? releaseLog.entries : [];
if (releaseEntries.length === 0) {
  fail("quality/release-log.json must include at least one release entry.");
}
const releaseKeys = new Set(releaseEntries.map((_, index) => `release.log.${index + 1}`));

const catalog = readJson(CATALOG_PATH);
if (!Array.isArray(catalog.items)) {
  fail("quality/test-catalog.json must include an `items` array.");
}

const seenIds = new Set();
const seenReleaseKeys = new Set();

for (const item of catalog.items) {
  if (!item || typeof item !== "object") {
    fail("Each catalog item must be an object.");
  }
  if (typeof item.id !== "string" || item.id.trim().length === 0) {
    fail("Each catalog item must have a non-empty string `id`.");
  }
  if (seenIds.has(item.id)) {
    fail(`Duplicate test catalog id: ${item.id}`);
  }
  seenIds.add(item.id);

  if (typeof item.title !== "string" || item.title.trim().length === 0) {
    fail(`Catalog item ${item.id} is missing non-empty title.`);
  }
  if (!ALLOWED_CATEGORIES.has(item.category)) {
    fail(
      `Catalog item ${item.id} has invalid category '${item.category}'. Allowed: bug, issue, feature, functionality, general.`
    );
  }
  if (typeof item.releaseLogKey !== "string" || !item.releaseLogKey.startsWith("release.log.")) {
    fail(`Catalog item ${item.id} must have releaseLogKey like release.log.N`);
  }
  const releaseIndex = Number.parseInt(item.releaseLogKey.slice("release.log.".length), 10);
  if (!Number.isInteger(releaseIndex) || releaseIndex < 1 || releaseIndex > releaseEntries.length) {
    fail(`Catalog item ${item.id} references unknown releaseLogKey: ${item.releaseLogKey}`);
  }
  if (seenReleaseKeys.has(item.releaseLogKey)) {
    fail(`Duplicate releaseLogKey in catalog: ${item.releaseLogKey}`);
  }
  seenReleaseKeys.add(item.releaseLogKey);
}

const missing = [...releaseKeys].filter((key) => !seenReleaseKeys.has(key));
if (missing.length > 0) {
  fail(
    [
      "Test catalog does not cover all existing release items.",
      "Missing keys:",
      ...missing.map((key) => `  - ${key}`)
    ].join("\n")
  );
}

console.log(
  `Test catalog coverage OK: ${catalog.items.length} items mapped to ${releaseKeys.size} release entries.`
);
