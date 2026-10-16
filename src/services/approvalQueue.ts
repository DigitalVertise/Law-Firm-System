import { DurableStore } from "../store/durableStore";

export type ApprovalRequest = {
  id: string;
  tenantId: string;
  matterId?: string;
  actor: string;
  action: string;
  payload?: Record<string, any>;
  createdAt: string;
  status: "pending" | "approved" | "rejected";
  requestedBy?: string;
};

export class ApprovalQueue {
  constructor(private store: DurableStore, private prefix = "approval:") {}

  private key(id: string) {
    return `${this.prefix}${id}`;
  }

  async enqueue(req: ApprovalRequest) {
    await this.store.set(this.key(req.id), JSON.stringify(req));
  }

  async get(id: string): Promise<ApprovalRequest | null> {
    const v = await this.store.get(this.key(id));
    return v ? (JSON.parse(v) as ApprovalRequest) : null;
  }

  async update(req: ApprovalRequest) {
    await this.store.set(this.key(req.id), JSON.stringify(req));
  }
}
