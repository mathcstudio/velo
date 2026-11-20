import { requireStudent } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { handle, HttpError, maybe, must, readJson, str } from "@/lib/http";
import { isFlagged } from "@/lib/ai";

type Ctx = { params: Promise<{ id: string }> };

async function requireSameClass(classId: string, deploymentId: string) {
  const d = maybe(
    await db()
      .from("deployments")
      .select("id, projects!inner(students!inner(class_id))")
      .eq("id", deploymentId)
      .maybeSingle(),
  ) as { projects: { students: { class_id: string } } } | null;
  if (!d || d.projects.students.class_id !== classId) throw new HttpError(404, "앱을 찾을 수 없어요.");
}

/** 피드백 목록 */
export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const s = await requireStudent();
  const { id } = await ctx.params;
  await requireSameClass(s.class_id, id);
  const rows = must(
    await db()
      .from("feedback")
      .select("id, message, created_at, students(name)")
      .eq("deployment_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
  ) as unknown as { id: string; message: string; created_at: string; students: { name: string } }[];
  return Response.json({
    feedback: rows.map((r) => ({ id: r.id, message: r.message, createdAt: r.created_at, author: r.students?.name ?? "" })),
  });
});

/** { like: true|false } 좋아요 / { message } 피드백 남기기 */
export const POST = handle(async (req: Request, ctx: Ctx) => {
  const s = await requireStudent();
  const { id } = await ctx.params;
  await requireSameClass(s.class_id, id);
  const body = await readJson(req);

  if (typeof body.like === "boolean") {
    if (body.like) await db().from("likes").upsert({ deployment_id: id, student_id: s.id });
    else await db().from("likes").delete().eq("deployment_id", id).eq("student_id", s.id);
    return Response.json({ ok: true });
  }

  const message = str(body.message, 200);
  if (message.length < 2) throw new HttpError(400, "피드백을 써 주세요.");
  if (await isFlagged(message)) throw new HttpError(400, "친구에게 상처가 될 수 있는 표현이 있어요. 다르게 써 볼까요?");
  must(await db().from("feedback").insert({ deployment_id: id, student_id: s.id, message }));
  return Response.json({ ok: true });
});
