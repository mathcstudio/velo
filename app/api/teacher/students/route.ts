import { requireTeacher } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { handle, must, readJson, str, ok } from "@/lib/http";
import { kstDayStart } from "@/lib/usage";

/** ?classId= 반 학생 목록 + 오늘 사용 횟수 */
export const GET = handle(async (req: Request) => {
  await requireTeacher();
  const classId = new URL(req.url).searchParams.get("classId") ?? "";
  const students = must<{ id: string; name: string; blocked: boolean; failed_attempts: number; pin_hash: string | null; projects: unknown[] }[]>(
    await db()
      .from("students")
      .select("id, name, blocked, failed_attempts, pin_hash, created_at, projects(id)")
      .eq("class_id", classId)
      .order("name"),
  );
  const ids = students.map((s) => s.id);
  const logs: { student_id: string; status: string }[] = ids.length
    ? must(await db().from("usage_logs").select("student_id, status").in("student_id", ids).gte("created_at", kstDayStart()))
    : [];
  return Response.json({
    students: students.map((s) => ({
      id: s.id,
      name: s.name,
      blocked: s.blocked,
      locked: s.failed_attempts >= 10,
      pinSet: Boolean(s.pin_hash),
      projectCount: (s.projects as unknown[]).length,
      callsToday: logs.filter((l) => l.student_id === s.id && l.status === "ok").length,
      blockedToday: logs.filter((l) => l.student_id === s.id && l.status === "blocked").length,
    })),
  });
});

/** { id, blocked? , resetPin? , delete? } */
export const PATCH = handle(async (req: Request) => {
  await requireTeacher();
  const body = await readJson(req);
  const id = str(body.id, 64);
  if (body.delete === true) {
    ok(await db().from("students").delete().eq("id", id));
    return Response.json({ ok: true });
  }
  const patch: Record<string, unknown> = {};
  if (typeof body.blocked === "boolean") patch.blocked = body.blocked;
  if (body.resetPin === true) {
    patch.pin_hash = null;
    patch.failed_attempts = 0;
  }
  ok(await db().from("students").update(patch).eq("id", id));
  return Response.json({ ok: true });
});
