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

function isFrontendDedicatedTestFile(path) {
  return (
    /^src\/.+\/(__tests__|tests)\/.+\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(path) ||
    /^src\/.+\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(path)
  );
}

function isRustDedicatedTestFile(path) {
  return (
    /^src-tauri\/tests\/.+\.rs$/i.test(path) ||
    /^src-tauri\/src\/.+\.(test|spec)\.rs$/i.test(path) ||
    /^src-tauri\/src\/.+_(test|spec)\.rs$/i.test(path)
  );
}

try {
  const stagedFiles = getStagedFiles();
  const changedFrontendCodeFiles = stagedFiles.filter(
    (path) => isFrontendCodeFile(path) && !isFrontendDedicatedTestFile(path)
  );
  const changedRustCodeFiles = stagedFiles.filter(
    (path) => isRustCodeFile(path) && !isRustDedicatedTestFile(path)
  );

  if (changedFrontendCodeFiles.length === 0 && changedRustCodeFiles.length === 0) {
    process.exit(0);
  }

  const changedFrontendTests = stagedFiles.filter(isFrontendDedicatedTestFile);
  const changedRustTests = stagedFiles.filter(isRustDedicatedTestFile);

  const errors = [];

  if (changedFrontendCodeFiles.length > 0 && changedFrontendTests.length === 0) {
    errors.push(
      [
        "Frontend code changed without dedicated frontend test file updates.",
        "Changed frontend code files:",
        ...changedFrontendCodeFiles.map((file) => `  - ${file}`),
        "Add/update at least one file in src/**/__tests__/, src/**/tests/, or *.test.*/*.spec.* under src/."
      ].join("\n")
    );
  }

  if (changedRustCodeFiles.length > 0 && changedRustTests.length === 0) {
    errors.push(
      [
        "Rust backend code changed without dedicated Rust test file updates.",
        "Changed Rust code files:",
        ...changedRustCodeFiles.map((file) => `  - ${file}`),
        "Add/update at least one file in src-tauri/tests/ or a dedicated *_test.rs/*.test.rs file."
      ].join("\n")
    );
  }

  if (errors.length > 0) {
    console.error("Dedicated test file guard failed.");
    console.error(errors.join("\n\n"));
    process.exit(1);
  }

  process.exit(0);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Unable to run test-evidence guard: ${message}`);
  process.exit(1);
}
