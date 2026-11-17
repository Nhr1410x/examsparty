import React, { lazy, Suspense, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Link,
  NavLink,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import {
  BookOpen,
  LayoutDashboard,
  LibraryBig,
  FileQuestion,
  GraduationCap,
  HeartHandshake,
  ShieldCheck,
  Sun,
  Moon,
  Menu,
  X,
  ChevronRight,
  PanelLeftClose,
  PanelLeft,
  Smartphone,
} from "lucide-react";
import { api } from "./api";
import { User } from "./types";
import { Home, Library, Detail, Questions, RecentPage, Privacy } from "./pages";
import { Player, Results } from "./player";
const Contribution = lazy(() =>
  import("./contribution").then((m) => ({ default: m.Contribution })),
);
const Admin = lazy(() => import("./admin").then((m) => ({ default: m.Admin })));
import "./style.css";

const nav = [
  { to: "/", label: "Tổng quan", icon: LayoutDashboard },
  { to: "/exams", label: "Khám phá kho đề", icon: LibraryBig },
  { to: "/questions", label: "Ngân hàng câu hỏi", icon: FileQuestion },
  { to: "/recent", label: "Không gian học tập", icon: GraduationCap },
];
function Layout() {
  const [theme, setTheme] = useState(
      document.documentElement.dataset.theme || "light",
    ),
    [open, setOpen] = useState(false),
    [user, setUser] = useState<User | null>(null),
    [demo, setDemo] = useState(false);
  const location = useLocation();
  const isAttempt = location.pathname.startsWith("/attempts/");
  const isAdmin = location.pathname.startsWith("/admin");
  const [collapsed, setCollapsed] = useState(() => isAttempt || isAdmin);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, []);

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice?.outcome === "accepted") {
        setDeferredPrompt(null);
      }
    } else {
      alert(
        "📱 CÁCH TẠO APP SHORTCUT TRÊN ĐIỆN THOẠI:\n\n" +
          "• Trên iPhone (Safari):\n" +
          "  1. Nhấn nút Chia sẻ (biểu tượng mũi tên hướng lên ở thanh dưới).\n" +
          "  2. Chọn 'Thêm vào MH chính' (Add to Home Screen).\n\n" +
          "• Trên Android (Chrome / Cốc Cốc):\n" +
          "  1. Nhấn nút 3 chấm ⋮ ở góc trên bên phải.\n" +
          "  2. Chọn 'Cài đặt ứng dụng' hoặc 'Thêm vào màn hình chính'.\n\n" +
          "Examsparty sẽ xuất hiện như ứng dụng độc lập trên màn hình chính của bạn!",
      );
    }
  };

  useEffect(() => {
    setOpen(false);
    window.scrollTo(0, 0);
    if (location.pathname.startsWith("/attempts/") || location.pathname.startsWith("/admin")) {
      setCollapsed(true);
    } else {
      setCollapsed(false);
    }
  }, [location.pathname]);
  useEffect(() => {
    if (isAdmin) {
      document.body.classList.add("admin-body-locked");
      document.documentElement.classList.add("admin-body-locked");
    } else {
      document.body.classList.remove("admin-body-locked");
      document.documentElement.classList.remove("admin-body-locked");
    }
    return () => {
      document.body.classList.remove("admin-body-locked");
      document.documentElement.classList.remove("admin-body-locked");
    };
  }, [isAdmin]);
  useEffect(() => {
    api<{ user: User | null; demo: boolean }>("/session")
      .then((r) => {
        setUser(r.user);
        setDemo(r.demo);
      })
      .catch(() => {});
  }, [location.pathname]);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const change = () => {
      if (!localStorage.getItem("ep-theme")) {
        const t = media.matches ? "dark" : "light";
        setTheme(t);
        document.documentElement.dataset.theme = t;
      }
    };
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  function toggleTheme() {
    const t = theme === "light" ? "dark" : "light";
    setTheme(t);
    document.documentElement.dataset.theme = t;
    localStorage.setItem("ep-theme", t);
  }
  useEffect(() => {
    let rafId: number | null = null;
    const handlePointerMove = (e: PointerEvent) => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        document.documentElement.style.setProperty("--mouse-x", `${e.clientX}px`);
        document.documentElement.style.setProperty("--mouse-y", `${e.clientY}px`);
        rafId = null;
      });
    };
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);
  const title = location.pathname.startsWith("/admin")
    ? "Không gian quản trị"
    : location.pathname.startsWith("/attempts")
      ? "Không gian làm bài"
      : location.pathname.startsWith("/contribute")
        ? "Đóng góp cộng đồng"
        : location.pathname.startsWith("/exams")
          ? "Khám phá kho đề"
          : nav.find((n) => n.to === location.pathname)?.label ||
            "Không gian học tập";
  return (
    <>
      <div className="tech-grid-bg" aria-hidden="true" />
      <div className="tech-spotlight" aria-hidden="true" />
      <a className="skip-link" href="#main">
        Đến nội dung chính
      </a>
      {!isAdmin && open && (
        <button
          className="nav-backdrop"
          aria-label="Đóng điều hướng"
          onClick={() => setOpen(false)}
        />
      )}
      {!isAdmin && (
        <aside className={`sidebar ${open ? "open" : ""} ${collapsed ? "collapsed" : ""}`}>
          <div className="sidebar-top-row">
            <Link className="brand" to="/">
              <span className="brand-mark">
                <BookOpen size={24} />
              </span>
              <span>
                exams<span className="brand-light">party</span>
              </span>
            </Link>
            <button
              className="icon-button sidebar-collapse-trigger button-step-press"
              aria-label="Thu gọn thanh điều hướng"
              title="Thu gọn menu"
              onClick={() => setCollapsed(true)}
            >
              <PanelLeftClose size={18} />
            </button>
          </div>
          <div className="sidebar-label">KHÔNG GIAN HỌC TẬP</div>
          <nav aria-label="Điều hướng chính">
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.to === "/"}>
                <n.icon size={20} />
                {n.label}
                <ChevronRight className="nav-arrow" size={16} />
              </NavLink>
            ))}
            <div className="nav-divider" />
            <button
              type="button"
              className="sidebar-install-link button-step-press"
              onClick={handleInstallApp}
              title="Cài đặt App Shortcut lên màn hình chính"
            >
              <Smartphone size={19} />
              <span>Cài App Shortcut</span>
            </button>
            <NavLink to="/contribute">
              <HeartHandshake size={20} />
              Đóng góp nội dung
            </NavLink>
            <NavLink to="/admin">
              <ShieldCheck size={20} />
              Quản trị hệ thống
            </NavLink>
          </nav>
          <div className="sidebar-bottom">
            <div className="guest-info">
              <span className="avatar">{user ? "A" : "K"}</span>
              <div>
                <strong>{user ? "Quản trị viên" : "Chào bạn học"}</strong>
                <small>
                  {user ? user.email : "Học tập tự do"}
                </small>
              </div>
              <span className="online-dot" />
            </div>
          </div>
        </aside>
      )}
      <div
        className={`app-content ${collapsed || isAdmin ? "expanded" : ""} ${isAttempt ? "exam-mode" : ""} ${isAdmin ? "admin-mode" : ""}`}
      >
        {!isAdmin && (
          <header className="topbar">
            <div className="row">
              <button
                className="icon-button mobile-menu"
                aria-label={open ? "Đóng menu" : "Mở menu"}
                onClick={() => setOpen(!open)}
              >
                {open ? <X size={21} /> : <Menu size={21} />}
              </button>
              <button
                className="icon-button sidebar-toggle-btn button-step-press"
                aria-label={collapsed ? "Mở rộng menu" : "Thu gọn menu"}
                title={collapsed ? "Mở rộng menu" : "Thu gọn menu"}
                onClick={() => setCollapsed(!collapsed)}
              >
                {collapsed ? <PanelLeft size={19} /> : <PanelLeftClose size={19} />}
              </button>
              <span className="breadcrumb">
                <strong>{title}</strong>
              </span>
              {isAttempt && (
                <span className="exam-mode-tag">
                  <span className="online-dot" /> Chế độ tập trung
                </span>
              )}
            </div>
            <div className="row" style={{ gap: 8, alignItems: "center" }}>
              <button
                type="button"
                className="app-install-btn button-step-press"
                onClick={handleInstallApp}
                title="Tạo app shortcut / Cài đặt ứng dụng"
                aria-label="Cài đặt shortcut ứng dụng"
              >
                <Smartphone size={15} />
                <span className="app-install-text">Tạo App</span>
              </button>
              <button
                className="icon-button theme-toggle"
                aria-label={`Chuyển sang giao diện ${theme === "light" ? "tối" : "sáng"}`}
                onClick={toggleTheme}
              >
                {theme === "light" ? <Moon size={19} /> : <Sun size={19} />}
              </button>
              <Link className="header-contribute" to="/contribute">
                Đóng góp đề
              </Link>
            </div>
          </header>
        )}
        {demo && (
          <div className="demo-banner">
            Bản xem thử trên máy • Dữ liệu trong bộ nhớ sẽ mất khi khởi động
            lại.
          </div>
        )}
        <main id="main">
          <Suspense
            fallback={<div className="loading">Đang tải nội dung…</div>}
          >
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/exams" element={<Library />} />
              <Route path="/exams/:id" element={<Detail />} />
              <Route path="/questions" element={<Questions />} />
              <Route path="/recent" element={<RecentPage />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/attempts/:id" element={<Player />} />
              <Route path="/attempts/:id/results" element={<Results />} />
              <Route path="/contribute" element={<Contribution />} />
              <Route path="/admin/*" element={<Admin />} />
              <Route
                path="*"
                element={
                  <div className="empty">
                    <h1>Trang này chưa có trong vở.</h1>
                    <Link className="button" to="/">
                      Về trang chủ
                    </Link>
                  </div>
                }
              />
            </Routes>
          </Suspense>
        </main>
        {!isAdmin && (
          <footer>
            <span>© {new Date().getFullYear()} Examsparty</span>
            <Link to="/privacy">Thông tin riêng tư</Link>
            <Link to="/contribute">
              Cùng đóng góp <HeartHandshake size={14} />
            </Link>
          </footer>
        )}
      </div>
      {!isAdmin && !isAttempt && (
        <nav className="mobile-bottom-nav" aria-label="Điều hướng nhanh điện thoại">
          <NavLink to="/" end className={({ isActive }) => `bottom-nav-item ${isActive ? "active" : ""}`}>
            <LayoutDashboard size={20} />
            <span>Trang chủ</span>
          </NavLink>
          <NavLink to="/exams" className={({ isActive }) => `bottom-nav-item ${isActive ? "active" : ""}`}>
            <LibraryBig size={20} />
            <span>Kho đề</span>
          </NavLink>
          <NavLink to="/recent" className={({ isActive }) => `bottom-nav-item ${isActive ? "active" : ""}`}>
            <GraduationCap size={20} />
            <span>Học tập</span>
          </NavLink>
          <NavLink to="/questions" className={({ isActive }) => `bottom-nav-item ${isActive ? "active" : ""}`}>
            <FileQuestion size={20} />
            <span>Câu hỏi</span>
          </NavLink>
          <NavLink to="/contribute" className={({ isActive }) => `bottom-nav-item ${isActive ? "active" : ""}`}>
            <HeartHandshake size={20} />
            <span>Đóng góp</span>
          </NavLink>
        </nav>
      )}
    </>
  );
}
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught error:", error, info);
  }
  render() {
    const { error } = this.state;
    return error ? (
      <div className="fatal" style={{ padding: "48px 24px", maxWidth: 600, margin: "60px auto", textAlign: "center" }}>
        <h1>Trang gặp sự cố hiển thị.</h1>
        <p>Bài làm đã đồng bộ vẫn được giữ trên máy chủ.</p>
        {error.message && (
          <p style={{ color: "var(--danger, #ef4444)", fontFamily: "monospace", fontSize: 13, background: "rgba(239, 68, 68, 0.08)", padding: "10px 14px", borderRadius: 8, margin: "16px 0", textAlign: "left", wordBreak: "break-word" }}>
            {error.message}
          </p>
        )}
        <div className="row wrap center" style={{ gap: 12, justifyContent: "center", marginTop: 20 }}>
          <button className="button" onClick={() => window.location.reload()}>
            Tải lại trang
          </button>
          <a className="button secondary" href="/">
            Về trang chủ
          </a>
        </div>
      </div>
    ) : (
      this.props.children
    );
  }
}
const root = createRoot(document.getElementById("root")!);
root.render(
  <div className="loading" role="status">
    Đang kết nối không gian học tập…
  </div>,
);
api("/session")
  .catch(() => {})
  .finally(() =>
    root.render(
      <ErrorBoundary>
        <BrowserRouter>
          <Layout />
        </BrowserRouter>
      </ErrorBoundary>,
    ),
  );
