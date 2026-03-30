# Feature Module Guide

This folder is the target home for logic gradually extracted from `src/App.tsx`.

The goal is not to rewrite behavior.
The goal is to move stable feature rules into clearer modules while preserving the current product.

## Planned Feature Areas

- `desktop/`
- `plan/`
- `timeline/`
- `workarea/`
- `workspace/`
- `search/`
- `drive/`

## Extraction Rules

- Move pure shaping logic first
- Move derived selectors and adapters before side effects
- Keep UI components thin where possible
- Avoid moving code only for aesthetics; move it when a boundary becomes clearer
- Preserve existing behavior while extracting

## First Good Candidates

- timeline row shaping
- timeline mode helpers
- execution/workarea projection helpers
- workspace scope helpers
- node search scoring
- deliverable normalization helpers

## Anti-Goals

- do not create empty abstraction layers with no real ownership
- do not move all business rules into generic utility files
- do not split files only by size if the domain becomes less clear
