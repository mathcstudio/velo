import "server-only";
import { db } from "./supabase";

export type AppSettings = {
  enabled: boolean;          // false면 학생 AI 호출 전체 중지 (수업 시간 외 등)
  provider: "openai" | "anthropic"; // 어떤 AI를 쓸지
  // ── GPT (OpenAI) ──
  model: string;             // OpenAI 모델 이름
  reasoningEffort: string;   // 추론 강도: "none" | "low" | "medium" | "high" | "xhigh" ("" = 보내지 않음)
  // ── Claude (Anthropic) ──
  claudeModel: string;       // Claude 모델 이름
  claudeEffort: "low" | "medium" | "high" | "xhigh" | "max"; // 생각 깊이
  // ── 공통 ──
  extraInstructions: string; // 교사가 덧붙이는 AI 지시문
  perMinuteLimit: number;    // 학생 1인당 1분 호출 수
};

/** 키가 하나만 설정되어 있으면 그 AI를 기본으로 */
function defaultProvider(): AppSettings["provider"] {
  const p = process.env.AI_PROVIDER;
  if (p === "openai" || p === "anthropic") return p;
  if (process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) return "anthropic";
  return "openai";
}

export const DEFAULT_SETTINGS: AppSettings = {
  enabled: true,
  provider: defaultProvider(),
  model: process.env.OPENAI_MODEL || "gpt-6-luna",
  // GPT-6 계열은 추론 모델: 추론 토큰도 출력 요금으로 계산되므로 수업용은 low 권장
  reasoningEffort: "low",
  claudeModel: process.env.CLAUDE_MODEL || "claude-opus-5-5",
  // Opus 5.5는 생각을 끌 수 없음. low로 두면 빠르고 토큰을 가장 적게 씀
  claudeEffort: "low",
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
