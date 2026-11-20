import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/** 서버 전용 Supabase 클라이언트 (service_role 키 사용 — 브라우저로 절대 보내지 않음) */
export function db(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 환경변수가 없습니다.");
  }
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}
