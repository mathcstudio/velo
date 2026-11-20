"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { api } from "./api";
import { Badge, Button } from "./ui";
import type { Version } from "./Studio";

export type Deployment = {
  slug: string;
  name: string;
  emoji: string;
  description: string;
  version_id: string | null;
  pending_version_id: string | null;
  hidden: boolean;
};

const EMOJIS = ["✨", "🎮", "🧠", "📚", "🎵", "🍱", "⏰", "🎲", "🌈", "🚀", "🐱", "⚽", "🧪", "🗳️", "🎨", "💡"];
const CHECKS = [
  "직접 3번 이상 눌러 보면서 잘 작동하는지 확인했어요",
  "이름·전화번호 같은 개인정보를 묻지 않아요",
  "친구가 봐도 기분 좋은 내용이에요",
];

export default function DeployPanel({
  projectId,
  defaultName,
  versions,
  currentVersionId,
  deployment,
  onDeployed,
}: {
  projectId: string;
  defaultName: string;
  versions: Version[];
  currentVersionId: string | null;
  deployment: Deployment | null;
  onDeployed: () => void;
}) {
  const [name, setName] = useState(deployment?.name ?? defaultName);
  const [emoji, setEmoji] = useState(deployment?.emoji ?? "✨");
  const [description, setDescription] = useState(deployment?.description ?? "");
  const [checked, setChecked] = useState<boolean[]>(CHECKS.map(() => false));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [qr, setQr] = useState("");
  const [origin, setOrigin] = useState("");

  useEffect(() => setOrigin(window.location.origin), []);
  const url = deployment ? `${origin}/p/${deployment.slug}` : "";
  useEffect(() => {
    if (url) QRCode.toDataURL(url, { width: 360, margin: 1 }).then(setQr).catch(() => {});
  }, [url]);

  const num = (id: string | null) => versions.find((v) => v.id === id)?.number;
  const current = num(currentVersionId);
  const live = deployment?.hidden ? undefined : num(deployment?.version_id ?? null);
  const pending = num(deployment?.pending_version_id ?? null);

  if (!currentVersionId) {
    return <p className="p-4 text-center text-gray-500">먼저 앱을 만들어야 배포할 수 있어요.</p>;
  }

  async function deploy() {
    setBusy(true);
    setError("");
    try {
      const r = await api<{ status: string }>("/api/deploy", { json: { projectId, name, emoji, description } });
      setChecked(CHECKS.map(() => false));
      onDeployed();
      alert(r.status === "pending" ? "배포 신청 완료! 선생님이 승인하면 공개돼요." : "배포 완료! 이제 친구들이 내 앱을 쓸 수 있어요 🎉");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const ready = name.trim() && description.trim() && checked.every(Boolean);

  return (
    <div className="flex flex-col gap-4">
      {deployment && (
        <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-2xl">{deployment.emoji}</span>
            <span className="font-bold">{deployment.name}</span>
            {live && <Badge color="emerald">v{live} 공개 중</Badge>}
            {pending && <Badge color="amber">v{pending} 승인 대기</Badge>}
            {deployment.hidden && <Badge color="gray">선생님이 숨김</Badge>}
          </div>
          {live && (
            <div className="mt-3 flex flex-col items-center gap-2">
              {qr && <img src={qr} alt="앱 주소 QR 코드" className="h-44 w-44 rounded-xl bg-white p-2" />}
              <a href={url} target="_blank" rel="noreferrer" className="break-all text-center font-mono text-sm text-violet-700 underline">
                {url}
              </a>
              <div className="flex gap-2">
                <Button variant="secondary" className="min-h-10 text-sm" onClick={() => navigator.clipboard?.writeText(url)}>주소 복사</Button>
                <a href={url} target="_blank" rel="noreferrer"><Button variant="secondary" className="min-h-10 text-sm">새 창에서 열기</Button></a>
              </div>
              <p className="text-center text-xs text-gray-500">친구 태블릿 카메라로 QR을 찍으면 바로 열려요.</p>
            </div>
          )}
          {live && current && live !== current && !pending && (
            <p className="mt-3 rounded-xl bg-white p-2 text-sm text-amber-800">
              지금 작업 중인 버전은 v{current}이에요. 고친 내용을 공개하려면 아래에서 다시 배포하세요.
            </p>
          )}
        </div>
      )}

      <div className="rounded-2xl bg-violet-50 p-3 text-sm text-violet-800">
        🚀 <b>배포</b>란 내가 만든 앱을 인터넷 주소로 내보내 다른 사람도 쓸 수 있게 하는 거예요.
        지금 버전 <b>v{current}</b>을(를) 배포해요.
      </div>

      <label className="flex flex-col gap-1">
        <span className="font-semibold">앱 이름</span>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} className="h-12 rounded-xl border-2 border-gray-200 px-3 focus:border-violet-500 focus:outline-none" />
      </label>

      <div>
        <span className="font-semibold">아이콘</span>
        <div className="mt-1 grid grid-cols-8 gap-1">
          {EMOJIS.map((e) => (
            <button key={e} onClick={() => setEmoji(e)} className={`h-11 rounded-xl text-2xl ${emoji === e ? "bg-violet-200 ring-2 ring-violet-500" : "bg-gray-50"}`}>{e}</button>
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-1">
        <span className="font-semibold">한 줄 설명</span>
        <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={120} placeholder="예) 우리 반 급식 메뉴를 투표로 정하는 앱" className="h-12 rounded-xl border-2 border-gray-200 px-3 focus:border-violet-500 focus:outline-none" />
      </label>

      <div className="rounded-2xl border-2 border-gray-100 p-3">
        <p className="mb-2 font-semibold">배포 전 체크리스트</p>
        {CHECKS.map((c, i) => (
          <label key={c} className="flex min-h-11 items-center gap-3">
            <input type="checkbox" checked={checked[i]} onChange={(e) => setChecked((s) => s.map((x, j) => (j === i ? e.target.checked : x)))} className="h-6 w-6 accent-violet-600" />
            <span className="text-sm">{c}</span>
          </label>
        ))}
      </div>

      {error && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <Button onClick={deploy} disabled={!ready || busy} variant="success" className="h-14 text-lg">
        {busy ? "배포하는 중…" : deployment ? `🚀 v${current} 다시 배포하기` : "🚀 배포하기"}
      </Button>
    </div>
  );
}
