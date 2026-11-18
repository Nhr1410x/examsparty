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
export interface PersonalExamSubject {
  subject: string;
  available_questions: number;
  grades: string[];
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
  created_at?: string;
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
  tracking_code?: string;
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
export interface ReportItem {
  id: string;
  exam_id?: string | null;
  question_id?: string | null;
  reason: string;
  suggested_answer?: string | null;
  message: string;
  details?: {
    question_label?: string;
    question_content?: string;
    client_id?: string;
    current_answer?: string;
    [key: string]: unknown;
  };
  status: "open" | "resolved";
  created_at: string;
  exam_title?: string;
}
export const REPORT_REASONS = [
  { value: "wrong_answer", label: "Sai đáp án", desc: "Đáp án công bố bị sai hoặc hệ thống chấm sai kết quả" },
  { value: "unclear_explanation", label: "Giải thích chưa hợp lý", desc: "Lời giải thiếu bước, khó hiểu hoặc mâu thuẫn" },
  { value: "content_error", label: "Đề bài có sai sót / thiếu số liệu", desc: "Đề bị thiếu dữ kiện, sai chính tả hoặc nhầm đề" },
  { value: "display_error", label: "Lỗi hiển thị công thức / hình ảnh", desc: "Công thức toán bị vỡ hoặc ảnh minh họa không tải được" },
  { value: "other", label: "Vấn đề khác", desc: "Góp ý hoặc phản ánh các vấn đề khác về câu hỏi" },
] as const;
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
  schema_version: "1.0",
  title: "Đề thi mẫu chuẩn - Toán học & Lập trình (Toán, Code, Bảng)",
  subject: "Toán học",
  grade: "12",
  description:
    "File JSON mẫu đầy đủ cú pháp đặc biệt: Công thức toán học (KaTeX $ và $$), khối mã code syntax highlighting, bảng Markdown, và đầy đủ 5 dạng câu hỏi.",
  topics: ["Hàm số", "Thuật toán", "Hình học không gian", "Giải tích"],
  settings: {
    time_limit_minutes: 45,
    shuffle_questions: true,
    shuffle_options: true,
    score_scale: 10,
  },
  questions: [
    {
      client_id: "q1",
      type: "single_choice",
      prompt: [
        {
          type: "text",
          value:
            "Cho parabol $(P)$ có hàm số bậc hai: $f(x) = x^2 - 4x + 3$. Tọa độ đỉnh $I(x_I; y_I)$ của parabol là:",
        },
        {
          type: "math",
          value: "x_I = -\\frac{b}{2a}, \\quad y_I = f(x_I)",
        },
      ],
      options: [
        { id: "a", content: [{ type: "text", value: "$I(2; -1)$" }] },
        { id: "b", content: [{ type: "text", value: "$I(-2; 1)$" }] },
        { id: "c", content: [{ type: "text", value: "$I(1; 0)$" }] },
        { id: "d", content: [{ type: "text", value: "$I(4; 3)$" }] },
      ],
      answer: { correct_option_ids: ["a"] },
      explanation: [
        {
          type: "text",
          value:
            "Áp dụng công thức đỉnh: hoành độ $x_I = -\\frac{-4}{2 \\cdot 1} = 2$. Thay $x = 2$ vào hàm số: $y_I = 2^2 - 4(2) + 3 = 4 - 8 + 3 = -1$. Vậy tọa độ đỉnh là $I(2; -1)$.",
        },
      ],
      points: 2,
      difficulty: "easy",
      tags: ["Hàm số", "Parabol"],
    },
    {
      client_id: "q2",
      type: "multiple_choice",
      prompt: [
        {
          type: "text",
          value:
            "Quan sát đoạn mã Python lọc số nguyên chẵn từ mảng và bảng phân tích bên dưới:",
        },
        {
          type: "code",
          language: "python",
          value:
            "def filter_evens(numbers):\n    # Lọc các phần tử chia hết cho 2\n    return [x for x in numbers if x % 2 == 0]\n\nresult = filter_evens([1, 2, 3, 4, 5, 6, 7, 8])\nprint(result)",
        },
        {
          type: "text",
          value:
            "| Đầu vào (Input) | Kết quả (Output) | Độ phức tạp |\n| :--- | :--- | :--- |\n| `[1, 2, 3, 4]` | `[2, 4]` | $O(n)$ |\n| `[1, 3, 5]` | `[]` | $O(n)$ |\n\nChọn các phát biểu **ĐÚNG** về hàm trên:",
        },
      ],
      options: [
        {
          id: "a",
          content: [
            {
              type: "text",
              value:
                "Đoạn mã in ra danh sách các số chẵn: `[2, 4, 6, 8]`.",
            },
          ],
        },
        {
          id: "b",
          content: [
            {
              type: "text",
              value:
                "Độ phức tạp thời gian của hàm là tuyến tính $O(n)$ theo độ dài mảng.",
            },
          ],
        },
        {
          id: "c",
          content: [
            {
              type: "text",
              value:
                "Biểu thức `x % 2 == 0` kiểm tra xem $x$ có phải là số lẻ không.",
            },
          ],
        },
        {
          id: "d",
          content: [
            {
              type: "text",
              value:
                "Cú pháp `[x for x in numbers if ...]` là List Comprehension trong Python.",
            },
          ],
        },
      ],
      answer: { correct_option_ids: ["a", "b", "d"], partial_credit: true },
      explanation: [
        {
          type: "text",
          value:
            "- Phương án **a** đúng: Các số chẵn là 2, 4, 6, 8.\n- Phương án **b** đúng: Duyệt qua mảng một lần nên độ phức tạp là $O(n)$.\n- Phương án **c** sai: Phép chia lấy dư cho 2 bằng 0 là kiểm tra số chẵn.\n- Phương án **d** đúng: Đây là cú pháp List Comprehension chuẩn trong Python.",
        },
      ],
      points: 2,
      difficulty: "medium",
      tags: ["Python", "Thuật toán"],
    },
    {
      client_id: "q3",
      type: "true_false",
      prompt: [
        {
          type: "text",
          value:
            "Xét tính Đúng / Sai của các mệnh đề hình học không gian sau:",
        },
      ],
      statements: [
        {
          id: "s1",
          content: [
            {
              type: "text",
              value:
                "Hai đường thẳng phân biệt cùng song song với một đường thẳng thứ ba thì song song với nhau: $a \\parallel c$ và $b \\parallel c \\implies a \\parallel b$.",
            },
          ],
          answer: true,
        },
        {
          id: "s2",
          content: [
            {
              type: "text",
              value:
                "Hai mặt phẳng phân biệt cùng vuông góc với một đường thẳng thì song song với nhau: $(P) \\perp d$ và $(Q) \\perp d \\implies (P) \\parallel (Q)$.",
            },
          ],
          answer: true,
        },
        {
          id: "s3",
          content: [
            {
              type: "text",
              value:
                "Hai đường thẳng chéo nhau trong không gian luôn có đúng một điểm chung.",
            },
          ],
          answer: false,
        },
        {
          id: "s4",
          content: [
            {
              type: "text",
              value:
                "Nếu đường thẳng $d$ vuông góc với hai đường thẳng cắt nhau trong $(P)$ thì $d \\perp (P)$.",
            },
          ],
          answer: true,
        },
      ],
      explanation: [
        {
          type: "text",
          value:
            "Hai đường thẳng chéo nhau là hai đường thẳng không cùng nằm trong bất kỳ mặt phẳng nào và **không có điểm chung**. Do đó mệnh đề s3 là Sai.",
        },
      ],
      points: 2,
      difficulty: "medium",
      tags: ["Hình học"],
    },
    {
      client_id: "q4",
      type: "short_answer",
      prompt: [
        {
          type: "text",
          value: "Tính giá trị của giới hạn lượng giác cơ bản sau:",
        },
        {
          type: "math",
          value: "L = \\lim_{x \\to 0} \\frac{\\sin(3x)}{x}",
        },
      ],
      answer: {
        accepted: ["3", "3.0", "3,0"],
        numeric_tolerance: 0.01,
      },
      explanation: [
        {
          type: "text",
          value:
            "Áp dụng công thức giới hạn đáng nhớ: $\\lim_{u \\to 0} \\frac{\\sin u}{u} = 1$.\nTa biến đổi: $\\lim_{x \\to 0} 3 \\cdot \\frac{\\sin(3x)}{3x} = 3 \\cdot 1 = 3$.",
        },
      ],
      points: 2,
      difficulty: "easy",
      tags: ["Giới hạn", "Giải tích"],
    },
    {
      client_id: "q5",
      type: "essay",
      prompt: [
        {
          type: "text",
          value:
            "Trình bày phương pháp chứng minh định lý Pythagoras trong tam giác vuông $ABC$ vuông tại $A$:\n$$a^2 = b^2 + c^2$$\n(Nêu vắn tắt các bước dựng hình và lập luận diện tích).",
        },
      ],
      rubric:
        "- Dựng hình vuông cạnh (b + c) chứa 4 tam giác vuông (1.0 điểm)\n- Tính diện tích hình vuông lớn theo hai cách (0.5 điểm)\n- Khai triển $(b+c)^2 = 4 \\cdot (\\frac{1}{2}bc) + a^2$ và suy ra $a^2 = b^2 + c^2$ (0.5 điểm)",
      explanation: [
        {
          type: "text",
          value:
            "Lời giải tham khảo: Dựng hình vuông lớn cạnh $b + c$. Diện tích hình vuông lớn bằng tổng diện tích 4 tam giác vuông bằng nhau và hình vuông ở giữa có cạnh $a$:\n$$(b+c)^2 = 4 \\cdot \\left(\\frac{1}{2}bc\\right) + a^2 \\iff b^2 + 2bc + c^2 = 2bc + a^2 \\iff a^2 = b^2 + c^2$$",
        },
      ],
      points: 2,
      difficulty: "hard",
      tags: ["Hình học", "Tự luận"],
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

export interface DocumentItem {
  id: string;
  title: string;
  description: string;
  subject: string;
  grade: string;
  category: "theory" | "outline" | "mindmap" | "exercise" | string;
  file_name: string;
  mime_type: string;
  file_size: number;
  thumbnail_url?: string;
  views_count: number;
  downloads_count: number;
  status: "published" | "draft" | "archived";
  author_name: string;
  created_at: string;
  updated_at: string;
}

export const documentCategories: Record<string, string> = {
  theory: "Lý thuyết trọng tâm",
  outline: "Đề cương ôn tập",
  mindmap: "Sơ đồ tư duy",
  exercise: "Chuyên đề bài tập",
};

