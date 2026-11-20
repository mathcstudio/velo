import { handle, HttpError, readJson, str } from "@/lib/http";
import { clearTeacherSession, safeEqual, setTeacherSession } from "@/lib/session";

export const POST = handle(async (req: Request) => {
  const body = await readJson(req);
  const password = str(body.password, 200);
  const expected = process.env.TEACHER_PASSWORD;
  if (!expected) throw new HttpError(500, "TEACHER_PASSWORD 환경변수가 설정되지 않았어요.");
  if (!password || !safeEqual(password, expected)) {
    await new Promise((r) => setTimeout(r, 800)); // 무차별 대입 속도 늦추기
    throw new HttpError(401, "비밀번호가 맞지 않아요.");
  }
  await setTeacherSession();
  return Response.json({ ok: true });
});

export const DELETE = handle(async () => {
  await clearTeacherSession();
  return Response.json({ ok: true });
});
