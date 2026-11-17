import { FormEvent, useEffect, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowRight,
  Search,
  BookOpen,
  Clock3,
  FileQuestion,
  Check,
  TrendingUp,
  SlidersHorizontal,
  GraduationCap,
  Play,
  Timer,
  ChevronLeft,
  ChevronRight,
  Code2,
  Languages,
  Atom,
  Calculator,
  Feather,
} from "lucide-react";
import { api, date, useLoad } from "./api";
import {
  Blocks,
  Empty,
  ErrorMessage,
  ExamTile,
  getSubjectTone,
  Loading,
  Notice,
  AnswerInput,
} from "./components";
import {
  ExamCard,
  ExamContent,
  Question,
  Recent,
  Attempt,
  Response,
  typeLabels,
} from "./types";

interface Catalog {
  subjects: string[];
  grades: string[];
  topics: string[];
  exams: number;
  questions: number;
}
export function Home() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const {
    data: exams,
    error,
    loading,
  } = useLoad<{ items: ExamCard[]; total: number }>("/exams?limit=6");
  const { data: catalog } = useLoad<Catalog>("/catalog");
  const { data: recent } = useLoad<{ items: Recent[] }>("/attempts");
  const subjects = [
    { name: "Toán học", icon: Calculator, tone: "green" },
    { name: "Vật lý", icon: Atom, tone: "blue" },
    { name: "Tiếng Anh", icon: Languages, tone: "purple" },
    { name: "Ngữ văn", icon: Feather, tone: "amber" },
    { name: "Tin học", icon: Code2, tone: "pink" },
  ];
  const completed = recent?.items.filter((r) => r.status === "submitted") || [];
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <h2>
            Kho đề & Luyện thi <span>trắc nghiệm</span>
          </h2>
          <p>
            Ngân hàng đề thi chuẩn hóa, tự động chấm điểm và xem lời giải từng bước.
          </p>
          <form
            className="hero-search"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              navigate(`/exams?q=${encodeURIComponent(query)}`);
            }}
          >
            <Search size={18} />
            <input
              aria-label="Tìm kiếm đề ôn tập"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm theo môn học, chủ đề hoặc tên đề thi…"
            />
            <button type="submit" className="button-step-press">
              Tìm đề <ArrowRight size={16} />
            </button>
          </form>
          <div className="quick-tags">
            <span className="quick-label">Môn học:</span>
            {["Toán học", "Vật lý", "Hóa học", "Tiếng Anh", "Tin học"].map((s) => (
              <Link key={s} to={`/exams?subject=${encodeURIComponent(s)}`} className="quick-tag">
                {s}
              </Link>
            ))}
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="craft-mockup card-hover-lift">
            <div className="craft-mockup-header">
              <div className="craft-tags">
                <span className="craft-badge craft-emerald">
                  <BookOpen size={12} /> Toán học 12
                </span>
                <span className="craft-badge craft-indigo">
                  <Clock3 size={12} /> 45:00
                </span>
              </div>
              <span className="craft-status">
                <span className="online-dot" /> Trực tiếp
              </span>
            </div>
            <div className="craft-question-meta">
              <span>CÂU 12 / 50</span>
              <span className="craft-level">Vận dụng</span>
            </div>
            <div className="craft-question-body">
              Cho hàm số <code>y = f(x)</code> có đạo hàm liên tục trên ℝ. Số điểm cực trị của hàm số là:
            </div>
            <div className="craft-options">
              <div className="craft-opt">
                <span className="craft-key">A</span>
                <span>x = 0</span>
              </div>
              <div className="craft-opt selected">
                <span className="craft-key">B</span>
                <span>x = 2</span>
                <Check size={14} className="craft-check" />
              </div>
              <div className="craft-opt">
                <span className="craft-key">C</span>
                <span>x = -1</span>
              </div>
              <div className="craft-opt">
                <span className="craft-key">D</span>
                <span>Không có cực trị</span>
              </div>
            </div>
            <div className="craft-footer">
              <div className="craft-progress-track">
                <div className="craft-progress-fill" style={{ width: "72%" }} />
              </div>
              <div className="craft-footer-meta">
                <span>Tiến độ: 36/50 câu</span>
                <strong>98.4% chính xác</strong>
              </div>
            </div>
          </div>
        </div>
      </section>
      <div className="stats-grid">
        <Stat
          icon={LibraryIcon}
          value={catalog?.exams ?? "—"}
          label="Đề thi có sẵn"
        />
        <Stat
          icon={FileQuestion}
          value={catalog?.questions ?? "—"}
          label="Ngân hàng câu hỏi"
        />
        <Stat
          icon={GraduationCap}
          value={catalog?.subjects.length ?? "—"}
          label="Môn học"
        />
        <Stat
          icon={TrendingUp}
          value={completed.length}
          label="Bài đã làm"
        />
      </div>
      <section className="subject-section">
        <div className="section-heading">
          <h2>Danh mục môn học</h2>
          <Link className="text-link" to="/exams">
            Tất cả môn học <ArrowRight size={15} />
          </Link>
        </div>
        <div className="subject-grid">
          {subjects.map((s) => (
            <Link
              to={`/exams?subject=${encodeURIComponent(s.name)}`}
              className="subject-tile card-hover-lift"
              key={s.name}
            >
              <span className={`subject-icon ${s.tone}`}>
                <s.icon size={22} />
              </span>
              <strong>{s.name}</strong>
              <ArrowRight size={15} />
            </Link>
          ))}
        </div>
      </section>
      <section>
        <div className="section-heading">
          <h2>Đề thi mới nhất</h2>
          <Link className="text-link" to="/exams">
            Xem toàn bộ kho đề <ArrowRight size={15} />
          </Link>
        </div>
        <ErrorMessage error={error} />
        {loading ? (
          <Loading />
        ) : exams?.items.length ? (
          <div className="exam-grid">
            {exams.items.map((e) => (
              <ExamTile exam={e} key={e.id} />
            ))}
          </div>
        ) : (
          <Empty />
        )}
      </section>
    </>
  );
}
const LibraryIcon = BookOpen;
export function Privacy() {
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Thông tin riêng tư</h1>
          <p>Dữ liệu được sử dụng khi bạn học và đóng góp nội dung.</p>
        </div>
      </div>
      <div className="panel">
        <h2>Khi bạn luyện tập và thi thử</h2>
        <p>
          Bạn không cần tạo tài khoản. Máy chủ lưu nội dung phiên, câu trả lời,
          kết quả và thời điểm làm bài. Cookie bảo mật nhận diện trình duyệt có
          thời hạn 30 ngày; quyền quản trị, nếu đăng nhập, hết hạn sau 8 giờ.
        </p>
        <p>
          Trình duyệt lưu giao diện sáng/tối, bản nháp câu trả lời chưa đồng bộ,
          vị trí câu và dấu cần ôn. Xóa cookie sẽ làm mất quyền truy cập lịch sử
          của trình duyệt; thao tác này không tự xóa các bản ghi trên máy chủ.
        </p>
        <h2>Khi bạn đóng góp học liệu</h2>
        <p>
          Email liên hệ và nội dung gửi được lưu để quản trị viên kiểm tra.
          Email không xuất hiện trong kho đề công khai. Nội dung và ảnh được
          công khai khi được duyệt hoặc xuất bản bởi quản trị viên. Hãy bảo đảm
          bạn có quyền chia sẻ và không đưa dữ liệu cá nhân vào đề.
        </p>
        <p>
          Mã theo dõi cho phép xem trạng thái, truy cập ảnh của nội dung đó và
          gửi bản sửa khi được yêu cầu. Giữ mã như mật khẩu; người có mã có thể
          truy cập các thông tin này.
        </p>
        <h2>Lưu giữ và yêu cầu xử lý dữ liệu</h2>
        <p>
          Dữ liệu máy chủ được giữ để phục vụ lịch sử làm bài, kiểm duyệt và
          nhật ký quản trị. Hiện chưa có chức năng tự động xóa dữ liệu hoặc xóa
          tài khoản tự phục vụ. Nếu cần xử lý dữ liệu đã gửi, liên hệ quản trị
          viên của đơn vị vận hành và cung cấp mã theo dõi hoặc mã phiên liên
          quan; không cung cấp mật khẩu.
        </p>
        <Notice>
          Trong bản demo cục bộ, dữ liệu máy chủ chỉ nằm trong bộ nhớ và mất khi
          khởi động lại. Bản nháp trong trình duyệt vẫn còn cho tới khi bạn xóa
          dữ liệu trang.
        </Notice>
      </div>
    </>
  );
}
function Stat({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof BookOpen;
  value: string | number;
  label: string;
}) {
  return (
    <div className="stat card-hover-lift">
      <span className="stat-icon">
        <Icon size={21} />
      </span>
      <div>
        <strong>{value}</strong>
        <p>{label}</p>
      </div>
    </div>
  );
}

export function Library() {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") || "");
  const { data, error, loading } = useLoad<{
    items: ExamCard[];
    total: number;
    page: number;
    limit: number;
  }>(`/exams?${params}`);
  const { data: catalog } = useLoad<Catalog>("/catalog");
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    setParams(next);
  };
  useEffect(() => setQuery(params.get("q") || ""), [params]);
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Kho đề ôn tập</h1>
        </div>
        <span className="count-label">{data?.total ?? "—"} đề</span>
      </div>
      <form
        className="search-box"
        onSubmit={(e) => {
          e.preventDefault();
          update("q", query);
        }}
      >
        <Search size={21} />
        <input
          aria-label="Tìm tên đề hoặc nội dung"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm tên đề hoặc nội dung bạn muốn ôn…"
        />
        <button className="button" type="submit">
          Tìm kiếm
        </button>
      </form>
      <div className="filters panel">
        <div className="row">
          <SlidersHorizontal size={18} />
          <strong>Bộ lọc</strong>
        </div>
        <div className="filter-grid">
          <label className="field">
            Môn học
            <select
              value={params.get("subject") || ""}
              onChange={(e) => update("subject", e.target.value)}
            >
              <option value="">Tất cả môn học</option>
              {catalog?.subjects.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Chủ đề
            <select
              value={params.get("topic") || ""}
              onChange={(e) => update("topic", e.target.value)}
            >
              <option value="">Tất cả chủ đề</option>
              {catalog?.topics.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Dạng câu
            <select
              value={params.get("type") || ""}
              onChange={(e) => update("type", e.target.value)}
            >
              <option value="">Mọi dạng câu</option>
              {Object.entries(typeLabels).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Mức độ
            <select
              value={params.get("difficulty") || ""}
              onChange={(e) => update("difficulty", e.target.value)}
            >
              <option value="">Mọi mức độ</option>
              <option value="easy">Cơ bản</option>
              <option value="medium">Thông hiểu</option>
              <option value="hard">Vận dụng</option>
            </select>
          </label>
          <label className="field">
            Thời lượng tối đa
            <select
              value={params.get("max_minutes") || ""}
              onChange={(e) => update("max_minutes", e.target.value)}
            >
              <option value="">Không giới hạn</option>
              {[15, 30, 45, 60].map((n) => (
                <option key={n} value={n}>
                  {n} phút
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Số câu tối thiểu
            <input
              type="number"
              min="1"
              max="200"
              value={params.get("min_questions") || ""}
              onChange={(e) => update("min_questions", e.target.value)}
              placeholder="Bất kỳ"
            />
          </label>
        </div>
        {params.size > 0 && (
          <button className="text-button" onClick={() => setParams({})}>
            Xóa bộ lọc
          </button>
        )}
      </div>
      <ErrorMessage error={error} />
      {loading ? (
        <Loading />
      ) : data?.items.length ? (
        <>
          <div className="exam-grid">
            {data.items.map((e) => (
              <ExamTile key={e.id} exam={e} />
            ))}
          </div>
          <Pagination
            page={data.page}
            hasNext={data.page * data.limit < data.total}
            onChange={(page) => {
              const next = new URLSearchParams(params);
              next.set("page", String(page));
              setParams(next);
            }}
          />
        </>
      ) : (
        <Empty />
      )}
    </>
  );
}
export function Pagination({
  page,
  hasNext,
  onChange,
}: {
  page: number;
  hasNext: boolean;
  onChange: (page: number) => void;
}) {
  return (
    <div className="pagination">
      <button
        className="button secondary small"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        <ChevronLeft size={16} />
        Trước
      </button>
      <span>Trang {page}</span>
      <button
        className="button secondary small"
        disabled={!hasNext}
        onClick={() => onChange(page + 1)}
      >
        Sau
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

export function Detail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    data: exam,
    error,
    loading,
  } = useLoad<ExamCard & { content: ExamContent }>(`/exams/${id}`);
  const [busy, setBusy] = useState(false),
    [issue, setIssue] = useState<unknown>(null),
    [confirm, setConfirm] = useState(false),
    [report, setReport] = useState(""),
    [reported, setReported] = useState(false);
  async function start(mode: "practice" | "exam") {
    setBusy(true);
    setIssue(null);
    try {
      const attempt = await api<Attempt>("/attempts", "POST", {
        exam_id: id,
        mode,
      });
      navigate(`/attempts/${attempt.id}`);
    } catch (e) {
      setIssue(e);
    } finally {
      setBusy(false);
    }
  }
  if (loading) return <Loading />;
  if (error || !exam) return <ErrorMessage error={error} />;
  return (
    <>
      <Link className="back-link" to="/exams">
        <ChevronLeft size={16} />
        Quay lại kho đề
      </Link>
      <div className="detail-grid">
        <div>
          <span className={`subject-pill subject-${getSubjectTone(exam.subject)}`}>
            <span className="subject-dot" />
            {exam.subject}
          </span>
          <h1 className="detail-title">{exam.title}</h1>
          <div className="detail-facts panel">
            <div>
              <FileQuestion />
              <strong>{exam.question_count}</strong>
              <span>Câu hỏi</span>
            </div>
            <div>
              <Clock3 />
              <strong>{exam.time_limit_minutes} phút</strong>
              <span>Thời gian thi</span>
            </div>
            <div>
              <GraduationCap />
              <strong>10 điểm</strong>
              <span>Thang điểm</span>
            </div>
          </div>
          <h2>Nội dung trong đề</h2>
          <div className="panel preview-list">
            {exam.content.questions.map((q, i) => (
              <div key={q.client_id}>
                <span className="question-label">
                  CÂU {i + 1} · {typeLabels[q.type]} · {q.points} điểm
                </span>
                <Blocks blocks={q.prompt} />
              </div>
            ))}
          </div>
          <details className="panel report">
            <summary>Báo lỗi nội dung đề</summary>
            {reported ? (
              <Notice>
                Đã gửi báo lỗi. Cảm ơn bạn đã góp phần cải thiện học liệu.
              </Notice>
            ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    await api(`/exams/${id}/report`, "POST", {
                      message: report,
                    });
                    setReported(true);
                  } catch (e) {
                    setIssue(e);
                  }
                }}
              >
                <label className="field">
                  Nội dung cần kiểm tra
                  <textarea
                    minLength={10}
                    maxLength={2000}
                    required
                    value={report}
                    onChange={(e) => setReport(e.target.value)}
                  />
                </label>
                <button className="button secondary">Gửi báo lỗi</button>
              </form>
            )}
          </details>
        </div>
        <aside className="mode-panel panel">
          <h2>Chọn chế độ làm bài</h2>
          <div className="mode-option">
            <span className="subject-icon green">
              <BookOpen />
            </span>
            <h3>Luyện tập</h3>
            <p>
              Không áp lực thời gian. Hiểu từng câu qua đáp án và lời giải ngay
              sau khi kiểm tra.
            </p>
            <ul>
              <li>Giữ nguyên thứ tự câu và phương án</li>
              <li>Tự động lưu, tiếp tục bất cứ lúc nào</li>
              <li>Kết thúc sớm khi bạn muốn</li>
            </ul>
            <button
              className="button full"
              disabled={busy}
              onClick={() => void start("practice")}
            >
              <Play size={17} />
              Bắt đầu luyện tập
            </button>
          </div>
          <div className="mode-option">
            <span className="subject-icon amber">
              <Timer />
            </span>
            <h3>Thi thử</h3>
            <p>Làm quen áp lực phòng thi và đánh giá kiến thức của bạn.</p>
            <ul>
              <li>
                {exam.content.settings.shuffle_questions
                  ? "Trộn câu hỏi"
                  : "Giữ thứ tự câu hỏi"}{" "}
                ·{" "}
                {exam.content.settings.shuffle_options
                  ? "trộn phương án"
                  : "giữ thứ tự phương án"}
              </li>
              <li>Không tạm dừng; tự nộp khi hết giờ</li>
              <li>Chỉ xem đáp án sau khi nộp</li>
            </ul>
            <button
              className="button secondary full"
              disabled={busy}
              onClick={() => setConfirm(true)}
            >
              Bắt đầu thi thử <ArrowRight size={17} />
            </button>
          </div>
          {confirm && (
            <div className="confirm-box" role="alert">
              <strong>
                Bạn có {exam.time_limit_minutes} phút cho {exam.question_count}{" "}
                câu.
              </strong>
              <p>
                Điểm = điểm đạt / tổng điểm × 10. Câu tự luận cần người chấm.
                Đồng hồ chạy ngay sau khi xác nhận.
              </p>
              <div className="row">
                <button
                  className="button small"
                  disabled={busy}
                  onClick={() => void start("exam")}
                >
                  Xác nhận thi
                </button>
                <button
                  className="button secondary small"
                  onClick={() => setConfirm(false)}
                >
                  Để sau
                </button>
              </div>
            </div>
          )}
          <ErrorMessage error={issue} />
        </aside>
      </div>
    </>
  );
}

export function RecentPage() {
  const { data, error, loading } = useLoad<{ items: Recent[] }>("/attempts");
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Bài làm gần đây</h1>
        </div>
      </div>
      <ErrorMessage error={error} />
      {loading ? (
        <Loading />
      ) : data?.items.length ? (
        <div className="recent-list">
          {data.items.map((r) => (
            <Link
              className="recent-item panel"
              key={r.id}
              to={`/attempts/${r.id}${r.status === "submitted" ? "/results" : ""}`}
            >
              <span className="subject-icon green">
                {r.mode === "practice" ? <BookOpen /> : <Timer />}
              </span>
              <div>
                <h3>{r.title}</h3>
                <p>
                  {r.mode === "practice" ? "Luyện tập" : "Thi thử"} ·{" "}
                  {date(r.started_at)}
                </p>
              </div>
              <span className="badge">
                {r.status === "submitted"
                  ? `${r.score ?? "—"}/10`
                  : r.mode === "exam" &&
                    r.expires_at &&
                    new Date(r.expires_at) < new Date()
                    ? "Đã hết giờ"
                    : "Tiếp tục học"}
              </span>
              <ArrowRight size={18} />
            </Link>
          ))}
        </div>
      ) : (
        <Empty text="Hành trình của bạn bắt đầu từ một đề nhỏ." />
      )}
    </>
  );
}

export function Questions() {
  const [query, setQuery] = useState(""),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [answers, setAnswers] = useState<Record<string, Response>>({});
  const { data, error, loading } = useLoad<{
    items: (Question & { id: string })[];
  }>(`/questions?q=${encodeURIComponent(search)}&page=${page}`);
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Ngân hàng câu hỏi</h1>
        </div>
        <Link className="button secondary" to="/exams">
          Luyện theo đề <ArrowRight size={16} />
        </Link>
      </div>
      <form
        className="search-box"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(query);
          setPage(1);
        }}
      >
        <Search />
        <input
          aria-label="Tìm câu hỏi"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm câu hỏi theo nội dung…"
        />
        <button className="button">Tìm kiếm</button>
      </form>
      <ErrorMessage error={error} />
      {loading ? (
        <Loading />
      ) : data?.items.length ? (
        <>
          <div className="question-bank">
            {data.items.map((q, i) => (
              <article className="panel" key={q.id}>
                <div className="row between">
                  <span className="question-label">
                    CÂU {(page - 1) * 12 + i + 1}
                  </span>
                  <span className="badge">{typeLabels[q.type]}</span>
                </div>
                <Blocks blocks={q.prompt} />
                <AnswerInput
                  question={q}
                  value={answers[q.id]}
                  onChange={(v) => setAnswers({ ...answers, [q.id]: v })}
                />
              </article>
            ))}
          </div>
          <Pagination
            page={page}
            hasNext={data.items.length === 12}
            onChange={setPage}
          />
        </>
      ) : (
        <Empty />
      )}
    </>
  );
}
