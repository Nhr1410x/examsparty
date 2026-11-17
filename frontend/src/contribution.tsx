import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Download,
  Eye,
  FileJson,
  Pencil,
  Plus,
  Send,
  Upload,
  ArrowRight,
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
} from "./components";
import {
  emptyExam,
  emptyQuestion,
  ExamContent,
  Submission,
  template,
  typeLabels,
} from "./types";

export function ExamEditor({
  raw,
  onChange,
  initial = template,
  defaultMode = "preview",
}: {
  raw: string;
  onChange: (raw: string) => void;
  initial?: ExamContent;
  defaultMode?: "preview" | "form" | "json";
}) {
  const [mode, setMode] = useState<"preview" | "form" | "json">(defaultMode),
    [form, setForm] = useState<ExamContent>(() => {
      try {
        return JSON.parse(raw);
      } catch {
        return initial;
      }
    }),
    [issue, setIssue] = useState<unknown>(null),
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
  return (
    <div className="exam-editor">
      <div className="editor-toolbar">
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
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (f.size > 2 * 1024 * 1024) {
                  setIssue(new Error("JSON tối đa 2 MB."));
                  return;
                }
                const text = await f.text();
                onChange(text);
                try {
                  setForm(JSON.parse(text));
                  setMode("preview");
                } catch {
                  setMode("json");
                }
                e.target.value = "";
              }}
            />
          </label>
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
          <ExamPreview content={parsedContent} showAnswers={true} />
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
}: {
  content: ExamContent;
  showAnswers?: boolean;
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
        <article className="panel" key={q.client_id}>
          <span className="question-label">
            CÂU {i + 1} · {typeLabels[q.type]}
          </span>
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
  const [tab, setTab] = useState("send"),
    [raw, setRaw] = useState(() => {
      try {
        return (
          localStorage.getItem("ep-contribution-draft") ||
          JSON.stringify(template, null, 2)
        );
      } catch {
        return JSON.stringify(template, null, 2);
      }
    }),
    [contact, setContact] = useState(""),
    [preview, setPreview] = useState<ExamContent | null>(null),
    [issue, setIssue] = useState<unknown>(null),
    [busy, setBusy] = useState(false),
    [code, setCode] = useState(() => {
      try {
        return localStorage.getItem("ep-last-tracking") || "";
      } catch {
        return "";
      }
    }),
    [created, setCreated] = useState(false),
    [tracked, setTracked] = useState<Submission | null>(null),
    [accepted, setAccepted] = useState(false);
  useEffect(() => {
    try {
      localStorage.setItem("ep-contribution-draft", raw);
    } catch {}
    setPreview(null);
    setAccepted(false);
  }, [raw]);
  async function validate() {
    setBusy(true);
    setIssue(null);
    try {
      const response = await api<{ content: ExamContent }>(
        "/contributions/validate",
        "POST",
        JSON.parse(raw),
      );
      setPreview(response.content);
    } catch (e) {
      setIssue(e);
    } finally {
      setBusy(false);
    }
  }
  async function send() {
    if (!preview || !accepted) return;
    setBusy(true);
    setIssue(null);
    try {
      const response = await api<{ tracking_code: string }>(
        "/contributions",
        "POST",
        { contact, content: preview },
      );
      setCode(response.tracking_code);
      try {
        localStorage.setItem("ep-last-tracking", response.tracking_code);
      } catch {}
      setCreated(true);
    } catch (e) {
      setIssue(e);
    } finally {
      setBusy(false);
    }
  }
  async function track() {
    setBusy(true);
    setIssue(null);
    try {
      setTracked(
        await api<Submission>("/contributions/track", "POST", { code }),
      );
    } catch (e) {
      setIssue(e);
      setTracked(null);
    } finally {
      setBusy(false);
    }
  }
  async function revise() {
    setBusy(true);
    setIssue(null);
    try {
      await api("/contributions/revise", "PUT", {
        code,
        content: JSON.parse(raw),
      });
      setTracked((previous) =>
        previous ? { ...previous, status: "pending" } : null,
      );
      setTab("track");
    } catch (e) {
      setIssue(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Đóng góp nội dung</h1>
        </div>
      </div>
      <div className="tabs page-tabs">
        <button
          className={tab === "send" ? "active" : ""}
          onClick={() => setTab("send")}
        >
          Gửi nội dung
        </button>
        <button
          className={tab === "track" ? "active" : ""}
          onClick={() => setTab("track")}
        >
          Theo dõi đóng góp
        </button>
      </div>
      <ErrorMessage error={issue} />
      {tab === "send" ? (
        created ? (
          <div className="panel success-panel">
            <CheckCircle2 size={44} />
            <h2>Đã nhận đóng góp của bạn!</h2>
            <p>
              Nội dung đang chờ quản trị viên duyệt. Lưu mã bí mật dưới đây để
              theo dõi và chỉnh sửa khi được yêu cầu.
            </p>
            <code className="tracking-code">{code}</code>
            <button
              className="button"
              onClick={() => {
                download("ma-theo-doi.json", { tracking_code: code });
              }}
            >
              Tải mã theo dõi
            </button>
            <button
              className="button secondary"
              onClick={() => {
                setTab("track");
                void track();
              }}
            >
              Xem trạng thái
            </button>
          </div>
        ) : (
          <>
            <Notice>
              Nội dung chỉ xuất hiện công khai sau khi được duyệt. Email dùng để
              liên hệ; mã theo dõi cho phép xem trạng thái và gửi bản chỉnh sửa.
              Không đưa dữ liệu cá nhân vào đề.
            </Notice>
            <ExamEditor raw={raw} onChange={setRaw} />
            <div className="panel contribution-actions">
              <label className="field">
                Email liên hệ
                <input
                  type="email"
                  required
                  maxLength={200}
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="ban@example.com"
                />
              </label>
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => void validate()}
              >
                <Eye size={17} />
                {busy ? "Đang kiểm tra…" : "Kiểm tra & xem trước"}
              </button>
            </div>
            {preview && (
              <>
                <ExamPreview content={preview} />
                <div className="panel">
                  <label className="row">
                    <input
                      type="checkbox"
                      checked={accepted}
                      onChange={(e) => setAccepted(e.target.checked)}
                    />
                    Tôi đã kiểm tra nội dung và có quyền chia sẻ học liệu này.
                  </label>
                  <div className="row wrap">
                    <button
                      className="button"
                      disabled={busy || !accepted || !contact}
                      onClick={() => void send()}
                    >
                      <Send size={16} />
                      Gửi duyệt
                    </button>
                    {tracked?.status === "changes_requested" && (
                      <button
                        className="button secondary"
                        disabled={busy || !accepted}
                        onClick={() => void revise()}
                      >
                        Gửi lại bản chỉnh sửa
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </>
        )
      ) : (
        <>
          <div className="panel">
            <h2>Theo dõi nội dung đã gửi</h2>
            <p>Dùng mã được cấp sau khi gửi. Hãy giữ mã như một mật khẩu.</p>
            <form
              className="row track-form"
              onSubmit={(e) => {
                e.preventDefault();
                void track();
              }}
            >
              <label className="field grow">
                Mã theo dõi
                <input
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.trim())}
                  placeholder="Dán mã theo dõi 64 ký tự"
                  minLength={64}
                  maxLength={64}
                />
              </label>
              <button className="button" disabled={busy}>
                Tra cứu <ArrowRight size={16} />
              </button>
            </form>
          </div>
          {tracked && (
            <div className="panel">
              <div className="row between">
                <h2>{tracked.content.title}</h2>
                <Badge status={tracked.status} />
              </div>
              <p>Gửi lúc {date(tracked.created_at)}</p>
              {tracked.review_note && <Notice>{tracked.review_note}</Notice>}
              {tracked.status === "changes_requested" && (
                <button
                  className="button"
                  onClick={() => {
                    setRaw(JSON.stringify(tracked.content, null, 2));
                    setCreated(false);
                    setTab("send");
                  }}
                >
                  Chỉnh sửa & gửi lại
                </button>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}
