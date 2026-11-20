import { requireTeacher } from "@/lib/auth";
import { handle, readJson, str } from "@/lib/http";
import { getSettings, saveSettings } from "@/lib/settings";

export const PUT = handle(async (req: Request) => {
  await requireTeacher();
  const body = await readJson(req);
  const cur = await getSettings();
  const next = {
    enabled: typeof body.enabled === "boolean" ? body.enabled : cur.enabled,
    model: str(body.model, 60) || cur.model,
    reasoningEffort: typeof body.reasoningEffort === "string" ? str(body.reasoningEffort, 20) : cur.reasoningEffort,
    extraInstructions: typeof body.extraInstructions === "string" ? str(body.extraInstructions, 2000) : cur.extraInstructions,
    perMinuteLimit:
      typeof body.perMinuteLimit === "number" ? Math.max(1, Math.min(20, Math.round(body.perMinuteLimit))) : cur.perMinuteLimit,
  };
  await saveSettings(next);
  return Response.json({ settings: next });
});
