"use client";
import { useEffect, useState } from "react";
import { api } from "./api";
import { Button, Card } from "./ui";

export default function Login() {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // 이미 로그인되어 있으면 바로 작업실로
    api("/api/me", { on401: "throw" }).then(() => (window.location.href = "/studio")).catch(() => {});
    try {
      const saved = localStorage.getItem("velo_code");
      if (saved) setCode(saved);
    } catch {}
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/student", { json: { code, name, pin }, on401: "throw" });
      try { localStorage.setItem("velo_code", code.toUpperCase()); } catch {}
      window.location.href = "/studio";
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-gradient-to-br from-violet-100 via-fuchsia-50 to-amber-50 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="text-6xl">🪄</div>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-violet-800">VELO</h1>
          <p className="mt-1 text-lg text-violet-700/80">말로 설명하면 앱이 만들어지는 바이브코딩 교실</p>
        </div>
        <Card className="p-6">
          <form onSubmit={submit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1">
              <span className="font-semibold">학급 코드</span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="칠판에 적힌 6자리 코드"
                className="h-14 rounded-2xl border-2 border-gray-200 px-4 text-center text-2xl font-bold tracking-[0.3em] uppercase focus:border-violet-500 focus:outline-none"
                autoCapitalize="characters"
                autoComplete="off"
                maxLength={8}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-semibold">이름</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예) 3번 김하늘"
                className="h-14 rounded-2xl border-2 border-gray-200 px-4 text-lg focus:border-violet-500 focus:outline-none"
                maxLength={20}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-semibold">PIN 숫자 4자리</span>
              <input
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="처음이면 새로 정해요"
                inputMode="numeric"
                type="password"
                className="h-14 rounded-2xl border-2 border-gray-200 px-4 text-center text-2xl tracking-[0.5em] focus:border-violet-500 focus:outline-none"
              />
              <span className="text-sm text-gray-500">처음 들어오면 지금 입력한 PIN이 내 비밀번호가 돼요. 꼭 기억하세요!</span>
            </label>
            {error && <p className="rounded-xl bg-rose-50 p-3 text-rose-700">{error}</p>}
            <Button type="submit" disabled={busy || !code || !name || pin.length !== 4} className="h-14 text-lg">
              {busy ? "들어가는 중…" : "시작하기 🚀"}
            </Button>
          </form>
        </Card>
        <p className="mt-6 text-center">
          <a href="/teacher" className="text-sm text-gray-500 underline">선생님 관리 화면</a>
        </p>
      </div>
    </main>
  );
}
