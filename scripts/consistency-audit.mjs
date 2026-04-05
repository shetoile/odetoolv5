import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, "src");
const REPORT_DIR = path.join(ROOT, "quality", "reports");
const REPORT_PATH = path.join(REPORT_DIR, "consistency-latest.json");
const PACKAGE_JSON_PATH = path.join(ROOT, "package.json");

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".css"]);
const FRONTEND_TEST_FILE_PATTERN = /\.(test|spec)\.[cm]?[jt]sx?$/i;
const FRONTEND_TEST_PACKAGES = ["vitest", "jest", "@playwright/test", "cypress", "mocha", "ava"];
const TRACKED_CONFIG_ARTIFACTS = ["vite.config.js", "vite.config.d.ts"];
const WARNING_LINE_THRESHOLD = 1500;
const CRITICAL_LINE_THRESHOLD = 5000;
const LARGEST_FILE_LIMIT = 10;

function toRelative(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join("/");
}

function walkFiles(dirPath) {
  const results = [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(entryPath));
      continue;
    }
    if (!SOURCE_EXTENSIONS.has(path.extname(entry.name))) continue;
    results.push(entryPath);
  }
  return results;
}

function countLines(text) {
  if (text.length === 0) return 0;
  return (text.match(/\n/g)?.length ?? 0) + 1;
}

function countMatches(text, pattern) {
  return text.match(pattern)?.length ?? 0;
}

function isTrackedByGit(relativePath) {
  try {
    execFileSync("git", ["ls-files", "--error-unmatch", "--", relativePath], {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "ignore"]
    });
    return true;
  } catch {
    return false;
  }
}

function buildFinding(id, severity, summary, extra = {}) {
  return {
    id,
    severity,
    summary,
    ...extra
  };
}

const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, "utf8"));
const packageNames = new Set([
  ...Object.keys(packageJson.dependencies ?? {}),
  ...Object.keys(packageJson.devDependencies ?? {})
]);

const sourceFiles = walkFiles(SRC_DIR).map((filePath) => {
  const content = fs.readFileSync(filePath, "utf8");
  return {
    path: toRelative(filePath),
    lines: countLines(content),
    content
  };
});

sourceFiles.sort((left, right) => right.lines - left.lines || left.path.localeCompare(right.path));

const totalSourceLines = sourceFiles.reduce((sum, file) => sum + file.lines, 0);
const largestFiles = sourceFiles.slice(0, LARGEST_FILE_LIMIT).map(({ path: filePath, lines }) => ({
  path: filePath,
  lines
}));
const warningFiles = sourceFiles.filter((file) => file.lines >= WARNING_LINE_THRESHOLD);
const criticalFiles = sourceFiles.filter((file) => file.lines >= CRITICAL_LINE_THRESHOLD);
const frontendTestFiles = sourceFiles
  .filter((file) => FRONTEND_TEST_FILE_PATTERN.test(file.path))
  .map((file) => file.path);
const hasFrontendTestRunner = FRONTEND_TEST_PACKAGES.some((packageName) => packageNames.has(packageName));
const trackedConfigArtifacts = TRACKED_CONFIG_ARTIFACTS.filter(isTrackedByGit);

const appShell = sourceFiles.find((file) => file.path === "src/App.tsx") ?? null;
const procedureBuilderPanel = sourceFiles.find(
  (file) => file.path === "src/components/views/ProcedureBuilderPanel.tsx"
) ?? null;
const procedureContentPanel = sourceFiles.find(
  (file) => file.path === "src/components/views/ProcedureContentPanel.tsx"
) ?? null;
const localizationCatalog = sourceFiles.find((file) => file.path === "src/lib/i18n.ts") ?? null;

const findings = [];

if (appShell && appShell.lines >= CRITICAL_LINE_THRESHOLD) {
  findings.push(
    buildFinding(
      "app-shell-monolith",
      "critical",
      `src/App.tsx is ${appShell.lines.toLocaleString()} lines with ${countMatches(appShell.content, /useState\(/g)} useState calls and ${countMatches(appShell.content, /useEffect\(/g)} useEffect calls. This mixes UI composition, persistence, orchestration, and domain workflows in one file.`,
      { file: appShell.path }
    )
  );
}

if (procedureBuilderPanel && procedureBuilderPanel.lines >= CRITICAL_LINE_THRESHOLD) {
  findings.push(
    buildFinding(
      "procedure-builder-monolith",
      "critical",
      `Procedure builder lives in a ${procedureBuilderPanel.lines.toLocaleString()} line component, which makes editor behavior, layout consistency, and change review unusually hard to reason about.`,
      { file: procedureBuilderPanel.path }
    )
  );
}

if (procedureContentPanel && procedureContentPanel.lines >= CRITICAL_LINE_THRESHOLD) {
  findings.push(
    buildFinding(
      "procedure-content-panel-monolith",
      "high",
      `Procedure content rendering is concentrated in ${procedureContentPanel.lines.toLocaleString()} lines, so presentational changes and behavior changes are tightly coupled.`,
      { file: procedureContentPanel.path }
    )
  );
}

if (localizationCatalog && localizationCatalog.lines >= CRITICAL_LINE_THRESHOLD) {
  findings.push(
    buildFinding(
      "localization-catalog-monolith",
      "high",
      `The translation catalog is ${localizationCatalog.lines.toLocaleString()} lines in a single TypeScript file. This slows localization review and makes string consistency harder to audit by feature.`,
      { file: localizationCatalog.path }
    )
  );
}

if (!hasFrontendTestRunner || frontendTestFiles.length === 0) {
  findings.push(
    buildFinding(
      "frontend-test-gap",
      "high",
      `No frontend test runner dependency and no src/*.test or src/*.spec files were detected. UI confidence currently depends on typecheck/build discipline rather than executable component or integration coverage.`
    )
  );
}

if (trackedConfigArtifacts.length > 0) {
  findings.push(
    buildFinding(
      "tracked-generated-config-artifacts",
      "medium",
      `Tracked config artifacts were detected alongside the TypeScript source config: ${trackedConfigArtifacts.join(", ")}. These files add repository churn and can drift from vite.config.ts if the build pipeline changes.`
    )
  );
}

const report = {
  version: 1,
  generatedAt: new Date().toISOString(),
  thresholds: {
    warningLines: WARNING_LINE_THRESHOLD,
    criticalLines: CRITICAL_LINE_THRESHOLD
  },
  source: {
    fileCount: sourceFiles.length,
    totalLines: totalSourceLines,
    largestFiles,
    warningFiles: warningFiles.map(({ path: filePath, lines }) => ({ path: filePath, lines })),
    criticalFiles: criticalFiles.map(({ path: filePath, lines }) => ({ path: filePath, lines }))
  },
  appShell: appShell
    ? {
        path: appShell.path,
        lines: appShell.lines,
        useStateCount: countMatches(appShell.content, /useState\(/g),
        useEffectCount: countMatches(appShell.content, /useEffect\(/g),
        useMemoCount: countMatches(appShell.content, /useMemo\(/g),
        useCallbackCount: countMatches(appShell.content, /useCallback\(/g)
      }
    : null,
  frontendTests: {
    hasRunnerDependency: hasFrontendTestRunner,
    files: frontendTestFiles
  },
  trackedArtifacts: trackedConfigArtifacts,
  findings
};

fs.mkdirSync(REPORT_DIR, { recursive: true });
fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log("Consistency audit summary");
console.log(`- Source files scanned: ${report.source.fileCount}`);
console.log(`- Total source lines: ${report.source.totalLines.toLocaleString()}`);
console.log(`- Files over ${WARNING_LINE_THRESHOLD.toLocaleString()} lines: ${report.source.warningFiles.length}`);
console.log(`- Files over ${CRITICAL_LINE_THRESHOLD.toLocaleString()} lines: ${report.source.criticalFiles.length}`);
console.log(`- Frontend test files: ${report.frontendTests.files.length}`);
console.log(`- Tracked config artifacts: ${report.trackedArtifacts.length}`);
console.log("Largest files:");
for (const file of report.source.largestFiles) {
  console.log(`  - ${file.path}: ${file.lines.toLocaleString()} lines`);
}
if (report.findings.length > 0) {
  console.log("Top findings:");
  for (const finding of report.findings) {
    console.log(`  - [${finding.severity}] ${finding.summary}`);
  }
}
console.log(`Report written: ${toRelative(REPORT_PATH)}`);
