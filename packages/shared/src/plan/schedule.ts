/**
 * Pure study-plan scheduling (BUILD_BRIEF §M7). Given chapters (already ordered
 * by priority — weak areas first), an exam date, and daily study minutes, it
 * spreads chapters across the available days respecting the daily budget.
 */

export interface PlanChapterInput {
  chapterId: string;
  /** Estimated minutes to study this chapter. */
  minutes: number;
}

export interface PlanItem {
  chapterId: string;
  /** ISO date (YYYY-MM-DD) the chapter is scheduled for. */
  date: string;
  minutes: number;
}

export interface ScheduleOptions {
  examDate: Date;
  dailyMinutes: number;
  now?: Date;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function buildStudySchedule(
  chapters: PlanChapterInput[],
  options: ScheduleOptions,
): PlanItem[] {
  const now = options.now ?? new Date();
  const start = new Date(isoDate(now));
  const exam = new Date(isoDate(options.examDate));
  const msPerDay = 24 * 3600 * 1000;
  const totalDays = Math.max(1, Math.round((exam.getTime() - start.getTime()) / msPerDay));
  const dailyBudget = Math.max(15, options.dailyMinutes);

  const items: PlanItem[] = [];
  let day = 0;
  let usedToday = 0;

  for (const chapter of chapters) {
    // Move to the next day if this chapter doesn't fit and the day isn't empty.
    if (usedToday > 0 && usedToday + chapter.minutes > dailyBudget) {
      day += 1;
      usedToday = 0;
    }
    // Don't schedule past the exam day; wrap onto the last day instead.
    const scheduledDay = Math.min(day, totalDays - 1);
    const date = new Date(start.getTime() + scheduledDay * msPerDay);
    items.push({ chapterId: chapter.chapterId, date: isoDate(date), minutes: chapter.minutes });
    usedToday += chapter.minutes;
  }
  return items;
}
