import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { AppSettings } from "./settings";
import { AIError, type AIResult } from "./ai-error";

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new AIError("Claude API 키(ANTHROPIC_API_KEY)가 설정되지 않았어요. 선생님께 알려 주세요.", false);
  }
  // 혼잡(429 등)은 학생 화면에서 안내하며 다시 시도하므로 SDK 자체 재시도는 1번만
  client ??= new Anthropic({ maxRetries: 1 });
  return client;
}

/**
 * 안전 분류기가 요청을 거절(refusal)했을 때 서버에서 다른 모델로 자동으로 넘겨 주는 기능을
 * 지원하는 모델. (Haiku 5.5는 지원하지 않음)
 */
function supportsFallback(model: string): boolean {
  return /^claude-(opus-5-5|sonnet-5-5|fable-5-[12])/.test(model);
}

/** Claude 스트리밍 호출 */
export async function streamClaude(
  settings: AppSettings,
  prompt: { system: string; user: string },
  onDelta: (text: string) => void,
): Promise<AIResult> {
  const c = anthropic();
  const params = {
    model: settings.claudeModel,
    // 생각(thinking) 토큰도 이 한도에 포함되므로 넉넉하게
    max_tokens: 32000,
    // 규칙(시스템 프롬프트)은 모든 학생이 같으므로 캐시해서 입력 비용 절약
    system: [{ type: "text" as const, text: prompt.system, cache_control: { type: "ephemeral" as const } }],
    messages: [{ role: "user" as const, content: prompt.user }],
    // 생각의 깊이. 낮을수록 빠르고 토큰을 덜 씀 (Opus 5.5는 생각을 끌 수 없어서 이것으로 조절)
    output_config: { effort: settings.claudeEffort },
  };

  try {
    const stream = supportsFallback(settings.claudeModel)
      ? c.beta.messages.stream({ ...params, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" })
      : c.messages.stream(params);

    let text = "";
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        text += event.delta.text;
        onDelta(event.delta.text);
      }
    }
    const msg = await stream.finalMessage();

    if (msg.stop_reason === "refusal") {
      throw new AIError("AI가 이 요청은 도와줄 수 없다고 했어요. 표현을 바꿔서 다시 시도해 보세요.", false);
    }
    if (msg.stop_reason === "max_tokens") {
      throw new AIError("앱이 너무 길어서 끝까지 만들지 못했어요. 기능을 조금 줄여서 다시 요청해 보세요.", false);
    }
    const u = msg.usage;
    return {
      text,
      tokensIn: u.input_tokens + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0),
      tokensOut: u.output_tokens, // 생각(thinking) 토큰 포함
      model: msg.model,
    };
  } catch (e) {
    if (e instanceof AIError) throw e;
    if (e instanceof Anthropic.RateLimitError) {
      throw new AIError("지금 AI를 쓰는 친구가 많아요. 잠시 후 자동으로 다시 시도할게요.", true);
    }
    if (e instanceof Anthropic.APIError) {
      console.error("Claude error", e.status, e.message);
      const retry = (e.status ?? 0) >= 500;
      throw new AIError(
        retry ? "AI 서버가 바빠요. 잠시 후 자동으로 다시 시도할게요." : "AI 호출에 실패했어요. 선생님께 알려 주세요.",
        retry,
      );
    }
    throw e;
  }
}

/** OpenAI 키가 없을 때 쓰는 입력 검사: 가볍고 저렴한 Claude Haiku 5.5로 판정 */
export async function claudeFlagged(input: string): Promise<boolean> {
  try {
    const msg = await anthropic().messages.create({
      model: "claude-haiku-5-5",
      max_tokens: 1024,
      output_config: { effort: "low" },
      system:
        "너는 초·중·고 수업용 앱 제작 서비스의 입력 검사기야. 학생 입력이 폭력·선정·혐오·따돌림·자해·범죄·개인정보 수집에 해당하면 UNSAFE, 아니면 SAFE 한 단어로만 답해. 게임 속 전투, 퀴즈, 일상적인 표현은 SAFE야.",
      messages: [{ role: "user", content: `[학생 입력]\n${input}` }],
    });
    if (msg.stop_reason === "refusal") return true;
    const answer = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    return answer.toUpperCase().includes("UNSAFE");
  } catch {
    return false;
  }
}
