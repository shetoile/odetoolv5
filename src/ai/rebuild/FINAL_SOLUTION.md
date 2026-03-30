# Final AI Solution

This is the target ODETool AI architecture after the rebuild.

## Core idea

ODETool should not be one big autonomous agent.

It should be a staged AI platform:

1. Ingest documents and workspace structure
2. Normalize reusable knowledge
3. Retrieve evidence
4. Build reviewable plans
5. Run approval gates
6. Compile explicit execution packets
7. Only later enable controlled execution

## Current end-state in this rebuild

Implemented now:

- deterministic ingestion previews
- normalized document records
- workspace knowledge summaries
- explainable retrieval
- reviewable action plans
- approval queues with blockers and readiness
- execution packet previews
- policy gating that blocks direct workspace writes
- architecture scorecard and final solution view

Still intentionally disabled:

- direct model execution
- autonomous workspace writes
- uncontrolled agent loops

## Runtime shape

- `core/`
  - runtime contracts
  - rebuild gateway
  - rebuild policy gate
- `knowledge/`
  - documents
  - document store
  - retrieval
  - action planning
  - approval queue
  - execution packets
- `workflows/`
  - one explicit workflow per stage
- `evals/`
  - scorecard and architecture-quality signals

## Safety rules

- no published rebuild workflow writes directly into the workspace
- every planning or handoff artifact stays reviewable by a human
- evidence must remain attached to proposals and packets
- model access stays off until evaluation is stronger

## What comes after this

Only three major future modules remain:

1. strict schema-validated model gateway
2. controlled executor for approved draft outputs only
3. real golden-case evaluation based on production scenarios
