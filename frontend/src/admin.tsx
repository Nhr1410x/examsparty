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
} from "lucide-react";
import { api, date, useLoad } from "./api";
import {
  Badge,
  Blocks,
  Empty,
  ErrorMessage,
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
  Question,
  Submission,
  template,
  typeLabels,
  User,
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
  async function deleteSelected() {
    if (
      busy ||
      !selected.length ||
      !window.confirm(
        `Xóa ${selected.length} đề đã chọn khỏi kho đề? Bài làm cũ và câu hỏi trong ngân hàng vẫn được giữ.`,
      )
    )
      return;
    setIssue(null);
    setMessage("");
    setBusy(true);
    try {
      const result = await api<{ deleted: number }>("/admin/exams", "DELETE", {
        ids: selected,
      });
      setSelected([]);
      setPage(1);
      setRevision((n) => n + 1);
      setMessage(`Đã xóa ${result.deleted} đề. Bài làm cũ vẫn được giữ.`);
    } catch (e) {
      setIssue(e);
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    setIssue(null);
    setMessage("");
    setBusy(true);
    try {
      await api(
        `/admin/exams${editing && editing !== "new" ? `/${editing}` : ""}`,
        editing === "new" ? "POST" : "PUT",
        { content: JSON.parse(raw), status },
      );
      setEditing(null);
      setRevision((n) => n + 1);
      setMessage("Đã lưu đề và ghi nhật ký.");
    } catch (e) {
      setIssue(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="section-heading">
        <h2>Quản lý đề thi</h2>
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
                  <span>Chọn nhiều</span>
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
                        data.items.length > 0 &&
                        data.items.every((exam) => selected.includes(exam.id))
                      }
                      onChange={(e) =>
                        setSelected(
                          e.target.checked
                            ? data.items.map((exam) => exam.id)
                            : [],
                        )
                      }
                    />
                    <span>Chọn tất cả trong trang ({data.items.length})</span>
                  </label>
                  {selected.length > 0 && (
                    <button
                      type="button"
                      className="admin-select-dropdown-clear"
                      onClick={() => {
                        setSelected([]);
                        setSelectMenuOpen(false);
                      }}
                    >
                      Bỏ chọn tất cả ({selected.length})
                    </button>
                  )}
                </div>
              </div>
              {selected.length > 0 && (
                <div className="admin-selection-badge">
                  <span>
                    Đã chọn <strong>{selected.length}</strong> / {data.items.length} đề
                  </span>
                  <button
                    type="button"
                    className="text-link-subtle"
                    onClick={() => setSelected([])}
                  >
                    Bỏ chọn
                  </button>
                </div>
              )}
            </div>

            <div className="admin-batch-right">
              <button
                className="button danger small admin-delete-btn"
                disabled={busy || !selected.length}
                onClick={() => void deleteSelected()}
              >
                <Trash2 size={14} />
                <span>
                  {busy
                    ? "Đang xóa…"
                    : selected.length
                      ? `Xóa đã chọn (${selected.length})`
                      : "Xóa đã chọn"}
                </span>
              </button>
            </div>
          </div>
          <div className="admin-list">
            {data.items.map((exam) => (
              <div
                className={`panel review-item ${selected.includes(exam.id) ? "selected" : ""}`}
                key={exam.id}
              >
                <input
                  type="checkbox"
                  aria-label={`Chọn đề ${exam.title}`}
                  checked={selected.includes(exam.id)}
                  onChange={(e) =>
                    setSelected((ids) =>
                      e.target.checked
                        ? [...ids, exam.id]
                        : ids.filter((id) => id !== exam.id),
                    )
                  }
                />
                <div>
                  <strong>{exam.title}</strong>
                  <p>
                    {exam.subject} · v{exam.version} ·{" "}
                    {exam.content.questions.length} câu
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
    [kind, setKind] = useState(""),
    [filterStatus, setFilterStatus] = useState(""),
    [revision, setRevision] = useState(0),
    [editing, setEditing] = useState<string | null>(null),
    [content, setContent] = useState<Question>(emptyQuestion()),
    [status, setStatus] = useState("draft"),
    [issue, setIssue] = useState<unknown>(null),
    [busy, setBusy] = useState(false);
  const { data, error, loading } = useLoad<{
    items: { id: string; content: Question; status: string; version: number }[];
  }>(
    `/admin/questions?page=${page}&q=${encodeURIComponent(query)}${kind ? `&type=${kind}` : ""}${filterStatus ? `&status=${filterStatus}` : ""}`,
    revision,
  );
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
          }}
        >
          <Plus size={16} />
          Tạo câu hỏi
        </button>
      </div>
      <Notice>
        Xuất bản bản sửa câu hỏi sẽ cập nhật các đề đang liên kết; bài làm đã
        bắt đầu giữ nguyên nội dung cũ. Lưu trữ câu hỏi sẽ ẩn khỏi ngân hàng
        công khai và giữ lại nội dung trong đề đã dùng.
      </Notice>
      <div className="panel form-grid">
        <label className="field">
          Tìm nội dung
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
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
          Trạng thái lọc
          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setPage(1);
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
      {editing ? (
        <>
          <label className="field">
            Trạng thái
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="draft">Bản nháp</option>
              <option value="published">Đã xuất bản</option>
              <option value="archived">Lưu trữ</option>
            </select>
          </label>
          <QuestionEditor
            q={content}
            onChange={setContent}
            onRemove={() => setEditing(null)}
          />
          <div className="row">
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
        </>
      ) : loading ? (
        <Loading />
      ) : data?.items.length ? (
        <>
          <div className="admin-list">
            {data.items.map((q) => (
              <div className="panel" key={q.id}>
                <div className="row between">
                  <span className="small muted">
                    {q.content.type} · v{q.version}
                  </span>
                  <Badge status={q.status} />
                </div>
                <Blocks blocks={q.content.prompt} />
                <button
                  className="button secondary small"
                  onClick={() => {
                    setEditing(q.id);
                    setContent(q.content);
                    setStatus(q.status);
                  }}
                >
                  Chỉnh sửa
                </button>
              </div>
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
