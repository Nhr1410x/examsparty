import { useState } from "react";
import { Flag, X, Send, CheckCircle2, BookOpen } from "lucide-react";
import { api } from "./api";
import { ErrorMessage } from "./components";
import { REPORT_REASONS } from "./types";

export interface QuestionReportContext {
  examId?: string;
  examTitle?: string;
  questionId?: string;
  questionLabel?: string; // e.g. "Câu 3"
  questionPromptText?: string;
  currentAnswer?: string;
}

export function getPromptPlainText(blocks?: unknown): string {
  if (!Array.isArray(blocks)) return "";
  return blocks
    .map((b) => (b && typeof b === "object" && "value" in b ? String(b.value || "") : ""))
    .join(" ")
    .trim();
}

export function QuestionReportModal({
  isOpen,
  onClose,
  context,
}: {
  isOpen: boolean;
  onClose: () => void;
  context: QuestionReportContext;
}) {
  const [reason, setReason] = useState<string>("wrong_answer");
  const [suggestedAnswer, setSuggestedAnswer] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [issue, setIssue] = useState<unknown>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIssue(null);
    setBusy(true);

    try {
      await api("/reports", "POST", {
        exam_id: context.examId || null,
        question_id: context.questionId || null,
        question_label: context.questionLabel || "",
        question_content: context.questionPromptText || "",
        reason,
        suggested_answer: suggestedAnswer.trim(),
        message: message.trim(),
        details: {
          exam_title: context.examTitle || "",
          current_answer: context.currentAnswer || "",
        },
      });

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1800);
    } catch (err) {
      setIssue(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="report-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="report-modal-card">
        {/* Header */}
        <div className="report-modal-header">
          <div className="report-header-title-group">
            <span className="report-icon-badge" aria-hidden="true">
              <Flag size={18} />
            </span>
            <div>
              <h3 id="report-modal-title" className="report-title">
                Báo lỗi câu hỏi
              </h3>
              <p className="report-subtitle">
                {context.questionLabel || "Câu hỏi"}
                {context.examTitle ? ` • ${context.examTitle}` : ""}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="icon-button report-close-btn"
            onClick={onClose}
            disabled={busy}
            aria-label="Đóng cửa sổ báo lỗi"
          >
            <X size={18} />
          </button>
        </div>

        {/* Question snippet preview */}
        {context.questionPromptText && (
          <div className="report-question-preview">
            <span className="preview-label">
              <BookOpen size={13} /> Nội dung câu hỏi đang báo:
            </span>
            <p className="preview-text">{context.questionPromptText}</p>
          </div>
        )}

        {success ? (
          <div className="report-success-state">
            <CheckCircle2 size={40} className="report-success-icon" />
            <h4>Đã gửi phản ánh thành công!</h4>
            <p className="muted small">
              Cảm ơn bạn đã đóng góp! Ban biên tập sẽ đối chiếu và cập nhật lại câu hỏi
              trong thời gian sớm nhất.
            </p>
          </div>
        ) : (
          <form className="report-form" onSubmit={handleSubmit}>
            {/* Reason selector pills */}
            <div className="report-field-group">
              <label className="report-field-label">
                Vấn đề gặp phải <span className="required-star">*</span>
              </label>
              <div className="report-reasons-grid" role="radiogroup" aria-label="Chọn lý do báo lỗi">
                {REPORT_REASONS.map((r) => {
                  const active = reason === r.value;
                  return (
                    <button
                      key={r.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      className={`report-reason-chip ${active ? "active" : ""}`}
                      onClick={() => setReason(r.value)}
                    >
                      <span className={`chip-indicator ${active ? "checked" : ""}`} />
                      <span className="chip-label">{r.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Suggested correct answer */}
            <div className="report-field-group">
              <label className="report-field-label" htmlFor="report-suggested-answer">
                Đáp án đúng theo bạn <span className="optional-tag">(tùy chọn)</span>
              </label>
              <input
                id="report-suggested-answer"
                type="text"
                className="report-text-input"
                placeholder="Ví dụ: Phương án B (hoặc kết quả 24 m/s)..."
                maxLength={500}
                value={suggestedAnswer}
                onChange={(e) => setSuggestedAnswer(e.target.value)}
              />
              <span className="report-input-hint">
                Điền phương án trắc nghiệm hoặc giá trị kết quả mà bạn cho là chính xác.
              </span>
            </div>

            {/* Detailed reason / explanation */}
            <div className="report-field-group">
              <label className="report-field-label" htmlFor="report-message-text">
                Giải thích lý do & đề xuất chỉnh sửa <span className="optional-tag">(tùy chọn)</span>
              </label>
              <textarea
                id="report-message-text"
                className="report-textarea"
                rows={3}
                placeholder="Nêu rõ bước giải chưa hợp lý, điểm mâu thuẫn hoặc công thức cần chỉnh sửa..."
                maxLength={2000}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <span className="report-input-hint">
                Mô tả chi tiết giúp ban chuyên môn rà soát nhanh chóng và chính xác hơn.
              </span>
            </div>

            <ErrorMessage error={issue} />

            {/* Footer action bar */}
            <div className="report-modal-footer">
              <button
                type="button"
                className="button secondary button-step-press"
                onClick={onClose}
                disabled={busy}
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                className="button primary button-step-press report-submit-btn"
                disabled={busy}
              >
                <Send size={15} />
                <span>{busy ? "Đang gửi…" : "Gửi báo lỗi"}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export function QuestionReportButton({
  context,
  compact = false,
  className = "",
}: {
  context: QuestionReportContext;
  compact?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={`question-report-trigger-btn ${compact ? "compact" : ""} ${className}`}
        onClick={() => setOpen(true)}
        title="Báo lỗi câu hỏi này (sai đáp án, giải thích chưa hợp lý...)"
        aria-label="Báo lỗi câu hỏi này"
      >
        <Flag size={13} className="report-btn-flag" />
        {!compact && <span>Báo lỗi</span>}
      </button>

      <QuestionReportModal
        isOpen={open}
        onClose={() => setOpen(false)}
        context={context}
      />
    </>
  );
}
