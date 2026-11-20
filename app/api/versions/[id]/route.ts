import { requireStudent } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { handle, HttpError, maybe, must } from "@/lib/http";

/** 특정 버전의 코드 (본인 프로젝트만) */
export const GET = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const s = await requireStudent();
  const { id } = await ctx.params;
  const v = maybe(
    await db().from("versions").select("id, number, html, projects!inner(student_id)").eq("id", id).maybeSingle(),
  ) as { id: string; number: number; html: string; projects: { student_id: string } } | null;
  if (!v || v.projects.student_id !== s.id) throw new HttpError(404, "버전을 찾을 수 없어요.");
  return Response.json({ id: v.id, number: v.number, html: v.html });
});
