"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import TopBar from "./TopBar";
import PromptCards from "./PromptCards";
import Preview from "./Preview";
import CodeView from "./CodeView";
import DeployPanel, { type Deployment } from "./DeployPanel";
import { Badge, Button, timeAgo } from "./ui";
import {
  DEBUG_CARDS,
  EDIT_CARDS,
  KIND_LABEL,
  VIBE_CARDS,
  checkCards,
  formatPrompt,
  promptScore,
  type StudentPrompt,
} from "@/lib/prompts";

export type Version = {
  id: string;
  number: number;
  kind: string;
  prompt_text: string;
  summary: string;
  created_at: string;
};
type Data = {
  project: { id: string; title: string; current_version_id: string | null };
  versions: Version[];
  currentHtml: string | null;
  deployment: Deployment | null;
};
type Me = { dailyLimit: number; usedToday: number };
type Mode = "create" | "edit" | "debug" | "free";
type Tab = "prompt" | "history" | "deploy";
type View =
  | { kind: "current" }
  | { kind: "version"; number: number; id: string; html: string }
  | { kind: "compare"; a: { number: number; html: string }; b: { number: number; html: string } };
type Gen = { status: "idle" | "running" | "waiting"; text: string; message: string };

const emptyCreate = { vision: "", interaction: "", body: "", exception: "" };
const emptyEdit = { where: "", what: "", keep: "" };
const emptyDebug = { action: "", expected: "", actual: "" };

export default function Studio({ projectId }: { projectId: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [tab, setTab] = useState<Tab>("prompt");
  const [mode, setMode] = useState<Mode>("create");
  const [createVals, setCreateVals] = useState(emptyCreate);
  const [editVals, setEditVals] = useState(emptyEdit);
  const [debugVals, setDebugVals] = useState(emptyDebug);
  const [freeText, setFreeText] = useState("");
  const [problems, setProblems] = useState<string[]>([]);
  const [gen, setGen] = useState<Gen>({ status: "idle", text: "", message: "" });
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [view, setView] = useState<View>({ kind: "current" });
  const [errors, setErrors] = useState<string[]>([]);
  const [showCode, setShowCode] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const htmlCache = useRef(new Map<string, string>());
  const streamBox = useRef<HTMLPreElement>(null);

  const busy = gen.status !== "idle";

  const load = useCallback(async () => {
    const d = await api<Data>(`/api/projects/${projectId}`);
    setData(d);
    if (d.project.current_version_id && d.currentHtml) htmlCache.current.set(d.project.current_version_id, d.currentHtml);
    return d;
  }, [projectId]);

  const loadMe = useCallback(() => api<Me>("/api/me").then(setMe).catch(() => {}), []);

  useEffect(() => {
    load()
      .then((d) => setMode(d.versions.length > 0 ? "edit" : "create"))
      .catch((e) => setNotice({ type: "error", text: e.message }));
    loadMe();
  }, [load, loadMe]);

  // 스트리밍 코드가 늘어나면 맨 아래로 스크롤
  useEffect(() => {
    if (streamBox.current) streamBox.current.scrollTop = streamBox.current.scrollHeight;
  }, [gen.text]);

  // 성공 알림은 잠시 후 자동으로 닫기
  useEffect(() => {
    if (notice?.type !== "success") return;
    const t = setTimeout(() => setNotice(null), 9000);
    return () => clearTimeout(t);
  }, [notice]);

  const onPreviewError = useCallback((m: string) => {
    setErrors((prev) => (prev.includes(m) ? prev : [...prev, m].slice(-5)));
  }, []);

  /* ── AI 호출 ───────────────────────────────────── */
  async function generate(prompt: StudentPrompt, attempt = 0) {
    setGen({ status: "running", text: "", message: attempt ? `다시 시도하는 중 (${attempt}/3)…` : "AI가 앱을 만들고 있어요…" });
    setNotice(null);
    setShowCode(false);
    setView({ kind: "current" });

    let res: Response;
    try {
      res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, prompt }),
      });
    } catch {
      setGen({ status: "idle", text: "", message: "" });
      setNotice({ type: "error", text: "인터넷 연결을 확인해 주세요." });
      return;
    }
    if (!res.ok || !res.body) {
      const j = await res.json().catch(() => ({}));
      if (res.status === 401) window.location.href = "/";
      setGen({ status: "idle", text: "", message: "" });
      setNotice({ type: "error", text: j.error ?? "문제가 생겼어요." });
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let text = "";
    let finished = false;

    while (true) {
      const { done, value } = await reader.read().catch(() => ({ done: true, value: undefined }));
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        if (!line.trim()) continue;
        let msg;
        try {
          msg = JSON.parse(line);
        } catch {
          continue;
        }
        if (msg.t === "delta") {
          text += msg.d;
          setGen((g) => ({ ...g, text }));
        } else if (msg.t === "done") {
          finished = true;
          htmlCache.current.set(msg.versionId, msg.html);
          await load();
          loadMe();
          setErrors([]);
          setReloadKey((k) => k + 1);
          if (prompt.kind === "create") setCreateVals(emptyCreate);
          if (prompt.kind === "edit") setEditVals(emptyEdit);
          if (prompt.kind === "debug") setDebugVals(emptyDebug);
          if (prompt.kind === "free") setFreeText("");
          setMode("edit");
          setGen({ status: "idle", text: "", message: "" });
          setNotice({ type: "success", text: `v${msg.number} 완성! ${msg.summary ? "\n" + msg.summary : ""}` });
        } else if (msg.t === "error") {
          finished = true;
          if (msg.retry && attempt < 3) {
            const wait = 8 * (attempt + 1) + Math.floor(Math.random() * 5);
            for (let s = wait; s > 0; s--) {
              setGen({ status: "waiting", text: "", message: `친구들이 AI를 많이 쓰고 있어요. ${s}초 후 다시 시도할게요 (${attempt + 1}/3)` });
              await new Promise((r) => setTimeout(r, 1000));
            }
            return generate(prompt, attempt + 1);
          }
          setGen({ status: "idle", text: "", message: "" });
          setNotice({ type: "error", text: msg.message });
        }
      }
    }
    if (!finished) {
      setGen({ status: "idle", text: "", message: "" });
      setNotice({ type: "error", text: "연결이 끊겼어요. 잠시 후 ‘기록’ 탭을 확인해 보세요." });
      load().catch(() => {});
    }
  }

  function submit() {
    let prompt: StudentPrompt;
    let p: string[] = [];
    if (mode === "create") {
      p = checkCards(VIBE_CARDS, createVals);
      prompt = { kind: "create", ...createVals };
    } else if (mode === "edit") {
      p = checkCards(EDIT_CARDS, editVals);
      prompt = { kind: "edit", ...editVals };
    } else if (mode === "debug") {
      p = checkCards(DEBUG_CARDS, debugVals);
      prompt = { kind: "debug", ...debugVals, errors };
    } else {
      if (freeText.trim().length < 6) p = ["조금 더 자세히 써 주세요."];
      prompt = { kind: "free", text: freeText };
    }
    setProblems(p);
    if (p.length > 0) return;
    if (mode === "create" && (data?.versions.length ?? 0) > 0) {
      if (!confirm("처음부터 새로 만들면 지금 앱 대신 완전히 새로운 앱이 만들어져요. (예전 버전은 기록에 남아요) 계속할까요?")) return;
    }
    generate(prompt);
  }

  /* ── 버전 보기·비교·되돌리기 ───────────────────── */
  async function versionHtml(id: string): Promise<string> {
    const c = htmlCache.current.get(id);
    if (c) return c;
    const v = await api<{ html: string }>(`/api/versions/${id}`);
    htmlCache.current.set(id, v.html);
    return v.html;
  }

  async function viewVersion(v: Version) {
    if (v.id === data?.project.current_version_id) return setView({ kind: "current" });
    setView({ kind: "version", number: v.number, id: v.id, html: await versionHtml(v.id) });
    setShowCode(false);
    setErrors([]);
  }

  async function compareWithCurrent(v: Version) {
    const cur = data?.versions.find((x) => x.id === data.project.current_version_id);
    if (!cur) return;
    const [a, b] = await Promise.all([versionHtml(v.id), versionHtml(cur.id)]);
    setView({ kind: "compare", a: { number: v.number, html: a }, b: { number: cur.number, html: b } });
    setShowCode(false);
  }

  async function restore(v: Version) {
    if (!confirm(`v${v.number}(으)로 되돌릴까요? 지금 버전도 기록에 남아 있어요.`)) return;
    await api(`/api/projects/${projectId}`, { method: "PATCH", json: { restoreVersionId: v.id } });
    await load();
    setView({ kind: "current" });
    setErrors([]);
    setNotice({ type: "success", text: `v${v.number}의 상태로 되돌렸어요.` });
  }

  async function rename(title: string) {
    if (!data || !title.trim() || title === data.project.title) return;
    await api(`/api/projects/${projectId}`, { method: "PATCH", json: { title } }).catch(() => {});
    setData({ ...data, project: { ...data.project, title } });
  }

  if (!data) {
    return (
      <>
        <TopBar />
        <main className="flex flex-1 items-center justify-center text-gray-500">{notice?.text ?? "불러오는 중…"}</main>
      </>
    );
  }

  const hasApp = data.versions.length > 0;
  const current = data.versions.find((v) => v.id === data.project.current_version_id);
  const shownHtml = view.kind === "version" ? view.html : data.currentHtml;

  const draft: StudentPrompt =
    mode === "create" ? { kind: "create", ...createVals }
    : mode === "edit" ? { kind: "edit", ...editVals }
    : mode === "debug" ? { kind: "debug", ...debugVals, errors }
    : { kind: "free", text: freeText };

  return (
    <div className="flex min-h-dvh flex-col md:h-dvh">
      <TopBar
        title={
          <input
            key={data.project.title}
            defaultValue={data.project.title}
            onBlur={(e) => rename(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            className="w-full max-w-xs rounded-xl px-2 py-2 text-lg font-bold hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
            maxLength={40}
            aria-label="앱 이름"
          />
        }
      >
        {me && (
          <span className="hidden rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-600 sm:inline">
            AI {me.usedToday}/{me.dailyLimit}
          </span>
        )}
      </TopBar>

      <div className="flex flex-1 flex-col md:min-h-0 md:flex-row">
        {/* ── 왼쪽: 프롬프트 / 기록 / 배포 ── */}
        <aside className="flex flex-col border-b bg-white md:min-h-0 md:w-[400px] md:border-r md:border-b-0 lg:w-[460px]">
          <nav className="flex gap-1 border-b p-2">
            {([
              ["prompt", hasApp ? "🔧 고치기" : "✨ 만들기"],
              ["history", `🕘 기록 ${data.versions.length}`],
              ["deploy", "🚀 배포"],
            ] as [Tab, string][]).map(([t, label]) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`min-h-12 flex-1 rounded-2xl font-semibold ${tab === t ? "bg-violet-100 text-violet-800" : "text-gray-500 hover:bg-gray-50"}`}
              >
                {label}
              </button>
            ))}
          </nav>

          {tab === "prompt" && (
            <>
              <div key={mode} className="flex-1 overflow-y-auto p-3">
                {hasApp && (
                  <div className="mb-3 grid grid-cols-4 gap-1 rounded-2xl bg-gray-100 p-1">
                    {([
                      ["edit", "고치기"],
                      ["debug", "버그"],
                      ["free", "자유"],
                      ["create", "새로"],
                    ] as [Mode, string][]).map(([m, label]) => (
                      <button
                        key={m}
                        disabled={busy}
                        onClick={() => { setMode(m); setProblems([]); }}
                        className={`min-h-11 rounded-xl text-sm font-semibold ${mode === m ? "bg-white text-violet-700 shadow-sm" : "text-gray-500"}`}
                      >
                        {label}
                        {m === "debug" && errors.length > 0 && <span className="ml-1 text-rose-500">●</span>}
                      </button>
                    ))}
                  </div>
                )}

                {mode === "create" && (
                  <>
                    <div className="mb-3 rounded-2xl bg-gradient-to-r from-violet-50 to-fuchsia-50 p-3">
                      <p className="font-bold text-violet-800">V·I·B·E 카드로 앱을 설명해요</p>
                      <p className="text-sm text-violet-700/80">무엇을 · 어떻게 작동 · 모습 · 조건 — 자세할수록 원하는 앱에 가까워져요.</p>
                      <ScoreBar score={promptScore(VIBE_CARDS, createVals)} />
                    </div>
                    <PromptCards cards={VIBE_CARDS} values={createVals} disabled={busy} onChange={(k, v) => setCreateVals((s) => ({ ...s, [k]: v }))} />
                  </>
                )}

                {mode === "edit" && (
                  <>
                    <Tip>바꿀 곳 → 바꿀 내용 → 그대로 둘 것. 한 번에 한 가지씩 고치면 더 잘 돼요!</Tip>
                    <PromptCards cards={EDIT_CARDS} values={editVals} disabled={busy} onChange={(k, v) => setEditVals((s) => ({ ...s, [k]: v }))} />
                  </>
                )}

                {mode === "debug" && (
                  <>
                    <Tip>버그는 “무엇을 했더니 → 원래는 이래야 하는데 → 실제로는 이렇다”로 알려 주세요.</Tip>
                    {errors.length > 0 && (
                      <div className="mb-3 rounded-2xl bg-rose-50 p-3 text-sm text-rose-800">
                        <p className="font-bold">브라우저가 찾은 오류 {errors.length}개 (AI에게 함께 보내요)</p>
                        <ul className="mt-1 list-disc pl-5 font-mono text-xs">
                          {errors.map((e) => <li key={e}>{e}</li>)}
                        </ul>
                      </div>
                    )}
                    <PromptCards cards={DEBUG_CARDS} values={debugVals} disabled={busy} onChange={(k, v) => setDebugVals((s) => ({ ...s, [k]: v }))} />
                  </>
                )}

                {mode === "free" && (
                  <>
                    <Tip>카드 없이 자유롭게 써 보세요. 그래도 ‘어디를, 어떻게’는 꼭 들어가야 해요.</Tip>
                    <textarea
                      value={freeText}
                      onChange={(e) => setFreeText(e.target.value)}
                      disabled={busy}
                      rows={7}
                      maxLength={1500}
                      placeholder="예) 점수가 10점이 되면 축하 메시지와 함께 폭죽 애니메이션이 나오게 해 줘. 다른 기능은 그대로 둬."
                      className="w-full rounded-2xl border-2 border-violet-100 bg-white p-3 leading-relaxed focus:border-violet-400 focus:outline-none"
                    />
                  </>
                )}

                <details className="mt-3 rounded-2xl bg-gray-50 p-3 text-sm">
                  <summary className="cursor-pointer font-semibold text-gray-600">AI에게 보낼 프롬프트 미리 보기</summary>
                  <pre className="mt-2 whitespace-pre-wrap font-sans text-gray-700">{formatPrompt(draft) || "(아직 비어 있어요)"}</pre>
                </details>

                {problems.length > 0 && (
                  <div className="mt-3 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">
                    {problems.map((p) => <p key={p}>💡 {p}</p>)}
                  </div>
                )}
              </div>
              <div className="border-t p-3">
                <Button onClick={submit} disabled={busy} className="h-14 w-full text-lg">
                  {busy ? "만드는 중…" : mode === "create" ? "✨ 앱 만들기" : mode === "debug" ? "🐞 버그 고쳐 줘" : "🔧 고쳐 줘"}
                </Button>
              </div>
            </>
          )}

          {tab === "history" && (
            <div className="flex-1 overflow-y-auto p-3">
              {data.versions.length === 0 && <p className="p-4 text-center text-gray-500">아직 기록이 없어요.</p>}
              <ol className="flex flex-col gap-2">
                {[...data.versions].reverse().map((v) => {
                  const isCurrent = v.id === data.project.current_version_id;
                  const isViewing = view.kind === "version" && view.id === v.id;
                  return (
                    <li key={v.id} className={`rounded-2xl border-2 p-3 ${isCurrent ? "border-violet-400 bg-violet-50" : isViewing ? "border-amber-300 bg-amber-50" : "border-gray-100"}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-black text-violet-700">v{v.number}</span>
                        <Badge color={v.kind === "debug" ? "rose" : v.kind === "restore" ? "gray" : "violet"}>{KIND_LABEL[v.kind] ?? v.kind}</Badge>
                        {isCurrent && <Badge color="emerald">지금 버전</Badge>}
                        <span className="ml-auto text-xs text-gray-400">{timeAgo(v.created_at)}</span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{v.prompt_text}</p>
                      {v.summary && <p className="mt-2 whitespace-pre-wrap rounded-xl bg-white/70 p-2 text-sm text-emerald-800">{v.summary}</p>}
                      {!isCurrent && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          <SmallBtn onClick={() => viewVersion(v)}>👀 보기</SmallBtn>
                          <SmallBtn onClick={() => compareWithCurrent(v)}>↔️ 지금과 비교</SmallBtn>
                          <SmallBtn onClick={() => restore(v)} disabled={busy}>↩️ 되돌리기</SmallBtn>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

          {tab === "deploy" && (
            <div className="flex-1 overflow-y-auto p-3">
              <DeployPanel
                projectId={projectId}
                defaultName={data.project.title}
                versions={data.versions}
                currentVersionId={data.project.current_version_id}
                deployment={data.deployment}
                onDeployed={() => load()}
              />
            </div>
          )}
        </aside>

        {/* ── 오른쪽: 미리보기 ── */}
        <section className={`flex min-h-[70vh] flex-1 flex-col bg-gray-100 md:min-h-0 ${fullscreen ? "fixed inset-0 z-40" : ""}`}>
          <div className="flex min-h-14 flex-wrap items-center gap-2 border-b bg-white px-3 py-1">
            <div className="min-w-0 flex-1 truncate text-sm font-semibold">
              {busy ? (
                <span className="text-violet-700">⏳ {gen.message}</span>
              ) : view.kind === "version" ? (
                <span className="text-amber-700">
                  👀 v{view.number} 보는 중{" "}
                  <button className="ml-1 underline" onClick={() => setView({ kind: "current" })}>지금 버전으로</button>
                </span>
              ) : view.kind === "compare" ? (
                <span className="text-amber-700">
                  ↔️ v{view.a.number} vs v{view.b.number} 비교 중{" "}
                  <button className="ml-1 underline" onClick={() => setView({ kind: "current" })}>닫기</button>
                </span>
              ) : current ? (
                <span className="text-gray-600">▶ v{current.number} 실행 중</span>
              ) : (
                <span className="text-gray-400">미리보기</span>
              )}
            </div>
            {errors.length > 0 && !busy && view.kind !== "compare" && (
              <button
                onClick={() => { setTab("prompt"); setMode("debug"); }}
                className="min-h-10 rounded-xl bg-rose-100 px-3 text-sm font-semibold text-rose-700"
              >
                ⚠️ 오류 {errors.length}개 → 버그 고치기
              </button>
            )}
            {shownHtml && !busy && view.kind !== "compare" && (
              <>
                <ToolBtn onClick={() => { setErrors([]); setReloadKey((k) => k + 1); }} label="다시 실행">🔄</ToolBtn>
                <ToolBtn onClick={() => setShowCode((s) => !s)} label="코드 보기" active={showCode}>{"</>"}</ToolBtn>
              </>
            )}
            <ToolBtn onClick={() => setFullscreen((f) => !f)} label={fullscreen ? "작게 보기" : "크게 보기"}>{fullscreen ? "🗗" : "⛶"}</ToolBtn>
          </div>

          <div className="relative flex min-h-0 flex-1">
            {busy ? (
              <div className="flex min-h-0 flex-1 flex-col bg-[#1e1b2e]">
                <div className="flex items-center gap-2 px-4 py-2 text-sm text-violet-200">
                  <span className="inline-block h-2 w-2 animate-ping rounded-full bg-violet-400" />
                  {gen.status === "waiting" ? "잠시 기다리는 중…" : `AI가 코드를 쓰고 있어요 · ${gen.text ? gen.text.split("\n").length : 0}줄`}
                </div>
                <pre ref={streamBox} className="flex-1 overflow-auto whitespace-pre-wrap break-all px-4 pb-4 font-mono text-[13px] leading-6 text-violet-50">
                  {gen.text}
                  <span className="animate-pulse">▍</span>
                </pre>
              </div>
            ) : view.kind === "compare" ? (
              <div className="grid min-h-0 flex-1 grid-cols-2 gap-1">
                {[view.a, view.b].map((x, i) => (
                  <div key={i} className="flex min-h-0 flex-col">
                    <div className={`px-3 py-1 text-center text-sm font-bold ${i === 0 ? "bg-amber-100 text-amber-800" : "bg-violet-100 text-violet-800"}`}>
                      v{x.number} {i === 1 && "(지금)"}
                    </div>
                    <Preview html={x.html} className="flex-1" />
                  </div>
                ))}
              </div>
            ) : !shownHtml ? (
              <EmptyPreview />
            ) : showCode ? (
              <div className="min-h-0 flex-1"><CodeView code={shownHtml} /></div>
            ) : (
              <Preview html={shownHtml} reloadKey={reloadKey} onError={onPreviewError} />
            )}

            {notice && (
              <div
                className={`absolute inset-x-3 top-3 z-10 flex items-start gap-2 rounded-2xl p-3 shadow-lg ${notice.type === "success" ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"}`}
              >
                <p className="flex-1 whitespace-pre-wrap text-sm font-medium">{notice.text}</p>
                <button onClick={() => setNotice(null)} className="h-8 w-8 shrink-0 rounded-full hover:bg-white/20" aria-label="닫기">×</button>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function ScoreBar({ score }: { score: number }) {
  const label = score >= 85 ? "아주 좋아요! 🎯" : score >= 60 ? "좋아요 👍" : score >= 30 ? "조금 더 자세히 ✍️" : "카드를 채워 보세요";
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs font-semibold text-violet-700">
        <span>프롬프트 완성도</span>
        <span>{label}</span>
      </div>
      <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-white">
        <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all" style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 rounded-2xl bg-violet-50 p-3 text-sm text-violet-800">💡 {children}</p>;
}

function SmallBtn(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className="min-h-10 rounded-xl bg-white px-3 text-sm font-semibold text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50 disabled:opacity-40" />;
}

function ToolBtn({ children, onClick, label, active }: { children: React.ReactNode; onClick: () => void; label: string; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`flex min-h-11 min-w-11 items-center justify-center rounded-xl px-2 font-mono text-sm font-bold ${active ? "bg-violet-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
    >
      {children}
    </button>
  );
}

function EmptyPreview() {
  return (
    <div className="flex flex-1 items-center justify-center p-6 text-center">
      <div>
        <div className="text-6xl">🪄</div>
        <p className="mt-3 text-xl font-bold text-gray-700">여기에 내 앱이 나타나요</p>
        <p className="mt-1 text-gray-500">왼쪽 V·I·B·E 카드를 채우고 ‘앱 만들기’를 눌러 보세요.</p>
        <div className="mx-auto mt-5 grid max-w-sm grid-cols-2 gap-2 text-left text-sm">
          {VIBE_CARDS.map((c) => (
            <div key={c.key} className="rounded-2xl bg-white p-3 shadow-sm">
              <span className="font-black text-violet-600">{c.letter}</span> <span className="font-bold">{c.title}</span>
              <p className="text-gray-500">{c.question}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
