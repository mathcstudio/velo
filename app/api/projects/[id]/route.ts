import { requireOwnProject, requireStudent } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { handle, HttpError, maybe, must, readJson, str, ok } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

/** 프로젝트 + 버전 목록(코드 제외) + 현재 버전 코드 + 배포 정보 */
export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const s = await requireStudent();
  const { id } = await ctx.params;
  const project = await requireOwnProject(s.id, id);
  const versions = must(
    await db()
      .from("versions")
      .select("id, number, kind, prompt, prompt_text, summary, created_at")
      .eq("project_id", id)
      .order("number", { ascending: true }),
  );
  let currentHtml: string | null = null;
  if (project.current_version_id) {
    const v = maybe(await db().from("versions").select("html").eq("id", project.current_version_id).maybeSingle());
    currentHtml = v?.html ?? null;
  }
  const deployment = maybe(
    await db()
      .from("deployments")
      .select("slug, name, emoji, description, version_id, pending_version_id, hidden")
      .eq("project_id", id)
      .maybeSingle(),
  );
  return Response.json({ project, versions, currentHtml, deployment });
});

/**
 * 수정: { title } 이름 바꾸기
 *       { restoreVersionId } 예전 버전으로 되돌리기 (새 버전으로 기록됨)
 */
export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  const s = await requireStudent();
  const { id } = await ctx.params;
  await requireOwnProject(s.id, id);
  const body = await readJson(req);

  if (typeof body.title === "string") {
    const title = str(body.title, 40);
    if (!title) throw new HttpError(400, "이름을 입력해 주세요.");
    ok(await db().from("projects").update({ title }).eq("id", id));
  }

  if (typeof body.restoreVersionId === "string") {
    const src = maybe(
      await db()
        .from("versions")
        .select("number, html")
        .eq("id", body.restoreVersionId)
        .eq("project_id", id)
        .maybeSingle(),
    );
    if (!src) throw new HttpError(404, "버전을 찾을 수 없어요.");
    const last = must(
      await db().from("versions").select("number").eq("project_id", id).order("number", { ascending: false }).limit(1),
    );
    const number = (last[0]?.number ?? 0) + 1;
    const v = must(
      await db()
        .from("versions")
        .insert({
          project_id: id,
          number,
          kind: "restore",
          prompt: { from: src.number },
          prompt_text: `v${src.number}(으)로 되돌리기`,
          html: src.html,
          summary: `- v${src.number}의 상태로 되돌렸어요.`,
        })
        .select("id")
        .single(),
    );
    ok(
      await db().from("projects").update({ current_version_id: v.id, updated_at: new Date().toISOString() }).eq("id", id),
    );
  }
  return Response.json({ ok: true });
});

export const DELETE = handle(async (_req: Request, ctx: Ctx) => {
  const s = await requireStudent();
  const { id } = await ctx.params;
  await requireOwnProject(s.id, id);
  ok(await db().from("projects").delete().eq("id", id));
  return Response.json({ ok: true });
});
