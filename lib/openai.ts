import "server-only";
import type { AppSettings } from "./settings";
import { AIError, type AIResult } from "./ai-error";

const API = "https://api.openai.com/v1";

function key(): string {
  const k = process.env.OPENAI_API_KEY;
  if (!k) throw new AIError("OpenAI API 키(OPENAI_API_KEY)가 설정되지 않았어요. 선생님께 알려 주세요.", false);
  return k;
}

/** OpenAI Chat Completions 스트리밍 호출 */
export async function streamOpenAI(
  settings: AppSettings,
  prompt: { system: string; user: string },
  onDelta: (text: string) => void,
): Promise<AIResult> {
  const body: Record<string, unknown> = {
    model: settings.model,
    messages: [
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.user },
    ],
    stream: true,
    stream_options: { include_usage: true },
    // 추론 토큰도 이 한도에 포함되므로 넉넉하게 (앱 코드가 중간에 잘리지 않도록)
    max_completion_tokens: 32000,
  };
  if (settings.reasoningEffort) body.reasoning_effort = settings.reasoningEffort;

  const res = await fetch(`${API}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    console.error("OpenAI error", res.status, detail.slice(0, 500));
    const retry = res.status === 429 || res.status >= 500;
    throw new AIError(
      retry ? "지금 AI를 쓰는 친구가 많아요. 잠시 후 자동으로 다시 시도할게요." : "AI 호출에 실패했어요. 선생님께 알려 주세요.",
      retry,
    );
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let text = "";
  let tokensIn = 0;
  let tokensOut = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") continue;
      try {
        const j = JSON.parse(data);
        const d = j.choices?.[0]?.delta?.content;
        if (d) {
          text += d;
          onDelta(d);
        }
        if (j.usage) {
          tokensIn = j.usage.prompt_tokens ?? 0;
          tokensOut = j.usage.completion_tokens ?? 0; // 추론 토큰 포함
        }
      } catch {
        /* 조각난 줄은 무시 */
      }
    }
  }
  return { text, tokensIn, tokensOut, model: settings.model };
}

/** OpenAI Moderation API (무료) */
export async function openaiFlagged(input: string): Promise<boolean> {
  try {
    const res = await fetch(`${API}/moderations`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "omni-moderation-latest", input }),
    });
    if (!res.ok) return false;
    const j = await res.json();
    return Boolean(j.results?.[0]?.flagged);
  } catch {
    return false;
  }
}
