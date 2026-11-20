"use client";
import { api } from "./api";

export default function TopBar({ title, children }: { title?: React.ReactNode; children?: React.ReactNode }) {
  async function logout() {
    if (!confirm("로그아웃할까요?")) return;
    await api("/api/auth/student", { method: "DELETE" }).catch(() => {});
    window.location.href = "/";
  }
  return (
    <header className="sticky top-0 z-30 flex min-h-16 items-center gap-2 border-b bg-white/90 px-3 backdrop-blur">
      <a href="/studio" className="flex items-center gap-1 rounded-xl px-2 py-2 text-xl font-black text-violet-700">🪄 VELO</a>
      <div className="min-w-0 flex-1 truncate">{title}</div>
      {children}
      <a href="/gallery" className="flex min-h-12 items-center rounded-2xl px-3 font-semibold text-gray-700 hover:bg-gray-100">🖼️ 갤러리</a>
      <button onClick={logout} className="min-h-12 rounded-2xl px-3 text-gray-500 hover:bg-gray-100">나가기</button>
    </header>
  );
}
