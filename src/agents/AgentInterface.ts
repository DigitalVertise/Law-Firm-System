export type AgentContext = {
  tenantId: string;
  matterId?: string;
  userId?: string;
  requestId?: string;
  inputs: Record<string, any>;
  authorizedCapabilities: string[]; // capability strings allowed for this run
  now?: string;
};

export type AgentResult<T = any> = {
  ok: boolean;
  data?: T;
  warnings?: string[];
  errors?: string[];
  metadata?: Record<string, any>;
};

export enum AgentCapability {
  LEGAL_RESEARCH = "legal_research",
  DOCUMENT_DRAFT = "document_draft",
  MATTER_SUMMARY = "matter_summary",
  CLIENT_SERVICE = "client_service",
}

export interface Agent {
  id: string;
  name: string;
  capabilities: AgentCapability[];
  run(ctx: AgentContext, opts?: { timeoutMs?: number }): Promise<AgentResult>;
}
