import { lazy, Suspense, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  Clock3,
  FileQuestion,
  Check,
  AlertCircle,
  LoaderCircle,
  X,
  Upload,
  Plus,
  Trash2,
  Copy,
  Sparkles,
  HelpCircle,
  Columns,
  Eye,
  Pencil,
} from "lucide-react";
const MathContent = lazy(() => import("./math"));
import { api, ApiError, download } from "./api";
import {
  Attempt,
  Block,
  ExamCard,
  GradedQuestion,
  PersonalExamSubject,
  Question,
  Response,
  typeLabels,
  statusLabels,
} from "./types";

export function Notice({
  error,
  children,
}: {
  error?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`notice ${error ? "error" : ""}`}
      role={error ? "alert" : "status"}
    >
      <AlertCircle size={18} />
      <div>{children}</div>
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={22} /> Đang tải nội dung…
    </div>
  );
}
export function Empty({
  text = "Chưa có nội dung phù hợp.",
}: {
  text?: string;
}) {
  return (
    <div className="empty">
      <BookOpen size={36} />
      <h3>{text}</h3>
      <p>Thử thay đổi bộ lọc hoặc quay lại sau nhé.</p>
    </div>
  );
}
export function ErrorMessage({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <Notice error>
      {error instanceof Error ? error.message : String(error)}
      {error instanceof ApiError && error.issues.length > 0 && (
        <>
          <ul>
            {error.issues.map((i, n) => (
              <li key={n}>
                <strong>{i.path}</strong>: {i.message}
              </li>
            ))}
          </ul>
          <button
            className="text-button"
            onClick={() => download("loi-xac-thuc.json", error.issues)}
          >
            Tải danh sách lỗi
          </button>
        </>
      )}
    </Notice>
  );
}
export function Badge({ status }: { status: string }) {
  return (
    <span className={`badge status-${status}`}>
      {status === "pending" ? "Chờ duyệt" : statusLabels[status] || status}
    </span>
  );
}
function highlightCode(code: string): React.ReactNode[] {
  const tokenRegex =
    /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\b(?:def|return|class|import|from|as|if|elif|else|while|for|in|try|except|finally|with|pass|break|continue|lambda|function|const|let|var|async|await|switch|case|default|new|typeof|void|delete|throw|catch|int|float|double|char|bool|boolean|struct|typedef|public|private|protected|static|final|enum|interface|namespace|using|include|package)\b)|(\b(?:true|false|True|False|None|null|undefined)\b)|(\b\d+(?:\.\d+)?\b)|(\b[a-zA-Z_]\w*(?=\s*\())|([{}()[\].,;:+\-*/%=<>!&|^~]+)|(\s+)|([^\s]+)/g;

  const nodes: React.ReactNode[] = [];
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = tokenRegex.exec(code)) !== null) {
    const [, comment, str, kw, boolVal, num, fn, punct, space, text] = match;
    if (comment) {
      nodes.push(<span key={key++} className="tok-com">{comment}</span>);
    } else if (str) {
      nodes.push(<span key={key++} className="tok-str">{str}</span>);
    } else if (kw) {
      nodes.push(<span key={key++} className="tok-kw">{kw}</span>);
    } else if (boolVal) {
      nodes.push(<span key={key++} className="tok-bool">{boolVal}</span>);
    } else if (num) {
      nodes.push(<span key={key++} className="tok-num">{num}</span>);
    } else if (fn) {
      nodes.push(<span key={key++} className="tok-fn">{fn}</span>);
    } else if (punct) {
      nodes.push(<span key={key++} className="tok-punct">{punct}</span>);
    } else if (space) {
      nodes.push(space);
    } else {
      nodes.push(<span key={key++} className="tok-text">{text}</span>);
    }
  }
  return nodes;
}

export function CodeBlock({ language, code }: { language?: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };
  return (
    <div className="code-block">
      <div className="code-block-header">
        <span className="code-lang">{language || "code"}</span>
        <button
          type="button"
          className="code-copy-btn"
          aria-label="Sao chép mã nguồn"
          onClick={handleCopy}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          <span>{copied ? "Đã chép" : "Sao chép"}</span>
        </button>
      </div>
      <pre>
        <code>{highlightCode(code)}</code>
      </pre>
    </div>
  );
}

export function parseMathAndCode(text: string): React.ReactNode[] {
  if (!text) return [];

  const tokenRegex =
    /```(?:([a-zA-Z0-9_-]+)\n)?([\s\S]+?)```|\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\$((?:\\\$|[^\$\n])+?)\$|\\\(([\s\S]+?)\\\)|`([^`\n]+)`/g;

  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const [
      ,
      codeLang,
      codeBlock,
      dispMath1,
      dispMath2,
      inlineMath1,
      inlineMath2,
      inlineCode,
    ] = match;

    if (codeBlock !== undefined) {
      nodes.push(
        <CodeBlock key={key++} language={codeLang} code={codeBlock.trim()} />,
      );
    } else if (dispMath1 !== undefined || dispMath2 !== undefined) {
      const math = (dispMath1 ?? dispMath2).trim();
      nodes.push(
        <Suspense key={key++} fallback={<code>$${math}$$</code>}>
          <MathContent value={math} inline={false} />
        </Suspense>,
      );
    } else if (inlineMath1 !== undefined || inlineMath2 !== undefined) {
      const math = (inlineMath1 ?? inlineMath2).trim();
      nodes.push(
        <Suspense key={key++} fallback={<code>${math}$</code>}>
          <MathContent value={math} inline={true} />
        </Suspense>,
      );
    } else if (inlineCode !== undefined) {
      nodes.push(
        <code key={key++} className="inline-code-token">
          {highlightCode(inlineCode)}
        </code>,
      );
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

export function isLikelyLatex(str: string): boolean {
  if (!str) return false;
  const trimmed = str.trim();
  if (
    (trimmed.startsWith("$") && trimmed.endsWith("$")) ||
    (trimmed.startsWith("\\[") && trimmed.endsWith("\\]")) ||
    (trimmed.startsWith("\\(") && trimmed.endsWith("\\)"))
  ) {
    return true;
  }
  return /\\[a-zA-Z]+|[\^_]\{|\b(?:sin|cos|tan|cot|log|ln|lim|sum|int|sqrt|frac|alpha|beta|gamma|theta|pi|pm|times|div|leq|geq|neq|approx|equiv|to|rightarrow|Rightarrow|in|notin|subset|supset|cap|cup|forall|exists)\b|\^[0-9]+|\/[0-9]+/.test(
    trimmed,
  );
}

export function isLikelyCode(str: string): boolean {
  if (!str) return false;
  const trimmed = str.trim();
  if (
    (trimmed.startsWith("`") && trimmed.endsWith("`")) ||
    trimmed.startsWith("```")
  ) {
    return true;
  }
  return /\b(?:def|return|class|import|from|function|const|let|var|console\.log|print|if|else|elif|for|while|try|catch|except)\b|[{}();]/.test(
    trimmed,
  );
}

export function cleanLatex(str: string): string {
  let s = str.trim();
  if (s.startsWith("$$") && s.endsWith("$$") && s.length >= 4) {
    return s.slice(2, -2).trim();
  }
  if (s.startsWith("$") && s.endsWith("$") && s.length >= 2) {
    return s.slice(1, -1).trim();
  }
  if (s.startsWith("\\[") && s.endsWith("\\]") && s.length >= 4) {
    return s.slice(2, -2).trim();
  }
  if (s.startsWith("\\(") && s.endsWith("\\)") && s.length >= 4) {
    return s.slice(2, -2).trim();
  }
  return s;
}

export function cleanCode(str: string): string {
  let s = str.trim();
  if (s.startsWith("```") && s.endsWith("```")) {
    const lines = s.slice(3, -3).trim().split("\n");
    if (lines.length > 0 && /^[a-zA-Z0-9]+$/.test(lines[0].trim())) {
      return lines.slice(1).join("\n");
    }
    return lines.join("\n");
  }
  if (s.startsWith("`") && s.endsWith("`") && s.length >= 2) {
    return s.slice(1, -1);
  }
  return s;
}

export function AnswerDisplay({ value }: { value: string }) {
  if (!value) return null;
  const trimmed = value.trim();

  if (
    trimmed.includes("$") ||
    trimmed.includes("`") ||
    trimmed.includes("\\[") ||
    trimmed.includes("\\(")
  ) {
    return (
      <span className="answer-smart-content">
        {parseMathAndCode(value)}
      </span>
    );
  }

  if (isLikelyLatex(trimmed)) {
    return (
      <span className="answer-math-formula">
        <Suspense fallback={<code>{trimmed}</code>}>
          <MathContent value={cleanLatex(trimmed)} inline={true} />
        </Suspense>
      </span>
    );
  }

  if (isLikelyCode(trimmed)) {
    return (
      <code className="inline-code-token">
        {highlightCode(cleanCode(trimmed))}
      </code>
    );
  }

  return <span className="answer-text-content">{value}</span>;
}

export function Blocks({ blocks }: { blocks?: Block[] }) {
  return (
    <div className="blocks">
      {blocks?.map((b, i) =>
        b.type === "math" ? (
          <Suspense key={i} fallback={<code>{b.value}</code>}>
            <MathContent value={b.value || ""} inline={false} />
          </Suspense>
        ) : b.type === "code" ? (
          <CodeBlock key={i} language={b.language} code={b.value || ""} />
        ) : b.type === "image" ? (
          <img
            key={i}
            src={`/api/assets/${b.asset_id}`}
            alt={b.alt || "Hình minh họa câu hỏi"}
            loading="lazy"
          />
        ) : (
          <div className="block-text-p" key={i}>
            {parseMathAndCode(b.value || "")}
          </div>
        ),
      )}
    </div>
  );
}
export function getSubjectTone(subject = ""): string {
  const s = subject.toLowerCase().trim();
  if (s.includes("toán")) return "math";
  if (s.includes("lý") || s.includes("vật")) return "physics";
  if (s.includes("hóa")) return "chemistry";
  if (s.includes("sinh")) return "biology";
  if (s.includes("anh") || s.includes("english")) return "english";
  if (s.includes("tin")) return "cs";
  if (s.includes("sử")) return "history";
  if (s.includes("địa")) return "geography";
  if (s.includes("văn") || s.includes("ngữ")) return "literature";
  return "default";
}

export function ExamTile({
  exam,
  horizontal = false,
}: {
  exam: ExamCard;
  horizontal?: boolean;
}) {
  const tone = getSubjectTone(exam.subject);
  return (
    <article
      className={`exam-card ${horizontal ? "exam-card-horizontal" : ""} card-hover-lift`}
    >
      <div className="exam-card-main">
        <div className="card-top">
          <span className={`subject-pill subject-${tone}`}>
            <span className="subject-dot" />
            {exam.subject}
          </span>
          <span className="exam-card-chip">
            <Clock3 size={13} />
            {exam.time_limit_minutes} phút
          </span>
          <span className="exam-card-chip">
            <FileQuestion size={13} />
            {exam.question_count} câu hỏi
          </span>
          {exam.grade && (
            <span className="exam-card-chip">Khối {exam.grade}</span>
          )}
        </div>
        <h3 className="exam-card-title">
          <Link to={`/exams/${exam.id}`}>{exam.title}</Link>
        </h3>
        {exam.topics && exam.topics.length > 0 && (
          <div className="exam-card-topics">
            {exam.topics.slice(0, 4).map((t) => (
              <span key={t} className="exam-topic-tag">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="card-footer exam-card-actions">
        {!horizontal && (
          <div className="card-meta-row">
            <span className="card-meta-item">
              <FileQuestion size={15} />
              <span>{exam.question_count} câu hỏi</span>
            </span>
          </div>
        )}
        <Link
          className="btn-take-exam button-step-press"
          aria-label={`Vào làm đề ${exam.title}`}
          to={`/exams/${exam.id}`}
        >
          <span>Vào làm bài</span>
          <ArrowRight size={14} className="btn-arrow" />
        </Link>
      </div>
    </article>
  );
}
export function AnswerInput({
  question: q,
  value,
  onChange,
  disabled = false,
  feedback,
}: {
  question: Question;
  value?: Response;
  onChange: (value: Response) => void;
  disabled?: boolean;
  feedback?: GradedQuestion | null;
}) {
  if (q.type === "single_choice" || q.type === "multiple_choice") {
    const correctIds = feedback?.answer?.correct_option_ids || [];
    const hasFeedback = Boolean(feedback && correctIds.length > 0);

    return (
      <fieldset className="options" disabled={disabled}>
        <legend className="sr-only">{typeLabels[q.type]}</legend>
        {q.options?.map((o, i) => {
          const selected =
            q.type === "single_choice"
              ? value === o.id
              : Array.isArray(value) && value.includes(o.id);
          const isCorrect = correctIds.includes(o.id);

          let stateClass = "";
          if (hasFeedback) {
            if (selected && isCorrect) {
              stateClass = "option-correct";
            } else if (selected && !isCorrect) {
              stateClass = "option-wrong";
            } else if (!selected && isCorrect) {
              stateClass = "option-reveal-correct";
            }
          } else if (selected) {
            stateClass = "selected";
          }

          return (
            <label
              key={o.id}
              className={`option ${stateClass}`}
            >
              <input
                type={q.type === "single_choice" ? "radio" : "checkbox"}
                name={`answer-${q.client_id}`}
                checked={selected}
                disabled={disabled}
                onChange={() =>
                  onChange(
                    q.type === "single_choice"
                      ? o.id
                      : selected
                        ? (value as string[]).filter((v) => v !== o.id)
                        : [...(Array.isArray(value) ? value : []), o.id],
                  )
                }
              />
              <span className="option-letter">
                {String.fromCharCode(65 + i)}
              </span>
              <Blocks blocks={o.content} />
              {hasFeedback ? (
                selected && isCorrect ? (
                  <span className="option-state-badge badge-correct">
                    <Check size={15} /> Đúng
                  </span>
                ) : selected && !isCorrect ? (
                  <span className="option-state-badge badge-wrong">
                    <X size={15} /> Sai
                  </span>
                ) : isCorrect ? (
                  <span className="option-state-badge badge-correct-reveal">
                    <Check size={15} /> Đáp án đúng
                  </span>
                ) : null
              ) : (
                selected && <Check className="option-check" size={18} />
              )}
            </label>
          );
        })}
      </fieldset>
    );
  }

  if (q.type === "true_false") {
    return (
      <div className="statements">
        {q.statements?.map((s) => {
          const userVal =
            value &&
            typeof value === "object" &&
            !Array.isArray(value) &&
            s.id in value
              ? value[s.id]
              : undefined;
          const hasStmtFeedback = Boolean(feedback && typeof s.answer === "boolean");

          return (
            <fieldset key={s.id} disabled={disabled} className="statement-row">
              <legend>
                <Blocks blocks={s.content} />
              </legend>
              <div className="row">
                {[true, false].map((v) => {
                  const isUserChosen = userVal === v;
                  const isStmtCorrect = s.answer === v;
                  let pillClass = "";

                  if (hasStmtFeedback) {
                    if (isUserChosen && isStmtCorrect) {
                      pillClass = "pill-correct";
                    } else if (isUserChosen && !isStmtCorrect) {
                      pillClass = "pill-wrong";
                    } else if (!isUserChosen && isStmtCorrect) {
                      pillClass = "pill-reveal";
                    }
                  } else if (isUserChosen) {
                    pillClass = "selected";
                  }

                  return (
                    <label className={`pill-radio ${pillClass}`} key={String(v)}>
                      <input
                        type="radio"
                        name={`${q.client_id}-${s.id}`}
                        checked={isUserChosen}
                        disabled={disabled}
                        onChange={() =>
                          onChange({
                            ...(value &&
                            typeof value === "object" &&
                            !Array.isArray(value)
                              ? value
                              : {}),
                            [s.id]: v,
                          })
                        }
                      />
                      {v ? "Đúng" : "Sai"}
                      {hasStmtFeedback && isStmtCorrect && (
                        <Check size={13} className="pill-check-icon" />
                      )}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
      </div>
    );
  }

  if (q.type === "short_answer") {
    const isFeedbackCorrect = feedback?.status === "correct";
    const isFeedbackWrong = feedback?.status === "wrong" || feedback?.status === "partial";
    const strVal = typeof value === "string" ? value : "";
    const hasMathOrCode =
      strVal.trim().length > 0 &&
      (isLikelyLatex(strVal) ||
        isLikelyCode(strVal) ||
        strVal.includes("$") ||
        strVal.includes("`") ||
        strVal.includes("\\[") ||
        strVal.includes("\\("));

    return (
      <label className="field">
        Câu trả lời của bạn
        <div className="short-answer-wrap">
          <input
            className={`short-answer-input ${isFeedbackCorrect ? "input-correct" : isFeedbackWrong ? "input-wrong" : ""}`}
            maxLength={2000}
            disabled={disabled}
            value={strVal}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Nhập đáp án (hỗ trợ công thức như \sqrt{2}, x^2 hoặc mã `code`)..."
          />
          {feedback && (
            <span className={`input-badge ${isFeedbackCorrect ? "badge-correct" : "badge-wrong"}`}>
              {isFeedbackCorrect ? <Check size={15} /> : <X size={15} />}
              {isFeedbackCorrect ? "Chính xác" : "Chưa chính xác"}
            </span>
          )}
        </div>
        {hasMathOrCode && (
          <div className="short-answer-preview">
            <span className="short-answer-preview-label">
              <Sparkles size={12} /> Xem trước công thức / mã:
            </span>
            <div className="short-answer-preview-box">
              <AnswerDisplay value={strVal} />
            </div>
          </div>
        )}
      </label>
    );
  }

  return (
    <label className="field">
      {q.type === "essay" ? "Bài viết của bạn" : "Câu trả lời của bạn"}
      {q.type === "essay" ? (
        <textarea
          rows={8}
          maxLength={20000}
          disabled={disabled}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Trình bày câu trả lời tại đây…"
        />
      ) : (
        <input
          maxLength={2000}
          disabled={disabled}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Nhập đáp án…"
        />
      )}
    </label>
  );
}

export function Feedback({ q }: { q: GradedQuestion }) {
  const isCorrect = q.status === "correct";
  const isPending = q.status === "pending";

  return (
    <div
      className={`feedback ${isCorrect ? "good" : isPending ? "neutral" : "bad"}`}
    >
      <div className="feedback-header">
        <div className="feedback-status-pill">
          {isCorrect ? (
            <Check size={16} className="status-icon" />
          ) : isPending ? (
            <Clock3 size={16} className="status-icon" />
          ) : (
            <X size={16} className="status-icon" />
          )}
          <strong>
            {isPending
              ? "Chưa chấm — cần người chấm đánh giá"
              : isCorrect
                ? "Chính xác! Bạn làm rất tốt."
                : statusLabels[q.status] || "Chưa chính xác"}
          </strong>
        </div>
        <span className="feedback-points">
          <strong>{Number(q.awarded.toFixed(2))}</strong> / {q.points} điểm
        </span>
      </div>

      {/* Prominent Correct Answer Showcase */}
      {q.answer?.correct_option_ids && q.options && q.options.length > 0 && (
        <div className="correct-answer-showcase">
          <div className="showcase-label">
            <Check size={14} /> ĐÁP ÁN CHÍNH XÁC
          </div>
          <div className="showcase-options">
            {q.options
              .filter((o) => q.answer!.correct_option_ids!.includes(o.id))
              .map((o) => {
                const optIndex = q.options!.findIndex((x) => x.id === o.id);
                const letter = optIndex >= 0 ? String.fromCharCode(65 + optIndex) : "";
                return (
                  <div className="showcase-option-item" key={o.id}>
                    {letter && <span className="showcase-letter">{letter}</span>}
                    <div className="showcase-content">
                      <Blocks blocks={o.content} />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {q.answer?.accepted && q.answer.accepted.length > 0 && (
        <div className="correct-answer-showcase">
          <div className="showcase-label">
            <Check size={14} /> ĐÁP ÁN CHẤP NHẬN
          </div>
          <div className="showcase-accepted-pills">
            {q.answer.accepted.map((ans, idx) => (
              <div className="accepted-pill-rich" key={idx}>
                <AnswerDisplay value={ans} />
              </div>
            ))}
          </div>
        </div>
      )}

      {q.statements && q.statements.length > 0 && (
        <div className="correct-answer-showcase">
          <div className="showcase-label">
            <Check size={14} /> ĐÁP ÁN ĐÚNG / SAI
          </div>
          <div className="showcase-statements">
            {q.statements.map((s, idx) => (
              <div className="showcase-stmt-row" key={s.id}>
                <span className={`stmt-truth-badge ${s.answer ? "truth-true" : "truth-false"}`}>
                  Ý {idx + 1}: {s.answer ? "Đúng" : "Sai"}
                </span>
                <Blocks blocks={s.content} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="explanation-section">
        <div className="explanation-header">
          <BookOpen size={16} />
          <strong>Lời giải chi tiết & Hướng dẫn</strong>
        </div>
        <div className="explanation-body">
          {q.explanation &&
          q.explanation.length > 0 &&
          !q.explanation.every((b) => !b.value && !b.asset_id) ? (
            <Blocks blocks={q.explanation} />
          ) : (
            <p
              className="muted small"
              style={{ fontStyle: "italic", margin: "6px 0 0 0" }}
            >
              (Chưa có lời giải chi tiết cho câu hỏi này. Bạn hãy đối chiếu với đáp án chính xác hiển thị ở trên)
            </p>
          )}
        </div>
      </div>

      {q.rubric && (
        <div className="rubric-section">
          <strong>Tiêu chí chấm:</strong> {q.rubric}
        </div>
      )}
    </div>
  );
}
export function FormatGuidePanel({ onClose }: { onClose?: () => void }) {
  return (
    <div className="format-guide-panel">
      <div className="format-guide-header">
        <strong>
          📖 Hướng dẫn định dạng đặc biệt (Toán KaTeX, Mã nguồn, Bảng Markdown)
        </strong>
        {onClose && (
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Đóng hướng dẫn"
          >
            <X size={14} />
          </button>
        )}
      </div>
      <div className="format-guide-grid">
        <div className="format-guide-col">
          <span className="format-guide-title">📐 Công thức Toán (KaTeX)</span>
          <p className="format-guide-desc">
            Kẹp giữa <code>$..$</code> (cùng dòng) hoặc <code>$$..$$</code> (khối riêng):
          </p>
          <ul className="format-guide-list">
            <li>
              <code>$x^2 - 4x + 3 = 0$</code> &rarr; phương trình
            </li>
            <li>
              <code>$\frac&#123;a&#125;&#123;b&#125;$</code> &rarr; phân số
            </li>
            <li>
              <code>$\sqrt&#123;x&#125;$</code> &rarr; căn bậc hai
            </li>
            <li>
              <code>$\lim_&#123;x \to 0&#125; \frac&#123;\sin x&#125;&#123;x&#125;$</code> &rarr; giới hạn
            </li>
            <li>
              <code>\alpha, \beta, \pi, \le, \ge, \neq, \in, \vec&#123;AB&#125;</code>
            </li>
          </ul>
        </div>
        <div className="format-guide-col">
          <span className="format-guide-title">💻 Mã nguồn (Code) & Bảng</span>
          <p className="format-guide-desc">Đoạn code & Bảng dữ liệu:</p>
          <ul className="format-guide-list">
            <li>
              Nhấn nút <strong>Thêm Mã nguồn</strong> hoặc dùng cú pháp Markdown:{" "}
              <code>```python ... ```</code>
            </li>
            <li>
              Tạo bảng Markdown trong khối Văn bản:
              <pre>
                <code>
                  {`| Cột 1 | Cột 2 |
| :--- | :--- |
| Dữ liệu 1 | Dữ liệu 2 |`}
                </code>
              </pre>
            </li>
          </ul>
        </div>
        <div className="format-guide-col">
          <span className="format-guide-title">✨ Chữ nổi bật & Hình ảnh</span>
          <p className="format-guide-desc">Định dạng đoạn văn:</p>
          <ul className="format-guide-list">
            <li>
              <code>**in đậm**</code>, <code>*in nghiêng*</code>, <code>`mã code`</code>
            </li>
            <li>
              Danh sách: gạch đầu dòng <code>- Mục 1</code>
            </li>
            <li>
              Ảnh minh họa: bấm nút <strong>Thêm Ảnh</strong> (chọn PNG, JPG &le; 2 MB)
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export function BlockEditor({
  value,
  onChange,
  label,
  allowSplit = false,
  defaultViewMode = "split",
  minHeight,
}: {
  value: Block[];
  onChange: (blocks: Block[]) => void;
  label: string;
  allowSplit?: boolean;
  defaultViewMode?: "edit" | "split" | "preview";
  minHeight?: number;
}) {
  const [error, setError] = useState<unknown>(null),
    [busy, setBusy] = useState(false),
    [viewMode, setViewMode] = useState<"edit" | "split" | "preview">(defaultViewMode),
    [showGuide, setShowGuide] = useState(false);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("image", file);
      const result = await api<{ asset_id: string }>("/uploads", "POST", form);
      onChange([
        ...value,
        { type: "image", asset_id: result.asset_id, alt: file.name },
      ]);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  const renderEditControls = () => (
    <div className={`block-edit-controls ${allowSplit || minHeight ? "block-editor-large" : ""}`}>
      {value.map((b, i) => (
        <div className="block-row" key={i}>
          <div className="block-value">
            <span className="small muted">
              {b.type === "math"
                ? "LaTeX (Công thức)"
                : b.type === "code"
                  ? "Đoạn mã"
                  : b.type === "image"
                    ? "Ảnh minh họa"
                    : "Văn bản (Hỗ trợ Markdown, KaTeX $...$, Bảng)"}
            </span>
            {b.type === "image" ? (
              <>
                <img
                  className="image-preview"
                  src={`/api/assets/${b.asset_id}`}
                  alt={b.alt}
                />
                <input
                  aria-label="Mô tả ảnh"
                  placeholder="Mô tả thay thế cho ảnh"
                  value={b.alt || ""}
                  onChange={(e) =>
                    onChange(
                      value.map((v, n) =>
                        n === i ? { ...v, alt: e.target.value } : v,
                      ),
                    )
                  }
                />
              </>
            ) : (
              <>
                <textarea
                  rows={b.type === "code" ? 8 : minHeight ? Math.round(minHeight / 24) : allowSplit ? 6 : 3}
                  style={
                    minHeight
                      ? {
                          minHeight,
                          fontSize: "14.5px",
                          lineHeight: "1.65",
                        }
                      : allowSplit
                        ? {
                            minHeight: b.type === "code" ? 160 : 130,
                            fontSize: "14px",
                            lineHeight: "1.6",
                          }
                        : undefined
                  }
                  aria-label={`${label} — ${b.type}`}
                  placeholder={
                    b.type === "math"
                      ? "Nhập công thức LaTeX, ví dụ: x = \\frac{-b \\pm \\sqrt{\\Delta}}{2a}"
                      : b.type === "code"
                        ? "Dán hoặc gõ mã nguồn tại đây..."
                        : "Nhập nội dung văn bản. Có thể dùng $...$ cho toán, hoặc bảng | Cột 1 | Cột 2 |"
                  }
                  value={b.value || ""}
                  onChange={(e) =>
                    onChange(
                      value.map((v, n) =>
                        n === i ? { ...v, value: e.target.value } : v,
                      ),
                    )
                  }
                />
                {b.type === "code" && (
                  <input
                    aria-label="Ngôn ngữ mã"
                    value={b.language || ""}
                    placeholder="Ngôn ngữ (python, javascript, cpp, java, sql...)"
                    onChange={(e) =>
                      onChange(
                        value.map((v, n) =>
                          n === i ? { ...v, language: e.target.value } : v,
                        ),
                      )
                    }
                  />
                )}
              </>
            )}
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Xóa khối"
            title="Xóa khối này"
            onClick={() => onChange(value.filter((_, n) => n !== i))}
          >
            <X size={16} />
          </button>
        </div>
      ))}
      <div className="row wrap" style={{ gap: 8, marginTop: 8 }}>
        {(["text", "math", "code"] as const).map((type) => (
          <button
            type="button"
            className="button small secondary"
            key={type}
            onClick={() => onChange([...value, { type, value: "" }])}
          >
            <Plus size={14} />
            {type === "text"
              ? "Thêm Văn bản"
              : type === "math"
                ? "Thêm Công thức"
                : "Thêm Mã nguồn"}
          </button>
        ))}
        <label className="button small secondary upload-label">
          <Upload size={14} />
          {busy ? "Đang tải…" : "Thêm Ảnh (≤ 2 MB)"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      <ErrorMessage error={error} />
    </div>
  );

  const renderLivePreview = () => (
    <div className="block-live-preview-box">
      <div className="row between" style={{ marginBottom: 8, alignItems: "center" }}>
        <span className="preview-label-tag">Xem trước trực quan (Live Preview)</span>
      </div>
      {value.length === 0 || value.every((b) => !b.value && !b.asset_id) ? (
        <p className="muted small" style={{ fontStyle: "italic", margin: "16px 0" }}>
          (Chưa có nội dung. Hãy nhập nội dung hoặc thêm khối ở phần soạn thảo)
        </p>
      ) : (
        <Blocks blocks={value} />
      )}
    </div>
  );

  return (
    <div className={`block-editor ${allowSplit ? "block-editor-featured" : ""}`}>
      {allowSplit ? (
        <div className="block-editor-header">
          <span className="field-label" style={{ margin: 0, fontWeight: 600 }}>
            {label}
          </span>
          <div className="block-editor-toolbar">
            <button
              type="button"
              className={`guide-toggle-btn ${showGuide ? "active" : ""}`}
              onClick={() => setShowGuide(!showGuide)}
              title="Xem bảng hướng dẫn viết công thức Toán, Code, Bảng"
            >
              <HelpCircle size={14} />
              <span>Hướng dẫn định dạng</span>
            </button>
            <div
              className="segmented-control"
              role="tablist"
              aria-label="Chế độ hiển thị"
            >
              <button
                type="button"
                className={viewMode === "edit" ? "active" : ""}
                onClick={() => setViewMode("edit")}
                title="Chỉ hiển thị khung soạn thảo"
              >
                <Pencil size={13} />
                <span>Soạn thảo</span>
              </button>
              <button
                type="button"
                className={viewMode === "split" ? "active" : ""}
                onClick={() => setViewMode("split")}
                title="Chia đôi màn hình: Soạn thảo bên trái, Xem trước bên phải"
              >
                <Columns size={13} />
                <span>Chia đôi</span>
              </button>
              <button
                type="button"
                className={viewMode === "preview" ? "active" : ""}
                onClick={() => setViewMode("preview")}
                title="Chỉ hiển thị bản xem trước trực quan"
              >
                <Eye size={13} />
                <span>Xem trước</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <span className="field-label">{label}</span>
      )}

      {allowSplit && showGuide && <FormatGuidePanel onClose={() => setShowGuide(false)} />}

      {allowSplit ? (
        viewMode === "split" ? (
          <div className="block-split-container">
            <div className="block-split-edit-col">{renderEditControls()}</div>
            <div className="block-split-preview-col">{renderLivePreview()}</div>
          </div>
        ) : viewMode === "preview" ? (
          <div className="block-preview-only">{renderLivePreview()}</div>
        ) : (
          renderEditControls()
        )
      ) : (
        renderEditControls()
      )}
    </div>
  );
}
export function QuestionLivePreview({
  q,
  showAnswers = true,
}: {
  q: Question;
  showAnswers?: boolean;
}) {
  const isSingle = q.type === "single_choice";
  const isMultiple = q.type === "multiple_choice";
  const isTrueFalse = q.type === "true_false";
  const isShort = q.type === "short_answer";
  const isEssay = q.type === "essay";

  return (
    <div className="question-live-preview-card">
      <div className="question-live-preview-header">
        <div className="row wrap" style={{ gap: 8, alignItems: "center" }}>
          <span className="question-number-pill">CÂU {q.client_id?.toUpperCase() || "?"}</span>
          <span className="question-type-tag">{typeLabels[q.type]}</span>
          <span className="question-points-tag">{q.points || 1} điểm</span>
          <span className="question-diff-tag">
            {q.difficulty === "easy"
              ? "Cơ bản"
              : q.difficulty === "hard"
                ? "Vận dụng"
                : "Thông hiểu"}
          </span>
        </div>
        <span className="preview-label-tag">Xem trước trực quan</span>
      </div>

      {/* 1. Phần câu hỏi (Question prompt) */}
      <div className="preview-section-box prompt-box">
        <div className="preview-section-title">
          <span>NỘI DUNG CÂU HỎI</span>
        </div>
        {q.prompt.length === 0 || q.prompt.every((b) => !b.value && !b.asset_id) ? (
          <p className="muted small" style={{ fontStyle: "italic", margin: "10px 0" }}>
            (Chưa có nội dung câu hỏi. Hãy nhập văn bản hoặc công thức toán ở cột soạn thảo...)
          </p>
        ) : (
          <div className="preview-prompt-content">
            <Blocks blocks={q.prompt} />
          </div>
        )}
      </div>

      {/* 2. Phần đáp án & phương án lựa chọn */}
      <div className="preview-section-box answers-box">
        <div className="preview-section-title">
          <span>ĐÁP ÁN & PHƯƠNG ÁN LỰA CHỌN</span>
          {showAnswers && (isSingle || isMultiple || isTrueFalse || isShort) && (
            <span className="correct-badge-pill">Đã đánh dấu đáp án đúng</span>
          )}
        </div>

        {(isSingle || isMultiple) && (
          <div className="preview-options-list">
            {!q.options || q.options.length === 0 ? (
              <p className="muted small" style={{ fontStyle: "italic", margin: "6px 0" }}>
                (Chưa có phương án lựa chọn. Nhấn "Thêm phương án" ở bên soạn thảo)
              </p>
            ) : (
              q.options.map((opt, idx) => {
                const isCorrect = q.answer?.correct_option_ids?.includes(opt.id);
                const letter = String.fromCharCode(65 + idx);
                return (
                  <div
                    key={opt.id}
                    className={`preview-option-row ${isCorrect ? "correct-option" : ""}`}
                  >
                    <div className="option-letter-badge">{letter}</div>
                    <div className="option-content-body">
                      {opt.content.length === 0 || opt.content.every((b) => !b.value && !b.asset_id) ? (
                        <span className="muted small">(Trống)</span>
                      ) : (
                        <Blocks blocks={opt.content} />
                      )}
                    </div>
                    {isCorrect && (
                      <span className="option-correct-tag">
                        <Check size={13} />
                        Đáp án đúng
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {isTrueFalse && (
          <div className="preview-statements-list">
            {!q.statements || q.statements.length === 0 ? (
              <p className="muted small" style={{ fontStyle: "italic", margin: "6px 0" }}>
                (Chưa có nhận định. Nhấn "Thêm nhận định" ở bên soạn thảo)
              </p>
            ) : (
              q.statements.map((stmt, idx) => (
                <div key={stmt.id} className="preview-statement-row">
                  <div className="statement-num-badge">Ý {idx + 1}</div>
                  <div className="statement-body">
                    {stmt.content.length === 0 || stmt.content.every((b) => !b.value && !b.asset_id) ? (
                      <span className="muted small">(Trống)</span>
                    ) : (
                      <Blocks blocks={stmt.content} />
                    )}
                  </div>
                  <span className={`statement-answer-tag ${stmt.answer ? "is-true" : "is-false"}`}>
                    {stmt.answer ? "Đúng (True)" : "Sai (False)"}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {isShort && (
          <div className="preview-short-answers">
            <span className="small muted">Các đáp án được chấm đúng:</span>
            {!q.answer?.accepted || q.answer.accepted.length === 0 || q.answer.accepted.every((a) => !a.trim()) ? (
              <p className="muted small" style={{ fontStyle: "italic", marginTop: 4 }}>
                (Chưa có đáp án chấp nhận)
              </p>
            ) : (
              <div className="showcase-accepted-pills" style={{ marginTop: 8 }}>
                {q.answer.accepted
                  .filter((a) => a.trim().length > 0)
                  .map((ans, idx) => (
                    <div className="accepted-pill-rich correct" key={idx}>
                      <Check size={12} />
                      <AnswerDisplay value={ans} />
                    </div>
                  ))}
              </div>
            )}
            <div className="row wrap" style={{ gap: 12, marginTop: 8, fontSize: "12px", color: "var(--muted)" }}>
              <span>Phân biệt hoa/thường: {q.answer?.case_sensitive ? "Có" : "Không"}</span>
              {q.answer?.numeric_tolerance !== undefined && (
                <span>Dung sai số: ±{q.answer.numeric_tolerance}</span>
              )}
            </div>
          </div>
        )}

        {isEssay && (
          <div className="preview-essay-rubric">
            <span className="small muted">Tiêu chí chấm tự luận:</span>
            <div className="rubric-content-box" style={{ marginTop: 6 }}>
              {q.rubric?.trim() ? (
                <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{q.rubric}</p>
              ) : (
                <p className="muted small" style={{ fontStyle: "italic", margin: 0 }}>
                  (Chưa có tiêu chí chấm tự luận)
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3. Phần giải (Detailed solution & explanation) */}
      <div className="preview-section-box explanation-box">
        <div className="preview-section-title">
          <span className="green-text">LỜI GIẢI CHI TIẾT & HƯỚNG DẪN</span>
        </div>
        {!q.explanation || q.explanation.length === 0 || q.explanation.every((b) => !b.value && !b.asset_id) ? (
          <p className="muted small" style={{ fontStyle: "italic", margin: "8px 0" }}>
            (Chưa có lời giải chi tiết. Hãy nhập ở mục "Lời giải chi tiết" bên soạn thảo)
          </p>
        ) : (
          <div className="explanation-callout-panel">
            <Blocks blocks={q.explanation} />
          </div>
        )}
      </div>
    </div>
  );
}

export function QuestionEditor({
  q,
  onChange,
  onRemove,
  defaultViewMode = "split",
}: {
  q: Question;
  onChange: (q: Question) => void;
  onRemove: () => void;
  defaultViewMode?: "split" | "edit" | "preview";
}) {
  const [viewMode, setViewMode] = useState<"split" | "edit" | "preview">(defaultViewMode),
    [showGuide, setShowGuide] = useState(false);

  const update = (patch: Partial<Question>) => onChange({ ...q, ...patch });

  function setType(type: Question["type"]) {
    const next = { ...q, type };
    delete next.options;
    delete next.statements;
    delete next.answer;
    delete next.rubric;
    if (type === "single_choice" || type === "multiple_choice") {
      next.options = [
        { id: "a", content: [{ type: "text", value: "" }] },
        { id: "b", content: [{ type: "text", value: "" }] },
      ];
      next.answer = { correct_option_ids: ["a"] };
    }
    if (type === "true_false")
      next.statements = [
        { id: "s1", content: [{ type: "text", value: "" }], answer: true },
      ];
    if (type === "short_answer")
      next.answer = { accepted: [""], case_sensitive: false };
    onChange(next);
  }

  const renderEditForm = () => (
    <div className="question-workspace-edit-col">
      <div className="form-grid">
        <label className="field">
          Dạng câu hỏi
          <select
            value={q.type}
            onChange={(e) => setType(e.target.value as Question["type"])}
          >
            {Object.entries(typeLabels).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Điểm
          <input
            type="number"
            min="0"
            max="100"
            step="0.5"
            value={q.points}
            onChange={(e) => update({ points: Number(e.target.value) })}
          />
        </label>
        <label className="field">
          Mức độ
          <select
            value={q.difficulty}
            onChange={(e) =>
              update({ difficulty: e.target.value as Question["difficulty"] })
            }
          >
            <option value="easy">Cơ bản</option>
            <option value="medium">Thông hiểu</option>
            <option value="hard">Vận dụng</option>
          </select>
        </label>
      </div>

      <div className="question-prompt-edit-wrap" style={{ marginTop: 12 }}>
        <BlockEditor
          label="Nội dung câu hỏi (Đề bài)"
          value={q.prompt}
          onChange={(prompt) => update({ prompt })}
          allowSplit={false}
          minHeight={240}
        />
      </div>

      {/* Options for single_choice / multiple_choice */}
      {(q.type === "single_choice" || q.type === "multiple_choice") && (
        <div className="question-options-section" style={{ marginTop: 16 }}>
          <span className="eyebrow" style={{ display: "block", marginBottom: 8 }}>
            CÁC PHƯƠNG ÁN LỰA CHỌN
          </span>
          {q.options?.map((o, i) => (
            <div className="option-editor" key={o.id}>
              <div className="row between">
                <label className="row" style={{ fontWeight: 600 }}>
                  <input
                    type={q.type === "single_choice" ? "radio" : "checkbox"}
                    name={`correct-${q.client_id}`}
                    checked={q.answer?.correct_option_ids?.includes(o.id) || false}
                    onChange={() =>
                      update({
                        answer: {
                          ...q.answer,
                          correct_option_ids:
                            q.type === "single_choice"
                              ? [o.id]
                              : q.answer?.correct_option_ids?.includes(o.id)
                                ? q.answer.correct_option_ids.filter((id) => id !== o.id)
                                : [...(q.answer?.correct_option_ids || []), o.id],
                        },
                      })
                    }
                  />
                  Đáp án {String.fromCharCode(65 + i)} đúng
                </label>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Xóa phương án ${o.id}`}
                  onClick={() =>
                    update({
                      options: q.options!.filter((x) => x.id !== o.id),
                      answer: {
                        ...q.answer,
                        correct_option_ids: q.answer?.correct_option_ids?.filter(
                          (id) => id !== o.id,
                        ),
                      },
                    })
                  }
                >
                  <X size={16} />
                </button>
              </div>
              <BlockEditor
                label={`Phương án ${String.fromCharCode(65 + i)}`}
                value={o.content}
                onChange={(content) =>
                  update({
                    options: q.options!.map((v) =>
                      v.id === o.id ? { ...v, content } : v,
                    ),
                  })
                }
                minHeight={70}
              />
            </div>
          ))}
          {q.options && q.options.length < 20 && (
            <button
              type="button"
              className="button secondary small"
              onClick={() =>
                update({
                  options: [
                    ...q.options!,
                    {
                      id: `o${Date.now()}`,
                      content: [{ type: "text", value: "" }],
                    },
                  ],
                })
              }
            >
              <Plus size={16} />
              Thêm phương án
            </button>
          )}
          {q.type === "multiple_choice" && (
            <label className="row" style={{ marginTop: 10 }}>
              <input
                type="checkbox"
                checked={q.answer?.partial_credit || false}
                onChange={(e) =>
                  update({
                    answer: { ...q.answer, partial_credit: e.target.checked },
                  })
                }
              />
              Điểm từng phần (chọn thừa bị trừ, tối thiểu 0)
            </label>
          )}
        </div>
      )}

      {/* Statements for true_false */}
      {q.type === "true_false" && (
        <div className="question-statements-section" style={{ marginTop: 16 }}>
          <span className="eyebrow" style={{ display: "block", marginBottom: 8 }}>
            CÁC NHẬN ĐỊNH ĐÚNG / SAI
          </span>
          {q.statements?.map((s) => (
            <div className="option-editor" key={s.id}>
              <BlockEditor
                label={`Nhận định ${s.id}`}
                value={s.content}
                onChange={(content) =>
                  update({
                    statements: q.statements!.map((v) =>
                      v.id === s.id ? { ...v, content } : v,
                    ),
                  })
                }
                minHeight={70}
              />
              <div className="row between" style={{ marginTop: 6 }}>
                <label className="row">
                  Đáp án:
                  <select
                    aria-label={`Đáp án ${s.id}`}
                    value={String(s.answer)}
                    onChange={(e) =>
                      update({
                        statements: q.statements!.map((v) =>
                          v.id === s.id
                            ? { ...v, answer: e.target.value === "true" }
                            : v,
                        ),
                      })
                    }
                  >
                    <option value="true">Đúng (True)</option>
                    <option value="false">Sai (False)</option>
                  </select>
                </label>
                <button
                  type="button"
                  className="button small secondary"
                  onClick={() =>
                    update({
                      statements: q.statements!.filter((v) => v.id !== s.id),
                    })
                  }
                >
                  Xóa nhận định
                </button>
              </div>
            </div>
          ))}
          {q.statements && q.statements.length < 20 && (
            <button
              type="button"
              className="button secondary small"
              onClick={() =>
                update({
                  statements: [
                    ...q.statements!,
                    {
                      id: `s${Date.now()}`,
                      content: [{ type: "text", value: "" }],
                      answer: true,
                    },
                  ],
                })
              }
            >
              <Plus size={16} />
              Thêm nhận định
            </button>
          )}
        </div>
      )}

      {/* Short answer */}
      {q.type === "short_answer" && (
        <div className="question-short-answer-section" style={{ marginTop: 16 }}>
          <label className="field">
            <div className="row between wrap" style={{ gap: 8, marginBottom: 4 }}>
              <span>Đáp án chấp nhận (mỗi dòng một đáp án)</span>
              <div className="row" style={{ gap: 6 }}>
                <button
                  type="button"
                  className="button secondary small mini-tool-btn"
                  onClick={() => {
                    const cur = q.answer?.accepted || [];
                    update({
                      answer: { ...q.answer, accepted: [...cur, "\\sqrt{2}"] },
                    });
                  }}
                >
                  <Plus size={12} /> Thêm công thức math mẫu
                </button>
                <button
                  type="button"
                  className="button secondary small mini-tool-btn"
                  onClick={() => {
                    const cur = q.answer?.accepted || [];
                    update({
                      answer: { ...q.answer, accepted: [...cur, "`return n * 2`"] },
                    });
                  }}
                >
                  <Plus size={12} /> Thêm mã code mẫu
                </button>
              </div>
            </div>
            <textarea
              rows={4}
              value={q.answer?.accepted?.join("\n") || ""}
              onChange={(e) =>
                update({
                  answer: { ...q.answer, accepted: e.target.value.split("\n") },
                })
              }
              placeholder="Nhập các đáp án chấp nhận (hỗ trợ công thức \sqrt{2}, x^2 và mã `code`)..."
            />
          </label>
          <div className="row wrap" style={{ gap: 14 }}>
            <label className="row">
              <input
                type="checkbox"
                checked={q.answer?.case_sensitive || false}
                onChange={(e) =>
                  update({
                    answer: { ...q.answer, case_sensitive: e.target.checked },
                  })
                }
              />
              Phân biệt hoa/thường
            </label>
            <label className="field" style={{ flex: 1, minWidth: 200, margin: 0 }}>
              Dung sai số (để trống nếu so văn bản)
              <input
                type="number"
                min="0"
                step="any"
                value={q.answer?.numeric_tolerance ?? ""}
                onChange={(e) => {
                  const answer = { ...q.answer };
                  if (e.target.value === "") delete answer.numeric_tolerance;
                  else answer.numeric_tolerance = Number(e.target.value);
                  update({ answer });
                }}
              />
            </label>
          </div>
        </div>
      )}

      {/* Essay rubric */}
      {q.type === "essay" && (
        <div className="question-essay-section" style={{ marginTop: 16 }}>
          <label className="field">
            Tiêu chí chấm tự luận (Rubric)
            <textarea
              rows={4}
              value={q.rubric || ""}
              onChange={(e) => update({ rubric: e.target.value })}
              placeholder="Mô tả các bước cho điểm, tiêu chí đạt điểm tối đa..."
            />
          </label>
        </div>
      )}

      {/* Explanation */}
      <div className="question-explanation-edit-wrap" style={{ marginTop: 18 }}>
        <BlockEditor
          label="Lời giải chi tiết (Hiển thị cho học sinh sau khi nộp bài)"
          value={q.explanation}
          onChange={(explanation) => update({ explanation })}
          allowSplit={false}
          minHeight={160}
        />
      </div>

      {/* Tags */}
      <label className="field" style={{ marginTop: 16 }}>
        Thẻ chủ đề (cách nhau bằng dấu phẩy)
        <input
          value={q.tags.join(", ")}
          onChange={(e) =>
            update({
              tags: e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
          placeholder="Ví dụ: Đạo hàm, Hình học không gian, Python..."
        />
      </label>
    </div>
  );

  return (
    <div className="question-editor panel">
      {/* 1. Header Toolbar with Mode Switcher & Tools */}
      <div
        className="row between wrap question-editor-top-bar"
        style={{ marginBottom: 16, alignItems: "center", gap: 12 }}
      >
        <div className="row wrap" style={{ gap: 8, alignItems: "center" }}>
          <span
            className="question-number-pill"
            style={{ fontSize: "14px", padding: "5px 12px" }}
          >
            CÂU {q.client_id?.toUpperCase()}
          </span>
          <span className="question-type-tag">{typeLabels[q.type]}</span>
          <span className="question-points-tag">{q.points || 1} điểm</span>
        </div>

        <div className="row wrap" style={{ gap: 10, alignItems: "center" }}>
          <div className="segmented-control" role="tablist">
            <button
              type="button"
              className={viewMode === "split" ? "active" : ""}
              onClick={() => setViewMode("split")}
              title="Chia đôi màn hình: Soạn thảo bên trái, Xem trước đầy đủ bên phải"
            >
              <Columns size={13} />
              <span>Chia đôi</span>
            </button>
            <button
              type="button"
              className={viewMode === "edit" ? "active" : ""}
              onClick={() => setViewMode("edit")}
              title="Chỉ hiển thị khung soạn thảo"
            >
              <Pencil size={13} />
              <span>Chỉ soạn</span>
            </button>
            <button
              type="button"
              className={viewMode === "preview" ? "active" : ""}
              onClick={() => setViewMode("preview")}
              title="Chỉ hiển thị bản xem trước hoàn chỉnh"
            >
              <Eye size={13} />
              <span>Chỉ xem</span>
            </button>
          </div>

          <button
            type="button"
            className={`guide-toggle-btn ${showGuide ? "active" : ""}`}
            onClick={() => setShowGuide(!showGuide)}
            title="Xem bảng hướng dẫn viết công thức Toán KaTeX, Code, Bảng"
          >
            <HelpCircle size={14} />
            <span>Hướng dẫn ký hiệu</span>
          </button>

          <button
            type="button"
            className="button small secondary danger-text"
            aria-label={`Xóa câu ${q.client_id}`}
            onClick={onRemove}
            title="Xóa câu hỏi này"
          >
            <Trash2 size={15} />
            <span>Xóa câu này</span>
          </button>
        </div>
      </div>

      {showGuide && <FormatGuidePanel onClose={() => setShowGuide(false)} />}

      {/* Main Content Area: Split or Single Column */}
      <div className={`question-workspace-container mode-${viewMode}`}>
        {(viewMode === "split" || viewMode === "edit") && renderEditForm()}

        {(viewMode === "split" || viewMode === "preview") && (
          <div className="question-workspace-preview-col">
            <div className="preview-sticky-container">
              <QuestionLivePreview q={q} showAnswers={true} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function GeneratePersonalExamModal({
  open,
  onClose,
  onCreated,
  initialSubject,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (exam: ExamCard) => void;
  initialSubject?: string;
}) {
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<PersonalExamSubject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState(initialSubject || "");
  const [questionCount, setQuestionCount] = useState(10);
  const [timeLimit, setTimeLimit] = useState(20);
  const [mode, setMode] = useState<"practice" | "exam">("practice");
  const [customTitle, setCustomTitle] = useState("");
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setLoadingSubjects(true);
    api<PersonalExamSubject[]>("/personal-exams/subjects")
      .then((data) => {
        setSubjects(data);
        if (data.length > 0) {
          const defaultSub =
            initialSubject && data.some((s) => s.subject === initialSubject)
              ? initialSubject
              : data[0].subject;
          setSelectedSubject(defaultSub);
        }
      })
      .catch((err) => setError(err))
      .finally(() => setLoadingSubjects(false));
  }, [open, initialSubject]);

  if (!open) return null;

  const currentSubjectObj = subjects.find((s) => s.subject === selectedSubject);
  const maxAvailable = currentSubjectObj?.available_questions || 10;

  async function handleGenerate(startNow: boolean) {
    if (!selectedSubject) return;
    setError(null);
    setBusy(true);
    try {
      const exam = await api<ExamCard>("/personal-exams/generate", "POST", {
        subject: selectedSubject,
        question_count: Math.min(questionCount, maxAvailable),
        time_limit_minutes: timeLimit,
        title: customTitle.trim() || undefined,
      });

      if (startNow) {
        const attempt = await api<Attempt>("/attempts", "POST", {
          exam_id: exam.id,
          mode,
        });
        onClose();
        navigate(`/attempts/${attempt.id}`);
      } else {
        if (onCreated) onCreated(exam);
        onClose();
      }
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-dialog generate-exam-dialog panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-gen-title"
      >
        <div className="modal-dialog-header">
          <div className="row wrap" style={{ gap: 10, alignItems: "center" }}>
            <span className="modal-icon-badge">
              <Sparkles size={20} />
            </span>
            <div>
              <h2 id="modal-gen-title" style={{ margin: 0, fontSize: "19px" }}>
                Tạo đề tự luyện cá nhân
              </h2>
              <span className="small muted">
                Tự động bốc câu hỏi từ kho đề theo môn • Chỉ lưu vào kho cá nhân của bạn
              </span>
            </div>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Đóng hộp thoại"
            title="Đóng"
          >
            <X size={18} />
          </button>
        </div>

        <ErrorMessage error={error} />

        <div className="modal-dialog-body">
          {/* Môn học */}
          <div className="field-group">
            <label className="field-label">
              <strong>1. Chọn môn học:</strong>
            </label>
            {loadingSubjects ? (
              <Loading />
            ) : subjects.length > 0 ? (
              <div className="subject-select-grid">
                {subjects.map((s) => {
                  const tone = getSubjectTone(s.subject);
                  const isSelected = selectedSubject === s.subject;
                  return (
                    <button
                      key={s.subject}
                      type="button"
                      className={`subject-select-btn ${isSelected ? "selected" : ""}`}
                      onClick={() => {
                        setSelectedSubject(s.subject);
                        if (questionCount > s.available_questions) {
                          setQuestionCount(s.available_questions);
                        }
                      }}
                    >
                      <span className={`subject-dot-indicator tone-${tone}`} />
                      <span className="subject-btn-name">{s.subject}</span>
                      <span className="subject-q-count">
                        {s.available_questions} câu có sẵn
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="small muted">
                Chưa có môn học nào có câu hỏi trong kho đề.
              </p>
            )}
          </div>

          {/* Số câu hỏi */}
          <div className="field-group">
            <div
              className="row between"
              style={{ alignItems: "center", marginBottom: 6 }}
            >
              <label className="field-label" style={{ margin: 0 }}>
                <strong>2. Số lượng câu hỏi:</strong>{" "}
                <span className="green-text font-bold">
                  {Math.min(questionCount, maxAvailable)} câu
                </span>
              </label>
              <span className="small muted">
                (Kho đề hiện có {maxAvailable} câu môn này)
              </span>
            </div>
            <div className="row wrap" style={{ gap: 8, alignItems: "center" }}>
              {[5, 10, 15, 20].map((num) => (
                <button
                  key={num}
                  type="button"
                  className={`chip-btn ${questionCount === num ? "active" : ""}`}
                  disabled={maxAvailable < num && num > 5}
                  onClick={() => setQuestionCount(Math.min(num, maxAvailable))}
                >
                  {num} câu
                </button>
              ))}
              <button
                type="button"
                className={`chip-btn ${questionCount === maxAvailable ? "active" : ""}`}
                onClick={() => setQuestionCount(maxAvailable)}
              >
                Tất cả ({maxAvailable} câu)
              </button>
            </div>
          </div>

          {/* Thời gian làm bài */}
          <div className="field-group">
            <div
              className="row between"
              style={{ alignItems: "center", marginBottom: 6 }}
            >
              <label className="field-label" style={{ margin: 0 }}>
                <strong>3. Thời gian làm bài:</strong>{" "}
                <span className="green-text font-bold">{timeLimit} phút</span>
              </label>
            </div>
            <div className="row wrap" style={{ gap: 8, alignItems: "center" }}>
              {[15, 20, 30, 45, 60, 90].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  className={`chip-btn ${timeLimit === mins ? "active" : ""}`}
                  onClick={() => setTimeLimit(mins)}
                >
                  <Clock3 size={13} />
                  {mins} phút
                </button>
              ))}
            </div>
          </div>

          {/* Chế độ làm bài */}
          <div className="field-group">
            <label className="field-label">
              <strong>4. Chế độ làm bài:</strong>
            </label>
            <div className="row wrap" style={{ gap: 10 }}>
              <button
                type="button"
                className={`mode-select-card ${mode === "practice" ? "selected" : ""}`}
                onClick={() => setMode("practice")}
              >
                <div className="mode-select-title">
                  <BookOpen size={16} />
                  <strong>Luyện tập tự do</strong>
                </div>
                <span className="small muted">
                  Xem đáp án & giải thích ngay từng câu
                </span>
              </button>
              <button
                type="button"
                className={`mode-select-card ${mode === "exam" ? "selected" : ""}`}
                onClick={() => setMode("exam")}
              >
                <div className="mode-select-title">
                  <Clock3 size={16} />
                  <strong>Thi thử bấm giờ</strong>
                </div>
                <span className="small muted">
                  Tính giờ ngược, nộp bài mới biết kết quả
                </span>
              </button>
            </div>
          </div>

          {/* Tên đề tùy chỉnh */}
          <div className="field-group" style={{ marginBottom: 0 }}>
            <label className="field">
              <span className="small muted">Tên đề thi (tùy chọn):</span>
              <input
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder={`Đề tự luyện ${selectedSubject || "môn học"} (${Math.min(questionCount, maxAvailable)} câu - ${timeLimit} phút)`}
                maxLength={150}
              />
            </label>
          </div>
        </div>

        <div className="modal-dialog-footer">
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={onClose}
          >
            Hủy
          </button>
          <div className="row wrap" style={{ gap: 10 }}>
            <button
              type="button"
              className="button secondary"
              disabled={busy || !selectedSubject}
              onClick={() => void handleGenerate(false)}
              title="Tạo đề và lưu vào Kho cá nhân để làm sau"
            >
              Lưu vào kho cá nhân
            </button>
            <button
              type="button"
              className="button"
              disabled={busy || !selectedSubject}
              onClick={() => void handleGenerate(true)}
            >
              <Sparkles size={16} />
              {busy ? "Đang tạo đề…" : "Tạo & Làm bài ngay →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
