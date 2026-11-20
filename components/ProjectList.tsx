"use client";
import { useEffect, useState } from "react";
import { api } from "./api";
import TopBar from "./TopBar";
import { Badge, Button, Card, timeAgo } from "./ui";

type Project = {
  id: string;
  title: string;
  current_version_id: string | null;
  updated_at: string;
  deployments: { slug: string; emoji: string; version_id: string | null; pending_version_id: string | null; hidden: boolean }[] | { slug: string; emoji: string; version_id: string | null; pending_version_id: string | null; hidden: boolean } | null;
};
type Me = { name: string; className: string; dailyLimit: number; usedToday: number };

export default function ProjectList() {
  const [me, setMe] = useState<Me | null>(null);
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Me>("/api/me").then(setMe).catch(() => {});
    api<{ projects: Project[] }>("/api/projects").then((r) => setProjects(r.projects)).catch(() => {});
  }, []);

  async function create() {
    setBusy(true);
    try {
      const r = await api<{ id: string }>("/api/projects", { json: {} });
      window.location.href = `/studio/${r.id}`;
    } catch (e) {
      alert((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <>
      <TopBar />
      <main className="mx-auto w-full max-w-5xl flex-1 p-4">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-gray-500">{me?.className}</p>
            <h1 className="text-3xl font-black">{me ? `${me.name}의 작업실` : "작업실"}</h1>
            {me && (
              <p className="mt-1 text-sm text-gray-500">
                오늘 AI 사용: {me.usedToday} / {me.dailyLimit}회
              </p>
            )}
          </div>
          <Button onClick={create} disabled={busy} className="h-14 text-lg">＋ 새 앱 만들기</Button>
        </div>

        {projects === null ? (
          <p className="text-gray-500">불러오는 중…</p>
        ) : projects.length === 0 ? (
          <Card className="py-12 text-center">
            <div className="text-5xl">🌱</div>
            <p className="mt-3 text-lg font-semibold">아직 만든 앱이 없어요</p>
            <p className="text-gray-500">‘새 앱 만들기’를 눌러 첫 번째 앱을 만들어 보세요!</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => {
              const d = Array.isArray(p.deployments) ? p.deployments[0] : p.deployments;
              return (
                <a key={p.id} href={`/studio/${p.id}`}>
                  <Card className="h-full transition hover:ring-2 hover:ring-violet-300">
                    <div className="text-4xl">{d?.emoji ?? (p.current_version_id ? "📱" : "📝")}</div>
                    <h2 className="mt-2 truncate text-xl font-bold">{p.title}</h2>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {!p.current_version_id && <Badge color="gray">아직 비어 있음</Badge>}
                      {d?.version_id && !d.hidden && <Badge color="emerald">배포됨</Badge>}
                      {d?.pending_version_id && <Badge color="amber">승인 대기</Badge>}
                    </div>
                    <p className="mt-2 text-sm text-gray-500">{timeAgo(p.updated_at)} 수정</p>
                  </Card>
                </a>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
