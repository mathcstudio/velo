import { requireOwnProject, requireStudent } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { handle, HttpError, maybe, must, readJson, str, ok } from "@/lib/http";
import { randomCode } from "@/lib/session";
import { isFlagged } from "@/lib/openai";

/**
 * 배포하기: 현재 버전을 공개 주소(/p/<slug>)로 내보냄.
 * 학급이 '교사 승인 필요'면 승인 대기 상태로 들어가고, 이전에 공개된 버전은 승인 전까지 그대로 유지됨.
 */
export const POST = handle(async (req: Request) => {
  const s = await requireStudent();
  const body = await readJson(req);
  const projectId = str(body.projectId, 64);
  const name = str(body.name, 30);
  const emoji = str(body.emoji, 8) || "✨";
  const description = str(body.description, 120);
  if (!name) throw new HttpError(400, "앱 이름을 정해 주세요.");
  if (!description) throw new HttpError(400, "한 줄 설명을 써 주세요.");

  const project = await requireOwnProject(s.id, projectId);
  if (!project.current_version_id) throw new HttpError(400, "아직 배포할 앱이 없어요.");
  if (await isFlagged(`${name}\n${description}`)) throw new HttpError(400, "이름이나 설명에 부적절한 표현이 있어요.");

  const needApproval = s.classes.require_approval;
  const existing = maybe(await db().from("deployments").select("id, slug").eq("project_id", projectId).maybeSingle());
  const fields = {
    name,
    emoji,
    description,
    updated_at: new Date().toISOString(),
    ...(needApproval
      ? { pending_version_id: project.current_version_id }
      : { version_id: project.current_version_id, pending_version_id: null }),
  };

  let slug: string;
  if (existing) {
    ok(await db().from("deployments").update(fields).eq("id", existing.id));
    slug = existing.slug;
  } else {
    slug = randomCode(6).toLowerCase();
    must(await db().from("deployments").insert({ project_id: projectId, slug, ...fields }));
  }
  return Response.json({ slug, status: needApproval ? "pending" : "live" });
});
