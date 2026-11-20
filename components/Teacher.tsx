"use client";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "./api";
import Preview from "./Preview";
import { Badge, Button, Card, Modal, timeAgo } from "./ui";
import { KIND_LABEL } from "@/lib/prompts";

type Cls = { id: string; code: string; name: string; require_approval: boolean; daily_limit: number; studentCount: number };
type Dep = {
  id: string; slug: string; name: string; emoji: string; description: string;
  version_id: string | null; pending_version_id: string | null; hidden: boolean; updated_at: string;
  projects: { title: string; students: { name: string; classes: { name: string } } };
};
type Settings = { enabled: boolean; model: string; reasoningEffort: string; extraInstructions: string; perMinuteLimit: number };
type Overview = {
  classes: Cls[];
  deployments: Dep[];
  usageToday: { calls: number; errors: number; blocked: number; running: number; tokensIn: number; tokensOut: number };
  settings: Settings;
  openaiKeySet: boolean;
};
type Student = { id: string; name: string; blocked: boolean; locked: boolean; pinSet: boolean; projectCount: number; callsToday: number; blockedToday: number };
type History = {
  projects: { id: string; title: string; versions: { id: string; number: number; kind: string; prompt_text: string; summary: string; created_at: string }[] }[];
  blocked: { error: string; created_at: string }[];
};

export default function Teacher() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [data, setData] = useState<Overview | null>(null);
  const [tab, setTab] = useState<"classes" | "deploy" | "settings">("classes");

  const load = useCallback(async () => {
    try {
      setData(await api<Overview>("/api/teacher", { on401: "throw" }));
      setAuthed(true);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setAuthed(false);
      else alert((e as Error).message);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (authed === false) return <TeacherLogin onDone={load} />;
  if (!data) return <main className="flex flex-1 items-center justify-center text-gray-500">불러오는 중…</main>;

  const pendingCount = data.deployments.filter((d) => d.pending_version_id).length;

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-30 flex min-h-16 flex-wrap items-center gap-2 border-b bg-white px-4">
        <span className="text-xl font-black text-violet-700">🪄 VELO 교사</span>
        <nav className="ml-4 flex gap-1">
          {([
            ["classes", "🏫 반·학생"],
            ["deploy", `🚀 배포 관리${pendingCount ? ` (${pendingCount})` : ""}`],
            ["settings", "⚙️ AI 설정·사용량"],
          ] as const).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)} className={`min-h-11 rounded-xl px-3 font-semibold ${tab === t ? "bg-violet-100 text-violet-800" : "text-gray-500"}`}>
              {label}
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Badge color={data.settings.enabled ? "emerald" : "rose"}>{data.settings.enabled ? "AI 사용 중" : "AI 꺼짐"}</Badge>
          <button
            onClick={async () => { await api("/api/auth/teacher", { method: "DELETE" }); location.reload(); }}
            className="min-h-11 rounded-xl px-3 text-gray-500 hover:bg-gray-100"
          >
            로그아웃
          </button>
        </div>
      </header>
      {!data.openaiKeySet && (
        <p className="bg-rose-100 p-3 text-center text-rose-800">⚠️ OPENAI_API_KEY 환경변수가 설정되지 않았어요. Vercel 설정에서 추가해 주세요.</p>
      )}
      <main className="mx-auto w-full max-w-6xl flex-1 p-4">
        {tab === "classes" && <ClassesTab classes={data.classes} reload={load} />}
        {tab === "deploy" && <DeployTab deployments={data.deployments} reload={load} />}
        {tab === "settings" && <SettingsTab data={data} reload={load} />}
      </main>
    </div>
  );
}

function TeacherLogin({ onDone }: { onDone: () => void }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <h1 className="mb-4 text-2xl font-black">🪄 교사 로그인</h1>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setErr("");
            try {
              await api("/api/auth/teacher", { json: { password: pw }, on401: "throw" });
              onDone();
            } catch (e) {
              setErr((e as Error).message);
            }
          }}
          className="flex flex-col gap-3"
        >
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="관리자 비밀번호" className="h-12 rounded-xl border-2 border-gray-200 px-3 focus:border-violet-500 focus:outline-none" />
          {err && <p className="text-sm text-rose-600">{err}</p>}
          <Button type="submit">로그인</Button>
        </form>
      </Card>
    </main>
  );
}

/* ── 반·학생 ─────────────────────────────────────── */
function ClassesTab({ classes, reload }: { classes: Cls[]; reload: () => void }) {
  const [newName, setNewName] = useState("");
  const [selected, setSelected] = useState<string | null>(classes[0]?.id ?? null);
  const [showCode, setShowCode] = useState<Cls | null>(null);

  async function patch(id: string, p: Partial<Cls>) {
    await api("/api/teacher/classes", { method: "PATCH", json: { id, ...p } });
    reload();
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const r = await api<{ class: Cls }>("/api/teacher/classes", { json: { name: newName } });
            setNewName("");
            setSelected(r.class.id);
            reload();
          }}
        >
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="새 반 이름 (예: 2학년 3반)" className="h-12 flex-1 rounded-xl border-2 border-gray-200 px-3" />
          <Button type="submit" disabled={!newName.trim()}>＋ 반 만들기</Button>
        </form>
      </Card>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {classes.map((c) => (
          <Card key={c.id} className={selected === c.id ? "ring-2 ring-violet-400" : ""}>
            <button className="w-full text-left" onClick={() => setSelected(c.id)}>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">{c.name}</h2>
                <span className="text-sm text-gray-500">학생 {c.studentCount}명</span>
              </div>
              <p className="mt-1 font-mono text-2xl font-black tracking-widest text-violet-700">{c.code}</p>
            </button>
            <div className="mt-3 flex flex-col gap-2 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={c.require_approval} onChange={(e) => patch(c.id, { require_approval: e.target.checked })} className="h-5 w-5 accent-violet-600" />
                배포 전에 교사 승인 받기
              </label>
              <label className="flex items-center gap-2">
                1인당 하루 AI 호출
                <input
                  type="number"
                  defaultValue={c.daily_limit}
                  min={0}
                  max={500}
                  onBlur={(e) => Number(e.target.value) !== c.daily_limit && patch(c.id, { daily_limit: Number(e.target.value) })}
                  className="h-10 w-20 rounded-lg border px-2"
                />
                회
              </label>
              <div className="flex gap-2">
                <Button variant="secondary" className="min-h-10 flex-1 text-sm" onClick={() => setShowCode(c)}>칠판에 코드 띄우기</Button>
                <Button
                  variant="ghost"
                  className="min-h-10 text-sm text-rose-500"
                  onClick={async () => {
                    if (!confirm(`'${c.name}'을(를) 삭제할까요? 학생, 앱, 배포 기록이 모두 지워집니다.`)) return;
                    await api("/api/teacher/classes", { method: "DELETE", json: { id: c.id } });
                    reload();
                  }}
                >
                  삭제
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {selected && <StudentsTable classId={selected} />}

      <Modal open={!!showCode} onClose={() => setShowCode(null)} title={showCode?.name ?? ""} wide>
        {showCode && (
          <div className="py-10 text-center">
            <p className="text-2xl text-gray-500">{typeof window !== "undefined" ? window.location.host : ""} 접속 후 학급 코드 입력</p>
            <p className="mt-4 font-mono text-[18vw] font-black leading-none tracking-widest text-violet-700 lg:text-[160px]">{showCode.code}</p>
          </div>
        )}
      </Modal>
    </div>
  );
}

function StudentsTable({ classId }: { classId: string }) {
  const [students, setStudents] = useState<Student[] | null>(null);
  const [history, setHistory] = useState<{ name: string; data: History } | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await api<{ students: Student[] }>(`/api/teacher/students?classId=${classId}`);
    setStudents(r.students);
  }, [classId]);
  useEffect(() => { load(); }, [load]);

  async function patch(id: string, p: Record<string, unknown>) {
    await api("/api/teacher/students", { method: "PATCH", json: { id, ...p } });
    load();
  }

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-bold">학생 목록</h3>
        <Button variant="ghost" className="min-h-10 text-sm" onClick={load}>🔄 새로고침</Button>
      </div>
      {students === null ? (
        <p className="text-gray-500">불러오는 중…</p>
      ) : students.length === 0 ? (
        <p className="text-gray-500">아직 들어온 학생이 없어요. 학급 코드를 알려 주세요.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-gray-500">
              <tr><th className="py-2">이름</th><th>오늘 AI 호출</th><th>앱 수</th><th>상태</th><th className="text-right">관리</th></tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="py-2 font-semibold">{s.name}</td>
                  <td>
                    {s.callsToday}
                    {s.blockedToday > 0 && <Badge color="rose">차단된 입력 {s.blockedToday}</Badge>}
                  </td>
                  <td>{s.projectCount}</td>
                  <td className="space-x-1">
                    {s.blocked && <Badge color="rose">사용 중지</Badge>}
                    {s.locked && <Badge color="amber">PIN 잠김</Badge>}
                    {!s.pinSet && <Badge color="gray">새 PIN 대기</Badge>}
                  </td>
                  <td className="space-x-1 py-1 text-right">
                    <SmallBtn
                      onClick={async () => {
                        const data = await api<History>(`/api/teacher/history?studentId=${s.id}`);
                        setHistory({ name: s.name, data });
                      }}
                    >
                      📜 프롬프트 기록
                    </SmallBtn>
                    <SmallBtn onClick={() => patch(s.id, { blocked: !s.blocked })}>{s.blocked ? "▶ 다시 허용" : "⏸ 사용 중지"}</SmallBtn>
                    <SmallBtn onClick={() => confirm(`${s.name}의 PIN을 초기화할까요? 다음에 입력하는 PIN이 새 PIN이 됩니다.`) && patch(s.id, { resetPin: true })}>🔑 PIN 초기화</SmallBtn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!history} onClose={() => { setHistory(null); setPreviewHtml(null); }} title={`${history?.name ?? ""} · 프롬프트 기록`} wide>
        {history && (
          <div className="flex flex-col gap-4 lg:flex-row">
            <div className="flex flex-1 flex-col gap-4">
              {history.data.projects.length === 0 && <p className="text-gray-500">아직 만든 앱이 없어요.</p>}
              {history.data.projects.map((p) => (
                <div key={p.id}>
                  <h4 className="mb-2 font-bold">📱 {p.title}</h4>
                  <ol className="flex flex-col gap-2">
                    {p.versions.map((v) => (
                      <li key={v.id} className="rounded-xl bg-gray-50 p-3 text-sm">
                        <div className="flex items-center gap-2">
                          <b className="text-violet-700">v{v.number}</b>
                          <Badge>{KIND_LABEL[v.kind] ?? v.kind}</Badge>
                          <span className="text-xs text-gray-400">{new Date(v.created_at).toLocaleString("ko-KR")}</span>
                          <button
                            className="ml-auto text-xs text-violet-600 underline"
                            onClick={async () => setPreviewHtml((await api<{ html: string }>(`/api/teacher/version?id=${v.id}`)).html)}
                          >
                            실행해 보기
                          </button>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap">{v.prompt_text}</p>
                        {v.summary && <p className="mt-1 whitespace-pre-wrap text-emerald-700">{v.summary}</p>}
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
              {history.data.blocked.length > 0 && (
                <div>
                  <h4 className="mb-2 font-bold text-rose-700">🚫 차단된 프롬프트</h4>
                  {history.data.blocked.map((b, i) => (
                    <p key={i} className="mb-1 rounded-xl bg-rose-50 p-2 text-sm">
                      <span className="text-xs text-gray-400">{timeAgo(b.created_at)}</span> {b.error}
                    </p>
                  ))}
                </div>
              )}
            </div>
            {previewHtml && (
              <div className="h-[60vh] overflow-hidden rounded-2xl ring-1 ring-gray-200 lg:w-[45%]">
                <Preview html={previewHtml} />
              </div>
            )}
          </div>
        )}
      </Modal>
    </Card>
  );
}

/* ── 배포 관리 ───────────────────────────────────── */
function DeployTab({ deployments, reload }: { deployments: Dep[]; reload: () => void }) {
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const pending = deployments.filter((d) => d.pending_version_id);
  const live = deployments.filter((d) => d.version_id);

  const pendingKey = pending.map((d) => d.pending_version_id).join(",");
  useEffect(() => {
    for (const vid of pendingKey.split(",").filter(Boolean)) {
      api<{ html: string }>(`/api/teacher/version?id=${vid}`).then((v) => setPreviews((p) => ({ ...p, [vid]: v.html })));
    }
  }, [pendingKey]);

  async function act(id: string, action: string) {
    await api("/api/teacher/deployments", { method: "PATCH", json: { id, action } });
    reload();
  }

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="mb-3 text-xl font-bold">⏳ 승인 대기 {pending.length}</h2>
        {pending.length === 0 && <p className="text-gray-500">승인을 기다리는 앱이 없어요.</p>}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {pending.map((d) => (
            <Card key={d.id}>
              <div className="flex items-center gap-2">
                <span className="text-3xl">{d.emoji}</span>
                <div>
                  <p className="font-bold">{d.name}</p>
                  <p className="text-sm text-gray-500">{d.projects.students.classes.name} · {d.projects.students.name} · {timeAgo(d.updated_at)}</p>
                </div>
              </div>
              <p className="mt-2 text-sm">{d.description}</p>
              <div className="mt-3 h-80 overflow-hidden rounded-2xl ring-1 ring-gray-200">
                {previews[d.pending_version_id!] ? <Preview html={previews[d.pending_version_id!]} /> : <p className="p-4 text-gray-400">불러오는 중…</p>}
              </div>
              <div className="mt-3 flex gap-2">
                <Button variant="success" className="flex-1" onClick={() => act(d.id, "approve")}>✅ 승인</Button>
                <Button variant="danger" className="flex-1" onClick={() => act(d.id, "reject")}>반려</Button>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-bold">🌐 공개된 앱 {live.length}</h2>
        <Card>
          <table className="w-full text-left text-sm">
            <tbody>
              {live.map((d) => (
                <tr key={d.id} className="border-t first:border-t-0">
                  <td className="py-2 text-2xl">{d.emoji}</td>
                  <td>
                    <p className="font-semibold">{d.name}</p>
                    <p className="text-gray-500">{d.projects.students.classes.name} · {d.projects.students.name}</p>
                  </td>
                  <td>{d.hidden ? <Badge color="gray">숨김</Badge> : <Badge color="emerald">공개</Badge>}</td>
                  <td className="space-x-1 text-right">
                    <a href={`/p/${d.slug}`} target="_blank" rel="noreferrer"><SmallBtn>열기</SmallBtn></a>
                    <SmallBtn onClick={() => act(d.id, d.hidden ? "unhide" : "hide")}>{d.hidden ? "다시 공개" : "숨기기"}</SmallBtn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {live.length === 0 && <p className="text-gray-500">아직 공개된 앱이 없어요.</p>}
        </Card>
      </section>
    </div>
  );
}

/* ── AI 설정·사용량 ──────────────────────────────── */
function SettingsTab({ data, reload }: { data: Overview; reload: () => void }) {
  const [s, setS] = useState<Settings>(data.settings);
  const [saved, setSaved] = useState(false);
  const u = data.usageToday;

  async function save(next: Settings = s) {
    await api("/api/teacher/settings", { method: "PUT", json: next });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    reload();
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <h2 className="mb-3 text-xl font-bold">📊 오늘 사용량</h2>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="성공한 AI 호출" value={u.calls} />
          <Stat label="지금 생성 중" value={u.running} />
          <Stat label="오류(재시도 포함)" value={u.errors} />
          <Stat label="차단된 입력" value={u.blocked} />
          <Stat label="입력 토큰" value={u.tokensIn.toLocaleString()} />
          <Stat label="출력 토큰" value={u.tokensOut.toLocaleString()} />
        </div>
        <p className="mt-3 text-xs text-gray-500">정확한 비용은 OpenAI 대시보드(Usage)에서 확인하세요. 출력 토큰이 입력보다 비쌉니다.</p>
      </Card>

      <Card>
        <h2 className="mb-3 text-xl font-bold">⚙️ AI 설정</h2>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between rounded-2xl bg-gray-50 p-3">
            <div>
              <p className="font-semibold">학생 AI 사용</p>
              <p className="text-sm text-gray-500">수업 시간이 아닐 때 꺼 두면 비용을 아낄 수 있어요.</p>
            </div>
            <Button
              variant={s.enabled ? "success" : "danger"}
              onClick={() => { const next = { ...s, enabled: !s.enabled }; setS(next); save(next); }}
            >
              {s.enabled ? "켜짐" : "꺼짐"}
            </Button>
          </div>
          <label className="flex flex-col gap-1">
            <span className="font-semibold">모델 이름</span>
            <input value={s.model} onChange={(e) => setS({ ...s, model: e.target.value })} className="h-11 rounded-xl border-2 border-gray-200 px-3 font-mono" />
            <span className="text-xs text-gray-500">OpenAI 모델 ID를 그대로 입력하세요. 수업용으로는 빠르고 저렴한 mini급 모델을 추천해요.</span>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-semibold">추론 강도 (추론 모델일 때만)</span>
            <select value={s.reasoningEffort} onChange={(e) => setS({ ...s, reasoningEffort: e.target.value })} className="h-11 rounded-xl border-2 border-gray-200 px-3">
              <option value="">보내지 않음 (일반 모델)</option>
              <option value="minimal">minimal</option>
              <option value="low">low</option>
              <option value="medium">medium</option>
            </select>
            <span className="text-xs text-gray-500">일반 모델에 이 값을 보내면 오류가 나요. 모델이 지원할 때만 고르세요.</span>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-semibold">학생 1인당 1분 호출 수</span>
            <input type="number" min={1} max={20} value={s.perMinuteLimit} onChange={(e) => setS({ ...s, perMinuteLimit: Number(e.target.value) })} className="h-11 w-24 rounded-xl border-2 border-gray-200 px-3" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-semibold">AI에게 추가로 줄 지시 (선택)</span>
            <textarea
              value={s.extraInstructions}
              onChange={(e) => setS({ ...s, extraInstructions: e.target.value })}
              rows={4}
              placeholder="예) 오늘은 수학 수업이야. 학생 앱에 수학 개념 설명을 한 줄씩 넣어 줘."
              className="rounded-xl border-2 border-gray-200 p-3"
            />
          </label>
          <Button onClick={() => save()}>{saved ? "저장됨 ✓" : "저장"}</Button>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl bg-gray-50 p-3">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-black">{value}</p>
    </div>
  );
}

function SmallBtn(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className="min-h-9 rounded-lg bg-gray-100 px-2 text-xs font-semibold text-gray-700 hover:bg-gray-200" />;
}
