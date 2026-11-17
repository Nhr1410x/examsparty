import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import path from "node:path";
import { fileURLToPath } from "node:url";
const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
let target = (process.env.API_PROXY_TARGET || "http://localhost:3001").trim();

// On Render Free Tier, internal private networking (e.g. "examsparty-api:10000") cannot receive traffic.
// If an internal Render host is detected, route via the public onrender.com domain.
if (process.env.RENDER && target.includes("examsparty-api") && !target.includes(".onrender.com")) {
  console.log(
    `[Examsparty Web] Overriding private target "${target}" with public "https://examsparty-api.onrender.com" for Render Free Tier compatibility.`,
  );
  target = "https://examsparty-api.onrender.com";
}

if (!/^https?:\/\//.test(target)) {
  target = target.includes(".onrender.com") ? `https://${target}` : `http://${target}`;
}

console.log(`[Examsparty Web] Initialized. Proxying /api to ${target}`);

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob:; font-src 'self'; connect-src 'self' https:; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  );
  next();
});
app.get("/health", (req, res) => res.json({ status: "ok" }));
app.use(
  createProxyMiddleware({
    pathFilter: "/api",
    target,
    changeOrigin: true,
    secure: false,
    timeout: 120000,
    proxyTimeout: 120000,
    on: {
      proxyReq: (proxyReq, req) => {
        proxyReq.setHeader(
          "X-Forwarded-For",
          req.ip || req.socket.remoteAddress || "",
        );
      },
      error: (err, req, res) => {
        console.error(
          `[Examsparty Proxy Error] ${req.method} ${req.url} -> ${target} failed:`,
          err.message,
        );
        if (!res.headersSent) {
          res.writeHead(502, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              error:
                "API chưa sẵn sàng. Máy chủ backend có thể đang khởi động từ chế độ ngủ (khoảng 30 giây), vui lòng thử lại sau giây lát.",
              target,
              code: err.code || "PROXY_ERROR",
            }),
          );
        }
      },
    },
  }),
);
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), "dist");
app.use(
  express.static(dist, {
    maxAge: "1h",
    setHeaders: (res, file) => {
      if (file.endsWith(".html") || file.endsWith("theme.js"))
        res.setHeader("Cache-Control", "no-cache");
    },
  }),
);
app.get("/{*path}", (req, res) => res.sendFile(path.join(dist, "index.html")));
app.listen(Number(process.env.PORT) || 5173, "0.0.0.0", () =>
  console.log("Examsparty frontend ready"),
);
