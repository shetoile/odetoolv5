import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PACKAGE_JSON_PATH = path.join(ROOT, "package.json");
const TAURI_CONFIG_PATH = path.join(ROOT, "src-tauri", "tauri.conf.json");
const NSIS_BUNDLE_DIR = path.join(ROOT, "src-tauri", "target", "release", "bundle", "nsis");
const OUTPUT_DIR = path.join(ROOT, "output", "updater");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function normalizeGitHubRepo(remoteUrl) {
  const trimmed = remoteUrl.trim();
  const httpsMatch = trimmed.match(/github\.com[:/](.+?)(?:\.git)?$/i);
  if (httpsMatch?.[1]) {
    return httpsMatch[1].replace(/^\/+|\/+$/g, "");
  }
  return null;
}

function resolveRepositorySlug() {
  const fromEnv = process.env.UPDATER_REPOSITORY?.trim();
  if (fromEnv) return fromEnv.replace(/^\/+|\/+$/g, "");

  try {
    const remote = execFileSync("git", ["remote", "get-url", "origin"], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
    return normalizeGitHubRepo(remote);
  } catch {
    return null;
  }
}

function resolveReleaseTag(version) {
  const fromEnv = process.env.UPDATER_RELEASE_TAG?.trim();
  if (fromEnv) return fromEnv;
  return `v${version}`;
}

function toGitHubReleaseAssetName(fileName) {
  return fileName.trim().replace(/\s+/g, ".");
}

function findInstallerFile(productName, version) {
  if (!fs.existsSync(NSIS_BUNDLE_DIR)) {
    throw new Error(`NSIS bundle directory not found: ${NSIS_BUNDLE_DIR}`);
  }

  const candidates = fs
    .readdirSync(NSIS_BUNDLE_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => name.endsWith("-setup.exe") && name.includes(`_${version}_`))
    .filter((name) => name.startsWith(productName));

  if (candidates.length === 0) {
    throw new Error(
      `No signed NSIS installer was found for ${productName} ${version}. Run \`npm run tauri:build\` first.`
    );
  }

  candidates.sort((left, right) => right.localeCompare(left));
  return candidates[0];
}

const packageJson = readJson(PACKAGE_JSON_PATH);
const tauriConfig = readJson(TAURI_CONFIG_PATH);
const tauriVersion = String(tauriConfig.version ?? "").trim();
const packageVersion = String(packageJson.version ?? "").trim();
const version = tauriVersion || packageVersion;
const productName = String(tauriConfig.productName ?? "").trim();

if (!version) {
  throw new Error("Could not resolve the app version from package.json or src-tauri/tauri.conf.json.");
}

if (tauriVersion && packageVersion && tauriVersion !== packageVersion) {
  console.warn(
    `Version mismatch detected: using src-tauri/tauri.conf.json (${tauriVersion}) instead of package.json (${packageVersion}).`
  );
}

if (!productName) {
  throw new Error("Could not resolve productName from src-tauri/tauri.conf.json.");
}

const repositorySlug = resolveRepositorySlug();
if (!repositorySlug) {
  throw new Error(
    "Could not resolve the GitHub repository. Set UPDATER_REPOSITORY=owner/repo before running this script."
  );
}
const releaseTag = resolveReleaseTag(version);

const installerName = findInstallerFile(productName, version);
const installerPath = path.join(NSIS_BUNDLE_DIR, installerName);
const signaturePath = `${installerPath}.sig`;
const releaseInstallerName = toGitHubReleaseAssetName(installerName);
const releaseSignatureName = `${releaseInstallerName}.sig`;

if (!fs.existsSync(signaturePath)) {
  throw new Error(
    `Updater signature not found for ${installerName}. Make sure TAURI_SIGNING_PRIVATE_KEY_PATH is set before building.`
  );
}

const signature = fs.readFileSync(signaturePath, "utf8").trim();
const notes = process.env.UPDATER_NOTES?.trim() ?? "";
const installerUrl = `https://github.com/${repositorySlug}/releases/download/${encodeURIComponent(releaseTag)}/${encodeURIComponent(releaseInstallerName)}`;

const latestManifest = {
  version,
  notes,
  pub_date: new Date().toISOString(),
  platforms: {
    "windows-x86_64": {
      signature,
      url: installerUrl
    }
  }
};

fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUTPUT_DIR, { recursive: true });
fs.copyFileSync(installerPath, path.join(OUTPUT_DIR, releaseInstallerName));
fs.copyFileSync(signaturePath, path.join(OUTPUT_DIR, releaseSignatureName));
fs.writeFileSync(path.join(OUTPUT_DIR, "latest.json"), `${JSON.stringify(latestManifest, null, 2)}\n`, "utf8");

console.log("Prepared updater release files:");
console.log(`- Version: ${version}`);
console.log(`- Release tag: ${releaseTag}`);
console.log(`- Installer: ${path.join("output", "updater", releaseInstallerName)}`);
console.log(`- Signature: ${path.join("output", "updater", releaseSignatureName)}`);
console.log(`- Manifest: ${path.join("output", "updater", "latest.json")}`);
console.log(`- Feed URL: https://github.com/${repositorySlug}/releases/latest/download/latest.json`);
