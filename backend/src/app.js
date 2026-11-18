import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import multer from "multer";
import bcrypt from "bcryptjs";
import * as OTPAuth from "otpauth";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { z, ZodError } from "zod";
import {
  examSchema,
  questionSchema,
  makeSnapshot,
  publicQuestion,
  gradeQuestion,
  gradeAttempt,
  validResponse,
} from "./domain.js";
import { transaction } from "./db.js";
import { createZipArchive } from "./zip.js";

const hash = (value) => createHash("sha256").update(value).digest("hex");
const secret = () => randomBytes(32).toString("hex");
const uuid = z.uuid();
const httpError = (status, message) =>
  Object.assign(new Error(message), { status });
const pagination = (req) =>
  z
    .object({
      page: z.coerce.number().int().min(1).max(100000).default(1),
      limit: z.coerce.number().int().min(1).max(50).default(12),
    })
    .parse(req.query);
const assetIds = (content) => {
  const ids = new Set();
  for (const q of content.questions)
    for (const blocks of [
      q.prompt,
      q.explanation,
      ...(q.options || []).map((o) => o.content),
      ...(q.statements || []).map((s) => s.content),
    ])
      for (const b of blocks || []) if (b.type === "image") ids.add(b.asset_id);
  return [...ids];
};
export function createApp(db, config) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(express.json({ limit: "2mb" }));
  app.use(cookieParser());
  app.get("/api/health", async (req, res) => {
    await db.query("SELECT 1");
    res.json({ status: "ok" });
  });
  const limiter = (limit, windowMs = 15 * 60 * 1000) =>
    rateLimit({
      windowMs,
      limit,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: { error: "Bạn thao tác quá nhanh. Vui lòng thử lại sau." },
    });
  app.use("/api", limiter(1500));
  app.use("/api", async (req, res, next) => {
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.get("origin") !== config.frontendOrigin
    )
      throw httpError(
        403,
        "Nguồn yêu cầu không hợp lệ. Hãy mở trang từ địa chỉ chính thức.",
      );
    res.set("Cache-Control", "no-store");
    let row;
    if (/^[a-f0-9]{64}$/.test(req.cookies.ep_session || ""))
      row = (
        await db.query(
          "SELECT * FROM sessions WHERE token_hash=$1 AND expires_at > $2",
          [hash(req.cookies.ep_session), new Date()],
        )
      ).rows[0];
    if (!row) {
      const token = secret();
      row = {
        id: randomUUID(),
        token_hash: hash(token),
        expires_at: new Date(Date.now() + 30 * 86400000),
      };
      await db.query(
        "INSERT INTO sessions (id,token_hash,expires_at) VALUES ($1,$2,$3)",
        [row.id, row.token_hash, row.expires_at],
      );
      setCookie(res, token);
    }
    req.session = row;
    if (
      row.user_id &&
      row.auth_expires_at &&
      new Date(row.auth_expires_at) > new Date()
    ) {
      req.user = (
        await db.query("SELECT id,email,role,status FROM users WHERE id=$1", [
          row.user_id,
        ])
      ).rows[0];
      if (req.user?.status !== "active") req.user = null;
    }
    next();
  });
  function setCookie(res, token) {
    res.cookie("ep_session", token, {
      httpOnly: true,
      secure: config.production,
      sameSite: "lax",
      path: "/api",
      maxAge: 30 * 86400000,
    });
  }
  async function audit(client, req, action, type, target, summary) {
    await client.query(
      "INSERT INTO audit_logs (id,actor_id,action,target_type,target_id,summary) VALUES ($1,$2,$3,$4,$5,$6)",
      [randomUUID(), req.user?.id || null, action, type, target, summary],
    );
  }
  async function canReadAsset(asset, id, req, client = db) {
    if (!asset) return false;
    if (
      asset.published ||
      asset.owner_id === req.session.id ||
      req.user?.role === "admin"
    )
      return true;
    return (
      (
        await client.query(
          "SELECT asset_id FROM asset_access WHERE asset_id=$1 AND session_id=$2",
          [id, req.session.id],
        )
      ).rowCount > 0
    );
  }
  async function checkAssets(content, req, client = db) {
    for (const id of assetIds(content)) {
      const a = (
        await client.query(
          "SELECT owner_id,published FROM assets WHERE id=$1",
          [id],
        )
      ).rows[0];
      if (!(await canReadAsset(a, id, req, client)))
        throw httpError(
          400,
          `Ảnh ${id} không tồn tại hoặc bạn không có quyền sử dụng.`,
        );
    }
  }
  async function publishAssets(content, client) {
    for (const id of assetIds(content))
      await client.query("UPDATE assets SET published=true WHERE id=$1", [id]);
  }
  async function writeExam(client, content, status, author, existingId) {
    const id = existingId || randomUUID();
    const reusable = new Map();
    if (existingId) {
      const previous = (
        await client.query(
          "SELECT content,status FROM exams WHERE id=$1 FOR UPDATE",
          [id],
        )
      ).rows[0];
      if (!previous || previous.status === "deleted")
        throw httpError(404, "Không tìm thấy đề.");
      const links = (
        await client.query(
          "SELECT eq.question_id,eq.position,q.content FROM exam_questions eq JOIN questions q ON eq.question_id=q.id WHERE eq.exam_id=$1",
          [id],
        )
      ).rows;
      for (const link of links) {
        const before = previous.content.questions[link.position],
          after = content.questions.find(
            (q) => q.client_id === before?.client_id,
          );
        if (
          before &&
          after &&
          isDeepStrictEqual(before, after) &&
          isDeepStrictEqual(
            { ...link.content, client_id: after.client_id },
            after,
          )
        )
          reusable.set(after.client_id, link.question_id);
      }
      const updated = await client.query(
        "UPDATE exams SET title=$1,subject=$2,grade=$3,description=$4,content=$5,status=$6,version=version+1,updated_at=$7 WHERE id=$8",
        [
          content.title,
          content.subject,
          content.grade,
          content.description,
          JSON.stringify(content),
          status,
          new Date(),
          id,
        ],
      );
      if (!updated.rowCount) throw httpError(404, "Không tìm thấy đề.");
      await client.query("DELETE FROM exam_questions WHERE exam_id=$1", [id]);
    } else
      await client.query(
        "INSERT INTO exams (id,title,subject,grade,description,content,status,author_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
        [
          id,
          content.title,
          content.subject,
          content.grade,
          content.description,
          JSON.stringify(content),
          status,
          author,
        ],
      );
    for (let i = 0; i < content.questions.length; i++) {
      const qid = reusable.get(content.questions[i].client_id) || randomUUID();
      if (reusable.has(content.questions[i].client_id)) {
        if (status === "published")
          await client.query(
            "UPDATE questions SET status='published' WHERE id=$1",
            [qid],
          );
      } else
        await client.query(
          "INSERT INTO questions (id,content,status,author_id) VALUES ($1,$2,$3,$4)",
          [qid, JSON.stringify(content.questions[i]), status, author],
        );
      await client.query(
        "INSERT INTO exam_questions (exam_id,question_id,position) VALUES ($1,$2,$3)",
        [id, qid, i],
      );
    }
    if (status === "published") await publishAssets(content, client);
    return id;
  }
  const admin = (req, res, next) => {
    if (!req.user) throw httpError(401, "Vui lòng đăng nhập quản trị.");
    if (req.user.role !== "admin")
      throw httpError(403, "Bạn không có quyền quản trị.");
    next();
  };
  app.get("/api/session", (req, res) =>
    res.json({ user: req.user || null, demo: Boolean(config.demo) }),
  );
  app.post("/api/auth/login", limiter(8), async (req, res) => {
    const input = z
      .strictObject({
        email: z.email(),
        password: z.string().min(1).max(200),
        otp: z.string().max(10).optional(),
      })
      .parse(req.body);
    const user = (
      await db.query("SELECT * FROM users WHERE email=$1", [
        input.email.toLowerCase(),
      ])
    ).rows[0];
    const passwordOk = await bcrypt.compare(
      input.password,
      user?.password_hash ||
        "$2b$12$C6UzMDM.H6dfI/f/IKcEe.Wh6VbKRZ3UJQw5G9A4KdHpnS8d7MdEq",
    );
    if (
      !user ||
      !passwordOk ||
      user.status !== "active" ||
      user.role !== "admin"
    )
      throw httpError(401, "Email hoặc mật khẩu không chính xác.");
    if (config.totpSecret) {
      const totp = new OTPAuth.TOTP({
        secret: OTPAuth.Secret.fromBase32(config.totpSecret),
      });
      if (!input.otp || totp.validate({ token: input.otp, window: 1 }) === null)
        throw httpError(401, "Mã xác thực hai bước không hợp lệ.");
    }
    const token = secret();
    await db.query(
      "UPDATE sessions SET token_hash=$1,user_id=$2,auth_expires_at=$3 WHERE id=$4",
      [
        hash(token),
        user.id,
        new Date(Date.now() + 8 * 3600000),
        req.session.id,
      ],
    );
    setCookie(res, token);
    req.user = user;
    await audit(db, req, "login", "user", user.id, "Đăng nhập quản trị");
    res.json({ user: { id: user.id, email: user.email, role: user.role } });
  });
  app.post("/api/auth/logout", async (req, res) => {
    const token = secret();
    await db.query(
      "UPDATE sessions SET token_hash=$1,user_id=NULL,auth_expires_at=NULL WHERE id=$2",
      [hash(token), req.session.id],
    );
    setCookie(res, token);
    res.json({ ok: true });
  });

  const examCard = (row) => {
    const { content, ...rest } = row;
    return {
      ...rest,
      question_count: content.questions.length,
      time_limit_minutes: content.settings.time_limit_minutes,
      topics: content.topics,
      types: [...new Set(content.questions.map((q) => q.type))],
    };
  };
  app.get("/api/exams", async (req, res) => {
    const { page, limit } = pagination(req),
      values = ["published"];
    let where = "status=$1";
    const add = (sql, v) => {
      values.push(v);
      where += ` AND ${sql.replace("?", `$${values.length}`)}`;
    };
    if (req.query.q) {
      values.push(`%${String(req.query.q).slice(0, 100)}%`);
      where += ` AND (title ILIKE $${values.length} OR description ILIKE $${values.length})`;
    }
    if (req.query.subject) add("subject=?", String(req.query.subject));
    if (req.query.grade) add("grade=?", String(req.query.grade));
    if (req.query.topic)
      add(
        "content->'topics' @> ?::jsonb",
        JSON.stringify([String(req.query.topic)]),
      );
    if (req.query.type)
      add(
        "content->'questions' @> ?::jsonb",
        JSON.stringify([{ type: String(req.query.type) }]),
      );
    if (req.query.difficulty)
      add(
        "content->'questions' @> ?::jsonb",
        JSON.stringify([{ difficulty: String(req.query.difficulty) }]),
      );
    if (req.query.max_minutes)
      add(
        "(content->'settings'->>'time_limit_minutes')::int <= ?",
        z.coerce.number().int().min(1).max(300).parse(req.query.max_minutes),
      );
    if (req.query.min_questions)
      add(
        "jsonb_array_length(content->'questions') >= ?",
        z.coerce.number().int().min(1).max(200).parse(req.query.min_questions),
      );
    const total = Number(
      (
        await db.query(
          `SELECT count(*) AS count FROM exams WHERE ${where}`,
          values,
        )
      ).rows[0].count,
    );
    const rows = (
      await db.query(
        `SELECT * FROM exams WHERE ${where} ORDER BY updated_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
        [...values, limit, (page - 1) * limit],
      )
    ).rows;
    res.json({ items: rows.map(examCard), total, page, limit });
  });
  app.get("/api/catalog", async (req, res) => {
    const rows = (
      await db.query(
        "SELECT subject,grade,content FROM exams WHERE status='published'",
      )
    ).rows;
    const unique = (items) => [...new Set(items)].sort();
    res.json({
      subjects: unique(rows.map((r) => r.subject)),
      grades: unique(rows.map((r) => r.grade)),
      topics: unique(rows.flatMap((r) => r.content.topics)),
      exams: rows.length,
      questions: rows.reduce((s, r) => s + r.content.questions.length, 0),
    });
  });
  app.get("/api/exams/:id", async (req, res) => {
    uuid.parse(req.params.id);
    const row = (
      await db.query("SELECT * FROM exams WHERE id=$1", [
        req.params.id,
      ])
    ).rows[0];
    if (!row || row.status === "deleted")
      throw httpError(404, "Không tìm thấy đề.");
    if (row.status === "personal") {
      const isOwner =
        (row.owner_id && row.owner_id === req.session.id) ||
        (req.user && row.author_id && row.author_id === req.user.id) ||
        (row.content?.owner_id && row.content.owner_id === req.session.id);
      if (!isOwner && req.user?.role !== "admin") {
        throw httpError(404, "Không tìm thấy đề.");
      }
    } else if (row.status !== "published") {
      throw httpError(404, "Không tìm thấy đề.");
    }
    res.json({
      ...examCard(row),
      content: {
        ...row.content,
        questions: row.content.questions.map(publicQuestion),
      },
    });
  });
  app.get("/api/questions", async (req, res) => {
    const { page, limit } = pagination(req),
      q = `%${String(req.query.q || "").slice(0, 100)}%`;
    const values = [q];
    let where = "status='published' AND (content->'prompt')::text ILIKE $1";
    if (req.query.type) {
      const allowed = [
        "single_choice",
        "multiple_choice",
        "true_false",
        "short_answer",
        "essay",
      ];
      if (allowed.includes(req.query.type)) {
        values.push(req.query.type);
        where += ` AND content->>'type'=$${values.length}`;
      }
    }
    if (req.query.difficulty) {
      const allowed = ["easy", "medium", "hard"];
      if (allowed.includes(req.query.difficulty)) {
        values.push(req.query.difficulty);
        where += ` AND content->>'difficulty'=$${values.length}`;
      }
    }
    const rows = (
      await db.query(
        `SELECT id,content FROM questions WHERE ${where} ORDER BY updated_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
        [...values, limit, (page - 1) * limit],
      )
    ).rows;
    res.json({
      items: rows.map((row) => ({
        id: row.id,
        ...publicQuestion(row.content),
      })),
      page,
      limit,
    });
  });
  const submitReport = async (payload) => {
    const parsed = z
      .object({
        exam_id: z.string().uuid().optional().nullable(),
        question_id: z.string().uuid().optional().nullable(),
        question_label: z.string().max(200).optional().default(""),
        question_content: z.string().max(3000).optional().default(""),
        reason: z.string().max(100).default("other"),
        suggested_answer: z.string().max(2000).optional().default(""),
        message: z.string().trim().max(3000).optional().default(""),
        details: z.record(z.string(), z.any()).optional().default({}),
      })
      .parse(payload || {});

    let examId = parsed.exam_id || null;
    if (examId) {
      const examCheck = await db.query(
        "SELECT id FROM exams WHERE id=$1 AND status <> 'deleted'",
        [examId],
      );
      if (!examCheck.rowCount) examId = null;
    }

    let questionId = parsed.question_id || null;
    if (questionId) {
      const qCheck = await db.query(
        "SELECT id FROM questions WHERE id=$1 AND status <> 'deleted'",
        [questionId],
      );
      if (!qCheck.rowCount) questionId = null;
    }

    let finalMessage = parsed.message.trim();
    if (!finalMessage) {
      if (parsed.suggested_answer.trim()) {
        finalMessage = `Đề xuất đáp án: ${parsed.suggested_answer.trim()}`;
      } else {
        const reasonLabels = {
          wrong_answer: "Báo lỗi: Sai đáp án",
          unclear_explanation: "Báo lỗi: Lời giải/giải thích chưa hợp lý",
          content_error: "Báo lỗi: Đề bài có sai sót/thiếu số liệu",
          display_error: "Báo lỗi: Lỗi công thức hoặc hiển thị hình ảnh",
          other: "Báo lỗi nội dung câu hỏi",
        };
        finalMessage = reasonLabels[parsed.reason] || `Báo lỗi: ${parsed.reason}`;
      }
    }

    const reportId = randomUUID();
    const details = {
      question_label: parsed.question_label,
      question_content: parsed.question_content,
      ...parsed.details,
    };

    await db.query(
      `INSERT INTO reports (id, exam_id, question_id, reason, suggested_answer, message, details, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'open')`,
      [
        reportId,
        examId,
        questionId,
        parsed.reason,
        parsed.suggested_answer.trim() || null,
        finalMessage,
        JSON.stringify(details),
      ],
    );

    return { ok: true, id: reportId };
  };

  app.post("/api/reports", limiter(20), async (req, res) => {
    const result = await submitReport(req.body);
    res.status(201).json(result);
  });

  app.post("/api/exams/:id/report", limiter(20), async (req, res) => {
    uuid.parse(req.params.id);
    const result = await submitReport({
      ...req.body,
      exam_id: req.params.id,
    });
    res.status(201).json(result);
  });

  async function finish(client, row) {
    if (row.status === "submitted") return row;
    const result = gradeAttempt(row.snapshot, row.responses),
      now = new Date();
    await client.query(
      "UPDATE attempts SET status='submitted',result=$1,submitted_at=$2 WHERE id=$3",
      [JSON.stringify(result), now, row.id],
    );
    return { ...row, status: "submitted", result, submitted_at: now };
  }
  async function ownedAttempt(req, fn) {
    uuid.parse(req.params.id);
    return transaction(db, async (client) => {
      let row = (
        await client.query(
          "SELECT * FROM attempts WHERE id=$1 AND owner_id=$2 FOR UPDATE",
          [req.params.id, req.session.id],
        )
      ).rows[0];
      if (!row) throw httpError(404, "Không tìm thấy phiên làm bài của bạn.");
      if (
        row.status === "active" &&
        row.expires_at &&
        new Date(row.expires_at) <= new Date()
      )
        row = await finish(client, row);
      return fn(client, row);
    });
  }
  const visibleAttempt = (row) => {
    const feedback = {};
    if (row.mode === "practice")
      for (const [id, value] of Object.entries(row.checked)) {
        const q = row.snapshot.questions.find((q) => q.client_id === id);
        if (q)
          feedback[id] = { ...q, ...gradeQuestion(q, value), response: value };
      }
    return {
      id: row.id,
      exam_id: row.exam_id,
      mode: row.mode,
      status: row.status,
      started_at: row.started_at,
      expires_at: row.expires_at,
      submitted_at: row.submitted_at,
      server_time: new Date().toISOString(),
      snapshot: {
        ...row.snapshot,
        questions: row.snapshot.questions.map(publicQuestion),
      },
      responses: row.responses,
      feedback,
      result: row.status === "submitted" ? row.result : null,
    };
  };
  app.get("/api/personal-exams/subjects", async (req, res) => {
    const rows = (
      await db.query(
        "SELECT subject, grade, content->'questions' as questions FROM exams WHERE status='published'",
      )
    ).rows;
    const subjectsMap = new Map();
    for (const r of rows) {
      const existing = subjectsMap.get(r.subject) || {
        subject: r.subject,
        questions: new Set(),
        grades: new Set(),
      };
      if (r.grade) existing.grades.add(r.grade);
      if (Array.isArray(r.questions)) {
        for (const q of r.questions) {
          existing.questions.add(JSON.stringify(q.prompt));
        }
      }
      subjectsMap.set(r.subject, existing);
    }
    const result = Array.from(subjectsMap.values())
      .map((s) => ({
        subject: s.subject,
        available_questions: s.questions.size,
        grades: Array.from(s.grades).sort(),
      }))
      .sort((a, b) => a.subject.localeCompare(b.subject));
    res.json(result);
  });

  app.post("/api/personal-exams/generate", limiter(30), async (req, res) => {
    const body = z
      .strictObject({
        subject: z.string().min(1).max(50),
        question_count: z.coerce.number().int().min(1).max(500).default(10),
        time_limit_minutes: z.coerce.number().int().min(1).max(300).default(15),
        title: z.string().max(200).optional(),
        grade: z.string().max(20).optional(),
      })
      .parse(req.body);

    const examRows = (
      await db.query(
        "SELECT content, grade FROM exams WHERE status='published' AND subject=$1",
        [body.subject],
      )
    ).rows;

    const pool = [];
    const seen = new Set();
    for (const row of examRows) {
      if (Array.isArray(row.content?.questions)) {
        for (const q of row.content.questions) {
          const key = JSON.stringify(q.prompt);
          if (!seen.has(key)) {
            seen.add(key);
            pool.push(q);
          }
        }
      }
    }

    if (pool.length === 0) {
      throw httpError(
        400,
        `Chưa có câu hỏi nào thuộc môn "${body.subject}" trong kho đề để tạo đề tự luyện.`,
      );
    }

    // Shuffle and pick
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const count = Math.min(body.question_count, shuffled.length);
    const selected = shuffled.slice(0, count).map((q, idx) => ({
      ...q,
      client_id: `q${idx + 1}`,
      points: q.points || 1,
    }));

    const examId = randomUUID();
    const now = new Date();
    const examTitle =
      body.title?.trim() ||
      `Đề tự luyện ${body.subject} (${selected.length} câu - ${body.time_limit_minutes} phút)`;
    const examGrade = body.grade?.trim() || examRows[0]?.grade || "12";

    const content = {
      title: examTitle,
      subject: body.subject,
      grade: examGrade,
      description: `Đề thi tự luyện cá nhân gồm ${selected.length} câu hỏi môn ${body.subject}.`,
      topics: [...new Set(selected.flatMap((q) => q.tags || []))],
      settings: {
        time_limit_minutes: body.time_limit_minutes,
        shuffle_questions: true,
        passing_score: Math.max(1, Math.round(selected.length * 0.5)),
      },
      questions: selected,
      owner_id: req.session.id,
      is_personal: true,
    };

    await db.query(
      `INSERT INTO exams (id, title, subject, grade, description, content, status, version, author_id, owner_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'personal', 1, $7, $8, $9, $9)`,
      [
        examId,
        content.title,
        content.subject,
        content.grade,
        content.description,
        JSON.stringify(content),
        req.user?.id || null,
        req.session.id,
        now,
      ],
    );

    const createdRow = (
      await db.query("SELECT * FROM exams WHERE id=$1", [examId])
    ).rows[0];

    res.status(201).json(examCard(createdRow));
  });

  app.get("/api/personal-exams", async (req, res) => {
    const rows = (
      await db.query(
        `SELECT * FROM exams 
         WHERE status='personal' 
           AND (owner_id=$1 OR (author_id IS NOT NULL AND author_id=$2) OR (content->>'owner_id')=$3)
         ORDER BY created_at DESC`,
        [req.session.id, req.user?.id || null, req.session.id],
      )
    ).rows;
    res.json({ items: rows.map(examCard), total: rows.length });
  });

  app.delete("/api/personal-exams/:id", async (req, res) => {
    uuid.parse(req.params.id);
    const row = (
      await db.query("SELECT * FROM exams WHERE id=$1 AND status='personal'", [
        req.params.id,
      ])
    ).rows[0];
    if (!row) throw httpError(404, "Không tìm thấy đề cá nhân.");
    const isOwner =
      (row.owner_id && row.owner_id === req.session.id) ||
      (req.user && row.author_id && row.author_id === req.user.id) ||
      (row.content?.owner_id && row.content.owner_id === req.session.id);
    if (!isOwner && req.user?.role !== "admin") {
      throw httpError(403, "Bạn không có quyền xóa đề thi này.");
    }
    await db.query("DELETE FROM attempts WHERE exam_id=$1", [req.params.id]);
    await db.query("DELETE FROM exams WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  });

  app.post("/api/attempts", limiter(80), async (req, res) => {
    const { exam_id, mode } = z
      .strictObject({ exam_id: uuid, mode: z.enum(["practice", "exam"]) })
      .parse(req.body);
    const exam = (
      await db.query(
        "SELECT * FROM exams WHERE id=$1",
        [exam_id],
      )
    ).rows[0];
    if (!exam || exam.status === "deleted")
      throw httpError(404, "Không tìm thấy đề.");
    if (exam.status === "personal") {
      const isOwner =
        (exam.owner_id && exam.owner_id === req.session.id) ||
        (req.user && exam.author_id && exam.author_id === req.user.id) ||
        (exam.content?.owner_id && exam.content.owner_id === req.session.id);
      if (!isOwner && req.user?.role !== "admin") {
        throw httpError(404, "Không tìm thấy đề.");
      }
    } else if (exam.status !== "published") {
      throw httpError(404, "Không tìm thấy đề.");
    }
    const snapshot = makeSnapshot(exam.content, mode),
      id = randomUUID(),
      now = new Date(),
      expires =
        mode === "exam"
          ? new Date(
              now.getTime() + snapshot.settings.time_limit_minutes * 60000,
            )
          : null;
    await db.query(
      "INSERT INTO attempts (id,exam_id,owner_id,mode,snapshot,started_at,expires_at) VALUES ($1,$2,$3,$4,$5,$6,$7)",
      [
        id,
        exam_id,
        req.session.id,
        mode,
        JSON.stringify(snapshot),
        now,
        expires,
      ],
    );
    res
      .status(201)
      .json(
        visibleAttempt(
          (await db.query("SELECT * FROM attempts WHERE id=$1", [id])).rows[0],
        ),
      );
  });
  app.get("/api/attempts", async (req, res) => {
    const rows = (
      await db.query(
        "SELECT * FROM attempts WHERE owner_id=$1 ORDER BY started_at DESC LIMIT 30",
        [req.session.id],
      )
    ).rows;
    res.json({
      items: rows.map((r) => ({
        id: r.id,
        title: r.snapshot.title,
        mode: r.mode,
        status: r.status,
        expires_at: r.expires_at,
        started_at: r.started_at,
        score: r.result?.score,
      })),
    });
  });
  app.get("/api/attempts/:id", async (req, res) =>
    res.json(
      await ownedAttempt(req, async (client, row) => visibleAttempt(row)),
    ),
  );
  app.put("/api/attempts/:id/answers/:questionId", async (req, res) => {
    const input = z
      .strictObject({ response: z.unknown(), check: z.boolean().optional() })
      .parse(req.body);
    const outcome = await ownedAttempt(req, async (client, row) => {
      if (row.status !== "active")
        return { closed: true, attempt: visibleAttempt(row) };
      const q = row.snapshot.questions.find(
        (q) => q.client_id === req.params.questionId,
      );
      if (!q) throw httpError(404, "Không tìm thấy câu hỏi.");
      if (!validResponse(q, input.response))
        throw httpError(400, "Câu trả lời không đúng định dạng.");
      if (row.mode === "practice" && Object.hasOwn(row.checked, q.client_id))
        throw httpError(
          409,
          "Câu đã kiểm tra. Bắt đầu lượt luyện mới để trả lời lại.",
        );
      if (input.check && row.mode !== "practice")
        throw httpError(400, "Không thể xem đáp án trong khi thi.");
      row.responses = { ...row.responses, [q.client_id]: input.response };
      if (input.check)
        row.checked = { ...row.checked, [q.client_id]: input.response };
      await client.query(
        "UPDATE attempts SET responses=$1,checked=$2 WHERE id=$3",
        [JSON.stringify(row.responses), JSON.stringify(row.checked), row.id],
      );
      return { attempt: visibleAttempt(row) };
    });
    res
      .status(outcome.closed ? 409 : 200)
      .json(
        outcome.closed
          ? { error: "Phiên đã kết thúc.", attempt: outcome.attempt }
          : outcome.attempt,
      );
  });
  app.post("/api/attempts/:id/submit", async (req, res) =>
    res.json(
      await ownedAttempt(req, async (client, row) =>
        visibleAttempt(await finish(client, row)),
      ),
    ),
  );

  app.post("/api/contributions/validate", limiter(60), async (req, res) => {
    const content = examSchema.parse(req.body);
    await checkAssets(content, req);
    res.json({ content });
  });
  app.post("/api/contributions", limiter(12), async (req, res) => {
    const policy = (
      await db.query("SELECT value FROM settings WHERE key='policy'")
    ).rows[0].value;
    if (!policy.contributions_enabled)
      throw httpError(
        403,
        "Hệ thống đang tạm ngừng nhận đóng góp. Vui lòng quay lại sau.",
      );
    const { contact, content: raw } = z
      .strictObject({ contact: z.email().max(200), content: z.unknown() })
      .parse(req.body);
    const content = examSchema.parse(raw);
    await checkAssets(content, req);
    const id = randomUUID(),
      code = secret();
    await db.query(
      "INSERT INTO submissions (id,owner_id,contact,tracking_hash,content) VALUES ($1,$2,$3,$4,$5)",
      [id, req.session.id, contact, hash(code), JSON.stringify(content)],
    );
    res.status(201).json({ id, tracking_code: code, status: "pending" });
  });
  app.get("/api/contributions/my", limiter(60), async (req, res) => {
    const rows = (
      await db.query(
        "SELECT id,contact,content,status,review_note,reviewed_at,created_at FROM submissions WHERE owner_id=$1 ORDER BY created_at DESC LIMIT 50",
        [req.session.id],
      )
    ).rows;
    res.json({ items: rows });
  });
  app.post("/api/contributions/track", limiter(40), async (req, res) => {
    const { code } = z
      .object({ code: z.string().regex(/^[a-f0-9]{64}$/) })
      .parse(req.body);
    const row = (
      await db.query(
        "SELECT id,content,status,review_note,reviewed_at,created_at FROM submissions WHERE tracking_hash=$1",
        [hash(code)],
      )
    ).rows[0];
    if (!row) throw httpError(404, "Mã theo dõi không tồn tại.");
    for (const assetId of assetIds(row.content))
      await db.query(
        "INSERT INTO asset_access (asset_id,session_id) VALUES ($1,$2) ON CONFLICT (asset_id,session_id) DO NOTHING",
        [assetId, req.session.id],
      );
    res.json(row);
  });
  app.put("/api/contributions/revise", limiter(12), async (req, res) => {
    const { code, content: raw } = z
      .strictObject({
        code: z.string().regex(/^[a-f0-9]{64}$/),
        content: z.unknown(),
      })
      .parse(req.body);
    const content = examSchema.parse(raw);
    await checkAssets(content, req);
    const updated = await db.query(
      "UPDATE submissions SET content=$1,status='pending',review_note=NULL,reviewer_id=NULL,reviewed_at=NULL WHERE tracking_hash=$2 AND status='changes_requested'",
      [JSON.stringify(content), hash(code)],
    );
    if (!updated.rowCount)
      throw httpError(
        409,
        "Chỉ có thể gửi lại nội dung đang được yêu cầu chỉnh sửa.",
      );
    res.json({ status: "pending" });
  });
  app.delete("/api/contributions/:id", limiter(30), async (req, res) => {
    uuid.parse(req.params.id);
    const result = await db.query(
      "DELETE FROM submissions WHERE id=$1 AND owner_id=$2",
      [req.params.id, req.session.id],
    );
    res.json({ deleted: result.rowCount });
  });
  app.post("/api/contributions/batch-delete", limiter(30), async (req, res) => {
    const { ids } = z
      .object({ ids: z.array(z.string().uuid()).min(1).max(100) })
      .parse(req.body);
    const result = await db.query(
      "DELETE FROM submissions WHERE id = ANY($1::uuid[]) AND owner_id=$2",
      [ids, req.session.id],
    );
    res.json({ deleted: result.rowCount });
  });
  app.post("/api/contributions/delete-by-code", limiter(30), async (req, res) => {
    const { code } = z
      .object({ code: z.string().regex(/^[a-f0-9]{64}$/) })
      .parse(req.body);
    const result = await db.query(
      "DELETE FROM submissions WHERE tracking_hash=$1",
      [hash(code)],
    );
    res.json({ deleted: result.rowCount });
  });
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 0 },
  });
  app.post(
    "/api/uploads",
    limiter(20),
    upload.single("image"),
    async (req, res) => {
      const f = req.file;
      if (!f) throw httpError(400, "Vui lòng chọn ảnh PNG, JPEG hoặc WebP.");
      const b = f.buffer;
      const mime =
        b.length > 24 &&
        b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          ? "image/png"
          : b.length > 12 && b[0] === 255 && b[1] === 216 && b[2] === 255
            ? "image/jpeg"
            : b.length > 16 &&
                b.toString("ascii", 0, 4) === "RIFF" &&
                b.toString("ascii", 8, 12) === "WEBP"
              ? "image/webp"
              : null;
      if (!mime || mime !== f.mimetype)
        throw httpError(
          400,
          "Nội dung ảnh không khớp định dạng PNG/JPEG/WebP.",
        );
      const id = randomUUID();
      await db.query(
        "INSERT INTO assets (id,owner_id,mime_type,size,data) VALUES ($1,$2,$3,$4,$5)",
        [id, req.session.id, mime, b.length, b],
      );
      res.status(201).json({ asset_id: id, url: `/api/assets/${id}` });
    },
  );
  app.get("/api/assets/:id", async (req, res) => {
    uuid.parse(req.params.id);
    const a = (
      await db.query("SELECT * FROM assets WHERE id=$1", [req.params.id])
    ).rows[0];
    if (!(await canReadAsset(a, req.params.id, req)))
      throw httpError(404, "Không tìm thấy ảnh.");
    res
      .set({
        "Content-Type": a.mime_type,
        "Content-Disposition": "inline",
        "X-Content-Type-Options": "nosniff",
      })
      .send(a.data);
  });

  // --- Public Documents API ---
  app.get("/api/documents", async (req, res) => {
    const { page, limit } = pagination(req);
    const subject = req.query.subject ? String(req.query.subject).trim() : null;
    const grade = req.query.grade ? String(req.query.grade).trim() : null;
    const category = req.query.category ? String(req.query.category).trim() : null;
    const q = req.query.q ? String(req.query.q).trim() : null;

    const values = ["published"];
    let where = "status=$1";

    if (subject) {
      values.push(subject);
      where += ` AND subject=$${values.length}`;
    }
    if (grade) {
      values.push(grade);
      where += ` AND grade=$${values.length}`;
    }
    if (category) {
      values.push(category);
      where += ` AND category=$${values.length}`;
    }
    if (q) {
      values.push(`%${q}%`);
      where += ` AND (title ILIKE $${values.length} OR description ILIKE $${values.length} OR file_name ILIKE $${values.length})`;
    }

    const total = Number(
      (await db.query(`SELECT count(*) AS count FROM documents WHERE ${where}`, values)).rows[0]?.count || 0
    );

    const offset = (page - 1) * limit;
    values.push(limit, offset);
    const rows = (
      await db.query(
        `SELECT id, title, description, subject, grade, category, file_name, mime_type, file_size, thumbnail_url, views_count, downloads_count, author_name, created_at, updated_at
         FROM documents
         WHERE ${where}
         ORDER BY created_at DESC
         LIMIT $${values.length - 1} OFFSET $${values.length}`,
        values
      )
    ).rows;

    res.json({ items: rows, total, page, limit });
  });

  app.get("/api/documents/subjects", async (req, res) => {
    const rows = (
      await db.query(
        "SELECT subject, count(*) as count FROM documents WHERE status='published' GROUP BY subject ORDER BY count DESC"
      )
    ).rows;
    res.json({
      subjects: rows.map((r) => ({
        subject: r.subject,
        count: Number(r.count),
      })),
    });
  });

  app.get("/api/documents/:id", async (req, res) => {
    uuid.parse(req.params.id);
    const row = (
      await db.query(
        "SELECT id, title, description, subject, grade, category, file_name, mime_type, file_size, thumbnail_url, views_count, downloads_count, author_name, created_at, updated_at FROM documents WHERE id=$1 AND status='published'",
        [req.params.id]
      )
    ).rows[0];
    if (!row) throw httpError(404, "Không tìm thấy tài liệu.");

    db.query("UPDATE documents SET views_count = views_count + 1 WHERE id=$1", [req.params.id]).catch(() => {});
    res.json({ document: { ...row, views_count: Number(row.views_count) + 1 } });
  });

  app.get("/api/documents/:id/preview", async (req, res) => {
    uuid.parse(req.params.id);
    const row = (
      await db.query(
        "SELECT id, file_name, mime_type, data FROM documents WHERE id=$1 AND status <> 'deleted'",
        [req.params.id]
      )
    ).rows[0];
    if (!row) throw httpError(404, "Không tìm thấy tài liệu.");

    db.query("UPDATE documents SET views_count = views_count + 1 WHERE id=$1", [req.params.id]).catch(() => {});

    res.set({
      "Content-Type": row.mime_type || "application/pdf",
      "Content-Disposition": `inline; filename="${encodeURIComponent(row.file_name)}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=3600",
    }).send(row.data);
  });

  app.get("/api/documents/:id/download", async (req, res) => {
    uuid.parse(req.params.id);
    const row = (
      await db.query(
        "SELECT id, file_name, mime_type, data FROM documents WHERE id=$1 AND status <> 'deleted'",
        [req.params.id]
      )
    ).rows[0];
    if (!row) throw httpError(404, "Không tìm thấy tài liệu.");

    db.query("UPDATE documents SET downloads_count = downloads_count + 1 WHERE id=$1", [req.params.id]).catch(() => {});

    res.set({
      "Content-Type": row.mime_type || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(row.file_name)}"`,
      "X-Content-Type-Options": "nosniff",
    }).send(row.data);
  });

  app.post("/api/documents/batch-download", limiter(20), async (req, res) => {
    const { ids } = z
      .object({ ids: z.array(z.string().uuid()).min(1).max(50) })
      .parse(req.body);

    const placeholders = ids.map((_, i) => `$${i + 1}`).join(",");
    const rows = (
      await db.query(
        `SELECT id, file_name, data FROM documents WHERE id IN (${placeholders}) AND status <> 'deleted'`,
        ids
      )
    ).rows;

    if (!rows.length) throw httpError(404, "Không tìm thấy tài liệu nào để tải.");

    const zipBuffer = createZipArchive(
      rows.map((r) => ({ name: r.file_name, data: r.data }))
    );

    db.query(`UPDATE documents SET downloads_count = downloads_count + 1 WHERE id IN (${placeholders})`, ids).catch(() => {});

    res.set({
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="Examsparty_Tai_Lieu.zip"`,
      "X-Content-Type-Options": "nosniff",
    }).send(zipBuffer);
  });

  app.use("/api/admin", admin);
  app.get("/api/admin/overview", async (req, res) => {
    const count = async (table, where = "") =>
      Number(
        (await db.query(`SELECT count(*) AS count FROM ${table} ${where}`))
          .rows[0].count,
      );
    res.json({
      pending: await count("submissions", "WHERE status='pending'"),
      exams: await count("exams", "WHERE status <> 'deleted'"),
      questions: await count("questions", "WHERE status <> 'deleted'"),
      documents: await count("documents", "WHERE status <> 'deleted'"),
      attempts: await count("attempts"),
      reports: await count("reports", "WHERE status='open'"),
    });
  });

  // --- Admin Documents Management ---
  const docUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 35 * 1024 * 1024, files: 1 },
  });

  app.get("/api/admin/documents", async (req, res) => {
    const { page, limit } = pagination(req);
    const subject = req.query.subject ? String(req.query.subject).trim() : null;
    const grade = req.query.grade ? String(req.query.grade).trim() : null;
    const category = req.query.category ? String(req.query.category).trim() : null;
    const status = req.query.status ? String(req.query.status).trim() : null;
    const q = req.query.q ? String(req.query.q).trim() : null;

    const values = [];
    const conditions = [];

    if (status && status !== "all") {
      values.push(status);
      conditions.push(`status=$${values.length}`);
    } else {
      conditions.push(`status <> 'deleted'`);
    }

    if (subject) {
      values.push(subject);
      conditions.push(`subject=$${values.length}`);
    }
    if (grade) {
      values.push(grade);
      conditions.push(`grade=$${values.length}`);
    }
    if (category) {
      values.push(category);
      conditions.push(`category=$${values.length}`);
    }
    if (q) {
      values.push(`%${q}%`);
      conditions.push(`(title ILIKE $${values.length} OR file_name ILIKE $${values.length} OR description ILIKE $${values.length})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const total = Number(
      (await db.query(`SELECT count(*) AS count FROM documents ${where}`, values)).rows[0]?.count || 0
    );

    const offset = (page - 1) * limit;
    values.push(limit, offset);
    const rows = (
      await db.query(
        `SELECT id, title, description, subject, grade, category, file_name, mime_type, file_size, views_count, downloads_count, status, author_name, created_at, updated_at
         FROM documents
         ${where}
         ORDER BY created_at DESC
         LIMIT $${values.length - 1} OFFSET $${values.length}`,
        values
      )
    ).rows;

    res.json({ items: rows, total, page, limit });
  });

  app.post("/api/admin/documents", docUpload.single("file"), async (req, res) => {
    const file = req.file;
    if (!file) throw httpError(400, "Vui lòng đính kèm tập tin tài liệu.");

    const parsed = z
      .object({
        title: z.string().trim().min(2, "Tiêu đề quá ngắn").max(255),
        description: z.string().trim().max(2000).default(""),
        subject: z.string().trim().min(1, "Vui lòng chọn môn"),
        grade: z.string().trim().min(1, "Vui lòng chọn khối lớp"),
        category: z.string().trim().default("theory"),
        author_name: z.string().trim().default("Examsparty"),
        status: z.enum(["published", "draft", "archived"]).default("published"),
      })
      .parse(req.body);

    const id = randomUUID();
    const fileName = file.originalname || "document.pdf";
    const mimeType = file.mimetype || "application/pdf";
    const fileSize = file.size;
    const fileData = file.buffer;

    await db.query(
      `INSERT INTO documents (id, title, description, subject, grade, category, file_name, mime_type, file_size, data, author_name, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        id,
        parsed.title,
        parsed.description,
        parsed.subject,
        parsed.grade,
        parsed.category,
        fileName,
        mimeType,
        fileSize,
        fileData,
        parsed.author_name,
        parsed.status,
      ]
    );

    res.status(201).json({
      id,
      title: parsed.title,
      file_name: fileName,
      file_size: fileSize,
      status: parsed.status,
    });
  });

  app.put("/api/admin/documents/:id", docUpload.single("file"), async (req, res) => {
    uuid.parse(req.params.id);
    const parsed = z
      .object({
        title: z.string().trim().min(2).max(255),
        description: z.string().trim().max(2000).default(""),
        subject: z.string().trim().min(1),
        grade: z.string().trim().min(1),
        category: z.string().trim().default("theory"),
        author_name: z.string().trim().default("Examsparty"),
        status: z.enum(["published", "draft", "archived"]).default("published"),
      })
      .parse(req.body);

    const file = req.file;
    if (file) {
      await db.query(
        `UPDATE documents
         SET title=$1, description=$2, subject=$3, grade=$4, category=$5, author_name=$6, status=$7, file_name=$8, mime_type=$9, file_size=$10, data=$11, updated_at=now()
         WHERE id=$12`,
        [
          parsed.title,
          parsed.description,
          parsed.subject,
          parsed.grade,
          parsed.category,
          parsed.author_name,
          parsed.status,
          file.originalname,
          file.mimetype,
          file.size,
          file.buffer,
          req.params.id,
        ]
      );
    } else {
      await db.query(
        `UPDATE documents
         SET title=$1, description=$2, subject=$3, grade=$4, category=$5, author_name=$6, status=$7, updated_at=now()
         WHERE id=$8`,
        [
          parsed.title,
          parsed.description,
          parsed.subject,
          parsed.grade,
          parsed.category,
          parsed.author_name,
          parsed.status,
          req.params.id,
        ]
      );
    }

    res.json({ ok: true, id: req.params.id });
  });

  app.delete("/api/admin/documents", async (req, res) => {
    const { ids, permanent } = z
      .object({
        ids: z.array(z.string().uuid()).min(1),
        permanent: z.boolean().optional().default(true),
      })
      .parse(req.body);

    const placeholders = ids.map((_, i) => `$${i + 1}`).join(",");
    let result;
    if (permanent) {
      result = await db.query(
        `DELETE FROM documents WHERE id IN (${placeholders})`,
        ids
      );
    } else {
      result = await db.query(
        `UPDATE documents SET status='archived', updated_at=now() WHERE id IN (${placeholders})`,
        ids
      );
    }

    res.json({ deleted: result.rowCount });
  });
  app.get("/api/admin/review-queue", async (req, res) => {
    const { page, limit } = pagination(req);
    const status = z
      .enum(["pending", "approved", "rejected", "changes_requested"])
      .parse(req.query.status || "pending");
    const rows = (
      await db.query(
        "SELECT id,contact,content,status,review_note,created_at,reviewed_at FROM submissions WHERE status=$1 ORDER BY created_at ASC LIMIT $2 OFFSET $3",
        [status, limit, (page - 1) * limit],
      )
    ).rows;
    const items = [];
    for (const row of rows)
      items.push({
        ...row,
        duplicates: (
          await db.query(
            "SELECT id,title FROM exams WHERE status <> 'deleted' AND title=$1 LIMIT 5",
            [row.content.title],
          )
        ).rows,
      });
    res.json({ items, page, limit });
  });
  for (const [action, status] of [
    ["approve", "approved"],
    ["reject", "rejected"],
    ["request-changes", "changes_requested"],
  ])
    app.post(`/api/admin/submissions/:id/${action}`, async (req, res) => {
      uuid.parse(req.params.id);
      const { note } = z
        .object({ note: z.string().trim().max(2000).default("") })
        .parse(req.body || {});
      if (action !== "approve" && !note)
        throw httpError(400, "Vui lòng nhập lý do hoặc yêu cầu chỉnh sửa.");
      const result = await transaction(db, async (client) => {
        const s = (
          await client.query(
            "SELECT * FROM submissions WHERE id=$1 FOR UPDATE",
            [req.params.id],
          )
        ).rows[0];
        if (!s) throw httpError(404, "Không tìm thấy đóng góp.");
        if (s.status !== "pending")
          throw httpError(409, "Nội dung này đã được xử lý.");
        let examId = null;
        if (action === "approve") {
          const content = examSchema.parse(s.content);
          await checkAssets(content, req, client);
          examId = await writeExam(client, content, "published", req.user.id);
        }
        await client.query(
          "UPDATE submissions SET status=$1,review_note=$2,reviewer_id=$3,reviewed_at=$4 WHERE id=$5",
          [status, note, req.user.id, new Date(), s.id],
        );
        await audit(
          client,
          req,
          action,
          "submission",
          s.id,
          `${s.content.title}: ${note}`,
        );
        return { status, exam_id: examId };
      });
      res.json(result);
    });
  app.get("/api/admin/exams", async (req, res) => {
    const { page, limit } = pagination(req),
      q = `%${String(req.query.q || "").slice(0, 100)}%`;
    if (req.query.ids_only === "true") {
      const rows = (
        await db.query(
          "SELECT id FROM exams WHERE status <> 'deleted' AND title ILIKE $1 ORDER BY updated_at DESC",
          [q],
        )
      ).rows;
      return res.json({ ids: rows.map((r) => r.id), total: rows.length });
    }
    const count = Number(
      (
        await db.query(
          "SELECT count(*) AS count FROM exams WHERE status <> 'deleted' AND title ILIKE $1",
          [q],
        )
      ).rows[0].count,
    );
    res.json({
      items: (
        await db.query(
          "SELECT * FROM exams WHERE status <> 'deleted' AND title ILIKE $1 ORDER BY updated_at DESC LIMIT $2 OFFSET $3",
          [q, limit, (page - 1) * limit],
        )
      ).rows,
      total: count,
      page,
      limit,
    });
  });
  app.delete("/api/admin/exams", async (req, res) => {
    const { ids, permanent = true } = z
      .strictObject({
        ids: z
          .array(uuid)
          .min(1)
          .max(10000)
          .refine(
            (ids) =>
              new Set(ids.map((id) => id.toLowerCase())).size === ids.length,
            "Không chọn trùng đề.",
          ),
        permanent: z.boolean().optional().default(true),
      })
      .parse(req.body);
    const deleted = await transaction(db, async (client) => {
      const exams = (
        await client.query(
          `SELECT id,title FROM exams WHERE status <> 'deleted' AND id IN (${ids.map((_, i) => `$${i + 1}`).join(",")}) ORDER BY id FOR UPDATE`,
          ids,
        )
      ).rows;
      if (exams.length !== ids.length)
        throw httpError(
          404,
          "Một số đề không còn tồn tại. Vui lòng tải lại danh sách.",
        );

      // Find all questions associated with the exams being deleted
      const idPlaceholders = ids.map((_, i) => `$${i + 1}`).join(",");
      const linkedQRows = (
        await client.query(
          `SELECT DISTINCT question_id FROM exam_questions WHERE exam_id IN (${idPlaceholders})`,
          ids,
        )
      ).rows;
      const questionIds = linkedQRows.map((r) => r.question_id);

      // Remove association from exam_questions
      await client.query(
        `DELETE FROM exam_questions WHERE exam_id IN (${idPlaceholders})`,
        ids,
      );

      // Mark exams as deleted
      for (const exam of exams) {
        await client.query(
          "UPDATE exams SET status='deleted',updated_at=$1 WHERE id=$2",
          [new Date(), exam.id],
        );
        await audit(client, req, "delete", "exam", exam.id, exam.title);
      }

      // Delete questions completely from database if they are no longer in any active exam
      if (questionIds.length > 0) {
        const qPlaceholders = questionIds.map((_, i) => `$${i + 1}`).join(",");
        await client.query(
          `DELETE FROM questions 
           WHERE id IN (${qPlaceholders}) 
             AND id NOT IN (
               SELECT eq.question_id 
               FROM exam_questions eq 
               JOIN exams e ON eq.exam_id = e.id 
               WHERE e.status <> 'deleted'
             )`,
          questionIds,
        );
      }

      return exams.length;
    });
    res.json({ deleted });
  });
  app.post("/api/admin/exams", async (req, res) => {
    const { content: raw, status } = z
        .strictObject({
          content: z.unknown(),
          status: z.enum(["draft", "published", "archived"]),
        })
        .parse(req.body),
      content = examSchema.parse(raw);
    await checkAssets(content, req);
    const id = await transaction(db, async (client) => {
      const id = await writeExam(client, content, status, req.user.id);
      await audit(client, req, "create", "exam", id, content.title);
      return id;
    });
    res.status(201).json({ id });
  });
  app.put("/api/admin/exams/:id", async (req, res) => {
    uuid.parse(req.params.id);
    const { content: raw, status } = z
        .strictObject({
          content: z.unknown(),
          status: z.enum(["draft", "published", "archived"]),
        })
        .parse(req.body),
      content = examSchema.parse(raw);
    await checkAssets(content, req);
    await transaction(db, async (client) => {
      await writeExam(client, content, status, req.user.id, req.params.id);
      await audit(
        client,
        req,
        "update",
        "exam",
        req.params.id,
        `${content.title} (${status})`,
      );
    });
    res.json({ id: req.params.id });
  });
  app.post("/api/admin/exams/:id/questions", async (req, res) => {
    uuid.parse(req.params.id);
    const { question_id } = z
      .strictObject({ question_id: uuid })
      .parse(req.body);
    const content = await transaction(db, async (client) => {
      const exam = (
        await client.query(
          "SELECT content,status FROM exams WHERE id=$1 FOR UPDATE",
          [req.params.id],
        )
      ).rows[0];
      const question = (
        await client.query(
          "SELECT content FROM questions WHERE id=$1 AND status='published'",
          [question_id],
        )
      ).rows[0];
      if (!exam || exam.status === "deleted" || !question)
        throw httpError(404, "Không tìm thấy đề hoặc câu hỏi đã xuất bản.");
      if (
        (
          await client.query(
            "SELECT question_id FROM exam_questions WHERE exam_id=$1 AND question_id=$2",
            [req.params.id, question_id],
          )
        ).rowCount
      )
        throw httpError(409, "Câu hỏi đã có trong đề.");
      const q = { ...question.content, client_id: `bank_${randomUUID()}` };
      const content = examSchema.parse({
        ...exam.content,
        questions: [...exam.content.questions, q],
      });
      await client.query(
        "INSERT INTO exam_questions (exam_id,question_id,position) VALUES ($1,$2,$3)",
        [req.params.id, question_id, content.questions.length - 1],
      );
      await client.query(
        "UPDATE exams SET content=$1,version=version+1,updated_at=$2 WHERE id=$3",
        [JSON.stringify(content), new Date(), req.params.id],
      );
      if (exam.status === "published")
        await publishAssets({ questions: [q] }, client);
      await audit(
        client,
        req,
        "link-question",
        "exam",
        req.params.id,
        question_id,
      );
      return content;
    });
    res.status(201).json({ content });
  });
  app.get("/api/admin/questions", async (req, res) => {
    const { page, limit } = pagination(req);
    const values = [`%${String(req.query.q || "").slice(0, 100)}%`];
    let where = "status <> 'deleted' AND (content->'prompt')::text ILIKE $1";
    for (const key of ["type", "status", "difficulty"])
      if (req.query[key]) {
        const allowed =
          key === "type"
            ? [
                "single_choice",
                "multiple_choice",
                "true_false",
                "short_answer",
                "essay",
              ]
            : key === "difficulty"
            ? ["easy", "medium", "hard"]
            : ["draft", "published", "archived"];
        const value = z.enum(allowed).parse(req.query[key]);
        values.push(value);
        where += ` AND ${key === "type" ? "content->>'type'" : key === "difficulty" ? "content->>'difficulty'" : "status"}=$${values.length}`;
      }
    if (req.query.subject) {
      const subject = String(req.query.subject).trim();
      if (subject) {
        values.push(subject);
        where += ` AND (
          content->>'subject' = $${values.length}
          OR id IN (
            SELECT eq.question_id 
            FROM exam_questions eq 
            JOIN exams e ON eq.exam_id = e.id 
            WHERE e.status <> 'deleted' AND e.subject = $${values.length}
          )
        )`;
      }
    }
    if (req.query.ids_only === "true") {
      const rows = (
        await db.query(
          `SELECT id FROM questions WHERE ${where} ORDER BY updated_at DESC`,
          values,
        )
      ).rows;
      return res.json({ ids: rows.map((r) => r.id), total: rows.length });
    }
    const count = Number(
      (
        await db.query(
          `SELECT count(*) AS count FROM questions WHERE ${where}`,
          values,
        )
      ).rows[0].count,
    );
    const questionsRows = (
      await db.query(
        `SELECT * FROM questions WHERE ${where} ORDER BY updated_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
        [...values, limit, (page - 1) * limit],
      )
    ).rows;

    const qIds = questionsRows.map((q) => q.id);
    const subjectsMap = new Map();
    if (qIds.length > 0) {
      const qPlaceholders = qIds.map((_, i) => `$${i + 1}`).join(",");
      const linkRows = (
        await db.query(
          `SELECT eq.question_id, e.subject 
           FROM exam_questions eq 
           JOIN exams e ON eq.exam_id = e.id 
           WHERE eq.question_id IN (${qPlaceholders}) AND e.status <> 'deleted' AND e.subject IS NOT NULL`,
          qIds,
        )
      ).rows;
      for (const r of linkRows) {
        if (!subjectsMap.has(r.question_id)) {
          subjectsMap.set(r.question_id, r.subject);
        }
      }
    }
    const items = questionsRows.map((q) => ({
      ...q,
      subject: q.content?.subject || subjectsMap.get(q.id) || null,
    }));

    res.json({
      items,
      total: count,
      page,
      limit,
    });
  });
  app.get("/api/admin/questions/subjects", async (req, res) => {
    const qSubjects = (
      await db.query(
        "SELECT DISTINCT content->>'subject' as subject FROM questions WHERE status <> 'deleted' AND content->>'subject' IS NOT NULL",
      )
    ).rows.map((r) => r.subject);
    const examSubjects = (
      await db.query(
        "SELECT DISTINCT subject FROM exams WHERE status <> 'deleted' AND subject IS NOT NULL",
      )
    ).rows.map((r) => r.subject);
    const set = new Set([...qSubjects, ...examSubjects].filter(Boolean));
    res.json({ subjects: Array.from(set).sort((a, b) => a.localeCompare(b)) });
  });
  app.delete("/api/admin/questions", async (req, res) => {
    const { ids, permanent = true } = z
      .strictObject({
        ids: z
          .array(uuid)
          .min(1)
          .max(10000)
          .refine(
            (ids) =>
              new Set(ids.map((id) => id.toLowerCase())).size === ids.length,
            "Không chọn trùng câu hỏi.",
          ),
        permanent: z.boolean().optional().default(true),
      })
      .parse(req.body);
    const result = await transaction(db, async (client) => {
      const questions = (
        await client.query(
          `SELECT id, content FROM questions WHERE status <> 'deleted' AND id IN (${ids.map((_, i) => `$${i + 1}`).join(",")}) ORDER BY id FOR UPDATE`,
          ids,
        )
      ).rows;
      if (questions.length !== ids.length)
        throw httpError(
          404,
          "Một số câu hỏi không tồn tại hoặc đã bị xóa. Vui lòng tải lại danh sách.",
        );

      if (!permanent) {
        // Soft delete / Move to archive
        const idPlaceholders = ids.map((_, i) => `$${i + 2}`).join(",");
        await client.query(
          `UPDATE questions SET status='archived', updated_at=$1 WHERE id IN (${idPlaceholders})`,
          [new Date(), ...ids],
        );
        for (const q of questions) {
          const title = (
            q.content?.prompt?.[0]?.value ||
            q.content?.client_id ||
            q.id
          ).slice(0, 50);
          await audit(client, req, "archive", "question", q.id, title);
        }
        return { deleted: questions.length, mode: "archived" };
      }

      // Permanent delete: remove links in exam_questions and delete from questions
      await client.query(
        `DELETE FROM exam_questions WHERE question_id IN (${ids.map((_, i) => `$${i + 1}`).join(",")})`,
        ids,
      );
      for (const q of questions) {
        await client.query("DELETE FROM questions WHERE id=$1", [q.id]);
        const title = (
          q.content?.prompt?.[0]?.value ||
          q.content?.client_id ||
          q.id
        ).slice(0, 50);
        await audit(client, req, "delete", "question", q.id, title);
      }
      return { deleted: questions.length, mode: "permanent" };
    });
    res.json(result);
  });
  app.post("/api/admin/questions", async (req, res) => {
    const { content: raw, status } = z
        .strictObject({
          content: z.unknown(),
          status: z.enum(["draft", "published", "archived"]),
        })
        .parse(req.body),
      content = questionSchema.parse(raw),
      id = randomUUID();
    await checkAssets({ questions: [content] }, req);
    await transaction(db, async (client) => {
      await client.query(
        "INSERT INTO questions (id,content,status,author_id) VALUES ($1,$2,$3,$4)",
        [id, JSON.stringify(content), status, req.user.id],
      );
      if (status === "published")
        await publishAssets({ questions: [content] }, client);
      await audit(client, req, "create", "question", id, content.client_id);
    });
    res.status(201).json({ id });
  });
  app.put("/api/admin/questions/:id", async (req, res) => {
    uuid.parse(req.params.id);
    const { content: raw, status } = z
        .strictObject({
          content: z.unknown(),
          status: z.enum(["draft", "published", "archived"]),
        })
        .parse(req.body),
      content = questionSchema.parse(raw);
    await checkAssets({ questions: [content] }, req);
    await transaction(db, async (client) => {
      const updated = await client.query(
        "UPDATE questions SET content=$1,status=$2,version=version+1,updated_at=$3 WHERE id=$4",
        [JSON.stringify(content), status, new Date(), req.params.id],
      );
      if (!updated.rowCount) throw httpError(404, "Không tìm thấy câu hỏi.");
      const links = (
        await client.query(
          "SELECT exam_id,position FROM exam_questions WHERE question_id=$1",
          [req.params.id],
        )
      ).rows;
      for (const link of status === "published" ? links : []) {
        const exam = (
          await client.query(
            "SELECT content,status FROM exams WHERE id=$1 FOR UPDATE",
            [link.exam_id],
          )
        ).rows[0];
        if (exam.status === "deleted") continue;
        const questions = exam.content.questions;
        questions[link.position] = {
          ...content,
          client_id: questions[link.position].client_id,
        };
        const revised = examSchema.parse({ ...exam.content, questions });
        await client.query(
          "UPDATE exams SET content=$1,version=version+1,updated_at=$2 WHERE id=$3",
          [JSON.stringify(revised), new Date(), link.exam_id],
        );
      }
      if (status === "published")
        await publishAssets({ questions: [content] }, client);
      await audit(
        client,
        req,
        "update",
        "question",
        req.params.id,
        `${content.client_id} (${status})`,
      );
    });
    res.json({ ok: true });
  });
  app.get("/api/admin/users", async (req, res) => {
    const { page, limit } = pagination(req);
    res.json({
      items: (
        await db.query(
          "SELECT id,email,role,status,created_at FROM users WHERE email ILIKE $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
          [
            `%${String(req.query.q || "").slice(0, 100)}%`,
            limit,
            (page - 1) * limit,
          ],
        )
      ).rows,
      page,
      limit,
    });
  });
  app.post("/api/admin/users", async (req, res) => {
    const input = z
        .strictObject({
          email: z.email(),
          password: z.string().min(12).max(200),
          role: z.enum(["admin", "contributor"]),
        })
        .parse(req.body),
      id = randomUUID(),
      passwordHash = await bcrypt.hash(input.password, 12);
    await transaction(db, async (client) => {
      await client.query(
        "INSERT INTO users (id,email,password_hash,role,status) VALUES ($1,$2,$3,$4,$5)",
        [id, input.email.toLowerCase(), passwordHash, input.role, "active"],
      );
      await audit(client, req, "create", "user", id, input.email);
    });
    res.status(201).json({ id });
  });
  app.put("/api/admin/users/:id", async (req, res) => {
    uuid.parse(req.params.id);
    const { role, status } = z
      .strictObject({
        role: z.enum(["admin", "contributor"]),
        status: z.enum(["active", "blocked"]),
      })
      .parse(req.body);
    if (req.params.id === req.user.id)
      throw httpError(
        400,
        "Không thể đổi quyền hoặc khóa chính tài khoản đang đăng nhập.",
      );
    await transaction(db, async (client) => {
      const r = await client.query(
        "UPDATE users SET role=$1,status=$2 WHERE id=$3",
        [role, status, req.params.id],
      );
      if (!r.rowCount) throw httpError(404, "Không tìm thấy tài khoản.");
      await audit(
        client,
        req,
        "update",
        "user",
        req.params.id,
        `${role} / ${status}`,
      );
    });
    res.json({ ok: true });
  });
  app.get("/api/admin/audit-logs", async (req, res) => {
    const { page, limit } = pagination(req);
    res.json({
      items: (
        await db.query(
          "SELECT a.*,u.email FROM audit_logs a LEFT JOIN users u ON a.actor_id=u.id ORDER BY a.created_at DESC LIMIT $1 OFFSET $2",
          [limit, (page - 1) * limit],
        )
      ).rows,
      page,
      limit,
    });
  });
  app.get("/api/admin/reports", async (req, res) => {
    const { page, limit } = pagination(req);
    const filter = req.query.status;
    const values = [];
    let where = "";
    if (filter === "open" || filter === "resolved") {
      values.push(filter);
      where = `WHERE r.status = $${values.length}`;
    }
    const total = Number(
      (
        await db.query(
          `SELECT count(*) as count FROM reports r ${where}`,
          values,
        )
      ).rows[0]?.count || 0,
    );
    values.push(limit, (page - 1) * limit);
    const rows = (
      await db.query(
        `SELECT r.*, e.title AS exam_title, (q.content->'prompt')::jsonb AS question_prompt
         FROM reports r
         LEFT JOIN exams e ON r.exam_id = e.id
         LEFT JOIN questions q ON r.question_id = q.id
         ${where}
         ORDER BY (CASE WHEN r.status = 'open' THEN 0 ELSE 1 END), r.created_at DESC
         LIMIT $${values.length - 1} OFFSET $${values.length}`,
        values,
      )
    ).rows;
    res.json({
      items: rows,
      total,
      page,
      limit,
    });
  });
  app.put("/api/admin/reports/:id", async (req, res) => {
    uuid.parse(req.params.id);
    const targetStatus = req.body?.status === "open" ? "open" : "resolved";
    await transaction(db, async (client) => {
      const r = await client.query(
        "UPDATE reports SET status=$1 WHERE id=$2",
        [targetStatus, req.params.id],
      );
      if (!r.rowCount) throw httpError(404, "Không tìm thấy báo lỗi.");
      await audit(
        client,
        req,
        targetStatus === "resolved" ? "resolve" : "reopen",
        "report",
        req.params.id,
        targetStatus === "resolved" ? "Đã xử lý báo lỗi" : "Mở lại báo lỗi",
      );
    });
    res.json({ ok: true, status: targetStatus });
  });
  app.get("/api/admin/config", async (req, res) =>
    res.json({
      mfa_enabled: Boolean(config.totpSecret),
      max_image_mb: 2,
      max_questions: 200,
      submission_policy: "Email liên hệ và mã theo dõi bí mật",
      storage: "PostgreSQL",
      student_accounts: false,
      ...(await db.query("SELECT value FROM settings WHERE key='policy'"))
        .rows[0].value,
    }),
  );
  app.put("/api/admin/config", async (req, res) => {
    const policy = z
      .strictObject({ contributions_enabled: z.boolean() })
      .parse(req.body);
    await transaction(db, async (client) => {
      await client.query("UPDATE settings SET value=$1 WHERE key='policy'", [
        JSON.stringify(policy),
      ]);
      await audit(
        client,
        req,
        "update",
        "config",
        null,
        policy.contributions_enabled
          ? "Mở nhận đóng góp"
          : "Tạm ngừng nhận đóng góp",
      );
    });
    res.json(policy);
  });
  app.use("/api", (req, res) =>
    res.status(404).json({ error: "API không tồn tại." }),
  );
  app.use((err, req, res, next) => {
    if (err instanceof ZodError)
      return res.status(400).json({
        error: "Dữ liệu chưa hợp lệ.",
        issues: err.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      });
    if (err instanceof multer.MulterError)
      return res
        .status(400)
        .json({ error: "Ảnh tối đa 2 MB; mỗi lần tải một ảnh." });
    if (err.code === "23505")
      return res.status(409).json({ error: "Dữ liệu đã tồn tại." });
    if (err.type === "entity.too.large")
      return res.status(413).json({ error: "Dữ liệu quá lớn (tối đa 2 MB)." });
    if (err instanceof SyntaxError && "body" in err)
      return res.status(400).json({ error: "JSON không đúng cú pháp." });
    const status = err.status || 500;
    if (status === 500)
      console.error("API failure", {
        method: req.method,
        path: req.route?.path || "unmatched",
        code: err.code || err.name,
        message: err.message,
        stack: err.stack,
      });
    res.status(status).json({
      error:
        status === 500 ? "Máy chủ gặp lỗi. Vui lòng thử lại." : err.message,
    });
  });
  return app;
}
