import { db } from "@/lib/supabase";
import { APP_CSP } from "@/lib/prompts";

/**
 * 배포된 학생 앱을 그대로 보여 주는 공개 주소.
 * CSP 'sandbox' 덕분에 이 페이지는 VELO 사이트와 '다른 출처'로 취급되어
 * 학생 코드가 로그인 쿠키나 VELO API에 접근할 수 없음.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const { data: dep } = await db()
    .from("deployments")
    .select("version_id, hidden")
    .eq("slug", slug.toLowerCase())
    .maybeSingle();

  let html: string | null = null;
  if (dep && dep.version_id && !dep.hidden) {
    const { data: v } = await db().from("versions").select("html").eq("id", dep.version_id).maybeSingle();
    html = v?.html ?? null;
  }
  if (!html) {
    html = `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>VELO</title></head>
<body style="font-family:sans-serif;display:grid;place-items:center;height:100vh;margin:0;background:#f5f3ff;color:#4c1d95;text-align:center">
<div><div style="font-size:64px">🛠️</div><h1>아직 공개되지 않은 앱이에요</h1><p>선생님 승인을 기다리고 있거나, 주소가 잘못되었어요.</p></div></body></html>`;
  }

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": `sandbox allow-scripts allow-modals allow-forms allow-popups; ${APP_CSP}`,
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Cache-Control": "no-store",
    },
  });
}
