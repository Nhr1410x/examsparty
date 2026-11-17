import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock3,
  Flag,
  RotateCcw,
  Send,
  Search,
  Save,
  BookOpen,
  X,
  AlertCircle,
} from "lucide-react";
import { api, ApiError, useLoad } from "./api";
import {
  AnswerInput,
  Badge,
  Blocks,
  Empty,
  ErrorMessage,
  Feedback,
  Loading,
  Notice,
} from "./components";
import { Attempt, Response, typeLabels } from "./types";

function readLocal<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}
function writeLocal(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Browser storage can be disabled; server saves still work. */
  }
}
const answered = (v: Response | undefined) =>
  v !== undefined &&
  v !== null &&
  (typeof v === "string"
    ? v.trim() !== ""
    : Array.isArray(v)
      ? v.length > 0
      : Object.keys(v).length > 0);
export function Player() {
  const { id } = useParams();
  const { data, error, loading } = useLoad<Attempt>(`/attempts/${id}`);
  if (loading) return <Loading />;
  if (error || !data) return <ErrorMessage error={error} />;
  return <PlayerSession key={data.id} initial={data} />;
}
function PlayerSession({ initial }: { initial: Attempt }) {
  const navigate = useNavigate(),
    id = initial.id;
  const [attempt, setAttempt] = useState(initial),
    [responses, setResponses] = useState<Record<string, Response>>({
      ...initial.responses,
      ...readLocal<Record<string, Response>>(`ep-drafts-${id}`, {}),
    }),
    [index, setIndex] = useState(
      Math.min(
        readLocal<number>(`ep-index-${id}`, 0),
        initial.snapshot.questions.length - 1,
      ),
    ),
    [flags, setFlags] = useState<string[]>(readLocal(`ep-flags-${id}`, [])),
    [status, setStatus] = useState("Đã lưu"),
    [issue, setIssue] = useState<unknown>(null),
    [confirm, setConfirm] = useState(false),
    [submitting, setSubmitting] = useState(false),
    [now, setNow] = useState(Date.now());
  const pending = useRef<Record<string, Response>>(
      readLocal(`ep-drafts-${id}`, {}),
    ),
    saving = useRef<Promise<boolean> | null>(null),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    mounted = useRef(true),
    submissionLock = useRef(false);
  const offset = useRef(new Date(initial.server_time).getTime() - Date.now());
  const q = attempt.snapshot.questions[index];
  const remaining = attempt.expires_at
    ? Math.max(
        0,
        Math.ceil(
          (new Date(attempt.expires_at).getTime() - now - offset.current) /
            1000,
        ),
      )
    : null;
  const flush = useCallback(async (): Promise<boolean> => {
    if (saving.current) return saving.current;
    if (!Object.keys(pending.current).length) return true;
    saving.current = (async () => {
      try {
        while (Object.keys(pending.current).length) {
          const [key, value] = Object.entries(pending.current)[0];
          if (mounted.current) setStatus("Đang lưu…");
          const saved = await api<Attempt>(
            `/attempts/${id}/answers/${key}`,
            "PUT",
            { response: value },
          );
          if (JSON.stringify(pending.current[key]) === JSON.stringify(value))
            delete pending.current[key];
          writeLocal(`ep-drafts-${id}`, pending.current);
          if (mounted.current)
            setAttempt((previous) => ({
              ...previous,
              feedback: saved.feedback,
            }));
        }
        if (mounted.current) {
          setStatus("Đã lưu");
          setIssue(null);
        }
        return true;
      } catch (e) {
        if (mounted.current) {
          setStatus("Chưa đồng bộ — thử lại");
          setIssue(e);
        }
        if (e instanceof ApiError && e.status === 409) {
          const closed = (e.data as { attempt?: Attempt })?.attempt;
          if (closed?.status === "submitted") {
            pending.current = {};
            writeLocal(`ep-drafts-${id}`, {});
            navigate(`/attempts/${id}/results`, { replace: true });
          }
        }
        return false;
      } finally {
        saving.current = null;
      }
    })();
    return saving.current;
  }, [id, navigate]);
  useEffect(() => {
    mounted.current = true;
    if (initial.status === "submitted") {
      navigate(`/attempts/${id}/results`, { replace: true });
      return;
    }
    if (Object.keys(pending.current).length) void flush();
    const clock = setInterval(() => setNow(Date.now()), 1000);
    const online = () => void flush();
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (Object.keys(pending.current).length) {
        e.preventDefault();
      }
    };
    window.addEventListener("online", online);
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      mounted.current = false;
      clearInterval(clock);
      if (timer.current) clearTimeout(timer.current);
      window.removeEventListener("online", online);
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [flush, id, initial.status, navigate]);
  const submit = useCallback(
    async (expired = false) => {
      if (submissionLock.current) return;
      submissionLock.current = true;
      setSubmitting(true);
      setIssue(null);
      try {
        const saved = await flush();
        if (!saved && !expired)
          throw new Error(
            "Câu trả lời chưa được đồng bộ. Hãy thử lưu lại trước khi nộp.",
          );
        await api<Attempt>(`/attempts/${id}/submit`, "POST", {});
        pending.current = {};
        writeLocal(`ep-drafts-${id}`, {});
        navigate(`/attempts/${id}/results`, { replace: true });
      } catch (e) {
        setIssue(e);
      } finally {
        submissionLock.current = false;
        setSubmitting(false);
      }
    },
    [flush, id, navigate],
  );
  useEffect(() => {
    if (remaining === 0 && attempt.status === "active") void submit(true);
  }, [remaining, submit, attempt.status]);
  useEffect(() => {
    const online = () => {
      if (
        attempt.expires_at &&
        Date.now() + offset.current >= new Date(attempt.expires_at).getTime()
      )
        void submit(true);
    };
    window.addEventListener("online", online);
    return () => window.removeEventListener("online", online);
  }, [attempt.expires_at, submit]);
  function change(value: Response) {
    setResponses((previous) => ({ ...previous, [q.client_id]: value }));
    pending.current[q.client_id] = value;
    writeLocal(`ep-drafts-${id}`, pending.current);
    setStatus("Đang lưu…");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 500);
  }
  async function go(next: number) {
    await flush();
    setIndex(next);
    writeLocal(`ep-index-${id}`, next);
    setConfirm(false);
  }
  async function check() {
    if (!(await flush())) return;
    try {
      const saved = await api<Attempt>(
        `/attempts/${id}/answers/${q.client_id}`,
        "PUT",
        { response: responses[q.client_id] ?? null, check: true },
      );
      setAttempt(saved);
      setIssue(null);
    } catch (e) {
      setIssue(e);
    }
  }
  function flag() {
    const next = flags.includes(q.client_id)
      ? flags.filter((f) => f !== q.client_id)
      : [...flags, q.client_id];
    setFlags(next);
    writeLocal(`ep-flags-${id}`, next);
  }
  const answeredCount = attempt.snapshot.questions.filter((q) =>
    answered(responses[q.client_id]),
  ).length;
  return (
    <>
      <div className="player-heading">
        <div>
          <span className="eyebrow muted">
            {attempt.mode === "exam" ? "THI THỬ" : "LUYỆN TẬP"}
          </span>
          <h1>{attempt.snapshot.title}</h1>
          <div className="row wrap">
            <span className="save-state" role="status">
              <Save size={14} />
              {status}
            </span>
            <span className="muted small">
              {answeredCount}/{attempt.snapshot.questions.length} câu đã trả lời
            </span>
          </div>
        </div>
        {remaining !== null ? (
          <div
            className={`timer ${remaining < 60 ? "urgent" : ""}`}
            role="timer"
            aria-label="Thời gian còn lại"
          >
            <Clock3 size={22} />
            <div>
              <small>THỜI GIAN CÒN LẠI</small>
              <strong>
                {String(Math.floor(remaining / 60)).padStart(2, "0")}:
                {String(remaining % 60).padStart(2, "0")}
              </strong>
            </div>
          </div>
        ) : (
          <Link
            className="button secondary small"
            to="/recent"
            onClick={() => void flush()}
          >
            Lưu & tạm nghỉ
          </Link>
        )}
      </div>
      <div className="progress">
        <span
          style={{
            width: `${(answeredCount / attempt.snapshot.questions.length) * 100}%`,
          }}
        />
      </div>
      <div className="player-grid">
        <div>
          <article className="question-panel panel">
            <div className="row between">
              <span className="question-label">
                CÂU {index + 1} / {attempt.snapshot.questions.length}
              </span>
              <div className="row">
                <span className="badge">{typeLabels[q.type]}</span>
                <span className="small muted">{q.points} điểm</span>
                <button
                  className={`icon-button ${flags.includes(q.client_id) ? "flagged" : ""}`}
                  aria-label={
                    flags.includes(q.client_id)
                      ? "Bỏ đánh dấu"
                      : "Đánh dấu cần ôn"
                  }
                  aria-pressed={flags.includes(q.client_id)}
                  onClick={flag}
                >
                  <Flag size={18} />
                </button>
              </div>
            </div>
            <div className="question-content">
              <Blocks blocks={q.prompt} />
            </div>
            <AnswerInput
              question={q}
              value={responses[q.client_id]}
              onChange={change}
              disabled={
                Boolean(attempt.feedback[q.client_id]) ||
                submitting ||
                remaining === 0
              }
              feedback={attempt.feedback[q.client_id]}
            />
            {attempt.feedback[q.client_id] && (
              <Feedback q={attempt.feedback[q.client_id]} />
            )}
            <div className="question-actions">
              <button
                className="button secondary"
                disabled={index === 0 || submitting}
                onClick={() => void go(index - 1)}
              >
                <ArrowLeft size={16} />
                Câu trước
              </button>
              {attempt.mode === "practice" &&
                !attempt.feedback[q.client_id] && (
                  <button
                    className="button"
                    disabled={!answered(responses[q.client_id]) || submitting}
                    onClick={() => void check()}
                  >
                    <Check size={16} />
                    Kiểm tra
                  </button>
                )}
              <button
                className="button secondary"
                disabled={
                  index === attempt.snapshot.questions.length - 1 || submitting
                }
                onClick={() => void go(index + 1)}
              >
                Câu tiếp <ArrowRight size={16} />
              </button>
            </div>
          </article>
          <ErrorMessage error={issue} />
          {Boolean(issue) && (
            <button
              className="button secondary small"
              onClick={() => void flush()}
            >
              <RotateCcw size={16} />
              Thử lưu lại
            </button>
          )}
          {remaining !== null && (
            <p className="small muted">
              Nếu mất kết nối khi hết giờ, hệ thống chấm các câu đã đồng bộ gần
              nhất. Đồng hồ thi tiếp tục chạy khi bạn rời trang.
            </p>
          )}
        </div>
        <aside className="panel question-nav">
          <h3>Hành trình bài làm</h3>
          <p className="small muted">Chọn số để chuyển nhanh đến câu hỏi.</p>
          <div className="question-numbers">
            {attempt.snapshot.questions.map((item, i) => (
              <button
                key={item.client_id}
                className={`${answered(responses[item.client_id]) ? "answered" : ""} ${index === i ? "current" : ""} ${flags.includes(item.client_id) ? "flagged" : ""}`}
                aria-label={`Câu ${i + 1}${answered(responses[item.client_id]) ? ", đã trả lời" : ""}${flags.includes(item.client_id) ? ", đã đánh dấu" : ""}`}
                aria-current={i === index ? "step" : undefined}
                onClick={() => void go(i)}
              >
                {i + 1}
                {flags.includes(item.client_id) && <Flag size={8} />}
              </button>
            ))}
          </div>
          <div className="legend">
            <span>
              <i className="answered" />
              Đã trả lời
            </span>
            <span>
              <i />
              Chưa trả lời
            </span>
            <span>
              <Flag size={12} />
              Cần ôn lại
            </span>
          </div>
          <button
            className="button full"
            disabled={submitting}
            onClick={() => setConfirm(true)}
          >
            <Send size={16} />
            {submitting ? "Đang nộp…" : "Nộp bài"}
          </button>
          {confirm && (
            <div className="confirm-box" role="alert">
              <strong>Bạn muốn kết thúc bài?</strong>
              <p>
                Còn {attempt.snapshot.questions.length - answeredCount} câu chưa
                trả lời. Sau khi nộp, bạn có thể xem đáp án và lời giải.
              </p>
              <button
                className="button full small"
                disabled={submitting}
                onClick={() => void submit()}
              >
                Xác nhận nộp bài
              </button>
              <button
                className="text-button full"
                onClick={() => setConfirm(false)}
              >
                Tiếp tục làm bài
              </button>
            </div>
          )}
          <div className="nav-tip">
            <BookOpen size={20} />
            <p>
              {attempt.mode === "practice"
                ? "Không cần vội. Mỗi lời giải là một cơ hội hiểu sâu hơn."
                : "Bình tĩnh đọc kỹ đề. Bạn có thể quay lại các câu đã đánh dấu."}
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}

export function Results() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, error, loading } = useLoad<Attempt>(`/attempts/${id}`);
  const [filter, setFilter] = useState("all"),
    [query, setQuery] = useState(""),
    [issue, setIssue] = useState<unknown>(null),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (data?.status === "active")
      navigate(`/attempts/${id}`, { replace: true });
  }, [data, id, navigate]);
  if (loading) return <Loading />;
  if (error || !data?.result) return <ErrorMessage error={error} />;
  const result = data.result;
  const qLower = query.trim().toLowerCase();
  const questions = result.questions.filter((q, idx) => {
    const matchesFilter =
      filter === "all" ||
      q.status === filter ||
      (filter === "wrong" && q.status === "partial");
    if (!matchesFilter) return false;
    if (!qLower) return true;
    const questionNumber = `câu ${idx + 1}`;
    const inNumber = questionNumber.includes(qLower) || String(idx + 1) === qLower;
    const inPrompt = JSON.stringify(q.prompt).toLowerCase().includes(qLower);
    const inExplanation = q.explanation
      ? JSON.stringify(q.explanation).toLowerCase().includes(qLower)
      : false;
    const inOptions = q.options
      ? JSON.stringify(q.options).toLowerCase().includes(qLower)
      : false;
    const inTags = q.tags ? q.tags.some((t) => t.toLowerCase().includes(qLower)) : false;
    return inNumber || inPrompt || inExplanation || inOptions || inTags;
  });
  const duration = Math.max(
    0,
    Math.min(
      new Date(data.submitted_at!).getTime(),
      data.expires_at ? new Date(data.expires_at).getTime() : Infinity,
    ) - new Date(data.started_at).getTime(),
  );
  async function retry() {
    setBusy(true);
    try {
      const a = await api<Attempt>("/attempts", "POST", {
        exam_id: data!.exam_id,
        mode: data!.mode,
      });
      navigate(`/attempts/${a.id}`);
    } catch (e) {
      setIssue(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Link className="back-link" to="/recent">
        <ArrowLeft size={16} />
        Bài làm gần đây
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow muted">
            THÊM MỘT BƯỚC TRÊN HÀNH TRÌNH HỌC TẬP
          </span>
          <h1>Bạn đã hoàn thành bài!</h1>
          <p>{data.snapshot.title}</p>
        </div>
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => void retry()}
        >
          <RotateCcw size={16} />
          Làm lại bài này
        </button>
      </div>
      <div className="result-summary panel">
        <div
          className="score-ring"
          style={{ "--score": `${result.score * 10}%` } as React.CSSProperties}
        >
          <div>
            <strong>{result.score.toFixed(2)}</strong>
            <span>/ 10 điểm</span>
          </div>
        </div>
        <div className="result-message">
          <span className="eyebrow green-text">
            {result.provisional ? "ĐIỂM TẠM TÍNH" : "KẾT QUẢ BÀI LÀM"}
          </span>
          <h2>
            {result.score >= 8
              ? "Nỗ lực của bạn đã có kết quả!"
              : "Mỗi lần luyện tập, thêm một lần hiểu."}
          </h2>
          <p>
            Đã đạt {Number(result.earned.toFixed(2))} / {result.total} điểm gốc
            · {Math.floor(duration / 60000)} phút{" "}
            {Math.floor(duration / 1000) % 60} giây
          </p>
          <div className="result-counts">
            <span>
              <i className="green-dot" />
              {result.correct} đúng
            </span>
            <span>
              <i className="red-dot" />
              {result.wrong} sai / một phần
            </span>
            <span>
              <i className="gray-dot" />
              {result.blank} bỏ trống
            </span>
            {result.pending > 0 && <span>{result.pending} chưa chấm</span>}
          </div>
        </div>
      </div>
      {result.provisional && (
        <Notice>
          Có câu tự luận chưa chấm. Điểm trên là tạm tính theo tổng điểm toàn
          đề; câu tự luận không được tính là câu sai.
        </Notice>
      )}
      <ErrorMessage error={issue} />
      <div className="section-heading">
        <h2>Nhìn lại từng câu hỏi</h2>
        <span className="muted small">Hiểu vì sao, nhớ lâu hơn. Đáp án và giải thích chi tiết cho từng câu.</span>
      </div>
      <div className="review-tools">
        <div className="tabs" role="group" aria-label="Lọc kết quả">
          {[
            ["all", `Tất cả (${result.questions.length})`],
            ["wrong", `Sai / một phần (${result.wrong})`],
            ["blank", `Bỏ trống (${result.blank})`],
            ["correct", `Đúng (${result.correct})`],
            ...(result.pending > 0 ? [["pending", `Chưa chấm (${result.pending})`]] : []),
          ].map(([v, l]) => (
            <button
              key={v}
              className={filter === v ? "active" : ""}
              onClick={() => setFilter(v)}
            >
              {l}
            </button>
          ))}
        </div>
        <div className="review-search-bar">
          <Search size={18} />
          <input
            aria-label="Tìm câu trong kết quả"
            placeholder="Tìm theo số câu (câu 1, 2...), nội dung, đáp án hoặc lời giải..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              type="button"
              className="icon-button"
              onClick={() => setQuery("")}
              aria-label="Xóa từ khóa tìm kiếm"
              title="Xóa tìm kiếm"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>
      {questions.length ? (
        <div className="review-list">
          {questions.map((q) => {
            const origIdx = result.questions.indexOf(q);
            const isCorrect = q.status === "correct";
            const isWrong = q.status === "wrong" || q.status === "partial";
            const isBlank = q.status === "blank";

            return (
              <article
                className={`panel review-question-card ${
                  isCorrect
                    ? "card-status-correct"
                    : isWrong
                      ? q.status === "partial"
                        ? "card-status-partial"
                        : "card-status-wrong"
                      : isBlank
                        ? "card-status-blank"
                        : "card-status-pending"
                }`}
                key={q.client_id}
              >
                <div
                  className="row between wrap review-card-header"
                  style={{ gap: 10, alignItems: "center", marginBottom: 16 }}
                >
                  <div className="row wrap" style={{ gap: 8, alignItems: "center" }}>
                    <span className="question-number-pill question-badge-pill">
                      {isCorrect ? (
                        <>
                          <Check size={14} /> CÂU {origIdx + 1} • ĐÚNG (+{Number(q.awarded.toFixed(2))}/{q.points}đ)
                        </>
                      ) : isWrong ? (
                        q.status === "partial" ? (
                          <>
                            <AlertCircle size={14} /> CÂU {origIdx + 1} • MỘT PHẦN (+{Number(q.awarded.toFixed(2))}/{q.points}đ)
                          </>
                        ) : (
                          <>
                            <X size={14} /> CÂU {origIdx + 1} • SAI (0/{q.points}đ)
                          </>
                        )
                      ) : isBlank ? (
                        <>
                          ⊘ CÂU {origIdx + 1} • CHƯA LÀM (0/{q.points}đ)
                        </>
                      ) : (
                        <>
                          ⏳ CÂU {origIdx + 1} • CHỜ CHẤM
                        </>
                      )}
                    </span>
                    <span className="question-type-tag">{typeLabels[q.type]}</span>
                    <span className="question-points-tag">{q.points || 1} điểm</span>
                  </div>
                  <Badge status={q.status} />
                </div>
                <div className="review-question-prompt">
                  <Blocks blocks={q.prompt} />
                </div>
                <div className="review-question-input" style={{ margin: "16px 0" }}>
                  <AnswerInput
                    question={q}
                    value={q.response}
                    onChange={() => {}}
                    disabled
                    feedback={q}
                  />
                </div>
                <Feedback q={q} />
              </article>
            );
          })}
        </div>
      ) : (
        <Empty text="Không tìm thấy câu hỏi nào phù hợp với bộ lọc hoặc từ khóa tìm kiếm." />
      )}
    </>
  );
}
