import { requireTeacher } from "@/lib/auth";
import { handle, readJson, str } from "@/lib/http";
import { getSettings, saveSettings, type AppSettings } from "@/lib/settings";

const CLAUDE_EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;

export const PUT = handle(async (req: Request) => {
  await requireTeacher();
  const body = await readJson(req);
  const cur = await getSettings();
  const next: AppSettings = {
    enabled: typeof body.enabled === "boolean" ? body.enabled : cur.enabled,
    provider: body.provider === "anthropic" || body.provider === "openai" ? body.provider : cur.provider,
    model: str(body.model, 60) || cur.model,
    reasoningEffort: typeof body.reasoningEffort === "string" ? str(body.reasoningEffort, 20) : cur.reasoningEffort,
    claudeModel: str(body.claudeModel, 60) || cur.claudeModel,
    claudeEffort: (CLAUDE_EFFORTS as readonly string[]).includes(body.claudeEffort as string)
      ? (body.claudeEffort as AppSettings["claudeEffort"])
      : cur.claudeEffort,
    extraInstructions: typeof body.extraInstructions === "string" ? str(body.extraInstructions, 2000) : cur.extraInstructions,
    perMinuteLimit:
      typeof body.perMinuteLimit === "number" ? Math.max(1, Math.min(20, Math.round(body.perMinuteLimit))) : cur.perMinuteLimit,
  };
  await saveSettings(next);
  return Response.json({ settings: next });
});
