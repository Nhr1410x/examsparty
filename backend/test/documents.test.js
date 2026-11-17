import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createMemoryDatabase } from "../dev/memory-db.js";
import { createApp } from "../src/app.js";
import { migrate } from "../src/db.js";
import { seed } from "../src/seed.js";

test("study hub documents: upload, list, filters, preview, single download, batch zip download", async () => {
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
  const publicAgent = request.agent(app);

  const post = (agent, url) =>
    agent.post(url).set("Origin", config.frontendOrigin);
  const put = (agent, url) =>
    agent.put(url).set("Origin", config.frontendOrigin);
  const del = (agent, url) =>
    agent.delete(url).set("Origin", config.frontendOrigin);

  // 1. Admin logs in
  const loginRes = await post(adminAgent, "/api/auth/login").send({
    email: config.adminEmail,
    password: config.adminPassword,
  });
  assert.equal(loginRes.status, 200);

  // 2. Admin uploads Document 1 (Math PDF)
  const dummyPdf1 = Buffer.from("%PDF-1.4 Math Formulas PDF Content Here");
  const upload1 = await adminAgent
    .post("/api/admin/documents")
    .set("Origin", config.frontendOrigin)
    .field("title", "Sổ tay công thức Toán học 12")
    .field("description", "Toàn bộ công thức Giải tích và Hình học Oxyz")
    .field("subject", "Toán học")
    .field("grade", "12")
    .field("category", "theory")
    .field("author_name", "Tổ Toán Examsparty")
    .field("status", "published")
    .attach("file", dummyPdf1, "So-tay-Toan-12.pdf");

  assert.equal(upload1.status, 201);
  assert(upload1.body.id);
  const doc1Id = upload1.body.id;

  // 3. Admin uploads Document 2 (Physics PDF)
  const dummyPdf2 = Buffer.from("%PDF-1.4 Physics Mindmap Content Here");
  const upload2 = await adminAgent
    .post("/api/admin/documents")
    .set("Origin", config.frontendOrigin)
    .field("title", "Sơ đồ tư duy Vật lý 12")
    .field("description", "Dao động cơ và Sóng ánh sáng")
    .field("subject", "Vật lý")
    .field("grade", "12")
    .field("category", "mindmap")
    .field("author_name", "Ban Chuyên Môn")
    .field("status", "published")
    .attach("file", dummyPdf2, "So-do-tu-duy-Vat-ly-12.pdf");

  assert.equal(upload2.status, 201);
  const doc2Id = upload2.body.id;

  // 4. Public list: /api/documents
  const listRes = await publicAgent.get("/api/documents");
  assert.equal(listRes.status, 200);
  assert.equal(listRes.body.total, 2);
  assert.equal(listRes.body.items.length, 2);

  // 5. Public filter by subject
  const mathFilter = await publicAgent.get("/api/documents?subject=Toán học");
  assert.equal(mathFilter.status, 200);
  assert.equal(mathFilter.body.items.length, 1);
  assert.equal(mathFilter.body.items[0].subject, "Toán học");

  // 6. Public filter by category
  const mindmapFilter = await publicAgent.get("/api/documents?category=mindmap");
  assert.equal(mindmapFilter.status, 200);
  assert.equal(mindmapFilter.body.items.length, 1);
  assert.equal(mindmapFilter.body.items[0].category, "mindmap");

  // 7. Public search query
  const searchRes = await publicAgent.get("/api/documents?q=Giải tích");
  assert.equal(searchRes.status, 200);
  assert.equal(searchRes.body.items.length, 1);
  assert.equal(searchRes.body.items[0].id, doc1Id);

  // 8. Public subjects aggregation
  const subjectsRes = await publicAgent.get("/api/documents/subjects");
  assert.equal(subjectsRes.status, 200);
  assert(Array.isArray(subjectsRes.body.subjects));
  assert(subjectsRes.body.subjects.some((s) => s.subject === "Toán học" && s.count >= 1));

  // 9. Document detail & view count increment
  const detailRes = await publicAgent.get(`/api/documents/${doc1Id}`);
  assert.equal(detailRes.status, 200);
  assert.equal(detailRes.body.document.id, doc1Id);
  assert.equal(detailRes.body.document.title, "Sổ tay công thức Toán học 12");
  assert(detailRes.body.document.views_count >= 1);

  // 10. Preview endpoint (Content-Disposition: inline)
  const previewRes = await publicAgent.get(`/api/documents/${doc1Id}/preview`);
  assert.equal(previewRes.status, 200);
  assert.equal(previewRes.headers["content-type"], "application/pdf");
  assert(previewRes.headers["content-disposition"].includes("inline"));
  assert.deepEqual(previewRes.body, dummyPdf1);

  // 11. Download endpoint (Content-Disposition: attachment)
  const downloadRes = await publicAgent.get(`/api/documents/${doc1Id}/download`);
  assert.equal(downloadRes.status, 200);
  assert(downloadRes.headers["content-disposition"].includes("attachment"));
  assert.deepEqual(downloadRes.body, dummyPdf1);

  // 12. Batch ZIP download endpoint
  const batchZipRes = await post(publicAgent, "/api/documents/batch-download")
    .send({ ids: [doc1Id, doc2Id] })
    .buffer(true)
    .parse((res, fn) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => fn(null, Buffer.concat(chunks)));
    });
  assert.equal(batchZipRes.status, 200);
  assert.equal(batchZipRes.headers["content-type"], "application/zip");
  assert(batchZipRes.headers["content-disposition"].includes("Examsparty_Tai_Lieu.zip"));
  assert(batchZipRes.body.length > 50, "ZIP buffer should contain files");

  // Verify ZIP signature PK\x03\x04
  const zipBuf = batchZipRes.body;
  assert.equal(zipBuf[0], 0x50); // 'P'
  assert.equal(zipBuf[1], 0x4b); // 'K'
  assert.equal(zipBuf[2], 0x03);
  assert.equal(zipBuf[3], 0x04);

  // 13. Admin updates document
  const updateRes = await put(adminAgent, `/api/admin/documents/${doc1Id}`).send({
    title: "Sổ tay công thức Toán học 12 (Bản mới)",
    description: "Cập nhật định dạng chuẩn thi tốt nghiệp THPT",
    subject: "Toán học",
    grade: "12",
    category: "theory",
    status: "published",
  });
  assert.equal(updateRes.status, 200);

  const updatedDetail = await publicAgent.get(`/api/documents/${doc1Id}`);
  assert.equal(updatedDetail.body.document.title, "Sổ tay công thức Toán học 12 (Bản mới)");

  // 14. Admin deletes document
  const delRes = await del(adminAgent, "/api/admin/documents").send({
    ids: [doc1Id],
    permanent: true,
  });
  assert.equal(delRes.status, 200);
  assert.equal(delRes.body.deleted, 1);

  const checkDeleted = await publicAgent.get(`/api/documents/${doc1Id}`);
  assert.equal(checkDeleted.status, 404);
});
