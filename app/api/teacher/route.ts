import { requireTeacher } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { handle, must } from "@/lib/http";
import { getSettings } from "@/lib/settings";
import { kstDayStart } from "@/lib/usage";

/** 교사 대시보드 첫 화면 데이터 */
export const GET = handle(async () => {
  await requireTeacher();
  const [classes, students, deps, usage, settings] = await Promise.all([
    db().from("classes").select("*").order("created_at"),
    db().from("students").select("class_id"),
    db()
      .from("deployments")
      .select("id, slug, name, emoji, description, version_id, pending_version_id, hidden, updated_at, projects(title, students(name, classes(name)))")
      .order("updated_at", { ascending: false }),
    db().from("usage_logs").select("status, tokens_in, tokens_out, model").gte("created_at", kstDayStart()),
    getSettings(),
  ]);
  const studentRows = must<{ class_id: string }[]>(students);
  const usageRows = must<{ status: string; tokens_in: number; tokens_out: number; model: string | null }[]>(usage);
  return Response.json({
    classes: must<{ id: string }[]>(classes).map((c) => ({ ...c, studentCount: studentRows.filter((s) => s.class_id === c.id).length })),
    deployments: must(deps),
    usageToday: {
      calls: usageRows.filter((u) => u.status === "ok").length,
      errors: usageRows.filter((u) => u.status === "error").length,
      blocked: usageRows.filter((u) => u.status === "blocked").length,
      running: usageRows.filter((u) => u.status === "running").length,
      tokensIn: usageRows.reduce((a, u) => a + u.tokens_in, 0),
      tokensOut: usageRows.reduce((a, u) => a + u.tokens_out, 0),
      // 모델별 비교: 성공한 호출 수와 평균 토큰
      byModel: Object.values(
        usageRows
          .filter((u) => u.status === "ok")
          .reduce<Record<string, { model: string; calls: number; tokensIn: number; tokensOut: number }>>((acc, u) => {
            const m = u.model ?? "(기록 없음)";
            acc[m] ??= { model: m, calls: 0, tokensIn: 0, tokensOut: 0 };
            acc[m].calls++;
            acc[m].tokensIn += u.tokens_in;
            acc[m].tokensOut += u.tokens_out;
            return acc;
          }, {}),
      ),
    },
    settings,
    keys: { openai: Boolean(process.env.OPENAI_API_KEY), anthropic: Boolean(process.env.ANTHROPIC_API_KEY) },
  });
});
