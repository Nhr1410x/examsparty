import { useEffect, useState, useTransition } from "react";
import { useSearchParams } from "react-router-dom";
import {
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
  ChevronDown,
  ChevronUp,
  Folder,
  FolderOpen,
  FolderDown,
  ArrowLeft,
  Calculator,
  Atom,
  FlaskConical,
  Dna,
  BookOpen,
  Languages,
  Landmark,
  Globe,
  Laptop,
  Scale,
  GraduationCap,
} from "lucide-react";
import { api } from "./api";
import {
  DocumentItem,
  DocumentSubjectConfig,
  DEFAULT_DOCUMENT_SUBJECTS,
  documentCategories,
  GRADE_OPTIONS,
  formatGrade,
} from "./types";
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

export const SUBJECT_ICON_MAP: Record<string, any> = {
  Calculator,
  Atom,
  FlaskConical,
  Dna,
  BookOpen,
  Languages,
  Landmark,
  Globe,
  Laptop,
  Scale,
  GraduationCap,
  FileText,
  Sparkles,
};

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

  const toggleBrowserFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
      setFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setFullscreen(false);
    }
  };

  return (
    <div
      className="doc-fullscreen-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`Xem tài liệu: ${doc.title}`}
    >
      {/* Top Floating / Fixed Header matching screenshot */}
      <header className="doc-viewer-topbar">
        {/* Left: Document info & Navigation info */}
        <div className="doc-topbar-left">
          <span className={`subject-pill subject-${getSubjectTone(doc.subject)}`}>
            <span className="subject-dot" />
            {doc.subject}
          </span>
          <span className="doc-topbar-title" title={doc.title}>
            {doc.title}
          </span>
          <span className="doc-topbar-size">{formatFileSize(doc.file_size)}</span>
        </div>

        {/* Center: Circular Dark Close Button ( X ) matching screenshot */}
        <button
          type="button"
          className="doc-viewer-circle-close"
          onClick={onClose}
          title="Đóng xem tài liệu (Esc)"
          aria-label="Đóng xem tài liệu"
        >
          <X size={20} />
        </button>

        {/* Right: Fullscreen & PDF Gốc buttons matching screenshot */}
        <div className="doc-topbar-right">
          <button
            type="button"
            className="icon-button doc-topbar-btn"
            onClick={toggleBrowserFullscreen}
            title={fullscreen ? "Thu nhỏ" : "Toàn màn hình trình duyệt"}
            aria-label="Toàn màn hình"
          >
            {fullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
          </button>
          <a
            href={downloadUrl}
            className="doc-topbar-action-pill"
            title="Tải tệp tin gốc về máy"
          >
            <Download size={15} />
            <span>PDF gốc</span>
          </a>
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="icon-button doc-topbar-btn"
            title="Mở tab mới"
            aria-label="Mở tab mới"
          >
            <ExternalLink size={16} />
          </a>
        </div>
      </header>

      {/* Main Fullscreen Viewer Canvas */}
      <main className="doc-viewer-canvas">
        {isPdf ? (
          <iframe
            src={`${previewUrl}#toolbar=1&navpanes=0`}
            className="doc-fullscreen-iframe"
            title={doc.title}
          />
        ) : (
          <div className="doc-fullscreen-fallback">
            <div className="doc-fallback-card">
              <div className="doc-fallback-icon">
                <FileText size={56} />
              </div>
              <h2>{doc.title}</h2>
              <p className="muted">
                Định dạng {doc.file_name.split(".").pop()?.toUpperCase() || "tài liệu"} • {formatFileSize(doc.file_size)}
              </p>
              <p className="doc-fallback-desc">
                {doc.description || "Tài liệu học tập chất lượng cao biên soạn dành riêng cho học sinh Examsparty."}
              </p>
              <div className="row" style={{ gap: 14, marginTop: 20 }}>
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
          </div>
        )}
      </main>
    </div>
  );
}

export function DocumentsPage() {
  const [, startTransition] = useTransition();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentSubjectFromUrl = searchParams.get("subject") || "";

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [subject, setSubject] = useState(currentSubjectFromUrl);
  const [grade, setGrade] = useState("");
  const [category, setCategory] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [availableSubjects, setAvailableSubjects] = useState<SubjectCount[]>([]);
  const [subjectConfigs, setSubjectConfigs] =
    useState<DocumentSubjectConfig[]>(DEFAULT_DOCUMENT_SUBJECTS);

  // Selection & Actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);

  // Keep state in sync with URL
  useEffect(() => {
    const urlSub = searchParams.get("subject") || "";
    setSubject(urlSub);
  }, [searchParams]);

  // Fetch subject counts and configured subjects
  useEffect(() => {
    api<{ subjects: SubjectCount[]; configured?: DocumentSubjectConfig[] }>("/documents/subjects")
      .then((res) => {
        if (Array.isArray(res.subjects)) {
          setAvailableSubjects(res.subjects);
        }
        if (Array.isArray(res.configured) && res.configured.length > 0) {
          setSubjectConfigs(res.configured);
        }
      })
      .catch(() => {});
  }, []);

  // Fetch document list ONLY when a subject is selected
  useEffect(() => {
    if (!subject) {
      setDocuments([]);
      setTotal(0);
      setLoading(false);
      return;
    }

    let ignore = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", "12");
    params.set("subject", subject);
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
  }, [subject, page, grade, category, searchQuery]);

  const handleSelectSubject = (subName: string) => {
    startTransition(() => {
      setSubject(subName);
      setPage(1);
      setSelectedIds([]);
      if (subName) {
        setSearchParams({ subject: subName });
      } else {
        setSearchParams({});
      }
    });
  };

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
      a.download = `Examsparty_${subject ? subject.replace(/\s+/g, "_") : "Tai_Lieu"}.zip`;
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

  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  const toggleFolder = (folderName: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [folderName]: !prev[folderName],
    }));
  };

  // Auto-expand all folders when user searches
  useEffect(() => {
    if (searchQuery.trim()) {
      const all: Record<string, boolean> = {};
      for (const d of documents) {
        if (d.folder_name?.trim()) {
          all[d.folder_name.trim()] = true;
        }
      }
      setExpandedFolders(all);
    }
  }, [searchQuery, documents]);

  const handleDownloadFolder = async (folderName: string, docs: DocumentItem[]) => {
    const ids = docs.map((d) => d.id);
    if (!ids.length || downloadingZip) return;
    setDownloadingZip(true);
    try {
      const response = await fetch("/api/documents/batch-download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, folder_name: folderName, subject }),
      });
      if (!response.ok) throw new Error("Không thể tải tập tin ZIP.");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Examsparty_${folderName.replace(/\s+/g, "_")}.zip`;
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

  // Group documents by folder
  const folderMap = new Map<string, DocumentItem[]>();
  const standaloneDocs: DocumentItem[] = [];

  for (const doc of documents) {
    const fName = doc.folder_name?.trim();
    if (fName) {
      if (!folderMap.has(fName)) folderMap.set(fName, []);
      folderMap.get(fName)!.push(doc);
    } else {
      standaloneDocs.push(doc);
    }
  }

  const folderGroups = Array.from(folderMap.entries()).map(([name, docs]) => ({
    name,
    docs,
    totalSize: docs.reduce((acc, d) => acc + (d.file_size || 0), 0),
    grades: Array.from(new Set(docs.map((d) => d.grade).filter(Boolean))),
  }));

  const renderDocumentRow = (doc: DocumentItem, isNested = false) => {
    const isSelected = selectedIds.includes(doc.id);
    const isPdf =
      doc.mime_type?.includes("pdf") ||
      doc.file_name?.toLowerCase().endsWith(".pdf");

    return (
      <article
        key={doc.id}
        className={`doc-horizontal-row ${isNested ? "nested" : ""} ${isSelected ? "selected" : ""} card-hover-lift`}
      >
        {/* Left section: Checkbox + Icon + Info */}
        <div className="doc-row-left">
          <button
            type="button"
            className={`doc-row-checkbox ${isSelected ? "checked" : ""}`}
            onClick={() => toggleSelect(doc.id)}
            aria-label={isSelected ? "Bỏ chọn tài liệu này" : "Chọn tài liệu này để tải"}
          >
            {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
          </button>

          <div
            className={`doc-format-box ${isPdf ? "pdf" : "doc"}`}
            onClick={() => setPreviewDoc(doc)}
            title="Bấm để xem trực tiếp"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setPreviewDoc(doc);
              }
            }}
          >
            <FileText size={22} />
            <span className="doc-format-label">
              {isPdf ? "PDF" : doc.file_name.split(".").pop()?.toUpperCase() || "DOC"}
            </span>
          </div>

          <div className="doc-row-info">
            <div className="doc-row-title-line">
              <h3
                className="doc-row-title"
                title={doc.title}
                onClick={() => setPreviewDoc(doc)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setPreviewDoc(doc);
                  }
                }}
              >
                {doc.title}
              </h3>
              {!isNested && (
                <div className="doc-row-tags">
                  <span className={`subject-pill subject-${getSubjectTone(doc.subject)}`}>
                    <span className="subject-dot" />
                    {doc.subject}
                  </span>
                  <span className="doc-grade-tag">
                    {formatGrade(doc.grade)}
                  </span>
                  <span className="doc-category-tag">
                    {documentCategories[doc.category] || doc.category}
                  </span>
                  {doc.folder_name && (
                    <span className="doc-folder-tag-pill" title={`Thuộc thư mục: ${doc.folder_name}`}>
                      <Folder size={11} /> {doc.folder_name}
                    </span>
                  )}
                </div>
              )}
            </div>

            {!isNested && doc.description ? (
              <p className="doc-row-desc">{doc.description}</p>
            ) : null}

            <div className="doc-row-submeta">
              <span className="doc-author-name">
                Nguồn: <strong>{doc.author_name || "Examsparty"}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Right section: Stats & Actions */}
        <div className="doc-row-right">
          <div className="doc-row-stats">
            <span className="doc-size-badge">{formatFileSize(doc.file_size)}</span>
            <div className="doc-stats-counts">
              <span className="doc-stat-item" title={`${doc.views_count} lượt xem`}>
                <Eye size={13} /> {doc.views_count}
              </span>
              <span className="doc-stat-item" title={`${doc.downloads_count} lượt tải`}>
                <Download size={13} /> {doc.downloads_count}
              </span>
            </div>
          </div>

          <div className="doc-row-actions">
            <button
              type="button"
              className="button secondary small doc-action-btn button-step-press"
              onClick={() => setPreviewDoc(doc)}
              title="Xem trước toàn màn hình"
            >
              <Eye size={14} />
              <span>Xem trực tiếp</span>
            </button>
            <a
              href={`/api/documents/${doc.id}/download`}
              className="button small doc-action-btn button-step-press"
              title="Tải tập tin về máy"
            >
              <Download size={14} />
              <span>Tải về</span>
            </a>
          </div>
        </div>
      </article>
    );
  };

  const totalPages = Math.ceil(total / 12) || 1;
  const activeSubjects = subjectConfigs.filter((s) => s.active !== false);

  return (
    <div className="documents-page">
      {/* View 1: Subject Selection Hub (Khi chưa chọn môn) */}
      {!subject ? (
        <section className="subject-selection-hub">
          <div className="documents-hero-content">
            <div className="hero-eyebrow">
              <Sparkles size={14} className="sparkle-icon" />
              <span>KHO TÀI LIỆU HỌC TẬP</span>
            </div>
            <h1 className="documents-hero-title">
              Góc Tài Liệu & Sổ Tay Ôn Thi
            </h1>
            <p className="documents-hero-desc">
              Vui lòng chọn môn học bạn muốn ôn tập bên dưới để mở kho tài liệu tương ứng. Dữ liệu được tải theo từng môn giúp duyệt tài liệu nhanh, mượt mà và không lo bị đơ.
            </p>
          </div>

          <div className="subjects-hub-grid">
            {activeSubjects.map((s) => {
              const tone = s.tone && s.tone !== "default" ? s.tone : getSubjectTone(s.name);
              const countObj = availableSubjects.find(
                (sub) => sub.subject.toLowerCase() === s.name.toLowerCase(),
              );
              const count = countObj?.count ?? s.count ?? 0;
              const IconComponent = (s.icon && SUBJECT_ICON_MAP[s.icon]) || BookOpen;

              return (
                <div
                  key={s.id || s.name}
                  className={`subject-hub-card subject-theme-${tone} card-hover-lift`}
                  onClick={() => handleSelectSubject(s.name)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleSelectSubject(s.name);
                    }
                  }}
                >
                  <div className="subject-hub-card-top">
                    <div className="subject-hub-icon-box">
                      <IconComponent size={24} />
                    </div>
                    <span className="subject-hub-count-tag">
                      {count > 0 ? `${count} tài liệu` : "Khám phá"}
                    </span>
                  </div>

                  <div className="subject-hub-card-body">
                    <h3 className="subject-hub-card-title">{s.name}</h3>
                    <p className="subject-hub-card-desc">{s.desc}</p>
                  </div>

                  <div className="subject-hub-card-footer">
                    <span className="subject-hub-explore-text">Mở kho tài liệu</span>
                    <ChevronRight size={16} className="subject-hub-arrow" />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        /* View 2: Selected Subject View with Horizontal Documents List */
        <section className="subject-documents-view animate-fade-in">
          {/* Back navigation & Subject Header */}
          <div className="subject-active-header">
            <button
              type="button"
              className="button secondary small doc-back-subject-btn button-step-press"
              onClick={() => handleSelectSubject("")}
              title="Quay lại danh mục chọn môn học"
            >
              <ArrowLeft size={16} />
              <span>Chọn môn khác</span>
            </button>

            <div className="subject-active-info">
              <span className={`subject-pill subject-${getSubjectTone(subject)}`}>
                <span className="subject-dot" />
                {subject}
              </span>
              <h2 className="subject-active-title">
                Tài liệu môn {subject}
              </h2>
              <span className="subject-active-count">
                ({total} tài liệu có sẵn)
              </span>
            </div>

            {/* Quick switcher to jump directly to another subject */}
            <div className="subject-quick-switcher">
              <span className="quick-switch-label">Đổi nhanh:</span>
              <div className="quick-switch-pills">
                {activeSubjects.filter((s) => s.name !== subject).slice(0, 6).map((s) => (
                  <button
                    type="button"
                    key={s.id || s.name}
                    className="quick-switch-pill"
                    onClick={() => handleSelectSubject(s.name)}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
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
                  placeholder={`Tìm tài liệu trong môn ${subject}...`}
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
                    <option value="">Tất cả thể loại</option>
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

          {/* Main Horizontal List */}
          <main className="documents-main-container">
            {loading ? (
              <div className="doc-state-container">
                <div className="loading-spinner" />
                <p className="muted">Đang tải danh sách tài liệu môn {subject}...</p>
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
                  <FileText size={48} />
                </div>
                <h3>Chưa có tài liệu phù hợp cho môn {subject}</h3>
                <p className="muted">
                  Không tìm thấy tài liệu nào khớp với điều kiện lọc hiện tại. Hãy thử chọn khối lớp khác hoặc xóa từ khóa tìm kiếm.
                </p>
                <button
                  type="button"
                  className="button secondary small"
                  onClick={() => {
                    setGrade("");
                    setCategory("");
                    setSearchQuery("");
                    setPage(1);
                  }}
                >
                  Xóa bộ lọc
                </button>
              </div>
            ) : (
              <>
                {/* HORIZONTAL ROWS & FOLDER GROUPING (Gom theo thư mục & Dàn theo chiều ngang) */}
                <div className="documents-horizontal-list">
                  {/* Folders List (Nếu có tài liệu thuộc thư mục) */}
                  {folderGroups.map((folder) => {
                    const isExpanded = !!expandedFolders[folder.name];
                    const allFolderIds = folder.docs.map((d) => d.id);
                    const isAllFolderSelected =
                      allFolderIds.length > 0 &&
                      allFolderIds.every((id) => selectedIds.includes(id));

                    return (
                      <div
                        key={folder.name}
                        className={`doc-folder-card ${isExpanded ? "expanded" : ""} card-hover-lift`}
                      >
                        <div
                          className="doc-folder-header"
                          onClick={() => toggleFolder(folder.name)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              toggleFolder(folder.name);
                            }
                          }}
                          aria-expanded={isExpanded}
                        >
                          <div className="doc-folder-left">
                            <div className="doc-folder-icon-box">
                              {isExpanded ? <FolderOpen size={24} /> : <Folder size={24} />}
                            </div>
                            <div className="doc-folder-info">
                              <div className="doc-folder-title-row">
                                <h3 className="doc-folder-title">{folder.name}</h3>
                                <span className="doc-folder-badge">
                                  <Archive size={12} /> {folder.docs.length} bài học
                                </span>
                              </div>
                              <div className="doc-folder-meta">
                                <span>{formatFileSize(folder.totalSize)}</span>
                                <span>•</span>
                                <span>
                                  {folder.grades.map((g) => formatGrade(g)).join(", ") || subject}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="doc-folder-right" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              className="button secondary small doc-folder-dl-btn button-step-press"
                              onClick={() => void handleDownloadFolder(folder.name, folder.docs)}
                              disabled={downloadingZip}
                              title={`Tải trọn bộ thư mục "${folder.name}" dưới dạng .ZIP`}
                            >
                              <FolderDown size={14} />
                              <span>Tải cả thư mục (.ZIP)</span>
                            </button>

                            <button
                              type="button"
                              className="doc-folder-toggle-btn"
                              onClick={() => toggleFolder(folder.name)}
                              aria-label={isExpanded ? "Thu gọn thư mục" : "Mở thư mục"}
                            >
                              <span>{isExpanded ? "Thu gọn" : `Xem ${folder.docs.length} bài`}</span>
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                          </div>
                        </div>

                        {/* Expanded Folder Content */}
                        {isExpanded && (
                          <div className="doc-folder-content animate-fade-in">
                            <div className="doc-folder-content-header">
                              <span>
                                Danh sách tài liệu trong thư mục <strong>"{folder.name}"</strong> ({folder.docs.length} bài)
                              </span>
                              <button
                                type="button"
                                className="admin-clear-link"
                                onClick={() => {
                                  if (isAllFolderSelected) {
                                    setSelectedIds((prev) =>
                                      prev.filter((id) => !allFolderIds.includes(id)),
                                    );
                                  } else {
                                    setSelectedIds((prev) =>
                                      Array.from(new Set([...prev, ...allFolderIds])),
                                    );
                                  }
                                }}
                              >
                                {isAllFolderSelected ? "Bỏ chọn thư mục này" : "Chọn hết thư mục"}
                              </button>
                            </div>

                            <div className="doc-folder-items">
                              {folder.docs.map((doc) => renderDocumentRow(doc, true))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Section Divider if both folders and standalone docs exist */}
                  {folderGroups.length > 0 && standaloneDocs.length > 0 && (
                    <div className="doc-section-divider">
                      <span>Tài liệu riêng lẻ ({standaloneDocs.length})</span>
                    </div>
                  )}

                  {/* Standalone Documents (Tài liệu không nằm trong thư mục) */}
                  {standaloneDocs.map((doc) => renderDocumentRow(doc, false))}
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
        </section>
      )}

      {/* Fullscreen Live Preview Modal */}
      {previewDoc && (
        <DocumentViewerModal
          doc={previewDoc}
          onClose={() => setPreviewDoc(null)}
        />
      )}
    </div>
  );
}
