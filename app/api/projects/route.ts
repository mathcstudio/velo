import { requireStudent } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { handle, must, readJson, str } from "@/lib/http";

/** 내 프로젝트 목록 */
export const GET = handle(async () => {
  const s = await requireStudent();
  const rows = must(
    await db()
      .from("projects")
      .select("id, title, current_version_id, updated_at, deployments(slug, emoji, version_id, pending_version_id, hidden)")
      .eq("student_id", s.id)
      .order("updated_at", { ascending: false }),
  );
  return Response.json({ projects: rows });
});

/** 새 프로젝트 만들기 */
export const POST = handle(async (req: Request) => {
  const s = await requireStudent();
  const body = await readJson(req);
  const title = str(body.title, 40) || "새 앱";
  const row = must(await db().from("projects").insert({ student_id: s.id, title }).select("id").single());
  return Response.json({ id: row.id });
});
