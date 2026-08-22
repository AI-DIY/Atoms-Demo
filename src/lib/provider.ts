import type { ArtifactType, RoleId } from "@/lib/domain";

export type AgentContext = {
  goal: string;
  request: string;
  artifacts: Array<{ type: ArtifactType; content: unknown }>;
};

export type AgentOutput = {
  summary: string;
  artifact: {
    type: ArtifactType;
    content: unknown;
  };
  suggestedNextAction?: string;
};

export interface AgentProvider {
  generate(role: RoleId, context: AgentContext): Promise<AgentOutput>;
}
