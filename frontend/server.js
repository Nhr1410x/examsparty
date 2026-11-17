import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import path from "node:path";
import { fileURLToPath } from "node:url";
const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
let target = process.env.API_PROXY_TARGET || "http://localhost:3001";
if (!/^https?:\/\//.test(target)) target = `http://${target}`;
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob:; font-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  );
  next();
});
app.get("/health", (req, res) => res.json({ status: "ok" }));
app.use(
  createProxyMiddleware({
    pathFilter: "/api",
    target,
    changeOrigin: true,
    on: {
      proxyReq: (proxyReq, req) => {
        proxyReq.setHeader(
          "X-Forwarded-For",
          req.ip || req.socket.remoteAddress || "",
        );
      },
      error: (err, req, res) => {
        res.writeHead(502, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({ error: "API chưa sẵn sàng. Vui lòng thử lại sau." }),
        );
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
