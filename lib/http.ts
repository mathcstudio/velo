import "server-only";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Route Handler 공통 래퍼: HttpError는 그대로, 나머지는 500으로 응답 */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
      console.error(e);
      return Response.json({ error: "서버 오류가 났어요. 잠시 후 다시 시도해 주세요." }, { status: 500 });
    }
  };
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, "요청 형식이 올바르지 않아요.");
  }
}

export function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/** Supabase 결과에서 오류가 있으면 던지고 data를 돌려줌 (목록·single·insert용) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function must<T = any>(res: { data: unknown; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  if (res.data === null) throw new Error("데이터가 없습니다.");
  return res.data as T;
}

/** maybeSingle용: 없으면 null */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function maybe<T = any>(res: { data: unknown; error: { message: string } | null }): T | null {
  if (res.error) throw new Error(res.error.message);
  return res.data as T | null;
}

/** update/delete용: 오류만 확인 */
export function ok(res: { error: { message: string } | null }): void {
  if (res.error) throw new Error(res.error.message);
}
