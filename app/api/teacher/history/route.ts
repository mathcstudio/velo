import { requireTeacher } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { handle, must } from "@/lib/http";

/** ?studentId= 학생의 프로젝트별 프롬프트 기록 (평가·세특 자료용) */
export const GET = handle(async (req: Request) => {
  await requireTeacher();
  const studentId = new URL(req.url).searchParams.get("studentId") ?? "";
  const projects = must(
    await db()
      .from("projects")
      .select("id, title, created_at, updated_at, versions(id, number, kind, prompt_text, summary, created_at)")
      .eq("student_id", studentId)
      .order("created_at"),
  );
  const blocked = must(
    await db()
      .from("usage_logs")
      .select("error, created_at")
      .eq("student_id", studentId)
      .eq("status", "blocked")
      .order("created_at", { ascending: false })
      .limit(20),
  );
  for (const p of projects) (p.versions as { number: number }[]).sort((a, b) => a.number - b.number);
  return Response.json({ projects, blocked });
});
