import { DataType, newDb } from "pg-mem";

export function createMemoryDatabase() {
  const memory = newDb();
  memory.public.registerFunction({
    name: "jsonb_array_length",
    args: [DataType.jsonb],
    returns: DataType.integer,
    implementation: (value) => value.length,
  });
  const { Pool } = memory.adapters.createPg();
  return new Pool();
}
