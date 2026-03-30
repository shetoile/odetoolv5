# AI Rebuild Foundation

This folder is the clean starting point for the next ODETool AI architecture.

Phase 1 goal:
- disable the legacy AI surface in the app
- keep the rest of ODETool stable
- rebuild AI as small, validated workflows instead of one mixed UI-driven system

Target layers:
- `core/`: runtime contracts, orchestration primitives, policies
- `knowledge/`: normalized document and workspace facts
- `workflows/`: explicit workflow definitions
- `prompts/`: prompt envelopes and prompt templates
- `evals/`: golden cases and quality scoring

Execution model:
1. parse
2. normalize
3. retrieve
4. ask model
5. validate
6. propose action
7. user approves
8. execute
9. measure

This scaffold is intentionally minimal in Step 1 so the packaged build stays safe to test.
