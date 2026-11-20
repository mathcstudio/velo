import "server-only";
import { db } from "./supabase";

/** 한국 시간 기준 오늘 0시 (ISO 문자열) */
export function kstDayStart(): string {
  const H9 = 9 * 3600e3;
  const start = Math.floor((Date.now() + H9) / 864e5) * 864e5 - H9;
  return new Date(start).toISOString();
}

/** 기본: 성공했거나 진행 중인 호출만 셈 (서버 혼잡으로 실패한 호출은 한도에서 빼 줌) */
export async function countUsage(studentId: string, sinceIso: string, statuses = ["running", "ok"]) {
  const { count } = await db()
    .from("usage_logs")
    .select("id", { count: "exact", head: true })
    .eq("student_id", studentId)
    .in("status", statuses)
    .gte("created_at", sinceIso);
  return count ?? 0;
}
