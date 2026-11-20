"use client";
import { useEffect, useState } from "react";
import { api } from "./api";
import TopBar from "./TopBar";
import { Button, Card, Modal, timeAgo } from "./ui";

type App = {
  id: string; slug: string; name: string; emoji: string; description: string; updatedAt: string;
  author: string; mine: boolean; likes: number; liked: boolean; feedbackCount: number;
};
type Fb = { id: string; message: string; createdAt: string; author: string };

export default function Gallery() {
  const [apps, setApps] = useState<App[] | null>(null);
  const [className, setClassName] = useState("");
  const [open, setOpen] = useState<App | null>(null);
  const [feedback, setFeedback] = useState<Fb[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const r = await api<{ apps: App[]; className: string }>("/api/gallery");
    setApps(r.apps);
    setClassName(r.className);
    return r.apps;
  }
  useEffect(() => { load().catch(() => {}); }, []);

  async function openApp(a: App) {
    setOpen(a);
    setError("");
    setFeedback([]);
    const r = await api<{ feedback: Fb[] }>(`/api/gallery/${a.id}`);
    setFeedback(r.feedback);
  }

  async function toggleLike(a: App) {
    await api(`/api/gallery/${a.id}`, { json: { like: !a.liked } });
    const list = await load();
    if (open) setOpen(list.find((x) => x.id === open.id) ?? null);
  }

  async function sendFeedback() {
    if (!open) return;
    setError("");
    try {
      await api(`/api/gallery/${open.id}`, { json: { message } });
      setMessage("");
      const r = await api<{ feedback: Fb[] }>(`/api/gallery/${open.id}`);
      setFeedback(r.feedback);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <>
      <TopBar />
      <main className="mx-auto w-full max-w-6xl flex-1 p-4">
        <p className="text-gray-500">{className}</p>
        <h1 className="mb-4 text-3xl font-black">🖼️ 우리 반 앱 갤러리</h1>
        {apps === null ? (
          <p className="text-gray-500">불러오는 중…</p>
        ) : apps.length === 0 ? (
          <Card className="py-12 text-center">
            <div className="text-5xl">🌟</div>
            <p className="mt-3 text-lg font-semibold">아직 배포된 앱이 없어요</p>
            <p className="text-gray-500">첫 번째로 배포해 보세요!</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {apps.map((a) => (
              <Card key={a.id} className={`flex flex-col ${a.mine ? "ring-2 ring-violet-300" : ""}`}>
                <button onClick={() => openApp(a)} className="flex-1 text-left">
                  <div className="text-5xl">{a.emoji}</div>
                  <h2 className="mt-2 text-xl font-bold">{a.name}</h2>
                  <p className="text-sm text-gray-500">{a.author}{a.mine && " (나)"} · {timeAgo(a.updatedAt)}</p>
                  <p className="mt-2 text-gray-700">{a.description}</p>
                </button>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => toggleLike(a)} className={`min-h-11 rounded-xl px-3 font-semibold ${a.liked ? "bg-rose-100 text-rose-600" : "bg-gray-100 text-gray-600"}`}>
                    {a.liked ? "❤️" : "🤍"} {a.likes}
                  </button>
                  <button onClick={() => openApp(a)} className="min-h-11 rounded-xl bg-gray-100 px-3 font-semibold text-gray-600">💬 {a.feedbackCount}</button>
                  <Button onClick={() => openApp(a)} className="ml-auto min-h-11 text-sm">써 보기 ▶</Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      <Modal open={!!open} onClose={() => setOpen(null)} title={open ? `${open.emoji} ${open.name} · ${open.author}` : ""} wide>
        {open && (
          <div className="flex flex-col gap-4 lg:flex-row">
            <div className="h-[60vh] flex-1 overflow-hidden rounded-2xl ring-1 ring-gray-200">
              <iframe src={`/p/${open.slug}`} sandbox="allow-scripts allow-modals allow-forms allow-popups" className="h-full w-full border-0" title={open.name} />
            </div>
            <div className="flex w-full flex-col gap-3 lg:w-80">
              <button onClick={() => toggleLike(open)} className={`min-h-12 rounded-2xl font-semibold ${open.liked ? "bg-rose-100 text-rose-600" : "bg-gray-100 text-gray-600"}`}>
                {open.liked ? "❤️ 좋아요 취소" : "🤍 좋아요"} {open.likes}
              </button>
              <div className="rounded-2xl bg-violet-50 p-3">
                <p className="mb-2 text-sm font-semibold text-violet-800">💬 피드백 남기기 — 좋은 점 하나, 바라는 점 하나!</p>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={200}
                  rows={3}
                  placeholder="예) 버튼 소리가 재밌어요! 점수판이 더 컸으면 좋겠어요."
                  className="w-full rounded-xl bg-white p-2 focus:outline-none"
                />
                {error && <p className="mt-1 text-sm text-rose-600">{error}</p>}
                <Button onClick={sendFeedback} disabled={message.trim().length < 2} className="mt-2 w-full">보내기</Button>
              </div>
              <ul className="flex max-h-72 flex-col gap-2 overflow-auto">
                {feedback.map((f) => (
                  <li key={f.id} className="rounded-xl bg-gray-50 p-2 text-sm">
                    <span className="font-semibold">{f.author}</span> <span className="text-xs text-gray-400">{timeAgo(f.createdAt)}</span>
                    <p>{f.message}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
