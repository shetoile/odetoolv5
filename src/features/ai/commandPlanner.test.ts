import { describe, expect, it } from "vitest";
import {
  inferAiCommandActionId,
  inferAiCommandActionSequence,
  parseAiPlannerPayload
} from "@/features/ai/commandPlanner";

const DATABASE_STRUCTURE_ONLY_PROMPT = `
Now create the database structure for this Risk Management Framework workspace.

This is step 3 only.
Create the database sections, tables, and field structure needed for a professional risk management framework.

Include at least:
- Risk register
- Risk categories
- Risk matrix

Important rules:
- Create the database structure only
- Do not create dashboards or widgets yet
- Do not create fake/sample operational data unless needed as a structural example
`.trim();

describe("AI command planner", () => {
  it("expands structure-only database prompts into multiple section-creation steps", () => {
    expect(inferAiCommandActionId(DATABASE_STRUCTURE_ONLY_PROMPT)).toBe("database_create_section");
    const steps = inferAiCommandActionSequence(DATABASE_STRUCTURE_ONLY_PROMPT, "database_create_section");

    expect(steps.map((step) => step.actionId)).toEqual([
      "database_create_section",
      "database_create_section",
      "database_create_section"
    ]);
    expect(steps.map((step) => step.args.section_name)).toEqual([
      "Risk register",
      "Risk categories",
      "Risk matrix"
    ]);
  });

  it("does not treat a risk matrix database section as a dashboard widget", () => {
    const prompt = "Create a database section named Risk matrix with fields Risk title, Likelihood, Impact, Residual score.";

    expect(inferAiCommandActionId(prompt)).toBe("database_create_section");
    expect(inferAiCommandActionSequence(prompt).map((step) => step.actionId)).toEqual(["database_create_section"]);
  });

  it("filters suppressed sample-data and widget actions from planner JSON payloads", () => {
    const parsed = parseAiPlannerPayload(
      JSON.stringify({
        action_id: "database_create_section",
        actions: [
          {
            action_id: "database_create_section",
            args: {
              section_name: "Risk register",
              fields: ["Risk title", "Owner", "Likelihood", "Impact"]
            }
          },
          {
            action_id: "database_seed_examples",
            args: {
              section_name: "Risk register",
              count: 3
            }
          },
          {
            action_id: "dashboard_widget_create",
            args: {
              title: "Risk heatmap",
              widget_type: "matrix"
            }
          }
        ]
      }),
      DATABASE_STRUCTURE_ONLY_PROMPT
    );

    expect(parsed?.actionId).toBe("database_create_section");
    expect(parsed?.actionSequence.map((step) => step.actionId)).toEqual(["database_create_section"]);
  });
});
