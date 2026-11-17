import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createMemoryDatabase } from "../dev/memory-db.js";
import { createApp } from "../src/app.js";
import { migrate } from "../src/db.js";
import { seed } from "../src/seed.js";

test("personal exams: generation, privacy, taking attempt, and deletion", async () => {
  const db = createMemoryDatabase();
  await migrate(db);
  const config = {
    production: false,
    frontendOrigin: "http://localhost:5173",
    adminEmail: "admin@example.com",
    adminPassword: "test-password-123",
    seedDemo: true,
  };
  await seed(db, config);
  const app = createApp(db, config);
  const client1 = request.agent(app);
  const client2 = request.agent(app);

  const post = (agent, url) =>
    agent.post(url).set("Origin", config.frontendOrigin);
  const del = (agent, url) =>
    agent.delete(url).set("Origin", config.frontendOrigin);

  // 1. Check available subjects
  const subjectsRes = await client1.get("/api/personal-exams/subjects");
  assert.equal(subjectsRes.status, 200);
  assert(Array.isArray(subjectsRes.body));
  const math = subjectsRes.body.find((s) => s.subject === "Toán học");
  assert(math, "Math subject should be available");
  assert(math.available_questions > 0);

  // 2. Generate a personal exam
  const genRes = await post(client1, "/api/personal-exams/generate").send({
    subject: "Toán học",
    question_count: 5,
    time_limit_minutes: 25,
    title: "Đề test tự luyện Toán học",
  });
  assert.equal(genRes.status, 201);
  const exam = genRes.body;
  assert.equal(exam.subject, "Toán học");
  assert.equal(exam.status, "personal");
  assert.equal(exam.time_limit_minutes, 25);
  assert(exam.question_count <= 5);

  // 3. Verify it does NOT appear in public catalog or public exams
  const publicExams = await client1.get("/api/exams");
  assert(!publicExams.body.items.some((e) => e.id === exam.id));
  const catalog = await client1.get("/api/catalog");
  assert(!catalog.body.topics.includes("Đề test tự luyện"));

  // 4. Client 1 (owner) CAN access the exam
  const getOwner = await client1.get(`/api/exams/${exam.id}`);
  assert.equal(getOwner.status, 200);
  assert.equal(getOwner.body.id, exam.id);

  // 5. Client 2 (different session) CANNOT access the personal exam
  const getStranger = await client2.get(`/api/exams/${exam.id}`);
  assert.equal(getStranger.status, 404);

  // 6. Client 1 CAN start an attempt for this personal exam
  const attemptRes = await post(client1, "/api/attempts").send({
    exam_id: exam.id,
    mode: "practice",
  });
  assert.equal(attemptRes.status, 201);
  assert.equal(attemptRes.body.exam_id, exam.id);

  // 7. Client 2 CANNOT start an attempt for Client 1's personal exam
  const strangerAttempt = await post(client2, "/api/attempts").send({
    exam_id: exam.id,
    mode: "practice",
  });
  assert.equal(strangerAttempt.status, 404);

  // 8. Listed in personal exams for Client 1, but NOT Client 2
  const list1 = await client1.get("/api/personal-exams");
  assert(list1.body.items.some((e) => e.id === exam.id));
  const list2 = await client2.get("/api/personal-exams");
  assert(!list2.body.items.some((e) => e.id === exam.id));

  // 9. Delete personal exam
  const delRes = await del(client1, `/api/personal-exams/${exam.id}`);
  assert.equal(delRes.status, 200);

  const getDeleted = await client1.get(`/api/exams/${exam.id}`);
  assert.equal(getDeleted.status, 404);
});
