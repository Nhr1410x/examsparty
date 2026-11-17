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
