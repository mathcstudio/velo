import { requireTeacher } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { handle, HttpError, maybe, must } from "@/lib/http";

/** ?id= 버전 코드 보기 (승인 전 미리보기 등) */
export const GET = handle(async (req: Request) => {
  await requireTeacher();
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const v = maybe(await db().from("versions").select("id, number, html").eq("id", id).maybeSingle());
  if (!v) throw new HttpError(404, "버전을 찾을 수 없어요.");
  return Response.json(v);
});
