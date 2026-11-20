import "server-only";
import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export type StudentSession = { role: "student"; sid: string; cid: string; exp: number };
export type TeacherSession = { role: "teacher"; exp: number };

const STUDENT_COOKIE = "velo_s";
const TEACHER_COOKIE = "velo_t";

function secret(): Buffer {
  const s = process.env.SESSION_SECRET;
  if (s) return Buffer.from(s);
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!k) throw new Error("SESSION_SECRET 또는 SUPABASE_SERVICE_ROLE_KEY가 필요합니다.");
  return createHash("sha256").update("velo-session:" + k).digest();
}

function sign(payload: object): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${mac}`;
}

function verify<T extends { exp: number }>(token: string | undefined): T | null {
  if (!token) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = createHmac("sha256", secret()).update(body).digest();
  const given = Buffer.from(mac, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as T;
    return p.exp > Date.now() ? p : null;
  } catch {
    return null;
  }
}

const cookieOpts = (maxAgeSec: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: maxAgeSec,
});

export async function setStudentSession(sid: string, cid: string) {
  const days = 30;
  const token = sign({ role: "student", sid, cid, exp: Date.now() + days * 864e5 });
  (await cookies()).set(STUDENT_COOKIE, token, cookieOpts(days * 86400));
}

export async function setTeacherSession() {
  const hours = 12;
  const token = sign({ role: "teacher", exp: Date.now() + hours * 36e5 });
  (await cookies()).set(TEACHER_COOKIE, token, cookieOpts(hours * 3600));
}

export async function getStudentSession() {
  const s = verify<StudentSession>((await cookies()).get(STUDENT_COOKIE)?.value);
  return s?.role === "student" ? s : null;
}

export async function getTeacherSession() {
  const s = verify<TeacherSession>((await cookies()).get(TEACHER_COOKIE)?.value);
  return s?.role === "teacher" ? s : null;
}

export async function clearStudentSession() {
  (await cookies()).delete(STUDENT_COOKIE);
}
export async function clearTeacherSession() {
  (await cookies()).delete(TEACHER_COOKIE);
}

/* ── PIN / 비밀번호 ── */
export function hashPin(pin: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(pin, salt, 32);
  return `${salt.toString("base64url")}.${hash.toString("base64url")}`;
}

export function checkPin(pin: string, stored: string): boolean {
  const [s, h] = stored.split(".");
  if (!s || !h) return false;
  const hash = scryptSync(pin, Buffer.from(s, "base64url"), 32);
  const expected = Buffer.from(h, "base64url");
  return hash.length === expected.length && timingSafeEqual(hash, expected);
}

export function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** 헷갈리는 글자(0/O, 1/I/L)를 뺀 무작위 코드 */
export function randomCode(len: number): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += chars[bytes[i] % chars.length];
  return out;
}
