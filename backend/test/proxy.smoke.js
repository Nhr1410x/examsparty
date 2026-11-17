import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { setTimeout } from "node:timers/promises";
import request from "supertest";
import { createMemoryDatabase } from "../dev/memory-db.js";
import { migrate } from "../src/db.js";
import { seed } from "../src/seed.js";
import { createApp } from "../src/app.js";

test("production frontend serves SPA routes and proxies API cookies, login and attempts", async (t) => {
  const db = createMemoryDatabase();
  await migrate(db);
  const reservation = createServer();
  await new Promise((resolve) => reservation.listen(0, "127.0.0.1", resolve));
  const frontPort = reservation.address().port;
  await new Promise((resolve) => reservation.close(resolve));
  const origin = `http://127.0.0.1:${frontPort}`;
  const config = {
    frontendOrigin: origin,
    production: false,
    adminEmail: "smoke@example.com",
    adminPassword: "smoke-test-password",
    seedDemo: true,
  };
  await seed(db, config);
  const apiServer = createApp(db, config).listen(0, "127.0.0.1");
  await new Promise((resolve) => apiServer.once("listening", resolve));
  const front = spawn(process.execPath, ["frontend/server.js"], {
    cwd: new URL("../../", import.meta.url),
    env: {
      ...process.env,
      PORT: String(frontPort),
      API_PROXY_TARGET: `http://127.0.0.1:${apiServer.address().port}`,
    },
    stdio: "pipe",
  });
  let stderr = "";
  front.stderr.on("data", (data) => (stderr += data));
  t.after(async () => {
    front.kill();
    await new Promise((resolve) => apiServer.close(resolve));
    await db.end();
  });
  let ready = false;
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(`${origin}/health`)).ok) {
        ready = true;
        break;
      }
    } catch {}
    await setTimeout(100);
  }
  assert.ok(ready, `Frontend failed to start: ${stderr}`);
  const guest = request.agent(origin);
  const page = await guest.get("/exams/deep-link");
  assert.equal(page.status, 200);
  assert.match(page.text, /<html lang="vi">/);
  assert.match(page.headers["content-security-policy"], /script-src 'self'/);
  const session = await guest.get("/api/session");
  assert.equal(session.status, 200);
  assert.match(session.headers["set-cookie"][0], /HttpOnly/);
  const exams = await guest.get("/api/exams");
  assert.equal(exams.status, 200);
  assert.equal(exams.body.total, 6);
  const start = await guest
    .post("/api/attempts")
    .set("Origin", origin)
    .send({ exam_id: exams.body.items[0].id, mode: "exam" });
  assert.equal(start.status, 201);
  assert.equal((await guest.get(`/api/attempts/${start.body.id}`)).status, 200);
  const login = await guest
    .post("/api/auth/login")
    .set("Origin", origin)
    .send({ email: config.adminEmail, password: config.adminPassword });
  assert.equal(login.status, 200);
  assert.equal((await guest.get("/api/admin/overview")).status, 200);
  assert.equal((await guest.get(`/api/attempts/${start.body.id}`)).status, 200);
  assert.equal(
    (await guest.post("/api/auth/logout").set("Origin", origin).send({}))
      .status,
    200,
  );
  assert.equal((await guest.get("/api/admin/overview")).status, 401);
  assert.equal((await guest.get(`/api/attempts/${start.body.id}`)).status, 200);
  assert.doesNotMatch(stderr, /Error:|Unhandled|ECONNREFUSED/);
});
