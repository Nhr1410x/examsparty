import { createMemoryDatabase } from "../dev/memory-db.js";
import { migrate } from "./db.js";
import { seed } from "./seed.js";
import { createApp } from "./app.js";

if (process.env.NODE_ENV === "production")
  throw new Error(
    "In-memory demo is forbidden in production. Use DATABASE_URL.",
  );
// shortcut: demo data lives only in memory; use PostgreSQL for persistent development or deployment.
const db = createMemoryDatabase();
const config = {
  production: false,
  frontendOrigin: "http://localhost:5173",
  adminEmail: "admin@examsparty.local",
  adminPassword: "DemoAdmin123!",
  seedDemo: true,
  demo: true,
};
await migrate(db);
await seed(db, config);
createApp(db, config).listen(3001, "127.0.0.1", () =>
  console.log(
    "Demo API ready at http://localhost:3001/api/health. Open the frontend URL printed by Vite (usually http://localhost:5173). Data resets on restart.",
  ),
);
