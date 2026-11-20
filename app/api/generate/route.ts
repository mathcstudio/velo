import { requireOwnProject, requireStudent } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { handle, HttpError, maybe, must, readJson, str, ok } from "@/lib/http";
import { getSettings } from "@/lib/settings";
import { countUsage, kstDayStart } from "@/lib/usage";
import { buildMessages, isFlagged, OpenAIError, parseOutput, streamChat } from "@/lib/openai";
import { formatPrompt, type StudentPrompt } from "@/lib/prompts";

// AI가 앱 전체를 만드는 데 수십 초가 걸리므로 넉넉하게 (Vercel 무료 플랜 최대 300초)
export const maxDuration = 300;

const F = 600; // 카드 한 칸 최대 글자 수

function sanitize(p: unknown): StudentPrompt {
  const o = (p ?? {}) as Record<string, unknown>;
  switch (o.kind) {
    case "create":
      return { kind: "create", vision: str(o.vision, F), interaction: str(o.interaction, F), body: str(o.body, F), exception: str(o.exception, F) };
    case "edit":
      return { kind: "edit", where: str(o.where, F), what: str(o.what, F), keep: str(o.keep, F) };
    case "debug":
      return {
        kind: "debug",
        action: str(o.action, F),
        expected: str(o.expected, F),
        actual: str(o.actual, F),
        errors: Array.isArray(o.errors) ? o.errors.slice(0, 5).map((e) => str(e, 300)).filter(Boolean) : [],
      };
    case "free":
      return { kind: "free", text: str(o.text, 1500) };
    default:
      throw new HttpError(400, "프롬프트 형식이 올바르지 않아요.");
  }
}

/**
 * 앱 생성/수정. 응답은 한 줄에 JSON 하나씩(NDJSON) 흘려보냄:
 *   {"t":"delta","d":"<코드 조각>"}  … 반복
 *   {"t":"done","versionId":"...","number":3,"summary":"..."}
 *   {"t":"error","message":"..."}
 */
export const POST = handle(async (req: Request) => {
  const student = await requireStudent();
  const body = await readJson(req);
  const projectId = str(body.projectId, 64);
  const prompt = sanitize(body.prompt);
  const promptText = formatPrompt(prompt);
  if (promptText.replace(/\[[^\]]*\]/g, "").trim().length < 4) throw new HttpError(400, "프롬프트를 조금 더 써 주세요.");

  const project = await requireOwnProject(student.id, projectId);
  const settings = await getSettings();
  if (!settings.enabled) throw new HttpError(403, "지금은 AI 사용 시간이 아니에요. 선생님 안내를 기다려 주세요.");

  // ── 호출 한도 확인 ──
  const busy = await countUsage(student.id, new Date(Date.now() - 4 * 60e3).toISOString(), ["running"]);
  if (busy > 0) throw new HttpError(429, "이미 만들고 있는 중이에요. 끝날 때까지 기다려 주세요.");
  const lastMinute = await countUsage(student.id, new Date(Date.now() - 60e3).toISOString());
  if (lastMinute >= settings.perMinuteLimit) throw new HttpError(429, "너무 빨라요! 1분만 기다렸다가 다시 해 보세요.");
  const today = await countUsage(student.id, kstDayStart());
  if (today >= student.classes.daily_limit) {
    throw new HttpError(429, `오늘 사용할 수 있는 횟수(${student.classes.daily_limit}회)를 다 썼어요.`);
  }

  // ── 부적절한 내용 검사 ──
  if (await isFlagged(promptText)) {
    await db().from("usage_logs").insert({ student_id: student.id, status: "blocked", error: promptText.slice(0, 500) });
    throw new HttpError(400, "프롬프트에 학교에서 쓰기 어려운 내용이 있어요. 표현을 바꿔 볼까요?");
  }

  // ── 수정이면 현재 코드를 함께 보냄 ──
  let currentHtml: string | null = null;
  if (prompt.kind !== "create" && project.current_version_id) {
    const v = maybe(await db().from("versions").select("html").eq("id", project.current_version_id).maybeSingle());
    currentHtml = v?.html ?? null;
  }
  if (prompt.kind !== "create" && !currentHtml) throw new HttpError(400, "먼저 앱을 처음 만들어 주세요.");

  const log = must(
    await db().from("usage_logs").insert({ student_id: student.id, status: "running" }).select("id").single(),
  );

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let open = true;
      const send = (obj: object) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
        } catch {
          open = false; // 학생이 화면을 닫아도 저장은 계속 진행
        }
      };

      try {
        const messages = buildMessages(settings, promptText, currentHtml);
        const out = await streamChat(settings, messages, (d) => send({ t: "delta", d }));
        const parsed = parseOutput(out.text);
        if (!parsed) throw new Error("AI가 올바른 HTML을 만들지 못했어요. 다시 시도해 보세요.");

        const last = must(
          await db().from("versions").select("number").eq("project_id", projectId).order("number", { ascending: false }).limit(1),
        );
        const number = (last[0]?.number ?? 0) + 1;
        const v = must(
          await db()
            .from("versions")
            .insert({ project_id: projectId, number, kind: prompt.kind, prompt, prompt_text: promptText, html: parsed.html, summary: parsed.summary })
            .select("id")
            .single(),
        );
        const update: Record<string, unknown> = { current_version_id: v.id, updated_at: new Date().toISOString() };
        if (number === 1 && project.title === "새 앱") {
          const m = parsed.html.match(/<title>([^<]{1,40})<\/title>/i);
          if (m) update.title = m[1].trim();
        }
        ok(await db().from("projects").update(update).eq("id", projectId));
        await db().from("usage_logs").update({ status: "ok", tokens_in: out.tokensIn, tokens_out: out.tokensOut }).eq("id", log.id);
        send({ t: "done", versionId: v.id, number, summary: parsed.summary, html: parsed.html });
      } catch (e) {
        let message = e instanceof Error ? e.message : "알 수 없는 오류";
        let retry = false;
        if (e instanceof OpenAIError) {
          retry = e.status === 429 || e.status >= 500;
          message = retry ? "지금 AI를 쓰는 친구가 많아요. 잠시 후 자동으로 다시 시도할게요." : "AI 호출에 실패했어요. 선생님께 알려 주세요.";
        }
        await db().from("usage_logs").update({ status: "error", error: String(e).slice(0, 500) }).eq("id", log.id);
        send({ t: "error", message, retry });
      } finally {
        if (open) controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
});
