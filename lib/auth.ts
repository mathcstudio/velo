import "server-only";
import { db } from "./supabase";
import { HttpError, maybe, must } from "./http";
import { getStudentSession, getTeacherSession } from "./session";

export type Student = {
  id: string;
  class_id: string;
  name: string;
  blocked: boolean;
  classes: { id: string; code: string; name: string; require_approval: boolean; daily_limit: number };
};

/** 로그인한 학생 정보를 가져오고, 없으면 401 */
export async function requireStudent(): Promise<Student> {
  const s = await getStudentSession();
  if (!s) throw new HttpError(401, "로그인이 필요해요.");
  const row = maybe(
    await db()
      .from("students")
      .select("id, class_id, name, blocked, classes(id, code, name, require_approval, daily_limit)")
      .eq("id", s.sid)
      .maybeSingle(),
  ) as unknown as Student | null;
  if (!row) throw new HttpError(401, "로그인이 필요해요.");
  if (row.blocked) throw new HttpError(403, "선생님이 잠시 사용을 멈춰 두었어요.");
  return row;
}

export async function requireTeacher() {
  if (!(await getTeacherSession())) throw new HttpError(401, "교사 로그인이 필요해요.");
}

/** 학생 본인의 프로젝트인지 확인 */
export async function requireOwnProject(studentId: string, projectId: string) {
  const p = maybe(
    await db().from("projects").select("*").eq("id", projectId).eq("student_id", studentId).maybeSingle(),
  );
  if (!p) throw new HttpError(404, "프로젝트를 찾을 수 없어요.");
  return p as { id: string; title: string; current_version_id: string | null; student_id: string };
}
