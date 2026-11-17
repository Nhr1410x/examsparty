import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Eye,
  LayoutDashboard,
  ListFilter,
  LayoutGrid,
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
    [now, setNow] = useState(Date.now()),
    [matrixOpen, setMatrixOpen] = useState(false);
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
        <div className="player-heading-main">
          <div className="row wrap" style={{ alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span className={`player-mode-tag ${attempt.mode === "exam" ? "exam" : "practice"}`}>
              {attempt.mode === "exam" ? <Clock3 size={13} /> : <BookOpen size={13} />}
              {attempt.mode === "exam" ? "THI THỬ" : "LUYỆN TẬP"}
            </span>
            <span className="save-state" role="status">
              <Save size={13} />
              {status}
            </span>
          </div>
          <h1>{attempt.snapshot.title}</h1>
        </div>
        <div className="player-header-actions">
          {remaining !== null && (
            <div
              className={`timer ${remaining < 60 ? "urgent" : ""}`}
              role="timer"
              aria-label="Thời gian còn lại"
            >
              <Clock3 size={20} />
              <div>
                <small>THỜI GIAN</small>
                <strong>
                  {String(Math.floor(remaining / 60)).padStart(2, "0")}:
                  {String(remaining % 60).padStart(2, "0")}
                </strong>
              </div>
            </div>
          )}
          <button
            type="button"
            className="matrix-toggle-btn button secondary button-step-press"
            onClick={() => setMatrixOpen(true)}
            aria-label="Mở ma trận câu hỏi"
            title="Xem danh sách toàn bộ câu hỏi trong đề"
          >
            <LayoutGrid size={16} />
            <span>Ma trận câu hỏi</span>
            <span className="matrix-badge-count">
              {answeredCount}/{attempt.snapshot.questions.length}
            </span>
          </button>
          <button
            type="button"
            className="button primary button-step-press header-submit-btn"
            disabled={submitting}
            onClick={() => setConfirm(true)}
          >
            <Send size={15} />
            <span>Nộp bài</span>
          </button>
          {attempt.mode === "practice" && (
            <Link
              className="button secondary small"
              to="/recent"
              onClick={() => void flush()}
            >
              Tạm nghỉ
            </Link>
          )}
        </div>
      </div>
      <div className="progress">
        <span
          style={{
            width: `${(answeredCount / attempt.snapshot.questions.length) * 100}%`,
          }}
        />
      </div>

      <div className="player-focused-layout">
        <article className="question-panel panel focused-panel">
          <div className="row between wrap" style={{ alignItems: "center", marginBottom: 16 }}>
            <div className="row" style={{ alignItems: "center", gap: 10 }}>
              <span className="question-number-pill">
                CÂU {index + 1}
              </span>
              <span className="question-total-count">
                / {attempt.snapshot.questions.length} câu
              </span>
            </div>
            <div className="row" style={{ alignItems: "center", gap: 8 }}>
              <button
                type="button"
                className="matrix-inline-open-btn text-button"
                onClick={() => setMatrixOpen(true)}
                title="Bấm để mở danh sách ma trận các câu hỏi"
              >
                <LayoutGrid size={15} />
                <span>Ma trận ({answeredCount}/{attempt.snapshot.questions.length})</span>
              </button>
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
            style={{ marginTop: 12 }}
          >
            <RotateCcw size={16} />
            Thử lưu lại
          </button>
        )}
        {remaining !== null && (
          <p className="small muted" style={{ marginTop: 14, textAlign: "center" }}>
            Nếu mất kết nối khi hết giờ, hệ thống chấm các câu đã đồng bộ gần
            nhất. Đồng hồ thi tiếp tục chạy khi bạn rời trang.
          </p>
        )}
      </div>

      {/* MA TRẬN CÂU HỎI DRAWER / MODAL SHEET */}
      {matrixOpen && (
        <div
          className="matrix-drawer-backdrop"
          onClick={() => setMatrixOpen(false)}
        >
          <aside
            className="matrix-drawer panel"
            role="dialog"
            aria-modal="true"
            aria-label="Ma trận câu hỏi"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="matrix-drawer-header">
              <div>
                <h3 style={{ margin: 0 }}>Ma trận câu hỏi</h3>
                <span className="muted small">
                  Đã trả lời {answeredCount}/{attempt.snapshot.questions.length} câu
                </span>
              </div>
              <button
                type="button"
                className="icon-button close-matrix-btn"
                aria-label="Đóng ma trận"
                onClick={() => setMatrixOpen(false)}
              >
                <X size={19} />
              </button>
            </div>
            <div className="matrix-drawer-body">
              <div className="question-numbers scaled-matrix-numbers">
                {attempt.snapshot.questions.map((item, i) => (
                  <button
                    key={item.client_id}
                    className={`${answered(responses[item.client_id]) ? "answered" : ""} ${index === i ? "current" : ""} ${flags.includes(item.client_id) ? "flagged" : ""}`}
                    aria-label={`Câu ${i + 1}${answered(responses[item.client_id]) ? ", đã trả lời" : ""}${flags.includes(item.client_id) ? ", đã đánh dấu" : ""}`}
                    aria-current={i === index ? "step" : undefined}
                    onClick={() => {
                      void go(i);
                      setMatrixOpen(false);
                    }}
                  >
                    {i + 1}
                    {flags.includes(item.client_id) && <Flag size={8} />}
                  </button>
                ))}
              </div>
              <div className="legend" style={{ marginTop: 18 }}>
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
            </div>
            <div className="matrix-drawer-footer">
              <button
                className="button full primary"
                disabled={submitting}
                onClick={() => {
                  setConfirm(true);
                  setMatrixOpen(false);
                }}
              >
                <Send size={16} />
                {submitting ? "Đang nộp…" : "Nộp bài"}
              </button>
              <button
                className="button secondary full"
                onClick={() => setMatrixOpen(false)}
              >
                Quay lại làm tiếp
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* HỘP THOẠI XÁC NHẬN NỘP BÀI */}
      {confirm && (
        <div className="modal-backdrop" onClick={() => setConfirm(false)}>
          <div
            className="modal-dialog confirm-box panel"
            role="alertdialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 440, padding: 24, borderRadius: 16 }}
          >
            <h3 style={{ margin: "0 0 8px" }}>Bạn muốn kết thúc bài?</h3>
            <p className="muted small" style={{ margin: "0 0 16px", lineHeight: 1.5 }}>
              Còn {attempt.snapshot.questions.length - answeredCount} câu chưa
              trả lời. Sau khi nộp, bạn có thể xem điểm, đáp án và lời giải chi tiết.
            </p>
            <div className="row wrap" style={{ gap: 10 }}>
              <button
                className="button small primary"
                disabled={submitting}
                onClick={() => void submit()}
              >
                Xác nhận nộp bài
              </button>
              <button
                className="button secondary small"
                onClick={() => setConfirm(false)}
              >
                Tiếp tục làm bài
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function Results() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, error, loading } = useLoad<Attempt>(`/attempts/${id}`);
  const [filter, setFilter] = useState("all"),
    [query, setQuery] = useState(""),
    [reviewIndex, setReviewIndex] = useState(0),
    [viewMode, setViewMode] = useState<"player" | "list">("player"),
    [issue, setIssue] = useState<unknown>(null),
    [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data?.status === "active")
      navigate(`/attempts/${id}`, { replace: true });
  }, [data, id, navigate]);

  const rawQuestions = useMemo(() => {
    return Array.isArray(data?.result?.questions) ? data.result.questions : [];
  }, [data?.result?.questions]);

  const qLower = query.trim().toLowerCase();

  const filteredIndices = useMemo(() => {
    const indices = new Set<number>();
    rawQuestions.forEach((q, idx) => {
      const matchesFilter =
        filter === "all" ||
        q.status === filter ||
        (filter === "wrong" && q.status === "partial");
      if (!matchesFilter) return;
      if (!qLower) {
        indices.add(idx);
        return;
      }
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
      if (inNumber || inPrompt || inExplanation || inOptions || inTags) {
        indices.add(idx);
      }
    });
    return indices;
  }, [rawQuestions, filter, qLower]);

  const questions = useMemo(() => {
    return rawQuestions.filter((_, idx) => filteredIndices.has(idx));
  }, [rawQuestions, filteredIndices]);

  if (loading) return <Loading />;
  if (error) return <ErrorMessage error={error} />;
  if (!data?.result) {
    return (
      <div className="panel" style={{ textAlign: "center", padding: "40px 20px" }}>
        <h2>Chưa có kết quả chấm điểm.</h2>
        <p className="muted">Bài làm đang được xử lý hoặc chưa được nộp hoàn tất.</p>
        <Link to="/recent" className="button" style={{ marginTop: 16 }}>
          Về Không gian học tập
        </Link>
      </div>
    );
  }

  const result = data.result;
  if (rawQuestions.length === 0) {
    return (
      <div className="panel" style={{ textAlign: "center", padding: "40px 20px" }}>
        <h2>Không tìm thấy câu hỏi nào trong kết quả bài thi.</h2>
        <p className="muted">Bài làm đã được ghi nhận trên máy chủ.</p>
        <Link to="/recent" className="button" style={{ marginTop: 16 }}>
          Về Không gian học tập
        </Link>
      </div>
    );
  }

  const safeReviewIndex =
    reviewIndex >= 0 && reviewIndex < rawQuestions.length ? reviewIndex : 0;
  const currentQ = rawQuestions[safeReviewIndex] || rawQuestions[0];

  const submittedTime = data.submitted_at
    ? new Date(data.submitted_at).getTime()
    : Date.now();
  const startedTime = data.started_at
    ? new Date(data.started_at).getTime()
    : submittedTime;
  const expiresTime = data.expires_at
    ? new Date(data.expires_at).getTime()
    : Infinity;
  const calcDuration = Math.max(0, Math.min(submittedTime, expiresTime) - startedTime);
  const duration = isNaN(calcDuration) ? 0 : calcDuration;

  const safeScore =
    typeof result.score === "number" && !isNaN(result.score) ? result.score : 0;
  const safeEarned =
    typeof result.earned === "number" && !isNaN(result.earned) ? result.earned : 0;
  const safeTotal =
    typeof result.total === "number" && !isNaN(result.total) ? result.total : 0;

  const fmtPoints = (val: number | undefined | null) =>
    typeof val === "number" && !isNaN(val) ? Number(val.toFixed(2)) : 0;

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
        Không gian học tập
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow muted">
            THÊM MỘT BƯỚC TRÊN HÀNH TRÌNH HỌC TẬP
          </span>
          <h1>Bạn đã hoàn thành bài!</h1>
          <p>{data.snapshot?.title || "Đề thi"}</p>
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
          style={{ "--score": `${safeScore * 10}%` } as React.CSSProperties}
        >
          <div>
            <strong>{safeScore.toFixed(2)}</strong>
            <span>/ 10 điểm</span>
          </div>
        </div>
        <div className="result-message">
          <span className="eyebrow green-text">
            {result.provisional ? "ĐIỂM TẠM TÍNH" : "KẾT QUẢ BÀI LÀM"}
          </span>
          <h2>
            {safeScore >= 8
              ? "Nỗ lực của bạn đã có kết quả!"
              : "Mỗi lần luyện tập, thêm một lần hiểu."}
          </h2>
          <p>
            Đã đạt {fmtPoints(safeEarned)} / {safeTotal} điểm gốc
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
          <div className="row wrap" style={{ gap: 10, marginTop: 18 }}>
            <button
              type="button"
              className="button"
              onClick={() => {
                setViewMode("player");
                document
                  .getElementById("review-workspace")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              <Eye size={16} />
              Xem lại bài làm
            </button>
            <button
              type="button"
              className="button secondary"
              disabled={busy}
              onClick={() => void retry()}
            >
              <RotateCcw size={16} />
              Làm lại bài này
            </button>
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

      <div id="review-workspace" className="section-heading review-heading-row">
        <div>
          <h2>Xem lại bài làm</h2>
          <span className="muted small">
            Đối chiếu bài làm của bạn với đáp án và lời giải chi tiết từng câu.
          </span>
        </div>
        <div className="segmented-control" role="tablist">
          <button
            type="button"
            className={viewMode === "player" ? "active" : ""}
            onClick={() => setViewMode("player")}
            title="Giao diện phòng thi: Duyệt từng câu kèm ô số câu màu xanh (đúng) và đỏ (sai)"
          >
            <LayoutDashboard size={15} />
            Giao diện phòng thi
          </button>
          <button
            type="button"
            className={viewMode === "list" ? "active" : ""}
            onClick={() => setViewMode("list")}
            title="Danh sách toàn bộ các câu hỏi"
          >
            <ListFilter size={15} />
            Danh sách toàn bộ
          </button>
        </div>
      </div>

      {viewMode === "player" ? (
        <div className="player-grid review-player-grid">
          {/* Main Question Panel (Left) */}
          <div>
            <article
              className={`question-panel panel review-question-panel ${
                currentQ.status === "correct"
                  ? "card-status-correct"
                  : currentQ.status === "wrong"
                    ? "card-status-wrong"
                    : currentQ.status === "partial"
                      ? "card-status-partial"
                      : "card-status-blank"
              }`}
            >
              <div
                className="row between wrap"
                style={{ alignItems: "center", marginBottom: 16, gap: 10 }}
              >
                <div className="row wrap" style={{ alignItems: "center", gap: 10 }}>
                  <span className="question-number-pill">
                    CÂU {safeReviewIndex + 1}
                  </span>
                  <span className="question-total-count">
                    / {result.questions.length} câu
                  </span>
                  <span
                    className={`review-status-badge ${
                      currentQ.status === "correct"
                        ? "status-correct"
                        : currentQ.status === "wrong"
                          ? "status-wrong"
                          : currentQ.status === "partial"
                            ? "status-partial"
                            : "status-blank"
                    }`}
                  >
                    {currentQ.status === "correct" ? (
                      <>
                        <Check size={14} /> Đúng (+{fmtPoints(currentQ.awarded)}/{currentQ.points || 1}đ)
                      </>
                    ) : currentQ.status === "wrong" ? (
                      <>
                        <X size={14} /> Sai (0/{currentQ.points || 1}đ)
                      </>
                    ) : currentQ.status === "partial" ? (
                      <>
                        <AlertCircle size={14} /> Một phần (+{fmtPoints(currentQ.awarded)}/{currentQ.points || 1}đ)
                      </>
                    ) : currentQ.status === "blank" ? (
                      <>⊘ Chưa làm (0/{currentQ.points || 1}đ)</>
                    ) : (
                      <>⏳ Chờ chấm</>
                    )}
                  </span>
                </div>
                <div className="row wrap" style={{ gap: 8, alignItems: "center" }}>
                  <span className="question-type-tag">{typeLabels[currentQ.type]}</span>
                  <span className="question-points-tag">{currentQ.points || 1} điểm</span>
                </div>
              </div>

              <div className="question-content">
                <Blocks blocks={currentQ.prompt} />
              </div>

              <div className="review-question-input" style={{ margin: "20px 0" }}>
                <AnswerInput
                  question={currentQ}
                  value={currentQ.response}
                  onChange={() => {}}
                  disabled
                  feedback={currentQ}
                />
              </div>

              {/* Reveal answer and step-by-step solution */}
              <Feedback q={currentQ} />

              <div className="question-actions" style={{ marginTop: 28 }}>
                <button
                  type="button"
                  className="button secondary"
                  disabled={safeReviewIndex === 0}
                  onClick={() => setReviewIndex(safeReviewIndex - 1)}
                >
                  <ArrowLeft size={16} />
                  Câu trước
                </button>
                <span className="small muted">
                  Câu {safeReviewIndex + 1} / {result.questions.length}
                </span>
                <button
                  type="button"
                  className="button secondary"
                  disabled={safeReviewIndex === result.questions.length - 1}
                  onClick={() => setReviewIndex(safeReviewIndex + 1)}
                >
                  Câu tiếp
                  <ArrowRight size={16} />
                </button>
              </div>
            </article>
          </div>

          {/* Right Navigator Panel */}
          <aside className="panel question-nav review-question-nav">
            <div className="row between" style={{ alignItems: "center" }}>
              <h3>Hành trình bài làm</h3>
              <span className="badge small">
                {result.correct}/{result.questions.length} đúng
              </span>
            </div>
            <p className="small muted" style={{ margin: "4px 0 12px" }}>
              Nhấp số câu để xem bài làm, đáp án & giải thích.
            </p>

            {/* Search Bar */}
            <div className="review-nav-search">
              <Search size={14} />
              <input
                placeholder="Tìm câu (1, 2...), từ khóa..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Tìm kiếm câu hỏi"
              />
              {query && (
                <button
                  type="button"
                  className="icon-button"
                  style={{ width: 22, height: 22, padding: 0 }}
                  onClick={() => setQuery("")}
                  title="Xóa tìm kiếm"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="review-filter-pills">
              <button
                type="button"
                className={filter === "all" ? "active" : ""}
                onClick={() => setFilter("all")}
              >
                Tất cả ({result.questions.length})
              </button>
              <button
                type="button"
                className={filter === "correct" ? "active" : ""}
                onClick={() => setFilter("correct")}
              >
                Đúng ({result.correct})
              </button>
              <button
                type="button"
                className={filter === "wrong" ? "active" : ""}
                onClick={() => setFilter("wrong")}
              >
                Sai ({result.wrong})
              </button>
              {result.blank > 0 && (
                <button
                  type="button"
                  className={filter === "blank" ? "active" : ""}
                  onClick={() => setFilter("blank")}
                >
                  Bỏ trống ({result.blank})
                </button>
              )}
            </div>

            {/* Question Numbers 1, 2, 3... Grid */}
            <div className="question-numbers review-question-numbers">
              {result.questions.map((item, i) => {
                const isCorrect = item.status === "correct";
                const isWrong = item.status === "wrong";
                const isPartial = item.status === "partial";
                const isBlank = item.status === "blank";
                const isCurrent = i === safeReviewIndex;
                const isMatch = filteredIndices.has(i);

                let statusClass = "review-btn-blank";
                if (isCorrect) statusClass = "review-btn-correct";
                else if (isWrong) statusClass = "review-btn-wrong";
                else if (isPartial) statusClass = "review-btn-partial";

                return (
                  <button
                    key={item.client_id || i}
                    type="button"
                    className={`review-num-btn ${statusClass} ${isCurrent ? "current" : ""} ${!isMatch ? "dimmed" : ""}`}
                    onClick={() => setReviewIndex(i)}
                    title={`Câu ${i + 1}: ${
                      isCorrect
                        ? "Đúng"
                        : isWrong
                          ? "Sai"
                          : isPartial
                            ? "Một phần"
                            : isBlank
                              ? "Bỏ trống"
                              : "Chờ chấm"
                    } (+${fmtPoints(item.awarded)}/${item.points || 1}đ)`}
                    aria-label={`Câu ${i + 1}`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="review-legend">
              <span className="legend-item">
                <i className="legend-box green" /> Đúng ({result.correct})
              </span>
              <span className="legend-item">
                <i className="legend-box red" /> Sai ({result.wrong})
              </span>
              {result.blank > 0 && (
                <span className="legend-item">
                  <i className="legend-box gray" /> Bỏ trống ({result.blank})
                </span>
              )}
            </div>
          </aside>
        </div>
      ) : (
        <>
          <div className="review-tools">
            <div className="tabs" role="group" aria-label="Lọc kết quả">
              {[
                ["all", `Tất cả (${result.questions.length})`],
                ["wrong", `Sai / một phần (${result.wrong})`],
                ["blank", `Bỏ trống (${result.blank})`],
                ["correct", `Đúng (${result.correct})`],
                ...(result.pending > 0
                  ? [["pending", `Chưa chấm (${result.pending})`]]
                  : []),
              ].map(([v, l]) => (
                <button
                  key={v}
                  type="button"
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
                      <div
                        className="row wrap"
                        style={{ gap: 8, alignItems: "center" }}
                      >
                        <span className="question-number-pill question-badge-pill">
                          {isCorrect ? (
                            <>
                              <Check size={14} /> CÂU {origIdx + 1} • ĐÚNG (+{fmtPoints(q.awarded)}/{q.points || 1}đ)
                            </>
                          ) : isWrong ? (
                            q.status === "partial" ? (
                              <>
                                <AlertCircle size={14} /> CÂU {origIdx + 1} • MỘT PHẦN (+{fmtPoints(q.awarded)}/{q.points || 1}đ)
                              </>
                            ) : (
                              <>
                                <X size={14} /> CÂU {origIdx + 1} • SAI (0/{q.points || 1}đ)
                              </>
                            )
                          ) : isBlank ? (
                            <>
                              ⊘ CÂU {origIdx + 1} • CHƯA LÀM (0/{q.points || 1}đ)
                            </>
                          ) : (
                            <>⏳ CÂU {origIdx + 1} • CHỜ CHẤM</>
                          )}
                        </span>
                        <span className="question-type-tag">
                          {typeLabels[q.type]}
                        </span>
                        <span className="question-points-tag">
                          {q.points || 1} điểm
                        </span>
                      </div>
                      <Badge status={q.status} />
                    </div>
                    <div className="review-question-prompt">
                      <Blocks blocks={q.prompt} />
                    </div>
                    <div
                      className="review-question-input"
                      style={{ margin: "16px 0" }}
                    >
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
      )}
    </>
  );
}
