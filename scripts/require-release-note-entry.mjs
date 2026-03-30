import { execSync } from "node:child_process";

function run(command) {
  return execSync(command, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 10 * 1024 * 1024
  });
}

function getStagedFiles() {
  const raw = run("git diff --cached --name-only --diff-filter=ACMR");
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function isFrontendCodeFile(path) {
  return /^src\/.+\.(ts|tsx)$/i.test(path);
}

function isRustCodeFile(path) {
  return /^src-tauri\/src\/.+\.rs$/i.test(path);
}

function isDedicatedTestFile(path) {
  return (
    /(^|\/)(__tests__|tests)(\/|$)/i.test(path) ||
    /\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs|rs)$/i.test(path) ||
    /_(test|spec)\.rs$/i.test(path)
  );
}

try {
  const stagedFiles = getStagedFiles();
  const changedCode = stagedFiles.filter((file) => {
    if (isDedicatedTestFile(file)) return false;
    return isFrontendCodeFile(file) || isRustCodeFile(file);
  });

  if (changedCode.length === 0) {
    process.exit(0);
  }

  const hasReleaseLogUpdate = stagedFiles.includes("quality/release-log.json");
  const hasReleaseMarkdownUpdate = stagedFiles.includes("quality/RELEASE_NOTES.md");

  if (hasReleaseLogUpdate && hasReleaseMarkdownUpdate) {
    process.exit(0);
  }

  console.error("Release note guard failed.");
  console.error("Code changes were staged without release note updates.");
  console.error("Required staged files:");
  console.error("  - quality/release-log.json");
  console.error("  - quality/RELEASE_NOTES.md");
  console.error("Use:");
  console.error(
    '  npm run release:record -- --category functionality --title "Your change" --details "What changed and why"'
  );
  process.exit(1);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Unable to run release-note guard: ${message}`);
  process.exit(1);
}
