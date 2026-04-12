# Auto Update Setup

ODETool Pro now supports startup update checks through the Tauri updater.

## What Changed

- The installed desktop app checks for updates when it starts.
- On Windows, updates install in `passive` mode so the user does not need to manually download a fresh installer for each release.
- The app now looks for the update feed at:

```text
https://github.com/shetoile/odetoolv5/releases/latest/download/latest.json
```

## One-Time Install

Users still need one normal installer the first time.

After that, future releases can update in-place from inside the app.

## Signing Key

The updater signing key was generated locally at:

```text
C:\Users\burea\.tauri\odetool-updater.key
```

Public key:

```text
C:\Users\burea\.tauri\odetool-updater.key.pub
```

Keep the private key safe and backed up. If it is lost, future updates cannot be signed for this app identity.

## Release Steps

1. Bump the app version in:
   - `package.json`
   - `src-tauri/Cargo.toml`
   - `src-tauri/tauri.conf.json`
2. Build the signed desktop release:

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY_PATH="$env:USERPROFILE\.tauri\odetool-updater.key"
npm run tauri:build
```

3. Prepare the updater manifest and upload package:

```powershell
$env:UPDATER_RELEASE_TAG="v0.1.2"
npm run updater:prepare
```

4. Upload the files from `output/updater/` to a GitHub Release in `shetoile/odetoolv5`.
   - `latest.json`
   - `ODETool.Pro_<version>_x64-setup.exe`
   - `ODETool.Pro_<version>_x64-setup.exe.sig`

## GitHub Actions Release Automation

A release workflow is available at:

```text
.github/workflows/release-updater.yml
```

It can run in two modes:

- Push a version tag (for example `v0.1.1`) to build/sign/upload automatically.
- Run manually from Actions using `workflow_dispatch` and a tag name. The workflow now checks out that exact tag before building.

Required repository secrets:

- `TAURI_SIGNING_PRIVATE_KEY`
  - Full private key content from `C:\Users\burea\.tauri\odetool-updater.key`.
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
  - Private key password (leave empty only if your key was generated without password).

Suggested release flow:

1. Bump versions in `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`.
2. Commit and push.
3. Create and push a tag:

```powershell
git tag v0.1.1
git push origin v0.1.1
```

4. Wait for `Release Updater` workflow to upload:
   - `latest.json`
   - `*.exe`
   - `*.exe.sig`

## Notes

- `src-tauri/tauri.conf.json` now enables `createUpdaterArtifacts`, which produces the signed updater installer artifacts used by `latest.json`.
- `latest.json` should keep using the `releases/latest/download/latest.json` feed, but the installer URL inside that file should point to the specific tag release asset so the download stays stable even after newer releases are published.
- Debug builds skip startup update checks unless `ODETOOL_ENABLE_AUTO_UPDATE_IN_DEBUG=1` is set.
