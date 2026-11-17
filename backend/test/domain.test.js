import test from "node:test";
import assert from "node:assert/strict";
import {
  examSchema,
  gradeQuestion,
  gradeAttempt,
  publicQuestion,
  makeSnapshot,
} from "../src/domain.js";
import { sampleExam } from "../src/seed.js";

test("sample validates; broken answer references and zero totals fail", () => {
  assert.equal(examSchema.safeParse(sampleExam).success, true);
  const invalid = structuredClone(sampleExam);
  invalid.questions[0].answer.correct_option_ids = ["missing"];
  assert.equal(examSchema.safeParse(invalid).success, false);
  const zero = structuredClone(sampleExam);
  zero.questions.forEach((q) => (q.points = 0));
  assert.equal(examSchema.safeParse(zero).success, false);
  assert.equal(
    examSchema.safeParse({ ...sampleExam, unknown: true }).success,
    false,
  );
});

test("multiple choice uses exact sets and does not reward duplicate selections", () => {
  const q = {
    type: "multiple_choice",
    points: 2,
    answer: { correct_option_ids: ["a", "b"] },
  };
  assert.equal(gradeQuestion(q, ["a", "b"]).awarded, 2);
  assert.equal(gradeQuestion(q, ["a", "c"]).awarded, 0);
  assert.equal(gradeQuestion(q, ["a", "a"]).awarded, 0);
});

test("short answers normalize Unicode, spaces, decimal commas and tolerance", () => {
  const q = {
    type: "short_answer",
    points: 1,
    answer: { accepted: ["bốn"], case_sensitive: false },
  };
  assert.equal(gradeQuestion(q, "  BỐN  ").awarded, 1);
  assert.equal(
    gradeQuestion(
      { ...q, answer: { accepted: ["4"], numeric_tolerance: 0.01 } },
      "4,005",
    ).awarded,
    1,
  );
  assert.equal(
    gradeQuestion(
      { ...q, answer: { accepted: ["4"], numeric_tolerance: 0.01 } },
      "4abc",
    ).awarded,
    0,
  );
});

test("true/false supports partial statements; essays remain pending", () => {
  const q = {
    type: "true_false",
    points: 2,
    statements: [
      { id: "a", answer: true },
      { id: "b", answer: false },
    ],
  };
  assert.equal(gradeQuestion(q, { a: true }).awarded, 1);
  assert.equal(
    gradeQuestion({ type: "essay", points: 2 }, "Bài viết").status,
    "pending",
  );
  const result = gradeAttempt(
    { questions: [q, { client_id: "essay", type: "essay", points: 2 }] },
    { essay: "Nội dung" },
  );
  assert.equal(result.pending, 1);
  assert.equal(result.blank, 1);
  assert.equal(result.provisional, true);
});

test("public questions strip all answer keys and explanations, including statements", () => {
  for (const q of sampleExam.questions) {
    const visible = publicQuestion(q);
    assert.equal(visible.answer, undefined);
    assert.equal(visible.explanation, undefined);
    assert.ok(!visible.statements?.some((s) => "answer" in s));
  }
});

test("snapshot is independent and practice preserves all orders", () => {
  const original = structuredClone(sampleExam);
  const snapshot = makeSnapshot(original, "practice");
  assert.deepEqual(snapshot.questions, original.questions);
  original.questions[0].prompt[0].value = "Changed";
  assert.notEqual(snapshot.questions[0].prompt[0].value, "Changed");
  const shuffled = makeSnapshot(sampleExam, "exam");
  assert.deepEqual(
    shuffled.questions.map((q) => q.client_id).sort(),
    sampleExam.questions.map((q) => q.client_id).sort(),
  );
});

test("question identifiers cannot collide with inherited object properties", () => {
  for (const client_id of ["__proto__", "constructor", "toString", "valueOf"]) {
    const content = structuredClone(sampleExam);
    content.questions[0].client_id = client_id;
    assert.equal(examSchema.safeParse(content).success, false);
  }
});
