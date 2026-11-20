import { requireTeacher } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { handle, HttpError, maybe, must, readJson, str, ok } from "@/lib/http";

/** { id, action: "approve" | "reject" | "hide" | "unhide" } */
export const PATCH = handle(async (req: Request) => {
  await requireTeacher();
  const body = await readJson(req);
  const id = str(body.id, 64);
  const d = maybe(await db().from("deployments").select("pending_version_id").eq("id", id).maybeSingle());
  if (!d) throw new HttpError(404, "배포를 찾을 수 없어요.");
  const now = new Date().toISOString();
  switch (body.action) {
    case "approve":
      if (!d.pending_version_id) throw new HttpError(400, "승인 대기 중인 버전이 없어요.");
      ok(await db().from("deployments").update({ version_id: d.pending_version_id, pending_version_id: null, hidden: false, updated_at: now }).eq("id", id));
      break;
    case "reject":
      ok(await db().from("deployments").update({ pending_version_id: null }).eq("id", id));
      break;
    case "hide":
      ok(await db().from("deployments").update({ hidden: true }).eq("id", id));
      break;
    case "unhide":
      ok(await db().from("deployments").update({ hidden: false }).eq("id", id));
      break;
    default:
      throw new HttpError(400, "알 수 없는 동작이에요.");
  }
  return Response.json({ ok: true });
});
