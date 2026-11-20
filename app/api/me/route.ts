import { requireStudent } from "@/lib/auth";
import { handle } from "@/lib/http";
import { countUsage, kstDayStart } from "@/lib/usage";

export const GET = handle(async () => {
  const s = await requireStudent();
  const usedToday = await countUsage(s.id, kstDayStart());
  return Response.json({
    id: s.id,
    name: s.name,
    className: s.classes.name,
    dailyLimit: s.classes.daily_limit,
    usedToday,
  });
});
