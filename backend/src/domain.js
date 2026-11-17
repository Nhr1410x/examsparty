import { z } from "zod";
import { randomInt } from "node:crypto";

const id = z
  .string()
  .regex(/^[\w-]{1,80}$/)
  .refine(
    (value) => !Object.hasOwn(Object.prototype, value),
    "ID không được trùng thuộc tính có sẵn của đối tượng.",
  );
const block = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("text"),
    value: z.string().min(1).max(20000),
  }),
  z.strictObject({
    type: z.literal("math"),
    value: z.string().min(1).max(2000),
  }),
  z.strictObject({
    type: z.literal("code"),
    value: z.string().min(1).max(20000),
    language: z.string().max(40).optional(),
  }),
  z.strictObject({
    type: z.literal("image"),
    asset_id: z.uuid(),
    alt: z.string().min(1).max(500),
  }),
]);
const blocks = z.array(block).min(1).max(30);
const answer = z.strictObject({
  correct_option_ids: z.array(id).min(1).max(20).optional(),
  accepted: z.array(z.string().min(1).max(2000)).min(1).max(30).optional(),
  case_sensitive: z.boolean().optional(),
  numeric_tolerance: z.number().min(0).max(1000).optional(),
  partial_credit: z.boolean().optional(),
});
export const questionSchema = z
  .strictObject({
    client_id: id,
    type: z.enum([
      "single_choice",
      "multiple_choice",
      "true_false",
      "short_answer",
      "essay",
    ]),
    prompt: blocks,
    options: z
      .array(z.strictObject({ id, content: blocks }))
      .min(2)
      .max(20)
      .optional(),
    statements: z
      .array(z.strictObject({ id, content: blocks, answer: z.boolean() }))
      .min(1)
      .max(20)
      .optional(),
    answer: answer.optional(),
    explanation: z.preprocess((val) => {
      if (!Array.isArray(val)) return [];
      return val.filter(
        (b) =>
          (b && typeof b.value === "string" && b.value.trim().length > 0) ||
          b?.type === "image",
      );
    }, z.array(block).max(30).default([])),
    points: z.number().min(0).max(100).default(1),
    difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
    tags: z.array(z.string().min(1).max(80)).max(20).default([]),
    rubric: z.string().max(5000).optional(),
  })
  .superRefine((q, ctx) => {
    const fail = (path, message) =>
      ctx.addIssue({ code: "custom", path, message });
    if (["single_choice", "multiple_choice"].includes(q.type)) {
      if (!q.options) fail(["options"], "Cần ít nhất hai phương án.");
      const ids = q.options?.map((o) => o.id) || [];
      if (new Set(ids).size !== ids.length)
        fail(["options"], "ID phương án phải duy nhất.");
      const correct = q.answer?.correct_option_ids;
      if (
        !correct?.length ||
        correct.some((i) => !ids.includes(i)) ||
        new Set(correct).size !== correct.length
      )
        fail(
          ["answer", "correct_option_ids"],
          "Đáp án phải tham chiếu phương án hợp lệ và không trùng.",
        );
      if (q.type === "single_choice" && correct?.length !== 1)
        fail(["answer"], "Câu chọn một phải có đúng một đáp án.");
    }
    if (q.type === "true_false") {
      if (!q.statements?.length)
        fail(["statements"], "Cần nhận định và đáp án đúng/sai.");
      if (new Set(q.statements?.map((s) => s.id)).size !== q.statements?.length)
        fail(["statements"], "ID nhận định phải duy nhất.");
    }
    if (q.type === "short_answer") {
      if (!q.answer?.accepted?.length)
        fail(["answer", "accepted"], "Cần ít nhất một đáp án chấp nhận.");
      if (
        q.answer?.numeric_tolerance !== undefined &&
        q.answer.accepted?.some(
          (v) => !Number.isFinite(Number(v.replace(",", "."))),
        )
      )
        fail(
          ["answer", "numeric_tolerance"],
          "Dung sai chỉ dùng cho đáp án số.",
        );
    }
    if (!["single_choice", "multiple_choice"].includes(q.type) && q.options)
      fail(["options"], "Dạng câu này không hỗ trợ phương án.");
    if (q.type !== "true_false" && q.statements)
      fail(["statements"], "Dạng câu này không hỗ trợ nhận định.");
    if (q.answer?.partial_credit && q.type !== "multiple_choice")
      fail(
        ["answer", "partial_credit"],
        "Chỉ áp dụng điểm từng phần cho câu chọn nhiều.",
      );
  });

export const examSchema = z
  .strictObject({
    schema_version: z.literal("1.0"),
    title: z.string().trim().min(3).max(200),
    subject: z.string().trim().min(1).max(80),
    grade: z.string().max(30),
    topics: z.array(z.string().min(1).max(80)).max(20).default([]),
    description: z.string().max(5000).default(""),
    settings: z.strictObject({
      time_limit_minutes: z.number().int().min(1).max(300),
      shuffle_questions: z.boolean().default(true),
      shuffle_options: z.boolean().default(true),
      score_scale: z.literal(10).default(10),
    }),
    questions: z.array(questionSchema).min(1).max(200),
  })
  .superRefine((exam, ctx) => {
    if (
      new Set(exam.questions.map((q) => q.client_id)).size !==
      exam.questions.length
    )
      ctx.addIssue({
        code: "custom",
        path: ["questions"],
        message: "client_id của câu hỏi phải duy nhất.",
      });
    if (!exam.questions.some((q) => q.points > 0))
      ctx.addIssue({
        code: "custom",
        path: ["questions"],
        message: "Tổng điểm phải lớn hơn 0.",
      });
  });

export function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function makeSnapshot(exam, mode) {
  const copy = structuredClone(exam);
  if (mode === "exam") {
    if (exam.settings.shuffle_questions)
      copy.questions = shuffle(copy.questions);
    if (exam.settings.shuffle_options)
      copy.questions.forEach((q) => {
        if (q.options) q.options = shuffle(q.options);
      });
  }
  return copy;
}
export function publicQuestion(q) {
  const { answer, explanation, rubric, ...visible } = q;
  if (visible.statements)
    visible.statements = visible.statements.map(({ answer, ...s }) => s);
  return visible;
}
export function isBlank(response) {
  return (
    response === undefined ||
    response === null ||
    (typeof response === "string" && !response.trim()) ||
    (Array.isArray(response) && !response.length) ||
    (typeof response === "object" && !Object.keys(response).length)
  );
}
const normalize = (v, sensitive = false) => {
  const s = String(v).normalize("NFC").trim().replace(/\s+/g, " ");
  return sensitive ? s : s.toLocaleLowerCase("vi");
};
export function gradeQuestion(q, response) {
  if (isBlank(response)) return { awarded: 0, status: "blank" };
  if (q.type === "essay") return { awarded: 0, status: "pending" };
  let fraction = 0;
  if (q.type === "single_choice")
    fraction = response === q.answer.correct_option_ids[0] ? 1 : 0;
  if (q.type === "multiple_choice" && Array.isArray(response)) {
    const selected = [...new Set(response)],
      correct = q.answer.correct_option_ids;
    fraction =
      selected.length === correct.length &&
      selected.every((v) => correct.includes(v))
        ? 1
        : 0;
    // Partial credit penalizes extra choices; the score never becomes negative.
    if (q.answer.partial_credit)
      fraction = Math.max(
        0,
        (selected.filter((v) => correct.includes(v)).length -
          selected.filter((v) => !correct.includes(v)).length) /
          correct.length,
      );
  }
  if (q.type === "true_false" && typeof response === "object")
    fraction =
      q.statements.filter((s) => response[s.id] === s.answer).length /
      q.statements.length;
  if (q.type === "short_answer" && typeof response === "string") {
    fraction = q.answer.accepted.some(
      (v) =>
        normalize(v, q.answer.case_sensitive) ===
        normalize(response, q.answer.case_sensitive),
    )
      ? 1
      : 0;
    if (q.answer.numeric_tolerance !== undefined) {
      const value = Number(response.trim().replace(",", "."));
      fraction =
        Number.isFinite(value) &&
        q.answer.accepted.some(
          (v) =>
            Math.abs(Number(v.replace(",", ".")) - value) <=
            q.answer.numeric_tolerance,
        )
          ? 1
          : 0;
    }
  }
  return {
    awarded: q.points * fraction,
    status: fraction === 1 ? "correct" : fraction > 0 ? "partial" : "wrong",
  };
}
export function validResponse(q, response) {
  if (isBlank(response)) return true;
  if (q.type === "single_choice")
    return (
      typeof response === "string" && q.options.some((o) => o.id === response)
    );
  if (q.type === "multiple_choice")
    return (
      Array.isArray(response) &&
      new Set(response).size === response.length &&
      response.every((v) => q.options.some((o) => o.id === v))
    );
  if (q.type === "true_false")
    return (
      typeof response === "object" &&
      !Array.isArray(response) &&
      Object.entries(response).every(
        ([k, v]) =>
          q.statements.some((s) => s.id === k) && typeof v === "boolean",
      )
    );
  return (
    typeof response === "string" &&
    response.length <= (q.type === "essay" ? 20000 : 2000)
  );
}
export function gradeAttempt(snapshot, responses) {
  const questions = snapshot.questions.map((q) => ({
    ...q,
    response: responses[q.client_id] ?? null,
    ...gradeQuestion(q, responses[q.client_id]),
  }));
  const total = questions.reduce((s, q) => s + q.points, 0),
    earned = questions.reduce((s, q) => s + q.awarded, 0);
  const count = (status) => questions.filter((q) => q.status === status).length;
  return {
    score: Math.round((earned / total) * 1000) / 100,
    total,
    earned,
    correct: count("correct"),
    wrong: count("wrong") + count("partial"),
    blank: count("blank"),
    pending: count("pending"),
    provisional: count("pending") > 0,
    questions,
  };
}
