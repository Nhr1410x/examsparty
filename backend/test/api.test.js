import test from "node:test";
import assert from "node:assert/strict";
import { createMemoryDatabase } from "../dev/memory-db.js";
import request from "supertest";
import { createApp } from "../src/app.js";
import { migrate } from "../src/db.js";
import { seed, sampleExam } from "../src/seed.js";
import * as OTPAuth from "otpauth";

async function setup() {
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
  const guest = request.agent(app),
    other = request.agent(app);
  const exam = (await guest.get("/api/exams")).body.items[0];
  const post = (agent, url) =>
    agent.post(url).set("Origin", config.frontendOrigin);
  const put = (agent, url) =>
    agent.put(url).set("Origin", config.frontendOrigin);
  const del = (agent, url) =>
    agent.delete(url).set("Origin", config.frontendOrigin);
  return { db, guest, other, exam, post, put, del };
}

test("admins delete multiple exams and clean up questions from database while keeping attempts", async () => {
  const { db, guest, other, exam, post, put } = await setup();
  try {
    const remove = (agent, ids) =>
      agent
        .delete("/api/admin/exams")
        .set("Origin", "http://localhost:5173")
        .send({ ids });
    assert.equal((await remove(other, [exam.id])).status, 401);
    const attempt = (
      await post(guest, "/api/attempts").send({
        exam_id: exam.id,
        mode: "practice",
      })
    ).body;
    await post(guest, "/api/auth/login").send({
      email: "admin@example.com",
      password: "test-password-123",
    });
    const exams = (await guest.get("/api/admin/exams")).body.items;
    const ids = [exam.id, exams.find((e) => e.id !== exam.id).id];
    const questionsBefore = (
      await db.query("SELECT count(*) AS count FROM questions")
    ).rows[0].count;
    assert.equal(
      (await guest.delete("/api/admin/exams").send({ ids })).status,
      403,
    );
    for (const invalid of [
      [],
      ["invalid"],
      [ids[0], ids[0]],
      Array(101).fill(ids[0]),
    ])
      assert.equal((await remove(guest, invalid)).status, 400);
    assert.equal(
      (await remove(guest, [ids[0], "00000000-0000-4000-8000-000000000000"]))
        .status,
      404,
    );
    assert.equal((await guest.get(`/api/exams/${ids[0]}`)).status, 200);
    const deleted = await remove(guest, ids);
    assert.equal(deleted.status, 200);
    assert.equal(deleted.body.deleted, 2);
    assert.equal(
      (await guest.get("/api/admin/exams")).body.items.length,
      exams.length - 2,
    );
    assert.equal(
      (await guest.get("/api/admin/overview")).body.exams,
      exams.length - 2,
    );
    assert.equal(
      (await guest.get("/api/catalog")).body.exams,
      exams.length - 2,
    );
    for (const id of ids)
      assert.equal((await guest.get(`/api/exams/${id}`)).status, 404);
    assert.equal(
      (
        await post(guest, "/api/attempts").send({
          exam_id: ids[0],
          mode: "practice",
        })
      ).status,
      404,
    );
    const saved = await guest.get(`/api/attempts/${attempt.id}`);
    assert.equal(saved.status, 200);
    assert.deepEqual(saved.body.snapshot, attempt.snapshot);
    assert.equal(
      (await post(guest, `/api/attempts/${attempt.id}/submit`).send({})).status,
      200,
    );
    const questionsAfter = Number(
      (await db.query("SELECT count(*) AS count FROM questions")).rows[0].count,
    );
    assert.ok(
      questionsAfter < Number(questionsBefore),
      "Questions belonging to deleted exams must be deleted from database",
    );
    const logs = (
      await db.query(
        "SELECT target_id FROM audit_logs WHERE action='delete' AND target_type='exam'",
      )
    ).rows;
    assert.deepEqual(logs.map((row) => row.target_id).sort(), [...ids].sort());
    assert.equal((await remove(guest, ids)).status, 404);
    const removedExam = exams.find((e) => e.id === ids[0]);
    assert.equal(
      (
        await put(guest, `/api/admin/exams/${ids[0]}`).send({
          content: removedExam.content,
          status: "published",
        })
      ).status,
      404,
    );
    const question = (await db.query("SELECT id FROM questions LIMIT 1"))
      .rows[0];
    if (question) {
      assert.equal(
        (
          await post(guest, `/api/admin/exams/${ids[0]}/questions`).send({
            question_id: question.id,
          })
        ).status,
        404,
      );
    }
    const remainingQuestion = (
      await db.query("SELECT id,q.content FROM questions q LIMIT 1")
    ).rows[0];
    if (remainingQuestion) {
      assert.equal(
        (
          await put(guest, `/api/admin/questions/${remainingQuestion.id}`).send({
            content: {
              ...remainingQuestion.content,
              prompt: [{ type: "text", value: "Updated bank question" }],
            },
            status: "published",
          })
        ).status,
        200,
      );
    }
  } finally {
    await db.end();
  }
});

test("exam keys never leak, ownership is enforced, results survive submission", async () => {
  const { db, guest, other, exam, post, put } = await setup();
  const details = await guest.get(`/api/exams/${exam.id}`);
  assert.equal(details.body.content.questions[0].answer, undefined);
  const start = await post(guest, "/api/attempts").send({
    exam_id: exam.id,
    mode: "exam",
  });
  assert.equal(start.status, 201);
  const a = start.body;
  assert.equal(a.snapshot.questions[0].answer, undefined);
  assert.equal((await other.get(`/api/attempts/${a.id}`)).status, 404);
  const q = a.snapshot.questions[0];
  const save = await put(
    guest,
    `/api/attempts/${a.id}/answers/${q.client_id}`,
  ).send({ response: q.options?.[0]?.id ?? "test" });
  assert.equal(save.status, 200);
  const result = await post(guest, `/api/attempts/${a.id}/submit`).send({});
  assert.equal(result.status, 200);
  assert.ok(result.body.result.questions[0].explanation);
  assert.equal(
    (
      await put(guest, `/api/attempts/${a.id}/answers/${q.client_id}`).send({
        response: null,
      })
    ).status,
    409,
  );
  assert.deepEqual(
    (await post(guest, `/api/attempts/${a.id}/submit`).send({})).body.result,
    result.body.result,
  );
  await db.end();
});

test("expiry grades last saved answers and practice feedback only unlocks answered questions", async () => {
  const { db, guest, exam, post, put } = await setup();
  const start = await post(guest, "/api/attempts").send({
    exam_id: exam.id,
    mode: "exam",
  });
  await db.query("UPDATE attempts SET expires_at=$1 WHERE id=$2", [
    new Date(Date.now() - 1000),
    start.body.id,
  ]);
  const expired = await guest.get(`/api/attempts/${start.body.id}`);
  assert.equal(expired.body.status, "submitted");
  assert.ok(expired.body.result);
  const practice = (
    await post(guest, "/api/attempts").send({
      exam_id: exam.id,
      mode: "practice",
    })
  ).body;
  const q = practice.snapshot.questions[0];
  const save = await put(
    guest,
    `/api/attempts/${practice.id}/answers/${q.client_id}`,
  ).send({ response: q.options?.[0]?.id ?? "answer", check: true });
  assert.equal(save.status, 200);
  assert.ok(save.body.feedback[q.client_id]);
  assert.equal(save.body.snapshot.questions[0].answer, undefined);
  await db.end();
});

test("contribution validation, CSRF, moderation permissions and audit trail", async () => {
  const { db, guest, post } = await setup();
  assert.equal((await guest.post("/api/contributions").send({})).status, 403);
  assert.equal(
    (
      await post(guest, "/api/contributions").send({
        contact: "x@example.com",
        content: {},
      })
    ).status,
    400,
  );
  const created = await post(guest, "/api/contributions").send({
    contact: "x@example.com",
    content: sampleExam,
  });
  assert.equal(created.status, 201);
  assert.equal((await guest.get("/api/admin/review-queue")).status, 401);
  const login = await post(guest, "/api/auth/login").send({
    email: "admin@example.com",
    password: "test-password-123",
  });
  assert.equal(login.status, 200);
  const approved = await post(
    guest,
    `/api/admin/submissions/${created.body.id}/approve`,
  ).send({ note: "Đã kiểm tra" });
  assert.equal(approved.status, 200);
  const tracking = await post(guest, "/api/contributions/track").send({
    code: created.body.tracking_code,
  });
  assert.equal(tracking.body.status, "approved");
  assert.equal((await guest.get("/api/admin/audit-logs")).body.items.length, 2);
  assert.equal(
    (
      await post(
        guest,
        `/api/admin/submissions/${created.body.id}/approve`,
      ).send({})
    ).status,
    409,
  );
  await db.end();
});

test("public filters work and question search cannot probe hidden explanations", async () => {
  const { db, guest, post } = await setup();
  assert.equal(
    (await guest.get("/api/exams?subject=To%C3%A1n%20h%E1%BB%8Dc")).body.total,
    2,
  );
  assert.equal(
    (
      await guest.get(
        "/api/exams?topic=Python&type=single_choice&difficulty=medium&max_minutes=30&min_questions=1",
      )
    ).body.total,
    1,
  );
  assert.equal((await guest.get("/api/exams?page=1.5")).status, 400);
  assert.equal(
    (await guest.get("/api/exams?max_minutes=Infinity")).status,
    400,
  );
  assert.equal(
    (
      await guest.get(
        "/api/questions?q=Ph%E1%BB%A7%20%C4%91%E1%BB%8Bnh%20c%E1%BB%A7a",
      )
    ).status,
    200,
  );
  const content = structuredClone(sampleExam);
  content.title = "Search safety";
  content.questions[0].explanation = [
    { type: "text", value: "uniquesecretword" },
  ];
  await post(guest, "/api/auth/login").send({
    email: "admin@example.com",
    password: "test-password-123",
  });
  await post(guest, "/api/admin/exams").send({ content, status: "published" });
  assert.equal(
    (await guest.get("/api/questions?q=uniquesecretword")).body.items.length,
    0,
  );
  await db.end();
});

test("uploads stay private until approval and reject executable files", async () => {
  const { db, guest, other, post } = await setup();
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
    "base64",
  );
  const image = await post(guest, "/api/uploads").attach("image", png, {
    filename: "test.png",
    contentType: "image/png",
  });
  assert.equal(image.status, 201);
  assert.equal((await other.get(image.body.url)).status, 404);
  assert.equal((await guest.get(image.body.url)).status, 200);
  assert.equal(
    (
      await post(guest, "/api/uploads").attach(
        "image",
        Buffer.from('<svg onload="alert(1)"/>'),
        { filename: "bad.png", contentType: "image/png" },
      )
    ).status,
    400,
  );
  const content = structuredClone(sampleExam);
  content.questions[0].prompt.push({
    type: "image",
    asset_id: image.body.asset_id,
    alt: "Ảnh minh họa",
  });
  const submitted = await post(guest, "/api/contributions").send({
    contact: "author@example.com",
    content,
  });
  await post(guest, "/api/auth/login").send({
    email: "admin@example.com",
    password: "test-password-123",
  });
  assert.equal(
    (
      await post(
        guest,
        `/api/admin/submissions/${submitted.body.id}/approve`,
      ).send({})
    ).status,
    200,
  );
  assert.equal((await other.get(image.body.url)).status, 200);
  await db.end();
});

test("changes requested can be revised by secret code; blocked admins lose privileges", async () => {
  const { db, guest, other, post } = await setup();
  const created = (
    await post(other, "/api/contributions").send({
      contact: "author@example.com",
      content: sampleExam,
    })
  ).body;
  await post(guest, "/api/auth/login").send({
    email: "admin@example.com",
    password: "test-password-123",
  });
  assert.equal(
    (await post(guest, `/api/admin/submissions/${created.id}/reject`).send({}))
      .status,
    400,
  );
  assert.equal(
    (
      await post(
        guest,
        `/api/admin/submissions/${created.id}/request-changes`,
      ).send({ note: "Cần thêm giải thích." })
    ).status,
    200,
  );
  const revised = await other
    .put("/api/contributions/revise")
    .set("Origin", "http://localhost:5173")
    .send({
      code: created.tracking_code,
      content: { ...sampleExam, title: "Đã chỉnh sửa đề" },
    });
  assert.equal(revised.status, 200);
  assert.equal(
    (
      await post(other, "/api/contributions/track").send({
        code: created.tracking_code,
      })
    ).body.status,
    "pending",
  );
  await db.query(
    "UPDATE users SET status='blocked' WHERE email='admin@example.com'",
  );
  assert.equal((await guest.get("/api/admin/exams")).status, 401);
  await db.end();
});

test("editing a published exam cannot change an existing attempt snapshot", async () => {
  const { db, guest, exam, post, put } = await setup();
  const a = (
    await post(guest, "/api/attempts").send({
      exam_id: exam.id,
      mode: "practice",
    })
  ).body;
  await post(guest, "/api/auth/login").send({
    email: "admin@example.com",
    password: "test-password-123",
  });
  const original = (await guest.get("/api/admin/exams")).body.items.find(
    (e) => e.id === exam.id,
  ).content;
  const revised = structuredClone(original);
  revised.questions[0].prompt = [
    { type: "text", value: "Edited after attempt started" },
  ];
  assert.equal(
    (
      await put(guest, `/api/admin/exams/${exam.id}`).send({
        content: revised,
        status: "published",
      })
    ).status,
    200,
  );
  const loaded = await guest.get(`/api/attempts/${a.id}`);
  assert.deepEqual(
    loaded.body.snapshot.questions[0].prompt,
    a.snapshot.questions[0].prompt,
  );
  await db.end();
});

test("configured MFA rejects missing OTP and accepts the current TOTP", async () => {
  const db = createMemoryDatabase();
  await migrate(db);
  const totpSecret = "JBSWY3DPEHPK3PXP";
  const config = {
    production: false,
    frontendOrigin: "http://localhost:5173",
    adminEmail: "admin@example.com",
    adminPassword: "test-password-123",
    totpSecret,
    seedDemo: false,
  };
  await seed(db, config);
  const guest = request.agent(createApp(db, config));
  const login = () =>
    guest.post("/api/auth/login").set("Origin", config.frontendOrigin);
  assert.equal(
    (
      await login().send({
        email: config.adminEmail,
        password: config.adminPassword,
      })
    ).status,
    401,
  );
  const otp = new OTPAuth.TOTP({
    secret: OTPAuth.Secret.fromBase32(totpSecret),
  }).generate();
  assert.equal(
    (
      await login().send({
        email: config.adminEmail,
        password: config.adminPassword,
        otp,
      })
    ).status,
    200,
  );
  await db.end();
});

test("contribution policy is persisted and enforced only at the server", async () => {
  const { db, guest, other, post, put } = await setup();
  await post(guest, "/api/auth/login").send({
    email: "admin@example.com",
    password: "test-password-123",
  });
  assert.equal(
    (
      await put(guest, "/api/admin/config").send({
        contributions_enabled: false,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await post(other, "/api/contributions").send({
        contact: "x@example.com",
        content: sampleExam,
      })
    ).status,
    403,
  );
  await db.end();
});

test("bank questions can be reused across exams and edits reach linked exams only", async () => {
  const { db, guest, post, put } = await setup();
  await post(guest, "/api/auth/login").send({
    email: "admin@example.com",
    password: "test-password-123",
  });
  const exams = (await guest.get("/api/admin/exams")).body.items;
  const bank = (await guest.get("/api/admin/questions")).body.items[0];
  const target =
    exams.find(
      (e) =>
        !e.content.questions.some(
          (q) =>
            JSON.stringify(q.prompt) === JSON.stringify(bank.content.prompt),
        ),
    ) || exams[0];
  const added = await post(
    guest,
    `/api/admin/exams/${target.id}/questions`,
  ).send({ question_id: bank.id });
  assert.equal(added.status, 201);
  const count = target.content.questions.length + 1;
  const linked = (await guest.get("/api/admin/exams")).body.items.find(
    (e) => e.id === target.id,
  );
  assert.equal(
    (
      await put(guest, `/api/admin/exams/${target.id}`).send({
        content: {
          ...linked.content,
          description: "Changed exam description only",
        },
        status: linked.status,
      })
    ).status,
    200,
  );
  const changed = {
    ...bank.content,
    prompt: [{ type: "text", value: "Shared question was edited" }],
  };
  assert.equal(
    (
      await put(guest, `/api/admin/questions/${bank.id}`).send({
        content: changed,
        status: "published",
      })
    ).status,
    200,
  );
  const updated = (await guest.get("/api/admin/exams")).body.items.find(
    (e) => e.id === target.id,
  );
  assert.equal(updated.content.questions.length, count);
  assert.equal(
    updated.content.questions[count - 1].prompt[0].value,
    "Shared question was edited",
  );
  await db.end();
});

test("draft edits to linked questions do not leak into published exams", async () => {
  const { db, guest, post, put } = await setup();
  await post(guest, "/api/auth/login").send({
    email: "admin@example.com",
    password: "test-password-123",
  });
  const bank = (await guest.get("/api/admin/questions")).body.items[0];
  const link = (
    await db.query(
      "SELECT exam_id,position FROM exam_questions WHERE question_id=$1",
      [bank.id],
    )
  ).rows[0];
  const before = (await guest.get(`/api/exams/${link.exam_id}`)).body;
  const content = {
    ...bank.content,
    prompt: [{ type: "text", value: "Private unfinished draft" }],
  };
  assert.equal(
    (
      await put(guest, `/api/admin/questions/${bank.id}`).send({
        content,
        status: "draft",
      })
    ).status,
    200,
  );
  const after = (await guest.get(`/api/exams/${link.exam_id}`)).body;
  assert.deepEqual(
    after.content.questions[link.position].prompt,
    before.content.questions[link.position].prompt,
  );
  const saved = (await guest.get("/api/admin/exams")).body.items.find(
    (e) => e.id === link.exam_id,
  );
  assert.equal(
    (
      await put(guest, `/api/admin/exams/${link.exam_id}`).send({
        content: saved.content,
        status: "published",
      })
    ).status,
    200,
  );
  const stillPrivate = (
    await guest.get("/api/admin/questions")
  ).body.items.find((q) => q.id === bank.id);
  assert.equal(
    stillPrivate.status,
    "draft",
    "Saving unrelated exam metadata must not publish a newer bank draft",
  );
  await db.end();
});

test("secret tracking code restores private image access in a different browser", async () => {
  const { db, guest, other, post, put } = await setup();
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
    "base64",
  );
  const image = await post(guest, "/api/uploads").attach("image", png, {
    filename: "test.png",
    contentType: "image/png",
  });
  const content = structuredClone(sampleExam);
  content.questions[0].prompt.push({
    type: "image",
    asset_id: image.body.asset_id,
    alt: "Hình minh họa",
  });
  const submission = (
    await post(guest, "/api/contributions").send({
      contact: "x@example.com",
      content,
    })
  ).body;
  assert.equal((await other.get(image.body.url)).status, 404);
  assert.equal(
    (
      await post(other, "/api/contributions/track").send({
        code: submission.tracking_code,
      })
    ).status,
    200,
  );
  assert.equal((await other.get(image.body.url)).status, 200);
  await post(guest, "/api/auth/login").send({
    email: "admin@example.com",
    password: "test-password-123",
  });
  await post(
    guest,
    `/api/admin/submissions/${submission.id}/request-changes`,
  ).send({ note: "Sửa tiêu đề" });
  assert.equal(
    (
      await put(other, "/api/contributions/revise").send({
        code: submission.tracking_code,
        content: { ...content, title: "Đề đã chỉnh sửa" },
      })
    ).status,
    200,
  );
  await db.end();
});

test("admin search and filters narrow questions and accounts", async () => {
  const { db, guest, post, del } = await setup();
  await post(guest, "/api/auth/login").send({
    email: "admin@example.com",
    password: "test-password-123",
  });
  const essay = await guest.get(
    "/api/admin/questions?type=essay&status=published",
  );
  assert.equal(essay.body.items.length, 1);
  assert.equal(essay.body.items[0].content.type, "essay");
  assert.equal(
    (await guest.get("/api/admin/questions?q=notexistingword")).body.items
      .length,
    0,
  );
  assert.equal(
    (await guest.get("/api/admin/users?q=notexistingword")).body.items.length,
    0,
  );

  // Test question archiving vs permanent deletion
  const qList = (await guest.get("/api/admin/questions")).body.items;
  const toArchive = qList[0];
  const archiveRes = await del(guest, "/api/admin/questions").send({
    ids: [toArchive.id],
    permanent: false,
  });
  assert.equal(archiveRes.status, 200);
  assert.equal(archiveRes.body.deleted, 1);
  assert.equal(archiveRes.body.mode, "archived");

  const archivedQ = (
    await db.query("SELECT status FROM questions WHERE id=$1", [toArchive.id])
  ).rows[0];
  assert.equal(archivedQ.status, "archived");

  const toPermDelete = qList[1];
  const deleteRes = await del(guest, "/api/admin/questions").send({
    ids: [toPermDelete.id],
    permanent: true,
  });
  assert.equal(deleteRes.status, 200);
  assert.equal(deleteRes.body.deleted, 1);
  assert.equal(deleteRes.body.mode, "permanent");

  const deletedQ = (
    await db.query("SELECT id FROM questions WHERE id=$1", [toPermDelete.id])
  ).rows[0];
  assert.equal(deletedQ, undefined);

  await db.end();
});
