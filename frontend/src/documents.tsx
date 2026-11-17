import { useEffect, useState, useTransition } from "react";
import {
  BookMarked,
  Download,
  Eye,
  FileText,
  Search,
  X,
  ExternalLink,
  Maximize2,
  Minimize2,
  CheckSquare,
  Square,
  Archive,
  Layers,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";
import { api } from "./api";
import { DocumentItem, documentCategories } from "./types";
import { getSubjectTone } from "./components";

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface SubjectCount {
  subject: string;
  count: number;
}

const GRADE_OPTIONS = [
  { label: "Tất cả khối", value: "" },
  { label: "Lớp 12", value: "12" },
  { label: "Lớp 11", value: "11" },
  { label: "Lớp 10", value: "10" },
  { label: "ĐGNL - ĐGTD", value: "dgnl" },
  { label: "Tốt nghiệp THPT", value: "thpt_quoc_gia" },
];

export function DocumentViewerModal({
  doc,
  onClose,
}: {
  doc: DocumentItem;
  onClose: () => void;
}) {
  const [fullscreen, setFullscreen] = useState(false);
  const isPdf = doc.mime_type?.includes("pdf") || doc.file_name?.toLowerCase().endsWith(".pdf");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const previewUrl = `/api/documents/${doc.id}/preview`;
  const downloadUrl = `/api/documents/${doc.id}/download`;

  return (
    <div
      className={`doc-viewer-backdrop ${fullscreen ? "fullscreen" : ""}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Xem tài liệu: ${doc.title}`}
    >
      <div className={`doc-viewer-window ${fullscreen ? "fullscreen" : ""}`}>
        <header className="doc-viewer-header">
          <div className="doc-viewer-title-group">
            <span className={`subject-pill subject-${getSubjectTone(doc.subject)}`}>
              <span className="subject-dot" />
              {doc.subject}
            </span>
            <span className="doc-viewer-title" title={doc.title}>
              {doc.title}
            </span>
            <span className="doc-viewer-meta-tag">{formatFileSize(doc.file_size)}</span>
          </div>

          <div className="doc-viewer-actions">
            <a
              href={downloadUrl}
              className="button secondary small doc-viewer-btn"
              title="Tải tập tin về máy"
            >
              <Download size={15} />
              <span>Tải về</span>
            </a>
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="icon-button doc-viewer-icon-btn"
              title="Mở tab mới toàn màn hình"
              aria-label="Mở tab mới"
            >
              <ExternalLink size={16} />
            </a>
            <button
              type="button"
              className="icon-button doc-viewer-icon-btn"
              onClick={() => setFullscreen((f) => !f)}
              title={fullscreen ? "Thu nhỏ lại" : "Phóng to toàn màn hình"}
              aria-label={fullscreen ? "Thu nhỏ" : "Toàn màn hình"}
            >
              {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button
              type="button"
              className="icon-button doc-viewer-close-btn"
              onClick={onClose}
              title="Đóng xem trước (Esc)"
              aria-label="Đóng"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="doc-viewer-body">
          {isPdf ? (
            <iframe
              src={`${previewUrl}#toolbar=1&navpanes=0`}
              className="doc-viewer-iframe"
              title={doc.title}
            />
          ) : (
            <div className="doc-viewer-fallback">
              <div className="doc-fallback-icon">
                <FileText size={48} />
              </div>
              <h3>{doc.title}</h3>
              <p className="muted">
                Định dạng {doc.file_name.split(".").pop()?.toUpperCase() || "tài liệu"} • {formatFileSize(doc.file_size)}
              </p>
              <p className="doc-fallback-desc">
                {doc.description || "Tài liệu học tập chất lượng cao biên soạn dành riêng cho học sinh Examsparty."}
              </p>
              <div className="row" style={{ gap: 12, marginTop: 16 }}>
                <a href={downloadUrl} className="button">
                  <Download size={16} />
                  Tải tài liệu về máy ({formatFileSize(doc.file_size)})
                </a>
                <a
                  href={`https://docs.google.com/viewer?url=${encodeURIComponent(window.location.origin + previewUrl)}&embedded=true`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="button secondary"
                >
                  <ExternalLink size={16} />
                  Xem qua Google Docs
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function DocumentsPage() {
  const [, startTransition] = useTransition();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [category, setCategory] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [availableSubjects, setAvailableSubjects] = useState<SubjectCount[]>([]);

  // Selection & Actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);

  // Fetch subject counts
  useEffect(() => {
    api<{ subjects: SubjectCount[] }>("/documents/subjects")
      .then((res) => {
        if (Array.isArray(res.subjects)) {
          setAvailableSubjects(res.subjects);
        }
      })
      .catch(() => {});
  }, []);

  // Fetch document list
  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", "12");
    if (subject) params.set("subject", subject);
    if (grade) params.set("grade", grade);
    if (category) params.set("category", category);
    if (searchQuery.trim()) params.set("q", searchQuery.trim());

    api<{ items: DocumentItem[]; total: number; page: number }>(`/documents?${params.toString()}`)
      .then((res) => {
        if (ignore) return;
        setDocuments(res.items || []);
        setTotal(res.total || 0);
        setLoading(false);
      })
      .catch((err) => {
        if (ignore) return;
        setError(err.message || "Không thể tải danh sách tài liệu.");
        setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [page, subject, grade, category, searchQuery]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const isAllPageSelected =
    documents.length > 0 && documents.every((d) => selectedIds.includes(d.id));

  const toggleSelectAllPage = () => {
    const pageIds = documents.map((d) => d.id);
    if (isAllPageSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const handleBatchDownload = async () => {
    if (selectedIds.length === 0 || downloadingZip) return;
    setDownloadingZip(true);
    try {
      const response = await fetch("/api/documents/batch-download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds }),
      });

      if (!response.ok) {
        throw new Error("Không thể tải tập tin nén ZIP.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Examsparty_Tai_Lieu.zip";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e: any) {
      alert(e.message || "Lỗi khi tải tập tin ZIP.");
    } finally {
      setDownloadingZip(false);
    }
  };

  const totalPages = Math.ceil(total / 12) || 1;

  return (
    <div className="documents-page">
      {/* Header Banner */}
      <section className="documents-hero">
        <div className="documents-hero-content">
          <div className="hero-eyebrow">
            <Sparkles size={14} className="sparkle-icon" />
            <span>KHO TÀI LIỆU HỌC TẬP</span>
          </div>
          <h1 className="documents-hero-title">
            Góc Tài Liệu & Sổ Tay Ôn Thi
          </h1>
          <p className="documents-hero-desc">
            Tổng hợp sổ tay công thức, đề cương trọng tâm, sơ đồ tư duy và chuyên đề luyện thi chất lượng cao dành riêng cho học sinh.
          </p>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="documents-toolbar-card">
          <div className="documents-search-row">
            <div className="documents-search-box">
              <Search size={18} className="search-icon" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Tìm theo tên tài liệu, nội dung tóm tắt..."
                aria-label="Tìm tài liệu"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => setSearchQuery("")}
                  aria-label="Xóa tìm kiếm"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            <div className="documents-filter-selects">
              <div className="custom-select-wrapper">
                <Filter size={15} className="select-icon" />
                <select
                  value={subject}
                  onChange={(e) => {
                    startTransition(() => {
                      setSubject(e.target.value);
                      setPage(1);
                    });
                  }}
                  aria-label="Chọn môn học"
                >
                  <option value="">Tất cả môn học</option>
                  {availableSubjects.map((s) => (
                    <option key={s.subject} value={s.subject}>
                      {s.subject} ({s.count})
                    </option>
                  ))}
                </select>
              </div>

              <div className="custom-select-wrapper">
                <Layers size={15} className="select-icon" />
                <select
                  value={category}
                  onChange={(e) => {
                    startTransition(() => {
                      setCategory(e.target.value);
                      setPage(1);
                    });
                  }}
                  aria-label="Chọn dạng tài liệu"
                >
                  <option value="">Mọi thể loại</option>
                  {Object.entries(documentCategories).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Grade Filter Pills */}
          <div className="grade-pills-row" role="tablist" aria-label="Lọc theo khối lớp">
            {GRADE_OPTIONS.map((g) => (
              <button
                type="button"
                key={g.value}
                className={`grade-pill ${grade === g.value ? "active" : ""}`}
                onClick={() => {
                  startTransition(() => {
                    setGrade(g.value);
                    setPage(1);
                  });
                }}
                role="tab"
                aria-selected={grade === g.value}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Sticky Batch Selection Bar */}
      {selectedIds.length > 0 && (
        <div className="doc-batch-bar animate-fade-in" role="toolbar" aria-label="Tác vụ tải nhiều">
          <div className="doc-batch-left">
            <button
              type="button"
              className="doc-batch-check-all"
              onClick={toggleSelectAllPage}
            >
              {isAllPageSelected ? <CheckSquare size={16} /> : <Square size={16} />}
              <span>{isAllPageSelected ? "Bỏ chọn trang này" : "Chọn hết trang"}</span>
            </button>
            <span className="doc-batch-count">
              Đã chọn <strong>{selectedIds.length}</strong> tài liệu
            </span>
          </div>

          <div className="doc-batch-right">
            <button
              type="button"
              className="button small doc-batch-download-btn"
              disabled={downloadingZip}
              onClick={handleBatchDownload}
            >
              <Archive size={15} />
              <span>{downloadingZip ? "Đang nén ZIP..." : "Tải trọn bộ (.ZIP)"}</span>
            </button>
            <button
              type="button"
              className="button secondary small"
              onClick={() => setSelectedIds([])}
            >
              Bỏ chọn
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="documents-main-container">
        {loading ? (
          <div className="doc-state-container">
            <div className="loading-spinner" />
            <p className="muted">Đang tải danh sách tài liệu học tập...</p>
          </div>
        ) : error ? (
          <div className="doc-state-container error">
            <p>{error}</p>
            <button
              type="button"
              className="button secondary small"
              onClick={() => setPage(1)}
            >
              Thử lại
            </button>
          </div>
        ) : documents.length === 0 ? (
          <div className="doc-empty-card">
            <div className="doc-empty-icon">
              <BookMarked size={48} />
            </div>
            <h3>Chưa có tài liệu phù hợp</h3>
            <p className="muted">
              Không tìm thấy tài liệu nào khớp với bộ lọc hiện tại. Hãy thử đổi từ khóa hoặc chọn khối/môn học khác.
            </p>
            <button
              type="button"
              className="button secondary small"
              onClick={() => {
                setSubject("");
                setGrade("");
                setCategory("");
                setSearchQuery("");
                setPage(1);
              }}
            >
              Xóa tất cả bộ lọc
            </button>
          </div>
        ) : (
          <>
            <div className="documents-grid">
              {documents.map((doc) => {
                const isSelected = selectedIds.includes(doc.id);
                const isPdf =
                  doc.mime_type?.includes("pdf") ||
                  doc.file_name?.toLowerCase().endsWith(".pdf");

                return (
                  <article
                    key={doc.id}
                    className={`document-card ${isSelected ? "selected" : ""} card-hover-lift`}
                  >
                    <div className="doc-card-top">
                      <button
                        type="button"
                        className={`doc-card-checkbox ${isSelected ? "checked" : ""}`}
                        onClick={() => toggleSelect(doc.id)}
                        aria-label={isSelected ? "Bỏ chọn tài liệu này" : "Chọn tài liệu này để tải"}
                      >
                        {isSelected ? <CheckSquare size={17} /> : <Square size={17} />}
                      </button>

                      <div className="doc-card-badges">
                        <span className={`subject-pill subject-${getSubjectTone(doc.subject)}`}>
                          <span className="subject-dot" />
                          {doc.subject}
                        </span>
                        <span className="doc-grade-tag">
                          Lớp {doc.grade === "dgnl" ? "ĐGNL" : doc.grade === "thpt_quoc_gia" ? "THPT" : doc.grade}
                        </span>
                      </div>

                      <span className={`doc-type-badge ${isPdf ? "pdf" : "doc"}`}>
                        {isPdf ? "PDF" : doc.file_name.split(".").pop()?.toUpperCase() || "DOC"}
                      </span>
                    </div>

                    <div className="doc-card-content">
                      <h3
                        className="doc-card-title"
                        title={doc.title}
                        onClick={() => setPreviewDoc(doc)}
                      >
                        {doc.title}
                      </h3>
                      <p className="doc-card-desc">
                        {doc.description ||
                          `Tài liệu ${doc.subject} khối ${doc.grade} tổng hợp đầy đủ kiến thức ôn thi trọng tâm.`}
                      </p>
                    </div>

                    <div className="doc-card-footer">
                      <div className="doc-card-meta">
                        <span className="doc-card-size">{formatFileSize(doc.file_size)}</span>
                        <span className="meta-separator">•</span>
                        <span className="doc-card-stat" title={`${doc.views_count} lượt xem`}>
                          <Eye size={13} /> {doc.views_count}
                        </span>
                        <span className="meta-separator">•</span>
                        <span className="doc-card-stat" title={`${doc.downloads_count} lượt tải`}>
                          <Download size={13} /> {doc.downloads_count}
                        </span>
                      </div>

                      <div className="doc-card-actions">
                        <button
                          type="button"
                          className="button secondary small doc-action-btn"
                          onClick={() => setPreviewDoc(doc)}
                          title="Xem trước trực tiếp trên trang"
                        >
                          <Eye size={14} />
                          <span>Xem thử</span>
                        </button>
                        <a
                          href={`/api/documents/${doc.id}/download`}
                          className="button small doc-action-btn"
                          title="Tải tập tin về máy"
                        >
                          <Download size={14} />
                          <span>Tải về</span>
                        </a>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <nav className="pagination-bar" aria-label="Phân trang tài liệu">
                <button
                  type="button"
                  className="button secondary small"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  aria-label="Trang trước"
                >
                  <ChevronLeft size={16} /> Trang trước
                </button>
                <span className="page-indicator">
                  Trang <strong>{page}</strong> / {totalPages}
                </span>
                <button
                  type="button"
                  className="button secondary small"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  aria-label="Trang sau"
                >
                  Trang sau <ChevronRight size={16} />
                </button>
              </nav>
            )}
          </>
        )}
      </main>

      {/* Live Preview Modal */}
      {previewDoc && (
        <DocumentViewerModal
          doc={previewDoc}
          onClose={() => setPreviewDoc(null)}
        />
      )}
    </div>
  );
}
