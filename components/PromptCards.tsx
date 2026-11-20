"use client";
import { useState } from "react";
import type { CardDef } from "@/lib/prompts";

type SR = { lang: string; interimResults: boolean; onresult: (e: { results: { 0: { transcript: string } }[] }) => void; onend: () => void; onerror: () => void; start: () => void; stop: () => void };

function getRecognizer(): SR | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
  const C = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return C ? new C() : null;
}

/** 프롬프트 카드 묶음: 질문 + 입력칸 + 예시 칩 + 음성 입력 */
export default function PromptCards<K extends string>({
  cards,
  values,
  onChange,
  disabled,
}: {
  cards: CardDef<K>[];
  values: Record<K, string>;
  onChange: (key: K, value: string) => void;
  disabled?: boolean;
}) {
  const [listening, setListening] = useState<K | null>(null);

  function append(key: K, text: string) {
    const cur = values[key] ?? "";
    onChange(key, cur ? `${cur.replace(/\s+$/, "")} ${text}` : text);
  }

  function mic(key: K) {
    const r = getRecognizer();
    if (!r) {
      alert("이 기기에서는 음성 입력을 쓸 수 없어요. 키보드의 🎤 버튼을 써 보세요.");
      return;
    }
    r.lang = "ko-KR";
    r.interimResults = false;
    r.onresult = (e) => append(key, e.results[0][0].transcript);
    r.onend = () => setListening(null);
    r.onerror = () => setListening(null);
    setListening(key);
    r.start();
  }

  return (
    <div className="flex flex-col gap-3">
      {cards.map((c) => {
        const v = values[c.key] ?? "";
        const short = v.trim().length > 0 && v.trim().length < c.minLength;
        return (
          <div key={c.key} className="rounded-2xl border-2 border-violet-100 bg-white p-3 focus-within:border-violet-400">
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-600 font-black text-white">{c.letter}</span>
              <span className="font-bold">{c.title}</span>
              {!c.required && <span className="text-xs text-gray-400">선택</span>}
              <span className="ml-1 truncate text-sm text-gray-500">{c.question}</span>
            </div>
            <div className="flex gap-2">
              <textarea
                value={v}
                onChange={(e) => onChange(c.key, e.target.value)}
                placeholder={c.placeholder}
                rows={2}
                disabled={disabled}
                maxLength={600}
                className="min-h-16 flex-1 resize-y rounded-xl bg-gray-50 p-3 leading-relaxed focus:outline-none disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => mic(c.key)}
                disabled={disabled}
                className={`h-12 w-12 shrink-0 self-start rounded-xl text-xl ${listening === c.key ? "animate-pulse bg-rose-500 text-white" : "bg-gray-100 hover:bg-gray-200"}`}
                aria-label="말로 입력하기"
              >
                🎤
              </button>
            </div>
            {c.chips.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {c.chips.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    disabled={disabled}
                    onClick={() => append(c.key, chip)}
                    className="min-h-9 rounded-full bg-violet-50 px-3 text-sm text-violet-700 hover:bg-violet-100"
                  >
                    + {chip}
                  </button>
                ))}
              </div>
            )}
            {short && c.hint && <p className="mt-2 text-sm text-amber-700">💡 {c.hint}</p>}
          </div>
        );
      })}
    </div>
  );
}
