import { useEffect, useState } from "react";
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public issues: { path: string; message: string }[] = [],
    public data?: unknown,
  ) {
    super(message);
  }
}
export async function api<T>(
  url: string,
  method = "GET",
  data?: unknown,
): Promise<T> {
  const form = data instanceof FormData;
  const response = await fetch(`/api${url}`, {
    method,
    credentials: "same-origin",
    signal: AbortSignal.timeout(20000),
    headers: data && !form ? { "Content-Type": "application/json" } : {},
    body: data ? (form ? data : JSON.stringify(data)) : undefined,
  }).catch(() => {
    throw new Error(
      "Không thể kết nối máy chủ. Kiểm tra mạng và thử lại; bản nháp bài làm vẫn được giữ trên trình duyệt.",
    );
  });
  const body = await response
    .json()
    .catch(() => ({ error: "Không thể đọc phản hồi từ máy chủ." }));
  if (!response.ok)
    throw new ApiError(
      body.error || "Yêu cầu thất bại.",
      response.status,
      body.issues || [],
      body,
    );
  return body;
}
export function useLoad<T>(path: string, revision = 0) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api<T>(path)
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [path, revision]);
  return { data, error, loading, setData };
}
export const date = (value: string) =>
  new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
export function download(name: string, value: unknown) {
  const a = document.createElement("a"),
    url = URL.createObjectURL(
      new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
    );
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
