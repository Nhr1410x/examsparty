export type Block = {
  type: "text" | "math" | "code" | "image";
  value?: string;
  language?: string;
  asset_id?: string;
  alt?: string;
};
export type QuestionType =
  "single_choice" | "multiple_choice" | "true_false" | "short_answer" | "essay";
export type Response = string | string[] | Record<string, boolean> | null;
export interface Question {
  client_id: string;
  type: QuestionType;
  prompt: Block[];
  options?: { id: string; content: Block[] }[];
  statements?: { id: string; content: Block[]; answer?: boolean }[];
  answer?: {
    correct_option_ids?: string[];
    accepted?: string[];
    numeric_tolerance?: number;
    case_sensitive?: boolean;
    partial_credit?: boolean;
  };
  explanation: Block[];
  points: number;
  difficulty: "easy" | "medium" | "hard";
  tags: string[];
  rubric?: string;
}
export interface ExamContent {
  schema_version: "1.0";
  title: string;
  subject: string;
  grade: string;
  description: string;
  topics: string[];
  settings: {
    time_limit_minutes: number;
    shuffle_questions: boolean;
    shuffle_options: boolean;
    score_scale: 10;
  };
  questions: Question[];
}
export interface ExamCard {
  id: string;
  title: string;
  subject: string;
  grade: string;
  description: string;
  topics: string[];
  question_count: number;
  time_limit_minutes: number;
  types: QuestionType[];
  updated_at: string;
  status?: string;
  content?: ExamContent;
  version?: number;
}
export interface GradedQuestion extends Question {
  response: Response;
  awarded: number;
  status: "correct" | "wrong" | "blank" | "pending" | "partial";
}
export interface Result {
  score: number;
  earned: number;
  total: number;
  correct: number;
  wrong: number;
  blank: number;
  pending: number;
  provisional: boolean;
  questions: GradedQuestion[];
}
export interface Attempt {
  id: string;
  exam_id: string;
  mode: "practice" | "exam";
  status: "active" | "submitted";
  started_at: string;
  expires_at: string | null;
  submitted_at: string | null;
  server_time: string;
  snapshot: ExamContent;
  responses: Record<string, Response>;
  feedback: Record<string, GradedQuestion>;
  result: Result | null;
}
export interface Recent {
  id: string;
  title: string;
  mode: string;
  status: string;
  score?: number;
  started_at: string;
  expires_at?: string;
}
export interface User {
  id: string;
  email: string;
  role: string;
  status?: string;
}
export interface Submission {
  id: string;
  contact?: string;
  content: ExamContent;
  status: string;
  review_note?: string;
  created_at: string;
  reviewed_at?: string;
  duplicates?: { id: string; title: string }[];
}
export const typeLabels: Record<QuestionType, string> = {
  single_choice: "Chọn một",
  multiple_choice: "Chọn nhiều",
  true_false: "Đúng / Sai",
  short_answer: "Trả lời ngắn",
  essay: "Tự luận",
};
export const statusLabels: Record<string, string> = {
  published: "Đã xuất bản",
  draft: "Bản nháp",
  archived: "Đã lưu trữ",
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Từ chối",
  changes_requested: "Cần chỉnh sửa",
  active: "Đang hoạt động",
  blocked: "Đã khóa",
  correct: "Đúng",
  wrong: "Sai",
  blank: "Bỏ trống",
  partial: "Đúng một phần",
  submitted: "Đã nộp",
  open: "Chưa xử lý",
  resolved: "Đã xử lý",
};
export const emptyQuestion = (n = 1): Question => ({
  client_id: `q${n}`,
  type: "single_choice",
  prompt: [{ type: "text", value: "" }],
  options: [
    { id: "a", content: [{ type: "text", value: "" }] },
    { id: "b", content: [{ type: "text", value: "" }] },
  ],
  answer: { correct_option_ids: ["a"] },
  explanation: [],
  points: 1,
  difficulty: "medium",
  tags: [],
});
export const emptyExam = (): ExamContent => ({
  schema_version: "1.0",
  title: "",
  subject: "Toán học",
  grade: "10",
  description: "",
  topics: [],
  settings: {
    time_limit_minutes: 30,
    shuffle_questions: true,
    shuffle_options: true,
    score_scale: 10,
  },
  questions: [emptyQuestion()],
});
export const template: ExamContent = {
  ...emptyExam(),
  title: "Ôn tập kiến thức cơ bản",
  description: "Ví dụ định dạng JSON để nhập đề.",
  topics: ["Số học"],
  questions: [
    {
      ...emptyQuestion(),
      prompt: [{ type: "text", value: "Kết quả của 2 + 2 là bao nhiêu?" }],
      options: [
        { id: "a", content: [{ type: "text", value: "4" }] },
        { id: "b", content: [{ type: "text", value: "5" }] },
      ],
      explanation: [{ type: "text", value: "2 + 2 = 4." }],
    },
  ],
};

export function normalizeExamPayload(data: any): ExamContent {
  if (!data || typeof data !== "object") {
    throw new Error("Dữ liệu đề thi không hợp lệ (phải là đối tượng JSON).");
  }

  const rawQuestions = Array.isArray(data.questions) ? data.questions : [];
  const normalizedQuestions: Question[] =
    rawQuestions.length > 0
      ? rawQuestions.map((q: any, idx: number) => {
          const cid = String(q.client_id || `q${idx + 1}`);
          const type: QuestionType = [
            "single_choice",
            "multiple_choice",
            "true_false",
            "short_answer",
            "essay",
          ].includes(q.type)
            ? q.type
            : "single_choice";

          const normalizeBlocks = (val: any, allowEmptyArray = false): Block[] => {
            let list: Block[] = [];
            if (Array.isArray(val)) {
              list = val.map((b) =>
                typeof b === "string"
                  ? { type: "text", value: b }
                  : {
                      type: b?.type || "text",
                      value: b?.value || "",
                      language: b?.language,
                      asset_id: b?.asset_id,
                      alt: b?.alt,
                    },
              );
            } else if (typeof val === "string" && val.trim().length > 0) {
              list = [{ type: "text", value: val }];
            }

            const valid = list.filter(
              (b) =>
                (typeof b.value === "string" && b.value.trim().length > 0) ||
                b.type === "image",
            );

            if (valid.length > 0) return valid;
            if (allowEmptyArray) return [];
            return [{ type: "text", value: " " }];
          };

          const question: Question = {
            client_id: cid,
            type,
            prompt: normalizeBlocks(q.prompt, false),
            explanation: normalizeBlocks(q.explanation, true),
            points:
              typeof q.points === "number" && q.points > 0 ? q.points : 1,
            difficulty: ["easy", "medium", "hard"].includes(q.difficulty)
              ? q.difficulty
              : "medium",
            tags: Array.isArray(q.tags)
              ? q.tags.map(String).filter((t: string) => t.trim().length > 0)
              : [],
          };

          if (type === "true_false" && Array.isArray(q.statements)) {
            question.statements = q.statements.map((s: any, sIdx: number) => ({
              id: String(s.id || String.fromCharCode(97 + sIdx)),
              content: normalizeBlocks(s.content),
              answer: typeof s.answer === "boolean" ? s.answer : true,
            }));
          } else if (Array.isArray(q.options)) {
            question.options = q.options.map((opt: any, optIdx: number) => ({
              id: String(opt.id || String.fromCharCode(97 + optIdx)),
              content: normalizeBlocks(opt.content),
            }));
          }

          if (q.answer && typeof q.answer === "object") {
            question.answer = {
              correct_option_ids: Array.isArray(q.answer.correct_option_ids)
                ? q.answer.correct_option_ids.map(String)
                : undefined,
              accepted: Array.isArray(q.answer.accepted)
                ? q.answer.accepted.map(String)
                : undefined,
              numeric_tolerance:
                typeof q.answer.numeric_tolerance === "number"
                  ? q.answer.numeric_tolerance
                  : undefined,
              case_sensitive:
                typeof q.answer.case_sensitive === "boolean"
                  ? q.answer.case_sensitive
                  : undefined,
              partial_credit:
                typeof q.answer.partial_credit === "boolean"
                  ? q.answer.partial_credit
                  : undefined,
            };
          } else {
            question.answer = { correct_option_ids: ["a"] };
          }

          if (q.rubric) question.rubric = String(q.rubric);

          return question;
        })
      : [emptyQuestion(1)];

  // Ensure unique client_ids
  const seenIds = new Set<string>();
  normalizedQuestions.forEach((q, idx) => {
    if (seenIds.has(q.client_id) || !q.client_id) {
      q.client_id = `q${idx + 1}_${Math.random().toString(36).slice(2, 6)}`;
    }
    seenIds.add(q.client_id);
  });

  // Ensure at least one question has positive points
  if (!normalizedQuestions.some((q) => q.points > 0)) {
    normalizedQuestions[0].points = 1;
  }

  let title = String(data.title || "Đề thi mới").trim();
  if (title.length < 3) title = `${title} thi`;

  return {
    schema_version: "1.0",
    title,
    subject: String(data.subject || "Toán học").trim() || "Toán học",
    grade: String(data.grade || "12").trim() || "12",
    description: String(data.description || ""),
    topics: Array.isArray(data.topics) ? data.topics.map(String) : [],
    settings: {
      time_limit_minutes:
        typeof data.settings?.time_limit_minutes === "number" &&
        data.settings.time_limit_minutes >= 1 &&
        data.settings.time_limit_minutes <= 300
          ? data.settings.time_limit_minutes
          : 45,
      shuffle_questions:
        typeof data.settings?.shuffle_questions === "boolean"
          ? data.settings.shuffle_questions
          : true,
      shuffle_options:
        typeof data.settings?.shuffle_options === "boolean"
          ? data.settings.shuffle_options
          : true,
      score_scale: 10,
    },
    questions: normalizedQuestions,
  };
}
