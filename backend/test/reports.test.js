import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createMemoryDatabase } from "../dev/memory-db.js";
import { createApp } from "../src/app.js";
import { migrate } from "../src/db.js";
import { seed } from "../src/seed.js";

test("reports: per-question reporting, suggested answers, reason options, and admin resolution", async () => {
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
  const adminAgent = request.agent(app);
  const guestAgent = request.agent(app);

  const post = (agent, url) =>
    agent.post(url).set("Origin", config.frontendOrigin);
  const put = (agent, url) =>
    agent.put(url).set("Origin", config.frontendOrigin);

  // 1. Admin logs in
  const loginRes = await post(adminAgent, "/api/auth/login").send({
    email: config.adminEmail,
    password: config.adminPassword,
  });
  assert.equal(loginRes.status, 200);

  // Get a seeded exam and question to report
  const examsRes = await guestAgent.get("/api/exams");
  assert.equal(examsRes.status, 200);
  const targetExam = examsRes.body.items[0];
  assert(targetExam?.id);

  const questionsRes = await guestAgent.get("/api/questions");
  assert.equal(questionsRes.status, 200);
  const targetQuestion = questionsRes.body.items[0];

  // 2. Guest submits per-question report with wrong_answer and suggested_answer
  const report1 = await post(guestAgent, "/api/reports").send({
    exam_id: targetExam.id,
    question_id: targetQuestion?.id || null,
    question_label: "Câu 1",
    question_content: "Đơn vị SI của vận tốc là gì?",
    reason: "wrong_answer",
    suggested_answer: "Phương án B (m/s)",
    message: "Hệ thống đang tích đáp án A nhưng tài liệu chuẩn giáo khoa là m/s.",
  });
  assert.equal(report1.status, 201);
  assert(report1.body.id);
  const report1Id = report1.body.id;

  // 3. Guest submits report for unclear explanation
  const report2 = await post(guestAgent, "/api/reports").send({
    exam_id: targetExam.id,
    question_label: "Câu 2",
    reason: "unclear_explanation",
    suggested_answer: "",
    message: "Lời giải chưa giải thích vì sao áp dụng công thức v = s / t.",
  });
  assert.equal(report2.status, 201);
  assert(report2.body.id);

  // 4. Backwards compatibility: report via POST /api/exams/:id/report
  const legacyReport = await post(
    guestAgent,
    `/api/exams/${targetExam.id}/report`,
  ).send({
    message: "Báo lỗi chung toàn bộ đề thi có nhiều lỗi chính tả.",
  });
  assert.equal(legacyReport.status, 201);

  // 5. Admin views reports list
  const adminReportsRes = await adminAgent.get("/api/admin/reports");
  assert.equal(adminReportsRes.status, 200);
  assert.equal(adminReportsRes.body.items.length, 3);
  assert.equal(adminReportsRes.body.total, 3);

  // Find report 1 and verify all fields are persisted
  const item1 = adminReportsRes.body.items.find((r) => r.id === report1Id);
  assert(item1);
  assert.equal(item1.reason, "wrong_answer");
  assert.equal(item1.suggested_answer, "Phương án B (m/s)");
  assert.equal(item1.status, "open");
  assert.equal(item1.exam_title, targetExam.title);
  assert.equal(item1.details?.question_label, "Câu 1");

  // 6. Admin resolves report 1
  const resolveRes = await put(adminAgent, `/api/admin/reports/${report1Id}`).send({
    status: "resolved",
  });
  assert.equal(resolveRes.status, 200);
  assert.equal(resolveRes.body.status, "resolved");

  // 7. Admin filters by open reports
  const openReportsRes = await adminAgent.get("/api/admin/reports?status=open");
  assert.equal(openReportsRes.status, 200);
  assert.equal(openReportsRes.body.total, 2);
  assert(!openReportsRes.body.items.some((r) => r.id === report1Id));

  // 8. Admin filters by resolved reports
  const resolvedReportsRes = await adminAgent.get(
    "/api/admin/reports?status=resolved",
  );
  assert.equal(resolvedReportsRes.status, 200);
  assert.equal(resolvedReportsRes.body.total, 1);
  assert.equal(resolvedReportsRes.body.items[0].id, report1Id);
});
