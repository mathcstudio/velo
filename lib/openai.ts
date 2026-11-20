import "server-only";
import type { AppSettings } from "./settings";

const API = "https://api.openai.com/v1";

function key(): string {
  const k = process.env.OPENAI_API_KEY;
  if (!k) throw new Error("OPENAI_API_KEY 환경변수가 없습니다.");
  return k;
}

export const SUMMARY_MARK = "===변경요약===";

export function systemPrompt(extra: string): string {
  return `너는 초·중·고 학생의 '바이브코딩'을 돕는 웹앱 제작 도우미야. 학생이 한국어로 원하는 앱을 설명하면 바로 실행되는 웹앱을 만들어.

[반드시 지킬 규칙]
1. 결과는 하나의 완전한 HTML 문서야. <!DOCTYPE html>로 시작해서 </html>로 끝나고, CSS는 <style>, 자바스크립트는 <script> 안에 모두 넣어.
2. 외부 파일·CDN·라이브러리·웹 폰트·외부 이미지 주소·fetch/XMLHttpRequest를 쓰지 마. (보안 정책 때문에 모두 차단돼서 작동하지 않아.) 그림은 이모지, CSS, SVG, canvas로 표현해.
3. localStorage, sessionStorage, IndexedDB, 쿠키는 작동하지 않으니 쓰지 마. 데이터는 자바스크립트 변수에만 저장해.
4. 태블릿 터치 화면에 맞게: 반응형 레이아웃, 큰 버튼(최소 48px), 큰 글씨, 화면 안에서 스크롤 최소화. 화면의 모든 글자는 한국어로.
5. 이름·전화번호·주소·비밀번호 같은 개인정보를 입력받거나 모으는 기능은 만들지 마. 폭력적·선정적·혐오·따돌림 내용은 만들지 말고, 그런 요청이면 대신 "이런 내용은 만들 수 없어요"라고 정중하게 보여 주는 간단한 화면을 만들어.
6. 코드는 학생이 읽을 수 있게 간결하게(되도록 300줄 이내) 쓰고, 중요한 부분에 짧은 한국어 주석을 달아.
7. 수정 요청이 오면 기존 코드를 바탕으로 요청한 부분만 바꿔. '그대로 둘 것'으로 적힌 기능은 절대 망가뜨리지 마. 요청하지 않은 기능을 새로 넣거나 디자인을 크게 바꾸지 마.
8. 버그 신고가 오면 원인을 찾아 고치고, 같은 문제가 다시 생기지 않게 해.

[출력 형식]
- HTML 문서 전체만 출력해. 마크다운 코드블록(\`\`\`)이나 설명 문장을 앞에 쓰지 마.
- </html> 다음 줄에 ${SUMMARY_MARK} 라고 쓰고, 그 아래에 이번에 만든/바꾼 내용을 학생 눈높이의 한국어로 "- "로 시작하는 1~3줄로 요약해.${
    extra.trim() ? `\n\n[선생님의 추가 지시]\n${extra.trim()}` : ""
  }`;
}

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export function buildMessages(settings: AppSettings, promptText: string, currentHtml: string | null): ChatMessage[] {
  const user = currentHtml
    ? `[지금 앱의 코드]\n${currentHtml}\n\n[학생의 요청]\n${promptText}\n\n위 코드를 바탕으로 요청을 반영한 HTML 문서 전체를 다시 출력해.`
    : `[학생의 요청]\n${promptText}`;
  return [
    { role: "system", content: systemPrompt(settings.extraInstructions) },
    { role: "user", content: user },
  ];
}

export class OpenAIError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** OpenAI Chat Completions 스트리밍 호출. 글자가 생성될 때마다 onDelta 호출 */
export async function streamChat(
  settings: AppSettings,
  messages: ChatMessage[],
  onDelta: (text: string) => void,
): Promise<{ text: string; tokensIn: number; tokensOut: number }> {
  const body: Record<string, unknown> = {
    model: settings.model,
    messages,
    stream: true,
    stream_options: { include_usage: true },
    max_completion_tokens: 16000,
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
    throw new OpenAIError(res.status, detail.slice(0, 300));
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
          tokensOut = j.usage.completion_tokens ?? 0;
        }
      } catch {
        /* 조각난 줄은 무시 */
      }
    }
  }
  return { text, tokensIn, tokensOut };
}

/** AI 출력에서 HTML과 요약을 분리 */
export function parseOutput(raw: string): { html: string; summary: string } | null {
  let body = raw;
  let summary = "";
  const i = raw.indexOf(SUMMARY_MARK);
  if (i >= 0) {
    body = raw.slice(0, i);
    summary = raw.slice(i + SUMMARY_MARK.length).trim();
  }
  body = body.replace(/^\s*```(?:html)?\s*/i, "").replace(/```\s*$/, "");
  const start = body.search(/<!DOCTYPE html|<html/i);
  const end = body.toLowerCase().lastIndexOf("</html>");
  if (start < 0 || end < 0) return null;
  return { html: body.slice(start, end + 7).trim(), summary: summary.replace(/```/g, "").slice(0, 600) };
}

/** 부적절한 입력 검사 (OpenAI Moderation API, 무료). 검사 자체가 실패하면 통과시킴 */
export async function isFlagged(input: string): Promise<boolean> {
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
