import { InMemoryStore } from "../../src/store/durableStore";

test("duplicate event detection", async () => {
  const store = new InMemoryStore();
  const key = "whatsapp:event:abc";
  const v1 = await store.get(key);
  expect(v1).toBeNull();
  await store.set(key, "1", 60);
  const v2 = await store.get(key);
  expect(v2).toBe("1");
});
