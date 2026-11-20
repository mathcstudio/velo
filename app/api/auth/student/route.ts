import { db } from "@/lib/supabase";
import { handle, HttpError, readJson, str, maybe, must, ok } from "@/lib/http";
import { checkPin, clearStudentSession, hashPin, setStudentSession } from "@/lib/session";

const MAX_FAILS = 10;

/** 학생 로그인: 학급 코드 + 이름 + 4자리 PIN. 처음 들어오는 이름이면 자동으로 가입 */
export const POST = handle(async (req: Request) => {
  const body = await readJson(req);
  const code = str(body.code, 12).toUpperCase();
  const name = str(body.name, 20);
  const pin = str(body.pin, 4);
  if (!code || !name) throw new HttpError(400, "학급 코드와 이름을 입력해 주세요.");
  if (!/^\d{4}$/.test(pin)) throw new HttpError(400, "PIN은 숫자 4자리예요.");

  const cls = maybe(await db().from("classes").select("id, name").eq("code", code).maybeSingle());
  if (!cls) throw new HttpError(404, "학급 코드를 다시 확인해 주세요.");

  let student = maybe(
    await db().from("students").select("*").eq("class_id", cls.id).eq("name", name).maybeSingle(),
  );

  if (!student) {
    student = must(
      await db().from("students").insert({ class_id: cls.id, name, pin_hash: hashPin(pin) }).select().single(),
    );
  } else if (!student.pin_hash) {
    // 선생님이 PIN을 초기화한 경우: 이번에 입력한 PIN이 새 PIN
    ok(await db().from("students").update({ pin_hash: hashPin(pin), failed_attempts: 0 }).eq("id", student.id));
  } else {
    if (student.failed_attempts >= MAX_FAILS) {
      throw new HttpError(423, "PIN을 너무 많이 틀렸어요. 선생님께 PIN 초기화를 부탁하세요.");
    }
    if (!checkPin(pin, student.pin_hash)) {
      await db().from("students").update({ failed_attempts: student.failed_attempts + 1 }).eq("id", student.id);
      throw new HttpError(401, `PIN이 맞지 않아요. (${student.failed_attempts + 1}/${MAX_FAILS})`);
    }
    if (student.failed_attempts > 0) {
      await db().from("students").update({ failed_attempts: 0 }).eq("id", student.id);
    }
  }
  if (student.blocked) throw new HttpError(403, "선생님이 잠시 사용을 멈춰 두었어요.");

  await setStudentSession(student.id, cls.id);
  return Response.json({ ok: true, name, className: cls.name });
});

export const DELETE = handle(async () => {
  await clearStudentSession();
  return Response.json({ ok: true });
});
