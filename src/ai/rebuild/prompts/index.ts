import type { AiModelMessage } from "../core/contracts";

export type PromptTemplate = {
  system: string;
  user: string;
};

export function buildPromptEnvelope(template: PromptTemplate): AiModelMessage[] {
  return [
    { role: "system", content: template.system },
    { role: "user", content: template.user }
  ];
}
