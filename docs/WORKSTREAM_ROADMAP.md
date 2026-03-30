# ODETool Workstream Roadmap

Last updated: 2026-03-27

## Baseline

- Frozen snapshot: `C:\Users\burea\Desktop\ODETool Integration\ODETool Snapshot 2026-03-27_20-25-34`
- Active work copy: `C:\Users\burea\Desktop\ODETool Integration\ODETool Work 2026-03-27_20-25-34`
- Original folder remains untouched unless explicitly needed for comparison.

## Operating Rules

- Do not edit the snapshot folder.
- Build, package, and test from the active work copy only.
- Keep shipping checkpoints regularly with desktop installers.
- Stabilize UX and shell behavior before heavier ODE-book feature expansion.

## Phase 1: Shell And Navigation Stabilization

Goal: make the application feel native, predictable, and safe to extend.

Current focus:

1. Window behavior consistency
   - restore-mode drag/move
   - maximize/fullscreen correctness
   - startup sizing behavior
2. Language sync
   - immediate Windows layout change propagation
   - no page-switch workaround required
3. Navigation consistency
   - tree single-click = browse
   - tree double-click = open tab
   - tabs, breadcrumbs, search, and grid stay aligned
4. Asset responsiveness
   - fast quick-app icon hydration
   - no stale icon flash on startup
5. Release reliability
   - repeatable installer generation
   - stable regression checkpoints

## Phase 2: Interaction Model Lock

Goal: remove ambiguous behavior between tree, grid, timeline, tabs, and workarea.

Key outcomes:

- one clear action model for click, double-click, keyboard, and search
- no hidden state fights between active tabs and current browse context
- clearer transitions between desktop, timeline, and workspace surfaces

## Phase 3: Chantier V1

Goal: move from smart tree/task tooling to a real ODE chantier system.

Key outcomes:

- first-class chantier domain object
- chantier detail view
- linked ODE activity / NA classification
- value statement, motive, QCD targets, resources, indicators
- closure summary and chantier templates

Current slice started:

- chantier profile foundation is now wired into the procedure/workarea editor
- linked NA, value statement, QCD targets, resources, indicators, and closure summary now have a persisted first-pass model
- chantier lifecycle/governance fields are now part of the same persisted profile: status, approval gate note, decision log, and RETEX
- desktop now exposes a simple chantier portfolio strip with status filtering plus chantier/status badges on cards and detail rows
- desktop now also exposes a workspace-wide chantier governance panel with cross-folder status totals and quick jumps into active / attention chantiers
- procedure/workarea now exposes a manual "mark as chantier" toggle on plain folders so chantier governance can be tested directly from the UI
- desktop now exposes a management review layer for chantier governance: decision-stage lanes plus a broader workspace chantier portfolio list for review and quick jumps
- plan view now exposes a visible chantier steering tab with persisted planning and closure fields: owner, planning window, review cadence, capacity, dependencies, evidence chain, and signoff
- desktop now exposes a chantier command center and planning radar: quick management actions, owner load hotspots, planning-window groupings, and readiness-gap targeting
- desktop workspace portfolio review is now steerable with search, scope filters, review sorting, and inline readiness-gap visibility on each chantier card
- chantier steering now also persists quarter focus, cadence milestones, signoff owner/state, closure pack, role model, critical skills, people/GPEC plan, maturity level, transformation impact, and adoption notes
- desktop governance now exposes execution/cadence watch, signoff/closure watch, role-skill hotspots, people-plan gaps, maturity distribution, and transformation adoption watchlists
- desktop now exposes a structural ODE platform board: catalog version, NA anchoring coverage, top NA anchors, and chantier watchlists for work still outside the canonical ODE backbone

## Phase 4: Chantier Lifecycle And Governance

Key outcomes:

- statuses: draft, proposed, approved, active, paused, closed, archived
- approval and decision history
- launch/closure gates
- RETEX capture
- management review views

## Phase 5: Capacity, Cadence, And Portfolio Planning

Key outcomes:

- recurring cycle definitions
- quarterly planning views
- workload and capacity visibility
- resource conflict detection
- management arbitration support

## Phase 6: Deliverables, Evidence, And Traceability

Key outcomes:

- deliverable acceptance/signoff
- evidence chain from source to task to output
- closure packs and archive rules
- formal RETEX deliverables

## Phase 7: Structural ODE Platform

Key outcomes:

- versioned ODE catalog and errata
- persistent responsibility and role model
- GPEC / people / skill planning
- controlled extension model for organizations

## Phase 8: Maturity And Transformation Layer

Key outcomes:

- QCD / risk / quality dashboards
- cross-chantier orchestration
- maturity diagnostics
- consultant and adoption workflows

## Immediate Next Build Focus

1. Finish the stabilization pass in the work copy.
2. Validate tree/grid/tab consistency in the installed build.
3. Start `Chantier V1` as the first major ODE-book implementation stream.
