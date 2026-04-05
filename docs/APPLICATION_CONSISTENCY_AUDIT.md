# Application Consistency Audit

Snapshot prepared on 2026-04-04 against the current workspace state.

## What is already strong

- TypeScript typecheck passes.
- Production build passes.
- Rust backend unit tests pass (`33` passing tests during this audit).
- The app has a recognizable design language with strong theming tokens and a disciplined desktop shell.

## Structural consistency gaps

- `src/App.tsx` is the main architectural bottleneck at `23,565` lines.
  - It currently owns shell layout, workspace persistence, AI orchestration, auth/session state, panel routing, local-storage hydration, and workflow mutations.
  - This slows review, makes regressions harder to isolate, and encourages feature-specific exceptions instead of stable app-level patterns.
- Procedure editing is split across very large view files:
  - `src/components/views/ProcedureBuilderPanel.tsx`: `12,986` lines
  - `src/components/views/ProcedureContentPanel.tsx`: `6,040` lines
  - These files are too large for predictable UI consistency, especially for editor behaviors and workflow rules.
- Localization is centralized in one oversized file:
  - `src/lib/i18n.ts`: `5,470` lines
  - This makes per-feature language review, ownership, and consistency checks harder than they need to be.
- Frontend behavior is under-tested.
  - The current quality gate is strong on release discipline and build validation, but there is no dedicated frontend test runner and no `src/*.test` or `src/*.spec` coverage.
- The previous Vite chunk strategy manually separated tightly coupled feature folders.
  - That produced circular chunk warnings between AI, timeline, and workspace code during production builds.

## Improvements made in this pass

- The Vite manual chunk strategy was relaxed for tightly coupled feature folders so Rollup can place those modules automatically.
  - Goal: remove circular chunk warnings and make production output more stable.
- A new structural audit command was added:
  - `npm run quality:consistency`
  - Output: `quality/reports/consistency-latest.json`
- The full quality gate now refreshes the consistency audit automatically.

## Top-tier roadmap

1. Split `src/App.tsx` into feature controllers.
   - Suggested first extraction targets: auth/session, workspace persistence, document advisor, reusable library, desktop tab orchestration.
2. Introduce feature-owned view containers for procedure editing.
   - Move command logic, field mutation helpers, and rendering sections into smaller feature modules with explicit prop contracts.
3. Add executable frontend coverage.
   - Start with Vitest + React Testing Library for pure component/state flows.
   - Add a small number of high-value end-to-end desktop smoke tests after the component layer is covered.
4. Break localization into feature dictionaries.
   - Keep shared translation helpers in `src/lib/i18n.ts`, but move strings into feature-scoped catalogs to improve ownership and review quality.
5. Turn the consistency audit into a budget system.
   - Suggested next step: fail CI only for regressions beyond the recorded baseline, not for the existing debt all at once.
