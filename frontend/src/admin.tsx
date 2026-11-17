import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ShieldCheck,
  LogOut,
  Check,
  X,
  Pencil,
  Plus,
  Save,
  Eye,
  FileQuestion,
  LibraryBig,
  ClipboardCheck,
  Users,
  ScrollText,
  Flag,
  Settings,
  LayoutDashboard,
  ArrowLeft,
  Trash2,
  CheckSquare,
  ChevronDown,
  Sun,
  Moon,
  Upload,
  Archive,
  BookMarked,
  Download,
} from "lucide-react";
import { api, date, useLoad } from "./api";
import { formatFileSize, DocumentViewerModal } from "./documents";
import {
  Badge,
  Blocks,
  Empty,
  ErrorMessage,
  getSubjectTone,
  Loading,
  Notice,
  QuestionEditor,
} from "./components";
import { ExamEditor, ExamPreview } from "./contribution";
import { Pagination } from "./pages";
import {
  emptyQuestion,
  ExamCard,
  ExamContent,
  normalizeExamPayload,
  Question,
  Submission,
  template,
  typeLabels,
  User,
  DocumentItem,
  documentCategories,
} from "./types";

export function Admin() {
  const [revision, setRevision] = useState(0),
    { data, error, loading } = useLoad<{ user: User | null }>(
      "/session",
      revision,
    ),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [otp, setOtp] = useState(""),
    [issue, setIssue] = useState<unknown>(null),
    [busy, setBusy] = useState(false);
  if (loading) return <Loading />;
  if (error) return <ErrorMessage error={error} />;
  if (data?.user?.role !== "admin")
    return (
      <div className="login-wrap">
        <div className="panel login-panel">
          <span className="subject-icon green">
            <ShieldCheck size={30} />
          </span>
          <span className="eyebrow muted">QUẢN TRỊ VIÊN</span>
          <h1>Đăng nhập Quản trị</h1>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setIssue(null);
              setBusy(true);
              try {
                await api("/auth/login", "POST", {
                  email,
                  password,
                  otp: otp || undefined,
                });
                setPassword("");
                setOtp("");
                setRevision((n) => n + 1);
              } catch (e) {
                setIssue(e);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="field">
              Email
              <input
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="field">
              Mật khẩu
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <label className="field">
              Mã xác thực hai bước
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="6 chữ số (nếu đã bật MFA)"
              />
            </label>
            <ErrorMessage error={issue} />
            <button className="button full" disabled={busy}>
              <ShieldCheck size={17} />
              {busy ? "Đang xác thực…" : "Đăng nhập quản trị"}
            </button>
          </form>
          <p className="small muted">
            Tài khoản quản trị do chủ hệ thống cấp. Không có đăng ký admin công
            khai.
          </p>
          <Link className="text-link" to="/">
            Về không gian học tập
          </Link>
        </div>
      </div>
    );
  return (
    <AdminWorkspace
      user={data.user}
      onLogout={() => setRevision((n) => n + 1)}
    />
  );
}
const tabs = [
  ["overview", "Tổng quan", LayoutDashboard],
  ["review", "Duyệt nội dung", ClipboardCheck],
  ["exams", "Quản lý đề", LibraryBig],
  ["questions", "Câu hỏi", FileQuestion],
  ["documents", "Tài liệu", BookMarked],
  ["users", "Tài khoản", Users],
  ["reports", "Báo lỗi", Flag],
  ["logs", "Nhật ký", ScrollText],
  ["config", "Cấu hình", Settings],
] as const;
function AdminWorkspace({
  user,
  onLogout,
}: {
  user: User;
  onLogout: () => void;
}) {
  const [tab, setTab] = useState("overview"),
    [issue, setIssue] = useState<unknown>(null),
    [theme, setTheme] = useState(
      () => document.documentElement.dataset.theme || "light",
    );

  const activeTabTitle = tabs.find(([v]) => v === tab)?.[1] || "Tổng quan";

  useEffect(() => {
    document.body.classList.add("admin-body-locked");
    document.documentElement.classList.add("admin-body-locked");
    return () => {
      document.body.classList.remove("admin-body-locked");
      document.documentElement.classList.remove("admin-body-locked");
    };
  }, []);

  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    localStorage.setItem("ep-theme", next);
  }

  return (
    <div className="admin-portal-layout">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-header">
          <span className="admin-badge">
            <ShieldCheck size={14} /> QUẢN TRỊ VIÊN
          </span>
          <h3>Cổng Quản Trị</h3>
        </div>
        <nav className="admin-nav-list" aria-label="Điều hướng quản trị">
          {tabs.map(([v, label, Icon]) => (
            <button
              className={`admin-nav-btn ${tab === v ? "active" : ""}`}
              key={v}
              onClick={() => {
                setTab(v);
                setIssue(null);
              }}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-footer">
          <Link to="/" className="admin-return-link">
            <ArrowLeft size={16} /> Về trang học tập
          </Link>
          <div className="admin-user-card">
            <span className="avatar">A</span>
            <div className="admin-user-meta">
              <strong>Quản trị hệ thống</strong>
              <small>{user.email}</small>
            </div>
          </div>
          <button
            className="button secondary small full"
            onClick={async () => {
              try {
                await api("/auth/logout", "POST", {});
                onLogout();
              } catch (e) {
                setIssue(e);
              }
            }}
          >
            <LogOut size={15} />
            Đăng xuất
          </button>
        </div>
      </aside>
      <section className="admin-portal-content">
        <div className="admin-content-header">
          <div>
            <h1>{activeTabTitle}</h1>
          </div>
          <div className="row" style={{ gap: 10 }}>
            <button
              type="button"
              className="icon-button theme-toggle"
              aria-label={`Chuyển sang giao diện ${theme === "light" ? "tối" : "sáng"}`}
              title={`Chuyển sang giao diện ${theme === "light" ? "tối" : "sáng"}`}
              onClick={toggleTheme}
            >
              {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
            </button>
          </div>
        </div>
        <ErrorMessage error={issue} />
        <div className="admin-tab-body">
          {tab === "overview" ? (
            <Overview />
          ) : tab === "review" ? (
            <Review />
          ) : tab === "exams" ? (
            <ManageExams />
          ) : tab === "questions" ? (
            <ManageQuestions />
          ) : tab === "documents" ? (
            <ManageDocuments />
          ) : tab === "users" ? (
            <ManageUsers self={user.id} />
          ) : tab === "logs" ? (
            <Logs />
          ) : tab === "reports" ? (
            <Reports />
          ) : (
            <Config />
          )}
        </div>
      </section>
    </div>
  );
}
function Overview() {
  const { data, error, loading } =
    useLoad<Record<string, number>>("/admin/overview");
  return (
    <>
      <ErrorMessage error={error} />
      {loading ? (
        <Loading />
      ) : (
        <>
          <div className="stats-grid admin-stats">
            {[
              ["pending", "Đang chờ duyệt"],
              ["exams", "Đề trong hệ thống"],
              ["questions", "Câu hỏi đã lưu"],
              ["documents", "Tài liệu học tập"],
              ["attempts", "Lượt bắt đầu làm"],
              ["reports", "Báo lỗi chưa xử lý"],
            ].map(([key, label]) => (
              <div className="stat panel" key={key}>
                <div>
                  <strong>{data?.[key] ?? 0}</strong>
                  <p>{label}</p>
                </div>
              </div>
            ))}
          </div>
          <Notice>
            Đề và câu hỏi được lưu trữ thay vì xóa vĩnh viễn. Các phiên đang làm
            giữ nguyên bản chụp nội dung khi bắt đầu, kể cả sau khi quản trị
            viên sửa đề.
          </Notice>
        </>
      )}
    </>
  );
}
function Review() {
  const [status, setStatus] = useState("pending"),
    [page, setPage] = useState(1),
    [revision, setRevision] = useState(0),
    [selected, setSelected] = useState<Submission | null>(null),
    [note, setNote] = useState(""),
    [issue, setIssue] = useState<unknown>(null),
    [busy, setBusy] = useState(false);
  const { data, error, loading } = useLoad<{ items: Submission[] }>(
    `/admin/review-queue?status=${status}&page=${page}`,
    revision,
  );
  async function review(action: string) {
    if (!selected) return;
    setBusy(true);
    setIssue(null);
    try {
      await api(`/admin/submissions/${selected.id}/${action}`, "POST", {
        note,
      });
      setSelected(null);
      setNote("");
      setRevision((n) => n + 1);
    } catch (e) {
      setIssue(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="section-heading">
        <h2>Hàng đợi duyệt</h2>
        <select
          aria-label="Lọc trạng thái duyệt"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
            setSelected(null);
          }}
        >
          {[
            ["pending", "Chờ duyệt"],
            ["approved", "Đã duyệt"],
            ["rejected", "Đã từ chối"],
            ["changes_requested", "Cần chỉnh sửa"],
          ].map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>
      <ErrorMessage error={error || issue} />
      {loading ? (
        <Loading />
      ) : data?.items.length ? (
        <>
          <div className="admin-list">
            {data.items.map((s) => (
              <button
                className={`panel review-item ${selected?.id === s.id ? "selected" : ""}`}
                key={s.id}
                onClick={() => {
                  setSelected(s);
                  setNote(s.review_note || "");
                }}
              >
                <div>
                  <strong>{s.content.title}</strong>
                  <p>
                    {s.contact} · {date(s.created_at)}
                  </p>
                </div>
                <Badge status={s.status} />
                <Eye size={18} />
              </button>
            ))}
          </div>
          <Pagination
            page={page}
            hasNext={data.items.length === 12}
            onChange={setPage}
          />
        </>
      ) : (
        <Empty text="Hàng đợi này đã gọn gàng." />
      )}
      {selected && (
        <>
          <div className="panel">
            <div className="row between">
              <h2>{selected.content.title}</h2>
              <button
                className="icon-button"
                aria-label="Đóng xem trước"
                onClick={() => setSelected(null)}
              >
                <X />
              </button>
            </div>
            {Boolean(selected.duplicates?.length) && (
              <Notice>
                Cảnh báo trùng tiêu đề với:{" "}
                {selected.duplicates?.map((d) => d.title).join(", ")}. Hãy kiểm
                tra trước khi xuất bản.
              </Notice>
            )}
            <p className="small muted">
              Nguồn đóng góp: {selected.id} · {selected.contact}
            </p>
          </div>
          <ExamPreview content={selected.content} />
          {selected.status === "pending" && (
            <div className="panel">
              <label className="field">
                Ghi chú / lý do (bắt buộc khi từ chối hoặc yêu cầu sửa)
                <textarea
                  maxLength={2000}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
              <div className="row wrap">
                <button
                  className="button"
                  disabled={busy}
                  onClick={() => void review("approve")}
                >
                  <Check size={16} />
                  Duyệt & xuất bản
                </button>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => void review("request-changes")}
                >
                  <Pencil size={16} />
                  Yêu cầu chỉnh sửa
                </button>
                <button
                  className="button danger"
                  disabled={busy}
                  onClick={() => void review("reject")}
                >
                  <X size={16} />
                  Từ chối
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
function getExamQuestionCount(content: unknown): number {
  if (!content) return 0;
  if (typeof content === "object" && Array.isArray((content as { questions?: unknown[] }).questions)) {
    return (content as { questions: unknown[] }).questions.length;
  }
  if (typeof content === "string") {
    try {
      const parsed = JSON.parse(content);
      return Array.isArray(parsed?.questions) ? parsed.questions.length : 0;
    } catch {
      return 0;
    }
  }
  return 0;
}

function ManageExams() {
  const [page, setPage] = useState(1),
    [query, setQuery] = useState(""),
    [search, setSearch] = useState(""),
    [revision, setRevision] = useState(0),
    [editing, setEditing] = useState<string | null>(null),
    [raw, setRaw] = useState(JSON.stringify(template, null, 2)),
    [status, setStatus] = useState("draft"),
    [selected, setSelected] = useState<string[]>([]),
    [issue, setIssue] = useState<unknown>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [selectMenuOpen, setSelectMenuOpen] = useState(false);
  const selectMenuRef = useRef<HTMLDivElement>(null);
  const { data, error, loading } = useLoad<{
    items: (ExamCard & { content: ExamContent })[];
    total?: number;
    page?: number;
    limit?: number;
  }>(`/admin/exams?q=${encodeURIComponent(search)}&page=${page}`, revision);
  useEffect(() => {
    if (!selectMenuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (
        selectMenuRef.current &&
        !selectMenuRef.current.contains(e.target as Node)
      ) {
        setSelectMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [selectMenuOpen]);
  const safeSelected = Array.isArray(selected) ? selected : [];
  async function deleteSelected() {
    if (
      busy ||
      !safeSelected.length ||
      !window.confirm(
        `Xóa ${safeSelected.length} đề đã chọn và toàn bộ câu hỏi liên quan khỏi cơ sở dữ liệu?`,
      )
    )
      return;
    setIssue(null);
    setMessage("");
    setBusy(true);
    try {
      const result = await api<{ deleted: number }>("/admin/exams", "DELETE", {
        ids: safeSelected,
      });
      setSelected([]);
      setPage(1);
      setRevision((n) => n + 1);
      setMessage(`Đã xóa ${result.deleted} đề và toàn bộ câu hỏi liên quan khỏi cơ sở dữ liệu.`);
    } catch (e) {
      setIssue(e);
    } finally {
      setBusy(false);
    }
  }
  async function selectAllExams() {
    setBusy(true);
    try {
      const res = await api<{ ids: string[]; total: number }>(
        `/admin/exams?ids_only=true&q=${encodeURIComponent(search)}`,
      );
      setSelected(Array.isArray(res?.ids) ? res.ids : []);
      setSelectMenuOpen(false);
    } catch (e) {
      setIssue(e);
    } finally {
      setBusy(false);
    }
  }
  async function handleImportJson(file: File) {
    if (file.size > 2 * 1024 * 1024) {
      setIssue(new Error("File JSON tối đa 2 MB."));
      return;
    }
    setIssue(null);
    setMessage("");
    setBusy(true);
    try {
      const text = await file.text();
      let rawData: unknown;
      try {
        rawData = JSON.parse(text);
      } catch {
        throw new Error("File tải lên không phải là định dạng JSON hợp lệ.");
      }

      const items = Array.isArray(rawData) ? rawData : [rawData];
      if (items.length === 0) {
        throw new Error("File JSON rỗng, không chứa đề thi nào.");
      }

      let successCount = 0;
      let lastTitle = "";
      for (const item of items) {
        const normalized = normalizeExamPayload(item);
        await api("/admin/exams", "POST", {
          content: normalized,
          status: "published",
        });
        successCount++;
        lastTitle = normalized.title;
      }

      setRevision((n) => n + 1);
      setPage(1);
      const titleInfo =
        items.length === 1 && lastTitle ? ` "${lastTitle}"` : "";
      setMessage(
        `Đã nhập và lưu thành công ${successCount} đề thi${titleInfo} vào cơ sở dữ liệu!`,
      );
    } catch (e) {
      setIssue(e);
    } finally {
      setBusy(false);
    }
  }
  async function save(contentToSave?: ExamContent) {
    setIssue(null);
    setMessage("");
    setBusy(true);
    try {
      const payload = contentToSave || normalizeExamPayload(JSON.parse(raw));
      await api(
        `/admin/exams${editing && editing !== "new" ? `/${editing}` : ""}`,
        editing === "new" ? "POST" : "PUT",
        { content: payload, status },
      );
      setEditing(null);
      setRevision((n) => n + 1);
      setMessage(`Đã lưu đề "${payload.title}" vào cơ sở dữ liệu và ghi nhật ký.`);
    } catch (e) {
      setIssue(e);
      throw e;
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="section-heading">
        <h2>Quản lý đề thi</h2>
        <div className="row wrap" style={{ gap: 8 }}>
          <label
            className="button secondary small upload-label"
            style={{ margin: 0, cursor: busy ? "not-allowed" : "pointer" }}
            title="Chọn file JSON đề thi để lưu trực tiếp vào cơ sở dữ liệu"
          >
            <Upload size={16} />
            Nhập JSON vào database
            <input
              type="file"
              accept="application/json,.json"
              disabled={busy}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                await handleImportJson(f);
                e.target.value = "";
              }}
            />
          </label>
          <button
            className="button small"
            disabled={busy}
            onClick={() => {
              setEditing("new");
              setRaw(JSON.stringify(template, null, 2));
              setStatus("draft");
              setMessage("");
            }}
          >
            <Plus size={16} />
            Tạo đề
          </button>
        </div>
      </div>
      <form
        className="search-box"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(query);
          setPage(1);
          setSelected([]);
        }}
      >
        <input
          aria-label="Tìm đề quản trị"
          disabled={busy}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm theo tên đề…"
        />
        <button className="button secondary small" disabled={busy}>
          Tìm
        </button>
      </form>
      <ErrorMessage error={error || issue} />
      {message && <Notice>{message}</Notice>}
      {editing ? (
        <>
          <div className="panel admin-edit-panel">
            <div className="row between wrap" style={{ gap: 12 }}>
              <div>
                <span className="eyebrow green-text">QUẢN LÝ ĐỀ THI</span>
                <h3>{editing === "new" ? "Tạo đề mới" : "Chỉnh sửa đề thi"}</h3>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <button
                  className="button secondary small"
                  onClick={() => setEditing(null)}
                >
                  <X size={15} />
                  Hủy
                </button>
                <button
                  className="button small"
                  disabled={busy}
                  onClick={() => void save()}
                >
                  <Save size={15} />
                  {busy ? "Đang lưu…" : "Lưu đề"}
                </button>
              </div>
            </div>
            <label className="field" style={{ marginTop: 14 }}>
              Trạng thái đề thi
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="draft">Bản nháp</option>
                <option value="published">Xuất bản</option>
                <option value="archived">Lưu trữ</option>
              </select>
            </label>
          </div>
          <ExamEditor
            key={editing}
            raw={raw}
            onChange={setRaw}
            defaultMode="preview"
            onDirectSave={save}
          />
          <div className="row wrap between" style={{ marginTop: 24, marginBottom: 24 }}>
            <button
              className="button secondary"
              onClick={() => setEditing(null)}
            >
              Hủy
            </button>
            <button
              className="button"
              disabled={busy}
              onClick={() => void save()}
            >
              <Save size={16} />
              {busy ? "Đang lưu…" : "Lưu đề"}
            </button>
          </div>
        </>
      ) : loading ? (
        <Loading />
      ) : data?.items.length ? (
        <fieldset disabled={busy} aria-label="Danh sách đề thi">
          <div className="admin-batch-bar">
            <div className="admin-batch-left" ref={selectMenuRef}>
              <div className="admin-select-anchor">
                <button
                  type="button"
                  className={`button secondary small admin-select-trigger ${selectMenuOpen ? "active" : ""}`}
                  onClick={() => setSelectMenuOpen((o) => !o)}
                  aria-expanded={selectMenuOpen}
                >
                  <CheckSquare size={15} />
                  <span>Chọn mục</span>
                  <ChevronDown
                    size={13}
                    className={`select-chevron ${selectMenuOpen ? "open" : ""}`}
                  />
                </button>
                <div
                  className={`admin-select-dropdown ${selectMenuOpen ? "open" : ""}`}
                  role="menu"
                >
                  <label className="admin-select-dropdown-item">
                    <input
                      type="checkbox"
                      checked={
                        (data?.items?.length ?? 0) > 0 &&
                        (data?.items || []).every((exam) => safeSelected.includes(exam.id))
                      }
                      onChange={(e) => {
                        const pageIds = (data?.items || []).map((exam) => exam.id);
                        setSelected(
                          e.target.checked
                            ? Array.from(new Set([...safeSelected, ...pageIds]))
                            : safeSelected.filter((id) => !pageIds.includes(id)),
                        );
                      }}
                    />
                    <span>Chọn tất cả trong trang ({data?.items?.length ?? 0})</span>
                  </label>
                  <button
                    type="button"
                    className="admin-select-dropdown-item featured"
                    onClick={() => void selectAllExams()}
                  >
                    <span>Toàn bộ hệ thống</span>
                    <span className="select-item-tag featured">{data?.total ?? data?.items?.length ?? 0} đề</span>
                  </button>
                  {safeSelected.length > 0 && (
                    <>
                      <div className="admin-select-dropdown-divider" />
                      <button
                        type="button"
                        className="admin-select-dropdown-clear"
                        onClick={() => {
                          setSelected([]);
                          setSelectMenuOpen(false);
                        }}
                      >
                        <X size={13} />
                        Bỏ chọn tất cả ({safeSelected.length})
                      </button>
                    </>
                  )}
                </div>
              </div>
              {safeSelected.length > 0 && (
                <div className="admin-selection-badge">
                  <span>
                    Đã chọn <strong>{safeSelected.length}</strong>
                    {data?.total ? ` / ${data.total}` : ""} đề
                  </span>
                  {Boolean(
                    data?.total &&
                    data.total > (data?.items?.length ?? 0) &&
                    safeSelected.length < data.total,
                  ) && (
                      <button
                        type="button"
                        className="admin-select-all-btn"
                        onClick={() => void selectAllExams()}
                      >
                        <Check size={13} />
                        Chọn tất cả {data?.total} đề
                      </button>
                    )}
                  <button
                    type="button"
                    className="admin-clear-link"
                    onClick={() => setSelected([])}
                  >
                    Bỏ chọn
                  </button>
                </div>
              )}
            </div>

            <div className="admin-batch-right">
              <button
                className={`button small admin-delete-btn ${safeSelected.length ? "danger" : "secondary"}`}
                disabled={busy || !safeSelected.length}
                onClick={() => void deleteSelected()}
              >
                <Trash2 size={14} />
                <span>
                  {busy
                    ? "Đang xóa…"
                    : safeSelected.length
                      ? `Xóa đã chọn (${safeSelected.length})`
                      : "Xóa đã chọn"}
                </span>
              </button>
            </div>
          </div>
          <div className="admin-list">
            {(data?.items || []).map((exam) => (
              <div
                className={`panel review-item ${safeSelected.includes(exam.id) ? "selected" : ""}`}
                key={exam.id}
              >
                <input
                  type="checkbox"
                  aria-label={`Chọn đề ${exam.title}`}
                  checked={safeSelected.includes(exam.id)}
                  onChange={(e) =>
                    setSelected((ids) => {
                      const cur = Array.isArray(ids) ? ids : [];
                      return e.target.checked
                        ? [...cur, exam.id]
                        : cur.filter((id) => id !== exam.id);
                    })
                  }
                />
                <div>
                  <strong>{exam.title}</strong>
                  <p style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                    <span className={`subject-pill subject-${getSubjectTone(exam.subject)}`} style={{ padding: "2px 8px", fontSize: "11px" }}>
                      <span className="subject-dot" />
                      {exam.subject}
                    </span>
                    <span>· v{exam.version} · {getExamQuestionCount(exam.content)} câu</span>
                  </p>
                </div>
                <Badge status={exam.status || "draft"} />
                <button
                  className="button secondary small"
                  onClick={() => {
                    setEditing(exam.id);
                    setRaw(JSON.stringify(exam.content, null, 2));
                    setStatus(exam.status || "draft");
                    setMessage("");
                  }}
                >
                  Chỉnh sửa
                </button>
                <BankPicker
                  exam={exam}
                  onChange={() => setRevision((n) => n + 1)}
                />
              </div>
            ))}
          </div>
          <Pagination
            page={page}
            hasNext={data.items.length === 12}
            onChange={(next) => {
              setSelected([]);
              setPage(next);
            }}
          />
        </fieldset>
      ) : (
        <Empty />
      )}
    </>
  );
}
function ManageQuestions() {
  const [page, setPage] = useState(1),
    [query, setQuery] = useState(""),
    [filterSubject, setFilterSubject] = useState(""),
    [kind, setKind] = useState(""),
    [difficulty, setDifficulty] = useState(""),
    [filterStatus, setFilterStatus] = useState(""),
    [revision, setRevision] = useState(0),
    [editing, setEditing] = useState<string | null>(null),
    [content, setContent] = useState<Question>(emptyQuestion()),
    [status, setStatus] = useState("draft"),
    [selected, setSelected] = useState<string[]>([]),
    [selectMenuOpen, setSelectMenuOpen] = useState(false),
    [deleteDialog, setDeleteDialog] = useState<{
      ids: string[];
      preview?: string;
    } | null>(null),
    [deleteMode, setDeleteMode] = useState<"permanent" | "archive">("permanent"),
    [issue, setIssue] = useState<unknown>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const selectMenuRef = useRef<HTMLDivElement>(null);

  const { data: subjectsData } = useLoad<{ subjects: string[] }>(
    "/admin/questions/subjects",
    revision,
  );

  const { data, error, loading } = useLoad<{
    items: { id: string; content: Question; status: string; version: number; subject?: string }[];
    total: number;
    page: number;
    limit: number;
  }>(
    `/admin/questions?page=${page}&q=${encodeURIComponent(query)}${filterSubject ? `&subject=${encodeURIComponent(filterSubject)}` : ""}${kind ? `&type=${kind}` : ""}${difficulty ? `&difficulty=${difficulty}` : ""}${filterStatus ? `&status=${filterStatus}` : ""}`,
    revision,
  );

  async function selectAllQuestions() {
    setBusy(true);
    try {
      const res = await api<{ ids: string[]; total: number }>(
        `/admin/questions?ids_only=true&q=${encodeURIComponent(query)}${filterSubject ? `&subject=${encodeURIComponent(filterSubject)}` : ""}${kind ? `&type=${kind}` : ""}${difficulty ? `&difficulty=${difficulty}` : ""}${filterStatus ? `&status=${filterStatus}` : ""}`,
      );
      setSelected(Array.isArray(res?.ids) ? res.ids : []);
      setSelectMenuOpen(false);
    } catch (e) {
      setIssue(e);
    } finally {
      setBusy(false);
    }
  }

  const safeSelected = Array.isArray(selected) ? selected : [];

  useEffect(() => {
    if (!selectMenuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (
        selectMenuRef.current &&
        !selectMenuRef.current.contains(e.target as Node)
      ) {
        setSelectMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [selectMenuOpen]);

  function requestDeleteSelected() {
    if (busy || !safeSelected.length) return;
    setDeleteDialog({
      ids: safeSelected,
      preview: `${safeSelected.length} câu hỏi đã chọn`,
    });
    setDeleteMode("permanent");
  }

  function requestDeleteSingle(id: string, qContent?: Question) {
    if (busy) return;
    const previewText = qContent?.prompt?.[0]?.value
      ? `"${qContent.prompt[0].value.slice(0, 70)}${qContent.prompt[0].value.length > 70 ? "…" : ""}"`
      : "câu hỏi này";
    setDeleteDialog({
      ids: [id],
      preview: previewText,
    });
    setDeleteMode("permanent");
  }

  async function executeDelete(mode: "permanent" | "archive") {
    if (!deleteDialog || busy) return;
    const isPermanent = mode === "permanent";
    setIssue(null);
    setMessage("");
    setBusy(true);
    try {
      const result = await api<{ deleted: number; mode: string }>("/admin/questions", "DELETE", {
        ids: deleteDialog.ids,
        permanent: isPermanent,
      });
      const idsSet = new Set(deleteDialog.ids);
      setSelected((prev) => (Array.isArray(prev) ? prev.filter((id) => !idsSet.has(id)) : []));
      if (editing && idsSet.has(editing)) setEditing(null);
      setDeleteDialog(null);
      setRevision((n) => n + 1);
      if (isPermanent) {
        setMessage(`Đã xóa vĩnh viễn ${result.deleted} câu hỏi khỏi cơ sở dữ liệu.`);
      } else {
        setMessage(`Đã chuyển ${result.deleted} câu hỏi vào mục Lưu trữ.`);
      }
    } catch (e) {
      setIssue(e);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    setIssue(null);
    try {
      await api(
        `/admin/questions${editing === "new" ? "" : `/${editing}`}`,
        editing === "new" ? "POST" : "PUT",
        { content, status },
      );
      setEditing(null);
      setRevision((n) => n + 1);
      setMessage("Đã lưu câu hỏi thành công.");
    } catch (e) {
      setIssue(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="section-heading">
        <h2>Ngân hàng câu hỏi</h2>
        <button
          className="button small"
          onClick={() => {
            setEditing("new");
            setContent(emptyQuestion());
            setStatus("draft");
            setMessage("");
          }}
        >
          <Plus size={16} />
          Tạo câu hỏi
        </button>
      </div>
      <Notice>
        Xuất bản bản sửa câu hỏi sẽ cập nhật các đề đang liên kết; bài làm đã
        bắt đầu giữ nguyên nội dung cũ. Xóa hoặc lưu trữ câu hỏi sẽ ẩn khỏi ngân
        hàng và giữ lại nội dung trong đề đã dùng.
      </Notice>
      <div className="panel form-grid">
        <label className="field">
          Môn học
          <select
            value={filterSubject}
            onChange={(e) => {
              setFilterSubject(e.target.value);
              setPage(1);
              setSelected([]);
            }}
          >
            <option value="">Tất cả các môn</option>
            {(subjectsData?.subjects || [
              "Toán học",
              "Ngữ văn",
              "Tiếng Anh",
              "Vật lý",
              "Hóa học",
              "Sinh học",
              "Tin học",
              "Lịch sử",
              "Địa lý",
              "GDCD",
            ]).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Tìm nội dung
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
              setSelected([]);
            }}
            placeholder="Nhập nội dung câu hỏi…"
          />
        </label>
        <label className="field">
          Dạng câu hỏi
          <select
            value={kind}
            onChange={(e) => {
              setKind(e.target.value);
              setPage(1);
              setSelected([]);
            }}
          >
            <option value="">Tất cả dạng câu</option>
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
            value={difficulty}
            onChange={(e) => {
              setDifficulty(e.target.value);
              setPage(1);
              setSelected([]);
            }}
          >
            <option value="">Mọi mức độ</option>
            <option value="easy">Dễ</option>
            <option value="medium">Trung bình</option>
            <option value="hard">Khó</option>
          </select>
        </label>
        <label className="field">
          Trạng thái lọc
          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setPage(1);
              setSelected([]);
            }}
          >
            <option value="">Mọi trạng thái</option>
            <option value="draft">Nháp</option>
            <option value="published">Đã xuất bản</option>
            <option value="archived">Lưu trữ</option>
          </select>
        </label>
      </div>
      <ErrorMessage error={error || issue} />
      {message && <Notice>{message}</Notice>}
      {editing ? (
        <>
          <div className="panel">
            <label className="field">
              Trạng thái câu hỏi
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="draft">Bản nháp</option>
                <option value="published">Xuất bản</option>
                <option value="archived">Lưu trữ</option>
              </select>
            </label>
          </div>
          <QuestionEditor
            q={content}
            onChange={setContent}
            onRemove={() => setEditing(null)}
          />
          <div className="row wrap between" style={{ marginTop: 16 }}>
            <div className="row" style={{ gap: 8 }}>
              <button
                className="button"
                disabled={busy}
                onClick={() => void save()}
              >
                <Save size={16} />
                Lưu câu hỏi
              </button>
              <button
                className="button secondary"
                onClick={() => setEditing(null)}
              >
                Hủy
              </button>
            </div>
            {editing !== "new" && (
              <button
                type="button"
                className="button danger"
                disabled={busy}
                onClick={() => requestDeleteSingle(editing, content)}
              >
                <Trash2 size={16} />
                Xóa câu hỏi
              </button>
            )}
          </div>
        </>
      ) : loading ? (
        <Loading />
      ) : data?.items.length ? (
        <fieldset disabled={busy} aria-label="Danh sách câu hỏi">
          <div className="admin-batch-bar">
            <div className="admin-batch-left" ref={selectMenuRef}>
              <div className="admin-select-anchor">
                <button
                  type="button"
                  className={`button secondary small admin-select-trigger ${selectMenuOpen ? "active" : ""}`}
                  onClick={() => setSelectMenuOpen((v) => !v)}
                  disabled={busy}
                  aria-expanded={selectMenuOpen}
                >
                  <input
                    type="checkbox"
                    aria-label="Chọn tất cả câu hỏi trong trang"
                    checked={
                      Boolean(data?.items?.length) &&
                      data!.items.every((q) => safeSelected.includes(q.id))
                    }
                    onChange={(e) => {
                      e.stopPropagation();
                      const pageIds = (data?.items || []).map((q) => q.id);
                      if (e.target.checked) {
                        setSelected((prev) =>
                          Array.from(new Set([...(prev || []), ...pageIds])),
                        );
                      } else {
                        setSelected((prev) =>
                          (prev || []).filter((id) => !pageIds.includes(id)),
                        );
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span>Chọn mục</span>
                  <ChevronDown
                    size={13}
                    className={`select-chevron ${selectMenuOpen ? "open" : ""}`}
                  />
                </button>
                <div
                  className={`admin-select-dropdown ${selectMenuOpen ? "open" : ""}`}
                  role="menu"
                >
                  <label className="admin-select-dropdown-item">
                    <input
                      type="checkbox"
                      aria-label="Chọn tất cả câu trong trang"
                      checked={
                        Boolean(data?.items?.length) &&
                        data!.items.every((q) => safeSelected.includes(q.id))
                      }
                      onChange={(e) => {
                        const pageIds = (data?.items || []).map((q) => q.id);
                        if (e.target.checked) {
                          setSelected((prev) =>
                            Array.from(new Set([...(prev || []), ...pageIds])),
                          );
                        } else {
                          setSelected((prev) =>
                            (prev || []).filter((id) => !pageIds.includes(id)),
                          );
                        }
                      }}
                    />
                    <span>Chọn tất cả trong trang ({data?.items?.length ?? 0})</span>
                  </label>
                  <button
                    type="button"
                    className="admin-select-dropdown-item featured"
                    onClick={() => void selectAllQuestions()}
                  >
                    <span>Toàn bộ ngân hàng {filterSubject ? `môn ${filterSubject}` : ""}</span>
                    <span className="select-item-tag featured">{data?.total ?? data?.items?.length ?? 0} câu</span>
                  </button>
                  {safeSelected.length > 0 && (
                    <>
                      <div className="admin-select-dropdown-divider" />
                      <button
                        type="button"
                        className="admin-select-dropdown-clear"
                        onClick={() => {
                          setSelected([]);
                          setSelectMenuOpen(false);
                        }}
                      >
                        <X size={13} />
                        Bỏ chọn tất cả ({safeSelected.length})
                      </button>
                    </>
                  )}
                </div>
              </div>
              {safeSelected.length > 0 && (
                <div className="admin-selection-badge">
                  <span>
                    Đã chọn <strong>{safeSelected.length}</strong>
                    {data?.total ? ` / ${data.total}` : ""} câu hỏi
                  </span>
                  {Boolean(
                    data?.total &&
                    data.total > safeSelected.length,
                  ) && (
                      <button
                        type="button"
                        className="admin-select-all-btn"
                        onClick={() => void selectAllQuestions()}
                        title={`Chọn tất cả ${data?.total} câu hỏi`}
                      >
                        <Check size={13} />
                        Chọn toàn bộ {data?.total} câu hỏi {filterSubject ? `môn ${filterSubject}` : ""}
                      </button>
                    )}
                  <button
                    type="button"
                    className="admin-clear-link"
                    onClick={() => setSelected([])}
                  >
                    Bỏ chọn
                  </button>
                </div>
              )}
            </div>
            <div className="admin-batch-actions">
              <button
                type="button"
                className={`button small admin-delete-btn ${safeSelected.length ? "danger" : "secondary"}`}
                disabled={busy || !safeSelected.length}
                onClick={() => requestDeleteSelected()}
                title="Xóa các câu hỏi đã chọn khỏi ngân hàng"
              >
                <Trash2 size={14} />
                <span>
                  {busy
                    ? "Đang xóa…"
                    : safeSelected.length
                      ? `Xóa ${safeSelected.length} câu`
                      : "Xóa đã chọn"}
                </span>
              </button>
            </div>
          </div>

          {/* Banner notification when page items are selected but bank has more */}
          {Boolean(
            data?.total &&
            data.total > (data?.items?.length ?? 0) &&
            safeSelected.length > 0 &&
            safeSelected.length < data.total &&
            data.items.every((q) => safeSelected.includes(q.id)),
          ) && (
              <div
                className="admin-selection-callout"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 16px",
                  background: "var(--subtle)",
                  borderRadius: 12,
                  border: "1px solid var(--line)",
                  marginBottom: 14,
                  fontSize: 13.5,
                }}
              >
                <span>
                  Đang chọn tất cả <strong>{data.items.length}</strong> câu hỏi trên trang này.
                </span>
                <button
                  type="button"
                  className="button small primary"
                  onClick={() => void selectAllQuestions()}
                  disabled={busy}
                >
                  <Check size={14} />
                  <span>
                    Chọn tất cả <strong>{data.total}</strong> câu hỏi {filterSubject ? `môn ${filterSubject}` : "trong toàn bộ ngân hàng"}
                  </span>
                </button>
              </div>
            )}

          <div className="admin-list">
            {(data?.items || []).map((q) => (
              <div
                className={`panel ${safeSelected.includes(q.id) ? "selected" : ""}`}
                key={q.id}
              >
                <div
                  className="row between wrap"
                  style={{ gap: 8, marginBottom: 10 }}
                >
                  <div className="row" style={{ gap: 10, alignItems: "center" }}>
                    <input
                      type="checkbox"
                      aria-label={`Chọn câu hỏi ${q.id}`}
                      checked={safeSelected.includes(q.id)}
                      onChange={(e) => {
                        setSelected((prev) => {
                          const cur = Array.isArray(prev) ? prev : [];
                          return e.target.checked
                            ? [...cur, q.id]
                            : cur.filter((id) => id !== q.id);
                        });
                      }}
                    />
                    <span className="small muted">
                      {typeLabels[q.content.type] || q.content.type} · v
                      {q.version}
                      {q.content.difficulty
                        ? ` · ${q.content.difficulty === "easy" ? "Dễ" : q.content.difficulty === "hard" ? "Khó" : "Trung bình"}`
                        : ""}
                    </span>
                    {q.subject && (
                      <span
                        className={`subject-pill ${getSubjectTone(q.subject)}`}
                        style={{ cursor: "pointer", marginLeft: 4 }}
                        title={`Lọc theo môn ${q.subject}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setFilterSubject(q.subject || "");
                          setPage(1);
                        }}
                      >
                        {q.subject}
                      </span>
                    )}
                  </div>
                  <div className="row" style={{ gap: 8, alignItems: "center" }}>
                    <Badge status={q.status} />
                    <button
                      type="button"
                      className="button secondary small"
                      onClick={() => {
                        setEditing(q.id);
                        setContent(q.content);
                        setStatus(q.status);
                        setMessage("");
                      }}
                    >
                      <Pencil size={14} />
                      Chỉnh sửa
                    </button>
                    <button
                      type="button"
                      className="button danger small"
                      disabled={busy}
                      onClick={() => requestDeleteSingle(q.id, q.content)}
                      title="Xóa câu hỏi này"
                    >
                      <Trash2 size={14} />
                      Xóa
                    </button>
                  </div>
                </div>
                <Blocks blocks={q.content.prompt} />
              </div>
            ))}
          </div>
          <Pagination
            page={page}
            hasNext={data.items.length === 12}
            onChange={(next) => {
              setPage(next);
            }}
          />
        </fieldset>
      ) : (
        <Empty text="Không tìm thấy câu hỏi phù hợp." />
      )}

      {deleteDialog && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) setDeleteDialog(null);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-dialog delete-confirm-dialog">
            <div className="modal-dialog-header">
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  className={`modal-icon-badge ${deleteMode === "permanent" ? "danger" : "archive"}`}
                >
                  {deleteMode === "permanent" ? (
                    <Trash2 size={20} />
                  ) : (
                    <Archive size={20} />
                  )}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
                    {deleteDialog.ids.length === 1
                      ? "Tùy chọn xóa câu hỏi"
                      : `Tùy chọn xóa ${deleteDialog.ids.length} câu hỏi`}
                  </h3>
                  <p className="meta-text" style={{ margin: "3px 0 0" }}>
                    Chọn phương thức xử lý câu hỏi trong hệ thống
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => !busy && setDeleteDialog(null)}
                disabled={busy}
                aria-label="Đóng"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-dialog-body">
              {deleteDialog.preview && (
                <div className="delete-preview-box">
                  <div className="delete-preview-label">
                    {deleteDialog.ids.length === 1 ? "Nội dung câu hỏi:" : "Đối tượng tác động:"}
                  </div>
                  <div className="delete-preview-content">
                    {deleteDialog.preview}
                  </div>
                </div>
              )}

              <div className="delete-options-grid">
                <div
                  className={`delete-option-card ${deleteMode === "archive" ? "selected archive" : ""}`}
                  onClick={() => setDeleteMode("archive")}
                  role="button"
                  tabIndex={0}
                >
                  <div className="delete-option-header">
                    <div className="delete-option-icon archive">
                      <Archive size={18} />
                    </div>
                    <div className="delete-option-title-row">
                      <div className="delete-option-title">Chuyển vào lưu trữ</div>
                      <span className="delete-option-badge archive">An toàn</span>
                    </div>
                    <input
                      type="radio"
                      name="deleteQuestionMode"
                      checked={deleteMode === "archive"}
                      onChange={() => setDeleteMode("archive")}
                      className="delete-option-radio"
                    />
                  </div>
                  <p className="delete-option-desc">
                    Đặt trạng thái câu hỏi thành <strong>"Lưu trữ"</strong>. Câu hỏi sẽ ẩn khỏi danh sách chính nhưng dữ liệu vẫn an toàn trong cơ sở dữ liệu, có thể tìm lại và khôi phục bất cứ lúc nào qua bộ lọc trạng thái.
                  </p>
                </div>

                <div
                  className={`delete-option-card ${deleteMode === "permanent" ? "selected danger" : ""}`}
                  onClick={() => setDeleteMode("permanent")}
                  role="button"
                  tabIndex={0}
                >
                  <div className="delete-option-header">
                    <div className="delete-option-icon danger">
                      <Trash2 size={18} />
                    </div>
                    <div className="delete-option-title-row">
                      <div className="delete-option-title">Xóa vĩnh viễn khỏi Database</div>
                      <span className="delete-option-badge danger">Không thể hoàn tác</span>
                    </div>
                    <input
                      type="radio"
                      name="deleteQuestionMode"
                      checked={deleteMode === "permanent"}
                      onChange={() => setDeleteMode("permanent")}
                      className="delete-option-radio"
                    />
                  </div>
                  <p className="delete-option-desc">
                    Xóa <strong>hoàn toàn câu hỏi khỏi cơ sở dữ liệu</strong> và gỡ bỏ khỏi ngân hàng câu hỏi. Số lượng câu hỏi trên trang Tổng quan (Dashboard) sẽ giảm ngay lập tức.
                  </p>
                </div>
              </div>
            </div>

            <div className="modal-dialog-footer">
              <button
                type="button"
                className="button secondary"
                onClick={() => setDeleteDialog(null)}
                disabled={busy}
              >
                Hủy bỏ
              </button>
              <div>
                {deleteMode === "archive" ? (
                  <button
                    type="button"
                    className="button primary"
                    onClick={() => void executeDelete("archive")}
                    disabled={busy}
                  >
                    <Archive size={15} />
                    <span>{busy ? "Đang xử lý…" : "Xác nhận chuyển vào lưu trữ"}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="button danger"
                    onClick={() => void executeDelete("permanent")}
                    disabled={busy}
                  >
                    <Trash2 size={15} />
                    <span>{busy ? "Đang xóa…" : "Xác nhận xóa vĩnh viễn"}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ManageDocuments() {
  const [revision, setRevision] = useState(0),
    [query, setQuery] = useState(""),
    [search, setSearch] = useState(""),
    [subject, setSubject] = useState(""),
    [grade, setGrade] = useState(""),
    [category, setCategory] = useState(""),
    [status, setStatus] = useState("all"),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState<string[]>([]),
    [editing, setEditing] = useState<"new" | DocumentItem | null>(null),
    [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null),
    [deleteDialog, setDeleteDialog] = useState<{ ids: string[] } | null>(null),
    [deleteMode, setDeleteMode] = useState<"archive" | "permanent">("archive"),
    [busy, setBusy] = useState(false),
    [issue, setIssue] = useState<unknown>(null),
    [message, setMessage] = useState<string | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState(""),
    [formDesc, setFormDesc] = useState(""),
    [formSubject, setFormSubject] = useState("Toán học"),
    [formGrade, setFormGrade] = useState("12"),
    [formCategory, setFormCategory] = useState("theory"),
    [formAuthor, setFormAuthor] = useState("Examsparty"),
    [formStatus, setFormStatus] = useState<"published" | "draft" | "archived">("published"),
    [formFile, setFormFile] = useState<File | null>(null);

  const { data, error, loading } = useLoad<{ items: DocumentItem[]; total: number }>(
    `/admin/documents?page=${page}&q=${encodeURIComponent(search)}&subject=${encodeURIComponent(subject)}&grade=${encodeURIComponent(grade)}&category=${encodeURIComponent(category)}&status=${encodeURIComponent(status)}&r=${revision}`,
  );

  const startEdit = (item: "new" | DocumentItem) => {
    if (item === "new") {
      setFormTitle("");
      setFormDesc("");
      setFormSubject("Toán học");
      setFormGrade("12");
      setFormCategory("theory");
      setFormAuthor("Examsparty");
      setFormStatus("published");
      setFormFile(null);
    } else {
      setFormTitle(item.title);
      setFormDesc(item.description || "");
      setFormSubject(item.subject);
      setFormGrade(item.grade);
      setFormCategory(item.category);
      setFormAuthor(item.author_name || "Examsparty");
      setFormStatus(item.status);
      setFormFile(null);
    }
    setEditing(item);
    setIssue(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setIssue(new Error("Vui lòng nhập tiêu đề tài liệu."));
      return;
    }
    if (editing === "new" && !formFile) {
      setIssue(new Error("Vui lòng chọn tập tin tài liệu cần tải lên."));
      return;
    }

    setBusy(true);
    setIssue(null);
    try {
      const formData = new FormData();
      formData.append("title", formTitle.trim());
      formData.append("description", formDesc.trim());
      formData.append("subject", formSubject);
      formData.append("grade", formGrade);
      formData.append("category", formCategory);
      formData.append("author_name", formAuthor.trim() || "Examsparty");
      formData.append("status", formStatus);
      if (formFile) {
        formData.append("file", formFile);
      }

      const url = editing === "new" ? "/api/admin/documents" : `/api/admin/documents/${editing!.id}`;
      const method = editing === "new" ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        body: formData,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Không thể lưu tài liệu.");
      }

      setMessage(editing === "new" ? "Đã tải lên tài liệu mới thành công!" : "Đã cập nhật thông tin tài liệu!");
      setTimeout(() => setMessage(null), 3000);
      setEditing(null);
      setRevision((r) => r + 1);
    } catch (err: any) {
      setIssue(err);
    } finally {
      setBusy(false);
    }
  };

  const executeDelete = async (mode: "archive" | "permanent") => {
    if (!deleteDialog) return;
    setBusy(true);
    setIssue(null);
    try {
      await api("/admin/documents", "DELETE", {
        ids: deleteDialog.ids,
        permanent: mode === "permanent",
      });
      setMessage(
        mode === "permanent"
          ? `Đã xóa vĩnh viễn ${deleteDialog.ids.length} tài liệu.`
          : `Đã chuyển ${deleteDialog.ids.length} tài liệu vào lưu trữ.`,
      );
      setTimeout(() => setMessage(null), 3000);
      setSelected((prev) => prev.filter((id) => !deleteDialog.ids.includes(id)));
      setDeleteDialog(null);
      setRevision((r) => r + 1);
    } catch (err: any) {
      setIssue(err);
    } finally {
      setBusy(false);
    }
  };

  const handleBatchZipDownload = async () => {
    if (selected.length === 0 || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/documents/batch-download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selected }),
      });
      if (!res.ok) throw new Error("Không thể tải tập tin ZIP.");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Examsparty_Admin_Documents.zip";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setIssue(err);
    } finally {
      setBusy(false);
    }
  };

  const isAllPageSelected =
    Boolean(data?.items?.length) && data!.items.every((d) => selected.includes(d.id));

  return (
    <>
      <div className="admin-section-header">
        <div>
          <h2>Quản lý tài liệu học tập</h2>
          <p className="meta-text">Tải lên, biên soạn và quản lý các tài liệu ôn thi trực tuyến</p>
        </div>
        <button
          type="button"
          className="button small"
          onClick={() => startEdit("new")}
          disabled={busy}
        >
          <Plus size={16} />
          <span>Tải tài liệu mới</span>
        </button>
      </div>

      <div className="admin-filters-grid" style={{ marginBottom: 16 }}>
        <form
          className="search-row"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(query);
            setPage(1);
          }}
        >
          <input
            placeholder="Tìm theo tiêu đề, tên file..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="button secondary small" type="submit">
            Tìm
          </button>
        </form>

        <label className="field">
          Lọc môn
          <select
            value={subject}
            onChange={(e) => {
              setSubject(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả môn</option>
            {[
              "Toán học",
              "Ngữ văn",
              "Tiếng Anh",
              "Vật lý",
              "Hóa học",
              "Sinh học",
              "Tin học",
              "Lịch sử",
              "Địa lý",
              "GDCD",
            ].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          Khối lớp
          <select
            value={grade}
            onChange={(e) => {
              setGrade(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả khối</option>
            <option value="12">Lớp 12</option>
            <option value="11">Lớp 11</option>
            <option value="10">Lớp 10</option>
            <option value="dgnl">ĐGNL</option>
            <option value="thpt_quoc_gia">THPT QG</option>
          </select>
        </label>

        <label className="field">
          Dạng tài liệu
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Mọi thể loại</option>
            {Object.entries(documentCategories).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          Trạng thái
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">Mọi trạng thái</option>
            <option value="published">Đã xuất bản</option>
            <option value="draft">Bản nháp</option>
            <option value="archived">Lưu trữ</option>
          </select>
        </label>
      </div>

      <ErrorMessage error={error || issue} />
      {message && <Notice>{message}</Notice>}

      {/* Editing Dialog Modal */}
      {editing && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) setEditing(null);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-dialog" style={{ maxWidth: 620 }}>
            <div className="modal-dialog-header">
              <h3>{editing === "new" ? "Tải lên tài liệu học tập mới" : "Chỉnh sửa thông tin tài liệu"}</h3>
              <button
                type="button"
                className="icon-button"
                onClick={() => setEditing(null)}
                disabled={busy}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="modal-dialog-body">
              <label className="field">
                Tiêu đề tài liệu *
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="VD: Sổ tay tóm tắt công thức Vật lý 12..."
                />
              </label>

              <label className="field">
                Mô tả ngắn gọn
                <textarea
                  rows={2}
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Nội dung chính hoặc ghi chú dành cho học sinh..."
                />
              </label>

              <div className="grid col-2">
                <label className="field">
                  Môn học *
                  <select
                    value={formSubject}
                    onChange={(e) => setFormSubject(e.target.value)}
                  >
                    {[
                      "Toán học",
                      "Ngữ văn",
                      "Tiếng Anh",
                      "Vật lý",
                      "Hóa học",
                      "Sinh học",
                      "Tin học",
                      "Lịch sử",
                      "Địa lý",
                      "GDCD",
                    ].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  Khối lớp *
                  <select
                    value={formGrade}
                    onChange={(e) => setFormGrade(e.target.value)}
                  >
                    <option value="12">Lớp 12</option>
                    <option value="11">Lớp 11</option>
                    <option value="10">Lớp 10</option>
                    <option value="dgnl">ĐGNL</option>
                    <option value="thpt_quoc_gia">Tốt nghiệp THPT</option>
                  </select>
                </label>
              </div>

              <div className="grid col-2">
                <label className="field">
                  Thể loại tài liệu
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                  >
                    {Object.entries(documentCategories).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  Trạng thái
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                  >
                    <option value="published">Xuất bản công khai</option>
                    <option value="draft">Bản nháp (ẩn)</option>
                    <option value="archived">Lưu trữ</option>
                  </select>
                </label>
              </div>

              <label className="field">
                Nguồn / Tác giả
                <input
                  type="text"
                  value={formAuthor}
                  onChange={(e) => setFormAuthor(e.target.value)}
                  placeholder="Examsparty / Ban Chuyên Môn..."
                />
              </label>

              <label className="field">
                {editing === "new" ? "Chọn tập tin (PDF, DOCX, tối đa 35MB) *" : "Thay thế tập tin (để trống nếu giữ nguyên)"}
                <input
                  type="file"
                  accept=".pdf,.docx,.doc,.pptx"
                  required={editing === "new"}
                  onChange={(e) => setFormFile(e.target.files?.[0] || null)}
                />
              </label>

              <div className="modal-dialog-footer">
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setEditing(null)}
                  disabled={busy}
                >
                  Hủy
                </button>
                <button type="submit" className="button" disabled={busy}>
                  <Save size={16} />
                  <span>{busy ? "Đang xử lý…" : editing === "new" ? "Tải lên ngay" : "Lưu thay đổi"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main List */}
      {loading ? (
        <Loading />
      ) : data?.items?.length ? (
        <fieldset disabled={busy} aria-label="Danh sách tài liệu học tập">
          {/* Batch Bar */}
          <div className="admin-batch-bar">
            <div className="admin-batch-left">
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={isAllPageSelected}
                  onChange={(e) => {
                    const pageIds = (data?.items || []).map((d) => d.id);
                    if (e.target.checked) {
                      setSelected((prev) => Array.from(new Set([...prev, ...pageIds])));
                    } else {
                      setSelected((prev) => prev.filter((id) => !pageIds.includes(id)));
                    }
                  }}
                />
                <span>Chọn tất cả trong trang ({data.items.length})</span>
              </label>

              {selected.length > 0 && (
                <div className="admin-selection-badge">
                  <span>
                    Đã chọn <strong>{selected.length}</strong> / {data.total} tài liệu
                  </span>
                  <button
                    type="button"
                    className="admin-clear-link"
                    onClick={() => setSelected([])}
                  >
                    Bỏ chọn
                  </button>
                </div>
              )}
            </div>

            <div className="admin-batch-right">
              {selected.length > 0 && (
                <>
                  <button
                    type="button"
                    className="button secondary small"
                    onClick={handleBatchZipDownload}
                    title="Tải về file ZIP chứa các tài liệu đã chọn"
                  >
                    <Download size={14} />
                    <span>Tải về ZIP ({selected.length})</span>
                  </button>
                  <button
                    type="button"
                    className="admin-delete-btn"
                    onClick={() => setDeleteDialog({ ids: selected })}
                  >
                    <Trash2 size={14} />
                    <span>Xóa ({selected.length})</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }} />
                  <th>Tiêu đề tài liệu</th>
                  <th>Môn học</th>
                  <th>Khối</th>
                  <th>Dạng</th>
                  <th>Dung lượng</th>
                  <th>Lượt xem / tải</th>
                  <th>Trạng thái</th>
                  <th style={{ textAlign: "right" }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((doc) => {
                  const isChecked = selected.includes(doc.id);
                  return (
                    <tr key={doc.id} className={isChecked ? "selected-row" : ""}>
                      <td>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            setSelected((prev) =>
                              e.target.checked
                                ? [...prev, doc.id]
                                : prev.filter((id) => id !== doc.id),
                            );
                          }}
                        />
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{doc.title}</div>
                        <small className="muted" style={{ display: "block" }}>
                          {doc.file_name}
                        </small>
                      </td>
                      <td>
                        <span className={`subject-pill subject-${getSubjectTone(doc.subject)}`}>
                          <span className="subject-dot" />
                          {doc.subject}
                        </span>
                      </td>
                      <td>Lớp {doc.grade === "dgnl" ? "ĐGNL" : doc.grade === "thpt_quoc_gia" ? "THPT" : doc.grade}</td>
                      <td>{documentCategories[doc.category] || doc.category}</td>
                      <td>{formatFileSize(doc.file_size)}</td>
                      <td>
                        <span title="Lượt xem">{doc.views_count} xem</span> •{" "}
                        <span title="Lượt tải">{doc.downloads_count} tải</span>
                      </td>
                      <td>
                        <span className={`badge ${doc.status}`}>
                          {doc.status === "published"
                            ? "Xuất bản"
                            : doc.status === "draft"
                              ? "Nháp"
                              : "Lưu trữ"}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div className="row" style={{ gap: 6, justifyContent: "flex-end" }}>
                          <button
                            type="button"
                            className="icon-button"
                            onClick={() => setPreviewDoc(doc)}
                            title="Xem trước tài liệu"
                          >
                            <Eye size={15} />
                          </button>
                          <a
                            href={`/api/documents/${doc.id}/download`}
                            className="icon-button"
                            title="Tải tập tin về máy"
                          >
                            <Download size={15} />
                          </a>
                          <button
                            type="button"
                            className="icon-button"
                            onClick={() => startEdit(doc)}
                            title="Chỉnh sửa thông tin"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            className="icon-button"
                            onClick={() => setDeleteDialog({ ids: [doc.id] })}
                            title="Xóa tài liệu"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Pagination
            page={page}
            hasNext={data.items.length === 12}
            onChange={(next) => setPage(next)}
          />
        </fieldset>
      ) : (
        <Empty text="Chưa có tài liệu học tập nào phù hợp." />
      )}

      {/* Delete Confirmation Dialog */}
      {deleteDialog && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) setDeleteDialog(null);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-dialog delete-confirm-dialog">
            <div className="modal-dialog-header">
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div className={`modal-icon-badge ${deleteMode === "permanent" ? "danger" : "archive"}`}>
                  {deleteMode === "permanent" ? <Trash2 size={20} /> : <Archive size={20} />}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
                    {deleteDialog.ids.length === 1
                      ? "Tùy chọn xóa tài liệu"
                      : `Tùy chọn xóa ${deleteDialog.ids.length} tài liệu`}
                  </h3>
                  <p className="meta-text" style={{ margin: "3px 0 0" }}>
                    Chọn phương thức xử lý tài liệu trong hệ thống
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => !busy && setDeleteDialog(null)}
                disabled={busy}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-dialog-body">
              <div className="delete-options-container">
                <div
                  className={`delete-option-card ${deleteMode === "archive" ? "selected archive" : ""}`}
                  onClick={() => setDeleteMode("archive")}
                  role="button"
                  tabIndex={0}
                >
                  <div className="delete-option-header">
                    <div className="delete-option-icon archive">
                      <Archive size={18} />
                    </div>
                    <div className="delete-option-title-row">
                      <div className="delete-option-title">Chuyển vào lưu trữ</div>
                      <span className="delete-option-badge safe">An toàn</span>
                    </div>
                    <input
                      type="radio"
                      name="deleteDocMode"
                      checked={deleteMode === "archive"}
                      onChange={() => setDeleteMode("archive")}
                      className="delete-option-radio"
                    />
                  </div>
                  <p className="delete-option-desc">
                    Đặt trạng thái tài liệu thành <strong>"Lưu trữ"</strong>. Tài liệu sẽ ẩn khỏi góc học tập công khai nhưng dữ liệu vẫn được bảo toàn.
                  </p>
                </div>

                <div
                  className={`delete-option-card ${deleteMode === "permanent" ? "selected danger" : ""}`}
                  onClick={() => setDeleteMode("permanent")}
                  role="button"
                  tabIndex={0}
                >
                  <div className="delete-option-header">
                    <div className="delete-option-icon danger">
                      <Trash2 size={18} />
                    </div>
                    <div className="delete-option-title-row">
                      <div className="delete-option-title">Xóa vĩnh viễn khỏi Database</div>
                      <span className="delete-option-badge danger">Không thể hoàn tác</span>
                    </div>
                    <input
                      type="radio"
                      name="deleteDocMode"
                      checked={deleteMode === "permanent"}
                      onChange={() => setDeleteMode("permanent")}
                      className="delete-option-radio"
                    />
                  </div>
                  <p className="delete-option-desc">
                    Xóa <strong>hoàn toàn tập tin và bản ghi khỏi cơ sở dữ liệu</strong>. Dung lượng lưu trữ sẽ được giải phóng ngay lập tức.
                  </p>
                </div>
              </div>

              <div className="modal-dialog-footer">
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setDeleteDialog(null)}
                  disabled={busy}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  className={`button ${deleteMode === "permanent" ? "danger" : "secondary"}`}
                  onClick={() => void executeDelete(deleteMode)}
                  disabled={busy}
                >
                  {deleteMode === "permanent" ? <Trash2 size={15} /> : <Archive size={15} />}
                  <span>{busy ? "Đang xử lý…" : deleteMode === "permanent" ? "Xác nhận xóa vĩnh viễn" : "Xác nhận chuyển vào lưu trữ"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Live Preview Modal */}
      {previewDoc && (
        <DocumentViewerModal
          doc={previewDoc}
          onClose={() => setPreviewDoc(null)}
        />
      )}
    </>
  );
}

function ManageUsers({ self }: { self: string }) {
  const [revision, setRevision] = useState(0),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(1),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [role, setRole] = useState("contributor"),
    [issue, setIssue] = useState<unknown>(null),
    [busy, setBusy] = useState(false);
  const { data, error, loading } = useLoad<{ items: User[] }>(
    `/admin/users?page=${page}&q=${encodeURIComponent(query)}`,
    revision,
  );
  async function update(user: User, patch: Partial<User>) {
    try {
      await api(`/admin/users/${user.id}`, "PUT", {
        role: user.role,
        status: user.status,
        ...patch,
      });
      setRevision((n) => n + 1);
      setIssue(null);
    } catch (e) {
      setIssue(e);
    }
  }
  return (
    <>
      <h2>Quản lý tài khoản</h2>
      <label className="field">
        Tìm tài khoản theo email
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          placeholder="Nhập email cần tìm…"
        />
      </label>
      <ErrorMessage error={error || issue} />
      <form
        className="panel"
        onSubmit={async (e) => {
          e.preventDefault();
          setIssue(null);
          setBusy(true);
          try {
            await api("/admin/users", "POST", { email, password, role });
            setEmail("");
            setPassword("");
            setRevision((n) => n + 1);
          } catch (e) {
            setIssue(e);
          } finally {
            setBusy(false);
          }
        }}
      >
        <h3>Cấp tài khoản</h3>
        <div className="form-grid">
          <label className="field">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="field">
            Mật khẩu ban đầu (ít nhất 12 ký tự)
            <input
              type="password"
              minLength={12}
              maxLength={200}
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label className="field">
            Vai trò
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="contributor">Người đóng góp</option>
              <option value="admin">Quản trị viên</option>
            </select>
          </label>
        </div>
        <button className="button small" disabled={busy}>
          <Plus size={16} />
          Tạo tài khoản
        </button>
      </form>
      {loading ? (
        <Loading />
      ) : (
        data && (
          <>
            <div className="table-wrap panel">
              <table>
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Vai trò</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((u) => (
                    <tr key={u.id}>
                      <td>
                        {u.email}
                        {u.id === self ? " (bạn)" : ""}
                      </td>
                      <td>
                        <select
                          aria-label={`Vai trò ${u.email}`}
                          disabled={u.id === self}
                          value={u.role}
                          onChange={(e) =>
                            void update(u, { role: e.target.value })
                          }
                        >
                          <option value="admin">Admin</option>
                          <option value="contributor">Người đóng góp</option>
                        </select>
                      </td>
                      <td>
                        <Badge status={u.status || "active"} />
                      </td>
                      <td>
                        <button
                          className="button secondary small"
                          disabled={u.id === self}
                          onClick={() =>
                            void update(u, {
                              status:
                                u.status === "active" ? "blocked" : "active",
                            })
                          }
                        >
                          {u.status === "active" ? "Khóa" : "Mở khóa"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              hasNext={data.items.length === 12}
              onChange={setPage}
            />
          </>
        )
      )}
    </>
  );
}
function Logs() {
  const [page, setPage] = useState(1);
  const { data, error, loading } = useLoad<{
    items: {
      id: string;
      email: string;
      action: string;
      target_type: string;
      summary: string;
      created_at: string;
    }[];
  }>(`/admin/audit-logs?page=${page}`);
  return (
    <>
      <h2>Nhật ký thao tác</h2>
      <ErrorMessage error={error} />
      {loading ? (
        <Loading />
      ) : data?.items.length ? (
        <>
          <div className="table-wrap panel">
            <table>
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Người thực hiện</th>
                  <th>Thao tác</th>
                  <th>Nội dung</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((log) => (
                  <tr key={log.id}>
                    <td>{date(log.created_at)}</td>
                    <td>{log.email}</td>
                    <td>
                      <code>
                        {log.action} / {log.target_type}
                      </code>
                    </td>
                    <td>{log.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
function Reports() {
  const [page, setPage] = useState(1),
    [revision, setRevision] = useState(0),
    [issue, setIssue] = useState<unknown>(null);
  const { data, error, loading } = useLoad<{
    items: {
      id: string;
      title: string;
      message: string;
      status: string;
      created_at: string;
    }[];
  }>(`/admin/reports?page=${page}`, revision);
  return (
    <>
      <h2>Báo lỗi từ người học</h2>
      <ErrorMessage error={error || issue} />
      {loading ? (
        <Loading />
      ) : data?.items.length ? (
        <>
          <div className="admin-list">
            {data.items.map((r) => (
              <article className="panel" key={r.id}>
                <div className="row between">
                  <h3>{r.title}</h3>
                  <Badge status={r.status} />
                </div>
                <p>{r.message}</p>
                <p className="small muted">{date(r.created_at)}</p>
                {r.status === "open" && (
                  <button
                    className="button small secondary"
                    onClick={async () => {
                      try {
                        await api(`/admin/reports/${r.id}`, "PUT", {});
                        setRevision((n) => n + 1);
                      } catch (e) {
                        setIssue(e);
                      }
                    }}
                  >
                    Đánh dấu đã xử lý
                  </button>
                )}
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
        <Empty text="Chưa có báo lỗi nào." />
      )}
    </>
  );
}
function Config() {
  const [revision, setRevision] = useState(0),
    [issue, setIssue] = useState<unknown>(null),
    [busy, setBusy] = useState(false);
  const { data, error, loading } = useLoad<{
    mfa_enabled: boolean;
    max_image_mb: number;
    max_questions: number;
    submission_policy: string;
    storage: string;
    contributions_enabled: boolean;
  }>("/admin/config", revision);
  return (
    <>
      <h2>Cấu hình cốt lõi</h2>
      <ErrorMessage error={error || issue} />
      {loading ? (
        <Loading />
      ) : (
        data && (
          <div className="panel config-list">
            <div>
              <strong>Tiếp nhận đóng góp</strong>
              <label className="row">
                <input
                  type="checkbox"
                  disabled={busy}
                  checked={data.contributions_enabled}
                  onChange={async (e) => {
                    setBusy(true);
                    setIssue(null);
                    try {
                      await api("/admin/config", "PUT", {
                        contributions_enabled: e.target.checked,
                      });
                      setRevision((n) => n + 1);
                    } catch (e) {
                      setIssue(e);
                    } finally {
                      setBusy(false);
                    }
                  }}
                />
                {data.contributions_enabled ? "Đang mở" : "Tạm đóng"}
              </label>
            </div>
            <div>
              <strong>Xác thực hai bước</strong>
              <span>
                {data.mfa_enabled
                  ? "Đã bật TOTP"
                  : "Chưa bật (chỉ dùng phát triển)"}
              </span>
            </div>
            <div>
              <strong>Kích thước ảnh tối đa</strong>
              <span>{data.max_image_mb} MB · PNG / JPEG / WebP</span>
            </div>
            <div>
              <strong>Số câu mỗi đề tối đa</strong>
              <span>{data.max_questions}</span>
            </div>
            <div>
              <strong>Chính sách đóng góp</strong>
              <span>{data.submission_policy}</span>
            </div>
            <div>
              <strong>Lưu trữ bền vững</strong>
              <span>{data.storage}</span>
            </div>
            <Notice>
              Thiết lập bảo mật được cấu hình qua biến môi trường trên Render.
              Môn học và chủ đề được quản lý ngay trong biểu mẫu đề thi. Không
              hiển thị mật khẩu hay khóa bí mật tại đây.
            </Notice>
          </div>
        )
      )}
    </>
  );
}

function BankPicker({
  exam,
  onChange,
}: {
  exam: ExamCard;
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bank-picker">
      <button className="text-button" onClick={() => setOpen((v) => !v)}>
        <Plus size={14} />{" "}
        {open ? "Đóng ngân hàng câu hỏi" : "Thêm câu có sẵn từ ngân hàng"}
      </button>
      {open && (
        <BankList
          examId={exam.id}
          onAdded={() => {
            setOpen(false);
            onChange();
          }}
        />
      )}
    </div>
  );
}
function BankList({
  examId,
  onAdded,
}: {
  examId: string;
  onAdded: () => void;
}) {
  const [page, setPage] = useState(1),
    [issue, setIssue] = useState<unknown>(null),
    [busy, setBusy] = useState(false);
  const { data, error, loading } = useLoad<{
    items: { id: string; content: Question; status: string }[];
  }>(`/admin/questions?page=${page}&status=published`);
  return (
    <div className="bank-list">
      <p>
        Chọn câu đã xuất bản để liên kết. Những lần sửa câu sau này sẽ cập nhật
        tất cả đề liên kết.
      </p>
      <ErrorMessage error={error || issue} />
      {loading ? (
        <Loading />
      ) : (
        data && (
          <>
            {data.items
              .filter((q) => q.status === "published")
              .map((q) => (
                <div className="bank-choice" key={q.id}>
                  <Blocks blocks={q.content.prompt} />
                  <button
                    className="button secondary small"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      setIssue(null);
                      try {
                        await api(`/admin/exams/${examId}/questions`, "POST", {
                          question_id: q.id,
                        });
                        onAdded();
                      } catch (e) {
                        setIssue(e);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Thêm vào đề
                  </button>
                </div>
              ))}
            <Pagination
              page={page}
              hasNext={data.items.length === 12}
              onChange={setPage}
            />
          </>
        )
      )}
    </div>
  );
}
