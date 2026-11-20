"use client";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** JSON API 호출 도우미. 로그인이 풀렸으면(401) 첫 화면으로 보냄 */
export async function api<T = Record<string, unknown>>(
  url: string,
  opts: { method?: string; json?: unknown; on401?: "redirect" | "throw" } = {},
): Promise<T> {
  const res = await fetch(url, {
    method: opts.method ?? (opts.json !== undefined ? "POST" : "GET"),
    headers: opts.json !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: opts.json !== undefined ? JSON.stringify(opts.json) : undefined,
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && (opts.on401 ?? "redirect") === "redirect") {
      window.location.href = "/";
    }
    throw new ApiError(res.status, j.error || "문제가 생겼어요. 다시 시도해 주세요.");
  }
  return j as T;
}
