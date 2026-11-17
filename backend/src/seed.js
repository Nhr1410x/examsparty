import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";

const text = (value) => [{ type: "text", value }];
const choice = (
  client_id,
  prompt,
  options,
  correct,
  explanation,
  type = "single_choice",
) => ({
  client_id,
  type,
  prompt: text(prompt),
  options: options.map((value, i) => ({
    id: String.fromCharCode(97 + i),
    content: text(value),
  })),
  answer: { correct_option_ids: correct },
  explanation: text(explanation),
  points: 1,
  difficulty: "medium",
  tags: [],
});
export const sampleExam = {
  schema_version: "1.0",
  title: "Mệnh đề & Tập hợp — Nắm chắc nền tảng",
  subject: "Toán học",
  grade: "10",
  topics: ["Mệnh đề", "Tập hợp"],
  description:
    "Củng cố kiến thức đầu năm với những câu hỏi từ cơ bản đến vận dụng. Đọc kỹ từng nhận định và thử sức cùng các dạng câu hỏi khác nhau.",
  settings: {
    time_limit_minutes: 20,
    shuffle_questions: true,
    shuffle_options: true,
    score_scale: 10,
  },
  questions: [
    choice(
      "q1",
      "Trong các câu sau, câu nào là một mệnh đề đúng?",
      [
        "Số 2 là số nguyên tố.",
        "Hôm nay đẹp quá!",
        "Bạn đã làm bài chưa?",
        "Mọi số tự nhiên đều là số chẵn.",
      ],
      ["a"],
      "2 chỉ có hai ước dương là 1 và 2, nên 2 là số nguyên tố.",
    ),
    choice(
      "q2",
      "Chọn tất cả các số thuộc tập hợp số nguyên tố.",
      ["2", "3", "4", "5", "9"],
      ["a", "b", "d"],
      "2, 3 và 5 là các số nguyên tố; 4 và 9 là hợp số.",
      "multiple_choice",
    ),
    {
      client_id: "q3",
      type: "true_false",
      prompt: text("Xét tính đúng sai của các khẳng định về tập hợp."),
      statements: [
        {
          id: "s1",
          content: text("Tập rỗng là tập con của mọi tập hợp."),
          answer: true,
        },
        {
          id: "s2",
          content: text("Hai tập hợp bằng nhau khi chúng có cùng số phần tử."),
          answer: false,
        },
      ],
      points: 2,
      difficulty: "medium",
      tags: ["Tập hợp"],
      explanation: text(
        "Tập rỗng luôn là tập con. Hai tập bằng nhau phải chứa đúng các phần tử giống nhau, không chỉ cùng số lượng.",
      ),
    },
    {
      client_id: "q4",
      type: "short_answer",
      prompt: [
        {
          type: "text",
          value:
            "Cho A = {1, 2, 3}, B = {2, 3, 4, 5}. Số phần tử của hợp hai tập là bao nhiêu?",
        },
        { type: "math", value: "|A \\cup B| = ?" },
      ],
      answer: { accepted: ["5", "năm"], case_sensitive: false },
      points: 1,
      difficulty: "easy",
      tags: ["Tập hợp"],
      explanation: text("A ∪ B = {1, 2, 3, 4, 5}, có 5 phần tử."),
    },
    choice(
      "q5",
      "Phủ định của mệnh đề “Mọi số tự nhiên đều là số chẵn” là:",
      [
        "Mọi số tự nhiên đều là số lẻ.",
        "Có ít nhất một số tự nhiên không phải số chẵn.",
        "Không có số tự nhiên nào là số chẵn.",
        "Có ít nhất một số tự nhiên là số chẵn.",
      ],
      ["b"],
      "Phủ định của “mọi” là “tồn tại ít nhất một”, đồng thời phủ định tính chất.",
    ),
    choice(
      "q6",
      "Cho A = {1, 2, 3} và B = {3, 4}. Tập A ∩ B là:",
      ["{1, 2, 3, 4}", "{1, 2}", "{3}", "{4}"],
      ["c"],
      "Giao của hai tập chỉ chứa phần tử thuộc cả hai tập: số 3.",
    ),
  ],
};

export const seedExams = [
  sampleExam,
  {
    ...sampleExam,
    title: "Hàm số bậc hai và đồ thị",
    topics: ["Hàm số"],
    description:
      "Ôn tập đỉnh parabol, trục đối xứng và các phép tính với hàm số bậc hai.",
    questions: [
      choice(
        "q1",
        "Đồ thị hàm số y = x² có đỉnh tại đâu?",
        ["(0; 0)", "(1; 0)", "(0; 1)", "(1; 1)"],
        ["a"],
        "Hàm y = x² đạt giá trị nhỏ nhất 0 tại x = 0.",
      ),
      choice(
        "q2",
        "Trục đối xứng của parabol y = x² − 4x + 3 là:",
        ["x = 1", "x = 2", "x = 3", "y = 2"],
        ["b"],
        "Trục đối xứng x = −b/(2a) = 4/2 = 2.",
      ),
    ],
  },
  {
    ...sampleExam,
    title: "Chuyển động thẳng — Từ lý thuyết đến vận dụng",
    subject: "Vật lý",
    grade: "10",
    topics: ["Động học"],
    description:
      "Tốc độ, vận tốc và quãng đường. Hiểu bản chất để giải bài chính xác.",
    questions: [
      choice(
        "q1",
        "Đơn vị SI của vận tốc là gì?",
        ["m/s", "km/h", "m/s²", "N"],
        ["a"],
        "Đơn vị độ dài SI là mét, thời gian là giây, nên vận tốc là m/s.",
      ),
      {
        client_id: "q2",
        type: "short_answer",
        prompt: text(
          "Một xe đi đều với tốc độ 10 m/s trong 5 giây. Quãng đường đi được là bao nhiêu mét?",
        ),
        answer: { accepted: ["50"], numeric_tolerance: 0 },
        explanation: text("s = v × t = 10 × 5 = 50 m."),
        points: 1,
        difficulty: "easy",
        tags: [],
      },
    ],
  },
  {
    ...sampleExam,
    title: "English essentials: Present tenses",
    subject: "Tiếng Anh",
    grade: "11",
    topics: ["Ngữ pháp"],
    description:
      "Phân biệt hiện tại đơn và hiện tại tiếp diễn qua các tình huống quen thuộc.",
    questions: [
      choice(
        "q1",
        "She ___ to school every day.",
        ["go", "goes", "going", "gone"],
        ["b"],
        "Chủ ngữ she ở hiện tại đơn: động từ thêm -s/-es.",
      ),
      choice(
        "q2",
        "Look! The children ___ in the garden.",
        ["play", "plays", "are playing", "played"],
        ["c"],
        "“Look!” báo hiệu hành động đang xảy ra, dùng hiện tại tiếp diễn.",
      ),
    ],
  },
  {
    ...sampleExam,
    title: "Python cơ bản: Đọc hiểu đoạn mã",
    subject: "Tin học",
    grade: "10",
    topics: ["Python", "Lập trình"],
    description:
      "Luyện tư duy lập trình với biến, phép toán và vòng lặp Python.",
    questions: [
      {
        ...choice(
          "q1",
          "Đoạn mã sau in ra kết quả nào?",
          ["6", "3", "123", "Lỗi cú pháp"],
          ["a"],
          "sum([1, 2, 3]) trả về tổng 1 + 2 + 3 = 6.",
        ),
        prompt: [
          ...text("Đoạn mã sau in ra kết quả nào?"),
          {
            type: "code",
            language: "python",
            value: "numbers = [1, 2, 3]\nprint(sum(numbers))",
          },
        ],
      },
      choice(
        "q2",
        "Kiểu dữ liệu nào biểu diễn một danh sách trong Python?",
        ["str", "list", "int", "bool"],
        ["b"],
        "list là kiểu dữ liệu danh sách trong Python.",
      ),
    ],
  },
  {
    ...sampleExam,
    title: "Viết đoạn văn nghị luận xã hội",
    subject: "Ngữ văn",
    grade: "12",
    topics: ["Nghị luận"],
    description:
      "Rèn khả năng lập luận và trình bày quan điểm. Câu tự luận được lưu ở trạng thái chờ chấm.",
    questions: [
      {
        client_id: "q1",
        type: "essay",
        prompt: text(
          "Viết một đoạn văn khoảng 200 chữ về vai trò của tinh thần tự học đối với người trẻ.",
        ),
        rubric: "Luận điểm rõ, có dẫn chứng phù hợp, diễn đạt mạch lạc.",
        points: 10,
        difficulty: "medium",
        tags: ["Nghị luận"],
        explanation: text(
          "Gợi ý: giải thích tự học, phân tích vai trò, đưa dẫn chứng và rút ra bài học. Bài viết cần người chấm đánh giá.",
        ),
      },
    ],
  },
];

export async function seed(db, config) {
  if (config.adminEmail && config.adminPassword) {
    const existing = await db.query("SELECT id FROM users WHERE email=$1", [
      config.adminEmail.toLowerCase(),
    ]);
    if (!existing.rowCount)
      await db.query(
        "INSERT INTO users (id,email,password_hash,role,status) VALUES ($1,$2,$3,$4,$5)",
        [
          randomUUID(),
          config.adminEmail.toLowerCase(),
          await bcrypt.hash(config.adminPassword, 12),
          "admin",
          "active",
        ],
      );
  }
  if (
    config.seedDemo &&
    !(await db.query("SELECT id FROM exams LIMIT 1")).rowCount
  ) {
    for (const exam of seedExams) {
      const examId = randomUUID();
      await db.query(
        "INSERT INTO exams (id,title,subject,grade,description,content,status) VALUES ($1,$2,$3,$4,$5,$6,$7)",
        [
          examId,
          exam.title,
          exam.subject,
          exam.grade,
          exam.description,
          JSON.stringify(exam),
          "published",
        ],
      );
      for (let i = 0; i < exam.questions.length; i++) {
        const qid = randomUUID();
        await db.query(
          "INSERT INTO questions (id,content,status) VALUES ($1,$2,$3)",
          [qid, JSON.stringify(exam.questions[i]), "published"],
        );
        await db.query(
          "INSERT INTO exam_questions (exam_id,question_id,position) VALUES ($1,$2,$3)",
          [examId, qid, i],
        );
      }
    }
  }
}
