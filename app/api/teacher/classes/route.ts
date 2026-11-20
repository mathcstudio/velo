import { requireTeacher } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { handle, HttpError, must, readJson, str, ok } from "@/lib/http";
import { randomCode } from "@/lib/session";

/** 반 만들기 { name } */
export const POST = handle(async (req: Request) => {
  await requireTeacher();
  const body = await readJson(req);
  const name = str(body.name, 30);
  if (!name) throw new HttpError(400, "반 이름을 입력해 주세요.");
  for (let i = 0; i < 5; i++) {
    const { data, error } = await db().from("classes").insert({ name, code: randomCode(6) }).select().single();
    if (!error) return Response.json({ class: data });
    if (!error.message.includes("duplicate")) throw new Error(error.message);
  }
  throw new HttpError(500, "코드 생성에 실패했어요. 다시 시도해 주세요.");
});

/** 반 설정 바꾸기 { id, name?, require_approval?, daily_limit? } */
export const PATCH = handle(async (req: Request) => {
  await requireTeacher();
  const body = await readJson(req);
  const id = str(body.id, 64);
  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) patch.name = str(body.name, 30);
  if (typeof body.require_approval === "boolean") patch.require_approval = body.require_approval;
  if (typeof body.daily_limit === "number") patch.daily_limit = Math.max(0, Math.min(500, Math.round(body.daily_limit)));
  ok(await db().from("classes").update(patch).eq("id", id));
  return Response.json({ ok: true });
});

/** 반 삭제 { id } — 학생, 프로젝트, 배포가 모두 지워짐 */
export const DELETE = handle(async (req: Request) => {
  await requireTeacher();
  const body = await readJson(req);
  ok(await db().from("classes").delete().eq("id", str(body.id, 64)));
  return Response.json({ ok: true });
});
