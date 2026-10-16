// Minimal audit logging abstraction. Integrate with existing MOLMS audit DB or a logging service.
// For now this writes structured events via an injectable persister.

export type AuditEvent = {
  id?: string;
  timestamp: string;
  tenantId: string;
  matterId?: string;
  userId?: string;
  actor: string; // agent name or system
  action: string;
  status: "requested" | "completed" | "failed" | "approved" | "rejected";
  payload?: Record<string, any>;
};

export interface AuditPersister {
  save(event: AuditEvent): Promise<void>;
}

// Simple in-memory persister (for tests). Replace with DB-backed implementation.
export class InMemoryAuditPersister implements AuditPersister {
  events: AuditEvent[] = [];
  async save(event: AuditEvent) {
    this.events.push(event);
  }
}

export class AuditLog {
  constructor(private persister: AuditPersister) {}
  async record(evt: AuditEvent) {
    evt.timestamp = evt.timestamp || new Date().toISOString();
    await this.persister.save(evt);
  }
}
