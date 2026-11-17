import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Download,
  Eye,
  FileJson,
  Pencil,
  Plus,
  Save,
  Send,
  Upload,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Check,
  Search,
  BookOpen,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { api, date, download } from "./api";
import {
  AnswerInput,
  Badge,
  Blocks,
  ErrorMessage,
  Notice,
  QuestionEditor,
  Feedback,
  Loading,
} from "./components";
import {
  emptyExam,
  emptyQuestion,
  ExamContent,
  normalizeExamPayload,
  Submission,
  template,
  typeLabels,
} from "./types";

export function ExamEditor({
  raw,
  onChange,
  initial = template,
  defaultMode = "preview",
  onDirectSave,
  onBack,
}: {
  raw: string;
  onChange: (raw: string) => void;
  initial?: ExamContent;
  defaultMode?: "preview" | "form" | "json";
  onDirectSave?: (content: ExamContent) => Promise<void> | void;
  onBack?: () => void;
}) {
  const [mode, setMode] = useState<"preview" | "form" | "json">(defaultMode),
    [editingQuestionIdx, setEditingQuestionIdx] = useState<number | null>(null),
    [form, setForm] = useState<ExamContent>(() => {
      try {
        return JSON.parse(raw);
      } catch {
        return initial;
      }
    }),
    [issue, setIssue] = useState<unknown>(null),
    [savedNotice, setSavedNotice] = useState<string>(""),
    [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      setForm(JSON.parse(raw));
    } catch {}
  }, [raw]);

  let parsedContent: ExamContent = form;
  try {
    parsedContent = JSON.parse(raw);
  } catch {
    parsedContent = form;
  }

  function update(content: ExamContent) {
    setForm(content);
    onChange(JSON.stringify(content, null, 2));
  }
  function moveQuestion(index: number, delta: number) {
    const questions = [...form.questions];
    [questions[index], questions[index + delta]] = [
      questions[index + delta],
      questions[index],
    ];
    update({ ...form, questions });
  }
  async function showForm() {
    setIssue(null);
    setBusy(true);
    try {
      const content = JSON.parse(raw);
      try {
        const result = await api<{ content: ExamContent }>(
          "/contributions/validate",
          "POST",
          content,
        );
        setForm(result.content);
      } catch {
        setForm(content);
      }
      setMode("form");
    } catch (e) {
      setIssue(e);
    } finally {
      setBusy(false);
    }
  }

  if (editingQuestionIdx !== null && form.questions[editingQuestionIdx]) {
    const q = form.questions[editingQuestionIdx];
    const total = form.questions.length;
    return (
      <div className="single-question-edit-container">
        <div className="panel single-question-nav-bar">
          <div className="row between wrap" style={{ gap: 12, alignItems: "center" }}>
            <button
              type="button"
              className="button secondary small"
              onClick={() => setEditingQuestionIdx(null)}
            >
              <ArrowLeft size={15} />
              Quay lại xem toàn bộ đề
            </button>
            <div className="row" style={{ gap: 8, alignItems: "center" }}>
              <span
                className="question-number-pill"
                style={{ fontSize: "13px", padding: "5px 12px" }}
              >
                Đang sửa: CÂU {editingQuestionIdx + 1} / {total}
              </span>
              <button
                type="button"
                className="button secondary small"
                disabled={editingQuestionIdx <= 0}
                onClick={() => setEditingQuestionIdx(editingQuestionIdx - 1)}
                title="Chuyển sang câu trước"
              >
                <ChevronLeft size={15} />
                Câu trước
              </button>
              <button
                type="button"
                className="button secondary small"
                disabled={editingQuestionIdx >= total - 1}
                onClick={() => setEditingQuestionIdx(editingQuestionIdx + 1)}
                title="Chuyển sang câu sau"
              >
                Câu sau
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        </div>

        <QuestionEditor
          q={q}
          onChange={(updatedQ) => {
            const nextQuestions = form.questions.map((item, idx) =>
              idx === editingQuestionIdx ? updatedQ : item,
            );
            update({ ...form, questions: nextQuestions });
          }}
          onRemove={() => {
            if (window.confirm(`Bạn có chắc muốn xóa Câu ${editingQuestionIdx + 1}?`)) {
              const nextQuestions = form.questions.filter((_, idx) => idx !== editingQuestionIdx);
              update({ ...form, questions: nextQuestions.length ? nextQuestions : [emptyQuestion()] });
              setEditingQuestionIdx(null);
            }
          }}
        />

        <div className="panel single-question-footer-bar">
          <div className="row between wrap" style={{ gap: 12, alignItems: "center" }}>
            <button
              type="button"
              className="button secondary small"
              disabled={editingQuestionIdx <= 0}
              onClick={() => setEditingQuestionIdx(editingQuestionIdx - 1)}
            >
              <ChevronLeft size={15} />
              Câu trước
            </button>
            <button
              type="button"
              className="button"
              onClick={() => setEditingQuestionIdx(null)}
            >
              <Check size={16} />
              Hoàn tất sửa câu {editingQuestionIdx + 1} & Quay lại xem toàn bộ đề
            </button>
            <button
              type="button"
              className="button secondary small"
              disabled={editingQuestionIdx >= total - 1}
              onClick={() => setEditingQuestionIdx(editingQuestionIdx + 1)}
            >
              Câu sau
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="exam-editor">
      <div className="editor-toolbar">
        {onBack && (
          <button
            type="button"
            className="button secondary small"
            onClick={onBack}
            style={{ marginRight: 6 }}
          >
            <ArrowLeft size={14} />
            Danh sách đề
          </button>
        )}
        <div className="tabs">
          <button
            type="button"
            className={mode === "preview" ? "active" : ""}
            onClick={() => setMode("preview")}
          >
            <Eye size={15} />
            Xem trước câu hỏi
          </button>
          <button
            type="button"
            className={mode === "form" ? "active" : ""}
            disabled={busy}
            onClick={() => void showForm()}
          >
            Biểu mẫu
          </button>
          <button
            type="button"
            className={mode === "json" ? "active" : ""}
            onClick={() => setMode("json")}
          >
            <FileJson size={15} />
            JSON
          </button>
        </div>
        <div className="row wrap">
          <button
            type="button"
            className="button secondary small"
            onClick={() => download("de-thi-mau.json", template)}
          >
            <Download size={15} />
            Tải mẫu
          </button>
          <label className="button secondary small upload-label">
            <Upload size={15} />
            Nhập JSON
            <input
              type="file"
              accept="application/json,.json"
              disabled={busy}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (f.size > 2 * 1024 * 1024) {
                  setIssue(new Error("File JSON tối đa 2 MB."));
                  return;
                }
                setIssue(null);
                setSavedNotice("");
                const text = await f.text();
                try {
                  const rawParsed = JSON.parse(text);
                  const normalized = normalizeExamPayload(rawParsed);
                  const formatted = JSON.stringify(normalized, null, 2);
                  onChange(formatted);
                  setForm(normalized);
                  setMode("preview");
                  if (onDirectSave) {
                    const saveNow = window.confirm(
                      `Đã nạp file đề thi "${normalized.title}" (${normalized.questions.length} câu hỏi).\n\nBạn có muốn lưu ngay đề thi này vào cơ sở dữ liệu không?`,
                    );
                    if (saveNow) {
                      setBusy(true);
                      try {
                        await onDirectSave(normalized);
                        setSavedNotice(
                          `Đã nhập và lưu đề "${normalized.title}" vào cơ sở dữ liệu thành công!`,
                        );
                      } catch (err) {
                        setIssue(err);
                      } finally {
                        setBusy(false);
                      }
                    } else {
                      setSavedNotice(
                        `Đã nạp file JSON vào bản xem trước. Hãy nhấn "Lưu vào database" khi bạn muốn lưu.`,
                      );
                    }
                  } else {
                    setSavedNotice(`Đã nạp file JSON vào trình soạn thảo.`);
                  }
                } catch (err) {
                  onChange(text);
                  setMode("json");
                  setIssue(err);
                }
                e.target.value = "";
              }}
            />
          </label>
          {onDirectSave && (
            <button
              type="button"
              className="button small"
              disabled={busy}
              onClick={async () => {
                setIssue(null);
                setBusy(true);
                try {
                  await onDirectSave(parsedContent);
                  setSavedNotice(
                    `Đã lưu đề "${parsedContent.title}" vào cơ sở dữ liệu thành công!`,
                  );
                } catch (err) {
                  setIssue(err);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Save size={15} />
              Lưu vào CSDL
            </button>
          )}
          <button
            type="button"
            className="button secondary small"
            onClick={() => {
              const content = emptyExam();
              update(content);
              setMode("form");
            }}
          >
            Soạn đề mới
          </button>
        </div>
      </div>
      <ErrorMessage error={issue} />
      {savedNotice && <Notice>{savedNotice}</Notice>}
      {mode === "preview" ? (
        <div className="editor-preview-pane">
          <div className="panel editor-preview-action-bar">
            <div className="row between wrap" style={{ gap: 12 }}>
              <div>
                <span className="eyebrow green-text">BẢN XEM TRƯỚC CÂU HỎI & ĐỀ THI</span>
                <h3>{parsedContent.title || "Chưa đặt tiêu đề"}</h3>
                <p className="muted small">
                  {parsedContent.subject} · {parsedContent.questions.length} câu hỏi · {parsedContent.settings?.time_limit_minutes || 45} phút
                </p>
              </div>
              <div className="row wrap" style={{ gap: 8 }}>
                {onDirectSave && (
                  <button
                    type="button"
                    className="button small"
                    disabled={busy}
                    onClick={async () => {
                      setIssue(null);
                      setBusy(true);
                      try {
                        await onDirectSave(parsedContent);
                        setSavedNotice(
                          `Đã lưu đề "${parsedContent.title}" vào cơ sở dữ liệu thành công!`,
                        );
                      } catch (err) {
                        setIssue(err);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <Save size={14} />
                    Lưu vào database
                  </button>
                )}
                <button
                  type="button"
                  className="button secondary small"
                  disabled={busy}
                  onClick={() => void showForm()}
                >
                  <Pencil size={14} />
                  Chuyển sang soạn thảo biểu mẫu
                </button>
              </div>
            </div>
          </div>
          <ExamPreview
            content={parsedContent}
            showAnswers={true}
            onEditQuestion={(idx) => setEditingQuestionIdx(idx)}
          />
        </div>
      ) : mode === "json" ? (
        <label className="field">
          Nội dung đề theo schema 1.0
          <textarea
            className="json-editor"
            spellCheck={false}
            value={raw}
            onChange={(e) => onChange(e.target.value)}
            aria-label="Nội dung JSON đề thi"
          />
          <span className="hint">
            Hỗ trợ single_choice, multiple_choice, true_false, short_answer,
            essay. Nội dung dạng text, math, code, image. Không nhận HTML.
          </span>
        </label>
      ) : (
        <>
          <div className="panel">
            <h3>Thông tin đề</h3>
            <label className="field">
              Tiêu đề
              <input
                maxLength={200}
                value={form.title}
                onChange={(e) => update({ ...form, title: e.target.value })}
              />
            </label>
            <div className="form-grid">
              <label className="field">
                Môn học
                <input
                  value={form.subject}
                  onChange={(e) => update({ ...form, subject: e.target.value })}
                />
              </label>
              <label className="field">
                Lớp
                <input
                  value={form.grade}
                  onChange={(e) => update({ ...form, grade: e.target.value })}
                />
              </label>
              <label className="field">
                Thời gian thi (phút)
                <input
                  type="number"
                  min="1"
                  max="300"
                  value={form.settings.time_limit_minutes}
                  onChange={(e) =>
                    update({
                      ...form,
                      settings: {
                        ...form.settings,
                        time_limit_minutes: Number(e.target.value),
                      },
                    })
                  }
                />
              </label>
            </div>
            <label className="field">
              Mô tả
              <textarea
                value={form.description}
                onChange={(e) =>
                  update({ ...form, description: e.target.value })
                }
              />
            </label>
            <label className="field">
              Chủ đề (cách nhau bằng dấu phẩy)
              <input
                value={form.topics.join(", ")}
                onChange={(e) =>
                  update({
                    ...form,
                    topics: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
              />
            </label>
            <div className="row wrap">
              <label className="row">
                <input
                  type="checkbox"
                  checked={form.settings.shuffle_questions}
                  onChange={(e) =>
                    update({
                      ...form,
                      settings: {
                        ...form.settings,
                        shuffle_questions: e.target.checked,
                      },
                    })
                  }
                />
                Trộn câu khi thi
              </label>
              <label className="row">
                <input
                  type="checkbox"
                  checked={form.settings.shuffle_options}
                  onChange={(e) =>
                    update({
                      ...form,
                      settings: {
                        ...form.settings,
                        shuffle_options: e.target.checked,
                      },
                    })
                  }
                />
                Trộn phương án khi thi
              </label>
            </div>
          </div>
          {form.questions.map((q, i) => (
            <div key={`${i}-${q.client_id}`}>
              <div className="row">
                <span className="small muted">Vị trí {i + 1}</span>
                <button
                  className="button secondary small"
                  type="button"
                  disabled={i === 0}
                  aria-label={`Đưa câu ${q.client_id} lên`}
                  onClick={() => moveQuestion(i, -1)}
                >
                  ↑ Đưa lên
                </button>
                <button
                  className="button secondary small"
                  type="button"
                  disabled={i === form.questions.length - 1}
                  aria-label={`Đưa câu ${q.client_id} xuống`}
                  onClick={() => moveQuestion(i, 1)}
                >
                  ↓ Đưa xuống
                </button>
              </div>
              <QuestionEditor
                q={q}
                onChange={(next) =>
                  update({
                    ...form,
                    questions: form.questions.map((v, n) =>
                      n === i ? next : v,
                    ),
                  })
                }
                onRemove={() =>
                  update({
                    ...form,
                    questions: form.questions.filter((_, n) => n !== i),
                  })
                }
              />
            </div>
          ))}
          <button
            type="button"
            className="button secondary"
            disabled={form.questions.length >= 200}
            onClick={() => {
              let n = form.questions.length + 1;
              while (form.questions.some((q) => q.client_id === `q${n}`)) n++;
              update({
                ...form,
                questions: [...form.questions, emptyQuestion(n)],
              });
            }}
          >
            <Plus size={16} />
            Thêm câu hỏi
          </button>
        </>
      )}
    </div>
  );
}

export function ExamPreview({
  content,
  showAnswers = true,
  onEditQuestion,
}: {
  content: ExamContent;
  showAnswers?: boolean;
  onEditQuestion?: (index: number) => void;
}) {
  return (
    <div className="preview-exam">
      <div className="panel">
        <span className="eyebrow green-text">BẢN XEM TRƯỚC</span>
        <h2>{content.title}</h2>
        <p>
          {content.subject} · {content.questions.length} câu ·{" "}
          {content.settings.time_limit_minutes} phút
        </p>
        <p>{content.description}</p>
      </div>
      {content.questions.map((q, i) => (
        <article className="panel" key={q.client_id || i}>
          <div
            className="row between wrap question-preview-header"
            style={{ marginBottom: 14, alignItems: "center" }}
          >
            <div className="row wrap" style={{ gap: 8, alignItems: "center" }}>
              <span className="question-number-pill">CÂU {i + 1}</span>
              <span className="question-type-tag">{typeLabels[q.type]}</span>
              <span className="question-points-tag">{q.points || 1} điểm</span>
            </div>
            {onEditQuestion && (
              <button
                type="button"
                className="button small secondary question-edit-btn"
                onClick={() => onEditQuestion(i)}
                title={`Chỉnh sửa riêng Câu ${i + 1}`}
              >
                <Pencil size={13} />
                Sửa câu này
              </button>
            )}
          </div>
          <Blocks blocks={q.prompt} />
          <AnswerInput question={q} value={null} onChange={() => {}} disabled />
          {showAnswers && (
            <Feedback
              q={{
                ...q,
                response: null,
                awarded: 0,
                status: q.type === "essay" ? "pending" : "blank",
              }}
            />
          )}
        </article>
      ))}
    </div>
  );
}

export function Contribution() {
  const [view, setView] = useState<"list" | "editor">("list"),
    [mySubmissions, setMySubmissions] = useState<Submission[]>([]),
    [loadingMy, setLoadingMy] = useState(false),
    [activeSubmission, setActiveSubmission] = useState<Submission | null>(null),
    [trackingCode, setTrackingCode] = useState<string>(""),
    [showLookup, setShowLookup] = useState(false),
    [lookupCode, setLookupCode] = useState(""),
    [lookupResult, setLookupResult] = useState<Submission | null>(null),
    [lookupIssue, setLookupIssue] = useState<unknown>(null),
    [lookupBusy, setLookupBusy] = useState(false),
    [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [raw, setRaw] = useState(() => {
    try {
      return (
        localStorage.getItem("ep-contribution-draft") ||
        JSON.stringify(template, null, 2)
      );
    } catch {
      return JSON.stringify(template, null, 2);
    }
  });
  const [contact, setContact] = useState(""),
    [accepted, setAccepted] = useState(false),
    [busy, setBusy] = useState(false),
    [issue, setIssue] = useState<unknown>(null),
    [createdSuccess, setCreatedSuccess] = useState(false),
    [createdCode, setCreatedCode] = useState("");

  async function loadMySubmissions() {
    setLoadingMy(true);
    try {
      const res = await api<{ items: Submission[] }>("/contributions/my").catch(
        () => ({ items: [] }),
      );
      const serverItems = res.items || [];
      let localHist: Array<{
        code: string;
        id?: string;
        title?: string;
        content?: ExamContent;
        created_at?: string;
        contact?: string;
        status?: string;
        review_note?: string;
      }> = [];
      try {
        localHist = JSON.parse(
          localStorage.getItem("ep-contributions-history") || "[]",
        );
      } catch {}

      const map = new Map<string, Submission>();
      for (const item of serverItems) {
        map.set(item.id, item);
      }
      for (const h of localHist) {
        if (h.content && !map.has(h.id || h.code)) {
          map.set(h.id || h.code, {
            id: h.id || h.code,
            tracking_code: h.code,
            content: h.content,
            status: h.status || "pending",
            review_note: h.review_note,
            contact: h.contact,
            created_at: h.created_at || new Date().toISOString(),
          });
        }
      }
      setMySubmissions(Array.from(map.values()));
    } finally {
      setLoadingMy(false);
    }
  }

  useEffect(() => {
    void loadMySubmissions();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("ep-contribution-draft", raw);
    } catch {}
  }, [raw]);

  function handleCreateNew() {
    setActiveSubmission(null);
    setTrackingCode("");
    setRaw(JSON.stringify(emptyExam(), null, 2));
    setCreatedSuccess(false);
    setIssue(null);
    setView("editor");
  }

  function handleOpenExam(sub: Submission) {
    setActiveSubmission(sub);
    setTrackingCode(sub.tracking_code || "");
    if (sub.contact) setContact(sub.contact);
    setRaw(JSON.stringify(sub.content, null, 2));
    setCreatedSuccess(false);
    setIssue(null);
    setView("editor");
  }

  async function handleImportJson(file: File) {
    if (file.size > 2 * 1024 * 1024) {
      alert("File JSON tối đa 2 MB.");
      return;
    }
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const normalized = normalizeExamPayload(parsed);
      setActiveSubmission(null);
      setTrackingCode("");
      setRaw(JSON.stringify(normalized, null, 2));
      setCreatedSuccess(false);
      setIssue(null);
      setView("editor");
    } catch (e: any) {
      alert("File JSON không hợp lệ: " + (e?.message || e));
    }
  }

  async function handleLookup() {
    if (!lookupCode.trim()) return;
    setLookupBusy(true);
    setLookupIssue(null);
    try {
      const result = await api<Submission>("/contributions/track", "POST", {
        code: lookupCode.trim(),
      });
      setLookupResult(result);
    } catch (e) {
      setLookupIssue(e);
      setLookupResult(null);
    } finally {
      setLookupBusy(false);
    }
  }

  async function send() {
    if (!contact || !contact.trim()) {
      setIssue(
        new Error(
          "Vui lòng nhập Email liên hệ để nhận mã theo dõi và thông báo duyệt đề.",
        ),
      );
      return;
    }
    if (!accepted) {
      setIssue(
        new Error(
          "Vui lòng tích chọn xác nhận: Tôi đã kiểm tra nội dung và có quyền chia sẻ học liệu này.",
        ),
      );
      return;
    }
    setBusy(true);
    setIssue(null);
    try {
      const payload = normalizeExamPayload(JSON.parse(raw));
      const validated = await api<{ content: ExamContent }>(
        "/contributions/validate",
        "POST",
        payload,
      );
      const res = await api<{
        id: string;
        tracking_code: string;
        status: string;
      }>("/contributions", "POST", {
        contact: contact.trim(),
        content: validated.content,
      });
      setCreatedCode(res.tracking_code);
      setCreatedSuccess(true);

      // Save to localStorage history
      try {
        const hist = JSON.parse(
          localStorage.getItem("ep-contributions-history") || "[]",
        );
        hist.unshift({
          id: res.id,
          code: res.tracking_code,
          title: validated.content.title,
          content: validated.content,
          contact: contact.trim(),
          status: "pending",
          created_at: new Date().toISOString(),
        });
        localStorage.setItem(
          "ep-contributions-history",
          JSON.stringify(hist.slice(0, 50)),
        );
        localStorage.setItem("ep-last-tracking", res.tracking_code);
      } catch {}

      void loadMySubmissions();
    } catch (e) {
      setIssue(e);
    } finally {
      setBusy(false);
    }
  }

  async function revise() {
    if (!trackingCode) {
      setIssue(
        new Error(
          "Thiếu mã theo dõi để gửi bản chỉnh sửa. Hãy tra cứu mã của đề trước khi gửi lại.",
        ),
      );
      return;
    }
    setBusy(true);
    setIssue(null);
    try {
      const payload = normalizeExamPayload(JSON.parse(raw));
      await api("/contributions/revise", "PUT", {
        code: trackingCode,
        content: payload,
      });
      alert(
        "Đã gửi lại bản chỉnh sửa thành công! Đề thi đã quay lại hàng đợi duyệt của quản trị viên.",
      );
      setView("list");
      void loadMySubmissions();
    } catch (e) {
      setIssue(e);
    } finally {
      setBusy(false);
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === mySubmissions.length && mySubmissions.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(mySubmissions.map((s) => s.id)));
    }
  }

  async function handleDeleteSingle(sub: Submission, e: React.MouseEvent) {
    e.stopPropagation();
    if (
      !window.confirm(
        `Bạn có chắc chắn muốn xóa đề thi "${sub.content?.title || "này"}" khỏi danh sách không?`,
      )
    ) {
      return;
    }
    setBusy(true);
    setIssue(null);
    try {
      if (sub.tracking_code) {
        await api("/contributions/delete-by-code", "POST", {
          code: sub.tracking_code,
        }).catch(() => {});
      } else if (sub.id) {
        await api(`/contributions/${sub.id}`, "DELETE").catch(() => {});
      }
      try {
        const hist = JSON.parse(
          localStorage.getItem("ep-contributions-history") || "[]",
        );
        const filtered = hist.filter(
          (h: any) =>
            h.id !== sub.id &&
            h.code !== sub.id &&
            (!sub.tracking_code || h.code !== sub.tracking_code),
        );
        localStorage.setItem(
          "ep-contributions-history",
          JSON.stringify(filtered),
        );
      } catch {}

      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(sub.id);
        return next;
      });
      await loadMySubmissions();
    } catch (err) {
      setIssue(err);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteSelected() {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    if (
      !window.confirm(
        `Bạn có chắc chắn muốn xóa ${count} đề thi đã chọn không? Hành động này không thể hoàn tác.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setIssue(null);
    try {
      const selectedSubs = mySubmissions.filter((s) => selectedIds.has(s.id));
      for (const sub of selectedSubs) {
        try {
          if (sub.tracking_code) {
            await api("/contributions/delete-by-code", "POST", {
              code: sub.tracking_code,
            }).catch(() => {});
          } else if (sub.id) {
            await api(`/contributions/${sub.id}`, "DELETE").catch(() => {});
          }
        } catch {}
      }
      try {
        const hist = JSON.parse(
          localStorage.getItem("ep-contributions-history") || "[]",
        );
        const filtered = hist.filter(
          (h: any) => !selectedIds.has(h.id) && !selectedIds.has(h.code),
        );
        localStorage.setItem(
          "ep-contributions-history",
          JSON.stringify(filtered),
        );
      } catch {}

      setSelectedIds(new Set());
      await loadMySubmissions();
    } catch (err) {
      setIssue(err);
    } finally {
      setBusy(false);
    }
  }

  async function handleSendSelected() {
    if (selectedIds.size === 0) return;
    const selectedSubs = mySubmissions.filter((s) => selectedIds.has(s.id));
    let email = contact.trim();
    if (!email) {
      const entered = window.prompt(
        "Nhập Email liên hệ để nhận mã theo dõi và thông báo duyệt cho các đề thi đã chọn:",
      );
      if (!entered || !entered.trim()) return;
      email = entered.trim();
      setContact(email);
    }
    setBusy(true);
    setIssue(null);
    let successCount = 0;
    try {
      for (const sub of selectedSubs) {
        try {
          if (sub.status === "changes_requested" && sub.tracking_code) {
            await api("/contributions/revise", "PUT", {
              code: sub.tracking_code,
              content: normalizeExamPayload(sub.content),
            });
            successCount++;
          } else if (sub.status !== "approved" && sub.status !== "pending") {
            const validated = await api<{ content: ExamContent }>(
              "/contributions/validate",
              "POST",
              normalizeExamPayload(sub.content),
            );
            const res = await api<{
              id: string;
              tracking_code: string;
              status: string;
            }>("/contributions", "POST", {
              contact: email,
              content: validated.content,
            });
            sub.tracking_code = res.tracking_code;
            sub.status = "pending";
            try {
              const hist = JSON.parse(
                localStorage.getItem("ep-contributions-history") || "[]",
              );
              hist.unshift({
                id: res.id,
                code: res.tracking_code,
                title: validated.content.title,
                content: validated.content,
                contact: email,
                status: "pending",
                created_at: new Date().toISOString(),
              });
              localStorage.setItem(
                "ep-contributions-history",
                JSON.stringify(hist.slice(0, 50)),
              );
            } catch {}
            successCount++;
          } else if (sub.status === "pending") {
            successCount++;
          }
        } catch {}
      }
      alert(`Đã hoàn tất gửi duyệt ${successCount} đề thi!`);
      setSelectedIds(new Set());
      await loadMySubmissions();
    } catch (err) {
      setIssue(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Đóng góp đề thi & học liệu</h1>
          <p className="muted" style={{ margin: "4px 0 0 0", fontSize: "14px" }}>
            Chia sẻ đề thi chất lượng cao cho cộng đồng Examsparty. Quản lý các đề thi đã gửi và theo dõi tiến trình phê duyệt.
          </p>
        </div>
      </div>

      {view === "list" ? (
        <>
          <div className="contributions-toolbar">
            <div className="row wrap" style={{ gap: 10, alignItems: "center" }}>
              <button
                type="button"
                className="button"
                onClick={handleCreateNew}
              >
                <Plus size={16} />
                Thêm đề mới
              </button>
              <label className="button secondary upload-label">
                <Upload size={15} />
                Nhập JSON
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleImportJson(f);
                    e.target.value = "";
                  }}
                />
              </label>
              <button
                type="button"
                className="button secondary"
                onClick={() => download("de-thi-mau-examsparty.json", template)}
                title="Tải file mẫu JSON đầy đủ công thức toán KaTeX, code block, bảng markdown, 5 dạng câu hỏi"
              >
                <Download size={15} />
                Tải JSON mẫu
              </button>
            </div>
            <div className="row wrap" style={{ gap: 8 }}>
              <button
                type="button"
                className={`button secondary ${showLookup ? "active" : ""}`}
                onClick={() => setShowLookup(!showLookup)}
              >
                <Search size={15} />
                Tra cứu bằng mã
              </button>
              <button
                type="button"
                className="button secondary icon-button"
                onClick={() => void loadMySubmissions()}
                title="Tải lại danh sách"
                aria-label="Tải lại danh sách"
              >
                <RefreshCw size={15} />
              </button>
            </div>
          </div>

          {showLookup && (
            <div className="panel" style={{ marginBottom: 20 }}>
              <h3>Tra cứu trạng thái bằng mã theo dõi</h3>
              <p className="muted small">
                Nhập mã bí mật 64 ký tự đã được cấp khi gửi đề thi để kiểm tra tiến trình duyệt hoặc chỉnh sửa.
              </p>
              <form
                className="row track-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleLookup();
                }}
                style={{ gap: 10, marginTop: 12 }}
              >
                <label className="field grow" style={{ margin: 0 }}>
                  Mã theo dõi
                  <input
                    required
                    value={lookupCode}
                    onChange={(e) => setLookupCode(e.target.value.trim())}
                    placeholder="Dán mã theo dõi 64 ký tự hex"
                    minLength={64}
                    maxLength={64}
                  />
                </label>
                <button className="button" disabled={lookupBusy}>
                  {lookupBusy ? "Đang tra cứu…" : "Tra cứu"}
                </button>
              </form>
              <ErrorMessage error={lookupIssue} />
              {lookupResult && (
                <div
                  className="panel"
                  style={{
                    marginTop: 16,
                    border: "1px solid var(--green-border)",
                    background: "var(--surface)",
                  }}
                >
                  <div className="row between wrap" style={{ gap: 8 }}>
                    <h4>{lookupResult.content.title}</h4>
                    <Badge status={lookupResult.status} />
                  </div>
                  <p className="muted small">
                    Gửi lúc {date(lookupResult.created_at)} · {lookupResult.content.subject} · {lookupResult.content.questions.length} câu
                  </p>
                  {lookupResult.review_note && (
                    <Notice>{lookupResult.review_note}</Notice>
                  )}
                  <div className="row" style={{ marginTop: 12 }}>
                    <button
                      type="button"
                      className="button small"
                      onClick={() => {
                        handleOpenExam({
                          ...lookupResult,
                          tracking_code: lookupCode,
                        });
                      }}
                    >
                      Xem & Chỉnh sửa đề này →
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <div
              className="row between wrap"
              style={{ marginBottom: 14, alignItems: "center" }}
            >
              <div className="row wrap" style={{ gap: 14, alignItems: "center" }}>
                <h2 style={{ margin: 0, fontSize: "18px" }}>
                  Các đề thi bạn đã đóng góp ({mySubmissions.length})
                </h2>
                {mySubmissions.length > 0 && (
                  <label className="card-checkbox-label">
                    <input
                      type="checkbox"
                      className="card-checkbox"
                      checked={
                        selectedIds.size === mySubmissions.length &&
                        mySubmissions.length > 0
                      }
                      onChange={toggleSelectAll}
                    />
                    <span>Chọn tất cả ({mySubmissions.length})</span>
                  </label>
                )}
              </div>
              {selectedIds.size > 0 && (
                <div
                  className="row wrap"
                  style={{ gap: 8, alignItems: "center" }}
                >
                  <span className="small muted">
                    Đã chọn: <strong>{selectedIds.size}</strong> đề
                  </span>
                  <button
                    type="button"
                    className="button small"
                    disabled={busy}
                    onClick={() => void handleSendSelected()}
                    title="Gửi các đề thi đã chọn lên quản trị viên duyệt"
                  >
                    <Send size={14} />
                    Gửi duyệt đã chọn ({selectedIds.size})
                  </button>
                  <button
                    type="button"
                    className="button small secondary danger-text"
                    disabled={busy}
                    onClick={() => void handleDeleteSelected()}
                    title="Xóa các đề thi đã chọn khỏi danh sách"
                  >
                    <Trash2 size={14} />
                    Xóa đã chọn ({selectedIds.size})
                  </button>
                </div>
              )}
            </div>

            {loadingMy ? (
              <Loading />
            ) : mySubmissions.length > 0 ? (
              <div className="contributions-grid">
                {mySubmissions.map((sub, idx) => (
                  <div
                    key={sub.id || idx}
                    className={`contribution-card ${selectedIds.has(sub.id) ? "selected" : ""}`}
                    onClick={() => handleOpenExam(sub)}
                  >
                    <div>
                      <div className="contribution-card-header">
                        <div
                          className="row"
                          style={{ gap: 10, alignItems: "center" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            className="card-checkbox"
                            checked={selectedIds.has(sub.id)}
                            onChange={() => toggleSelect(sub.id)}
                            aria-label={`Chọn đề ${sub.content?.title}`}
                          />
                          <span className="badge">
                            {sub.content?.subject || "Chung"}
                          </span>
                        </div>
                        <Badge status={sub.status} />
                      </div>
                      <h3 className="contribution-card-title">
                        {sub.content?.title || "Đề thi không tên"}
                      </h3>
                      <div className="contribution-card-meta">
                        <span className="exam-card-question-count">
                          <strong>
                            {sub.content?.questions?.length || 0}
                          </strong>{" "}
                          câu hỏi
                        </span>
                        <span>
                          {sub.content?.settings?.time_limit_minutes || 45} phút
                        </span>
                        <span>{date(sub.created_at)}</span>
                      </div>
                      {sub.review_note && (
                        <div style={{ marginBottom: 12 }}>
                          <Notice error={sub.status === "changes_requested"}>
                            {sub.review_note}
                          </Notice>
                        </div>
                      )}
                    </div>
                    <div className="contribution-card-footer">
                      <div className="row" style={{ gap: 6 }}>
                        <button
                          type="button"
                          className="button small secondary danger-text"
                          title="Xóa đề này"
                          onClick={(e) => void handleDeleteSingle(sub, e)}
                        >
                          <Trash2 size={13} />
                          Xóa
                        </button>
                      </div>
                      <div className="row" style={{ gap: 8 }}>
                        {sub.status === "changes_requested" && (
                          <button
                            type="button"
                            className="button small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenExam(sub);
                            }}
                          >
                            <Send size={13} />
                            Sửa & Gửi lại
                          </button>
                        )}
                        <button
                          type="button"
                          className="button small secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenExam(sub);
                          }}
                        >
                          Xem đề & Chỉnh sửa →
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state-card">
                <BookOpen size={48} />
                <h3>Bạn chưa gửi đề thi đóng góp nào</h3>
                <p>
                  Hãy cùng cộng đồng xây dựng kho đề phong phú và chuẩn mực. Bạn có thể soạn đề trực tiếp hoặc nạp từ file JSON mẫu có sẵn.
                </p>
                <div className="row wrap center" style={{ gap: 10, justifyContent: "center" }}>
                  <button
                    type="button"
                    className="button"
                    onClick={handleCreateNew}
                  >
                    <Plus size={16} />
                    Soạn đề mới ngay
                  </button>
                  <label className="button secondary upload-label">
                    <Upload size={15} />
                    Nhập file JSON
                    <input
                      type="file"
                      accept="application/json,.json"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleImportJson(f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => download("de-thi-mau-examsparty.json", template)}
                  >
                    <Download size={15} />
                    Tải file JSON mẫu
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {createdSuccess ? (
            <div className="panel success-panel">
              <CheckCircle2 size={48} />
              <h2>Đã gửi đề thi lên hệ thống duyệt!</h2>
              <p>
                Đề thi của bạn đã được chuyển vào hàng đợi duyệt của quản trị viên. Hãy lưu mã bí mật dưới đây để theo dõi kết quả hoặc gửi bản chỉnh sửa khi được yêu cầu.
              </p>
              <code className="tracking-code">{createdCode}</code>
              <div className="row wrap center" style={{ gap: 10, justifyContent: "center", marginTop: 16 }}>
                <button
                  type="button"
                  className="button"
                  onClick={() => {
                    download("ma-theo-doi-examsparty.json", { tracking_code: createdCode });
                  }}
                >
                  <Download size={15} />
                  Tải mã theo dõi
                </button>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => {
                    setCreatedSuccess(false);
                    setView("list");
                    void loadMySubmissions();
                  }}
                >
                  Quay lại danh sách đề đóng góp
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="panel" style={{ marginBottom: 16, padding: "12px 18px" }}>
                <div className="row between wrap" style={{ gap: 10, alignItems: "center" }}>
                  <button
                    type="button"
                    className="button secondary small"
                    onClick={() => {
                      setView("list");
                      void loadMySubmissions();
                    }}
                  >
                    <ArrowLeft size={15} />
                    Quay lại danh sách đề đóng góp
                  </button>
                  {activeSubmission && (
                    <div className="row" style={{ gap: 8, alignItems: "center" }}>
                      <span className="muted small">Trạng thái:</span>
                      <Badge status={activeSubmission.status} />
                    </div>
                  )}
                </div>
              </div>

              {activeSubmission?.status === "changes_requested" && activeSubmission.review_note && (
                <div style={{ marginBottom: 16 }}>
                  <Notice error>
                    <strong>Yêu cầu chỉnh sửa từ quản trị viên:</strong> {activeSubmission.review_note}
                  </Notice>
                </div>
              )}

              <ExamEditor
                raw={raw}
                onChange={setRaw}
                onBack={() => {
                  setView("list");
                  void loadMySubmissions();
                }}
              />

              <div className="panel contribution-actions" style={{ marginTop: 20 }}>
                <div
                  className="row wrap between"
                  style={{ width: "100%", gap: 16, alignItems: "flex-end" }}
                >
                  <label className="field" style={{ flex: "1 1 280px", margin: 0 }}>
                    Email liên hệ (để nhận kết quả duyệt)
                    <input
                      type="email"
                      required
                      maxLength={200}
                      value={contact}
                      onChange={(e) => setContact(e.target.value)}
                      placeholder="ban@example.com"
                    />
                  </label>
                  <div
                    style={{
                      flex: "1 1 360px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    <label
                      className="row"
                      style={{ cursor: "pointer", fontSize: "14px" }}
                    >
                      <input
                        type="checkbox"
                        checked={accepted}
                        onChange={(e) => setAccepted(e.target.checked)}
                      />
                      Tôi đã kiểm tra nội dung và có quyền chia sẻ học liệu này.
                    </label>
                    <div className="row wrap" style={{ gap: 8 }}>
                      {activeSubmission?.status === "changes_requested" ? (
                        <button
                          type="button"
                          className="button"
                          disabled={busy || !accepted}
                          onClick={() => void revise()}
                        >
                          <Send size={16} />
                          {busy ? "Đang gửi…" : "Gửi lại bản chỉnh sửa"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="button"
                          disabled={busy || !accepted}
                          onClick={() => void send()}
                        >
                          <Send size={16} />
                          {busy ? "Đang gửi…" : "Gửi đề thi lên duyệt"}
                        </button>
                      )}
                      <button
                        type="button"
                        className="button secondary"
                        onClick={() => {
                          try {
                            const parsed = JSON.parse(raw);
                            download(`${parsed.title || "de-thi"}.json`, parsed);
                          } catch {
                            alert("Đề thi chưa đúng định dạng JSON để tải về.");
                          }
                        }}
                      >
                        <Download size={15} />
                        Lưu file JSON về máy
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <ErrorMessage error={issue} />
            </>
          )}
        </>
      )}
    </>
  );
}
