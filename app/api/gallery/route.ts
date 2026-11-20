import { requireStudent } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { handle, must } from "@/lib/http";

type Row = {
  id: string; slug: string; name: string; emoji: string; description: string; updated_at: string;
  projects: { student_id: string; students: { name: string; class_id: string } };
};

/** 우리 반 갤러리: 공개 중인 앱 + 좋아요/피드백 수 */
export const GET = handle(async () => {
  const s = await requireStudent();
  const rows = must(
    await db()
      .from("deployments")
      .select("id, slug, name, emoji, description, updated_at, projects!inner(student_id, students!inner(name, class_id))")
      .eq("projects.students.class_id", s.class_id)
      .not("version_id", "is", null)
      .eq("hidden", false)
      .order("updated_at", { ascending: false }),
  ) as unknown as Row[];

  const ids = rows.map((r) => r.id);
  const likes: { deployment_id: string; student_id: string }[] = ids.length ? must(await db().from("likes").select("deployment_id, student_id").in("deployment_id", ids)) : [];
  const fb: { deployment_id: string }[] = ids.length ? must(await db().from("feedback").select("deployment_id").in("deployment_id", ids)) : [];

  const apps = rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    emoji: r.emoji,
    description: r.description,
    updatedAt: r.updated_at,
    author: r.projects.students.name,
    mine: r.projects.student_id === s.id,
    likes: likes.filter((l) => l.deployment_id === r.id).length,
    liked: likes.some((l) => l.deployment_id === r.id && l.student_id === s.id),
    feedbackCount: fb.filter((f) => f.deployment_id === r.id).length,
  }));
  return Response.json({ apps, className: s.classes.name });
});
