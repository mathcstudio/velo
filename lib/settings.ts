import "server-only";
import { db } from "./supabase";

export type AppSettings = {
  enabled: boolean;          // false면 학생 AI 호출 전체 중지 (수업 시간 외 등)
  model: string;             // OpenAI 모델 이름
  reasoningEffort: string;   // 추론 모델일 때만: "", "minimal", "low" ...
  extraInstructions: string; // 교사가 덧붙이는 AI 지시문
  perMinuteLimit: number;    // 학생 1인당 1분 호출 수
};

export const DEFAULT_SETTINGS: AppSettings = {
  enabled: true,
  model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
  reasoningEffort: "",
  extraInstructions: "",
  perMinuteLimit: 3,
};

export async function getSettings(): Promise<AppSettings> {
  const { data } = await db().from("settings").select("value").eq("key", "app").maybeSingle();
  return { ...DEFAULT_SETTINGS, ...((data?.value as Partial<AppSettings>) ?? {}) };
}

export async function saveSettings(s: AppSettings) {
  const { error } = await db().from("settings").upsert({ key: "app", value: s });
  if (error) throw new Error(error.message);
}
