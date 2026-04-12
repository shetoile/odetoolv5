# ODETool Rebuild

Fresh, separate implementation of ODETool using:

- React 19 + TypeScript
- Vite
- Tailwind CSS v4
- Tauri v2 + Rust
- SurrealDB v2 (embedded `surrealkv`)

## What was preserved

- Service-level API shape and logic flow from the original app:
  - `nodeService` (`createNode`, `renameNode`, `moveNode`, `getAncestors`, `searchNodes`, etc.)
  - `taskService` (`createTask`, `searchTasks`, `linkTaskToNode`, etc.)
- Bridge architecture:
  - Frontend calls `invoke(...)`
  - Rust commands execute domain operations
  - SurrealDB stores local data

## Run

```bash
npm install
npm run tauri:dev
```

## Validate

```bash
npm run mock:test
```

## Auto Update

- The installed Windows app can now check GitHub Releases for updates on startup.
- Release prep guide: `docs/AUTO_UPDATE_SETUP.md`
- Automated tag-based release workflow: `.github/workflows/release-updater.yml`
- After `npm run tauri:build`, generate `latest.json` with:

```bash
npm run updater:prepare
```

## Consistency Audit

```bash
npm run quality:consistency
```

- Writes a structural consistency snapshot to `quality/reports/consistency-latest.json`.
- `npm run quality:run` refreshes this audit after the full quality gate.

## Auto Test System

```bash
npm run hooks:install
```

- `pre-commit`: runs `npm run test:quick`
- `pre-push`: runs `npm run mock:test`
- CI runs `npm run mock:test` on every push and pull request.

### Change Workflow (Required)

1. Run quality gate and generate a report:

```bash
npm run quality:run
```

2. If there are failures, fix and rerun step 1.
3. Record the change in release notes with category and QA report link:

```bash
npm run release:record -- --category functionality --title "Short title" --details "What changed and why"
```

Allowed categories: `feature`, `functionality`, `general`.

4. Commit and push. Hooks enforce:
- Dedicated tests for code changes.
- Release note updates for code changes.

Detailed process and category rules are documented in `quality/PROCESS.md`.

## Local database location

Database file is created by Tauri in app data as `odetool_rebuild.db`.

## Main files

- Frontend app shell: `src/App.tsx`
- HyperTree UI: `src/components/HyperTree.tsx`
- Node logic: `src/lib/nodeService.ts`
- Task logic: `src/lib/taskService.ts`
- Rust backend commands: `src-tauri/src/lib.rs`
- Surreal schema: `src-tauri/surreal-schema.surql`
