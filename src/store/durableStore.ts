// Abstraction for a durable store used for duplicate detection, approval state, etc.
// Implementations: Redis, Supabase, Postgres, etc. Provide InMemory for tests.

export interface DurableStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
}

export class InMemoryStore implements DurableStore {
  private m = new Map<string, { v: string; expiresAt?: number }>();
  async get(key: string) {
    const e = this.m.get(key);
    if (!e) return null;
    if (e.expiresAt && Date.now() > e.expiresAt) {
      this.m.delete(key);
      return null;
    }
    return e.v;
  }
  async set(key: string, value: string, ttlSeconds?: number) {
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;
    this.m.set(key, { v: value, expiresAt });
  }
  async del(key: string) {
    this.m.delete(key);
  }
}
