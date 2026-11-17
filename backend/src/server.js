import { createDatabase, migrate } from "./db.js";
import { seed } from "./seed.js";
import { createApp } from "./app.js";

const config = {
  production: process.env.NODE_ENV === "production",
  frontendOrigin: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
  adminEmail: process.env.ADMIN_EMAIL,
  adminPassword: process.env.ADMIN_PASSWORD,
  totpSecret: process.env.ADMIN_TOTP_SECRET,
  seedDemo: process.env.SEED_DEMO === "true",
};
if (!process.env.DATABASE_URL)
  throw new Error("DATABASE_URL is required. See backend/.env.example.");
if (config.production && !process.env.FRONTEND_ORIGIN)
  console.warn("Notice: FRONTEND_ORIGIN is not set; CSRF origin validation will fall back gracefully.");
if (config.production && !config.totpSecret)
  console.warn("Notice: ADMIN_TOTP_SECRET is not set; admin MFA will be disabled.");
if (config.adminPassword && config.adminPassword.length < 12)
  throw new Error("ADMIN_PASSWORD must contain at least 12 characters.");
if (config.production && config.frontendOrigin && !config.frontendOrigin.startsWith("http"))
  config.frontendOrigin = `https://${config.frontendOrigin}`;
const db = createDatabase(
  process.env.DATABASE_URL,
  process.env.DATABASE_SSL === "true",
);
try {
  await migrate(db);
  await seed(db, config);
} catch (err) {
  console.error("Migration or seed warning:", err);
}
const server = createApp(db, config).listen(
  Number(process.env.PORT) || 3001,
  "0.0.0.0",
  () => console.log("Examsparty API ready"),
);
async function shutdown() {
  server.close(async () => {
    await db.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
