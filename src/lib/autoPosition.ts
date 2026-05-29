/**
 * Auto-position a task in the first available slots on an assignee's schedule.
 * Distributes hours into real free gaps, respecting existing tasks + their overrides.
 * Returns overrides for EVERY work day between first and last allocated day
 * (including hours:0 for fully occupied days) so distributeTask() knows to skip them.
 */

import { supabase } from "@/integrations/supabase/client";
import { distributeTask, toDateKey, nextWorkDay } from "./taskDistribution";

export interface AutoPositionParams {
  taskId: string;
  totalHours: number;
  assigneeId: string;
  dailyWorkHours: number;
  workStartHour: number;
  weekendDays: number[];
  holidays: string[];
}

export interface ScheduleSlot {
  work_date: string;
  start_hour: number;
  hours: number;
}

export interface AutoPositionResult {
  startDate: Date;
  startHour: number;
  dueDateStr: string;
  overrides: ScheduleSlot[];
}

/**
 * Build per-day occupation from assignee's tasks, including their DB overrides.
 */
async function buildOccupationMap(
  assigneeId: string,
  excludeTaskId: string,
  dailyWorkHours: number,
  workStartHour: number,
  weekendDays: number[],
  holidays: string[],
): Promise<Map<string, { startHour: number; endHour: number }[]>> {
  const { data: assigneeTasks } = await supabase
    .from("tasks")
    .select("id, due_date, created_at, duration_hours, position_hour")
    .eq("assignee_id", assigneeId)
    .eq("is_done", false)
    .eq("is_archived", false);

  const tasks = (assigneeTasks || []) as {
    id: string; due_date: string | null; created_at: string;
    duration_hours: number | null; position_hour: number | null;
  }[];

  const taskIds = tasks.filter(t => t.id !== excludeTaskId).map(t => t.id);

  // Fetch existing overrides for all these tasks
  const overridesMap = new Map<string, Map<string, { startHour: number; hours: number }>>();
  if (taskIds.length > 0) {
    const { data: dbOverrides } = await supabase
      .from("task_schedule_overrides" as any)
      .select("*")
      .in("task_id", taskIds);

    for (const o of ((dbOverrides || []) as unknown as { task_id: string; work_date: string; start_hour: number; hours: number }[])) {
      if (!overridesMap.has(o.task_id)) overridesMap.set(o.task_id, new Map());
      overridesMap.get(o.task_id)!.set(o.work_date, { startHour: o.start_hour, hours: o.hours });
    }
  }

  // Distribute each existing task WITH its overrides to get real segments
  const occupation = new Map<string, { startHour: number; endHour: number }[]>();

  for (const task of tasks) {
    if (task.id === excludeTaskId) continue;
    const hours = task.duration_hours || dailyWorkHours;
    if (hours <= 0) continue;

    const startDate = task.due_date
      ? new Date(task.due_date + "T00:00:00")
      : new Date(task.created_at);

    const segments = distributeTask({
      totalHours: hours,
      startDate,
      startHour: task.position_hour ?? workStartHour,
      dailyWorkHours,
      workStartHour,
      weekendDays,
      holidays,
      overrides: overridesMap.get(task.id),
    });

    for (const seg of segments) {
      const key = toDateKey(seg.date);
      if (!occupation.has(key)) occupation.set(key, []);
      occupation.get(key)!.push({ startHour: seg.startHour, endHour: seg.endHour });
    }
  }

  return occupation;
}

/**
 * Find the largest single free gap in a day.
 * Returns null if no gap available.
 * (We use the FIRST gap, not the largest, to pack tasks sequentially.)
 */
function findFirstFreeGap(
  occupiedSlots: { startHour: number; endHour: number }[],
  workStartHour: number,
  workEndHour: number,
): { startHour: number; hours: number } | null {
  const sorted = [...occupiedSlots].sort((a, b) => a.startHour - b.startHour);
  let cursor = workStartHour;

  for (const slot of sorted) {
    if (slot.startHour > cursor) {
      const gapHours = Math.min(slot.startHour, workEndHour) - cursor;
      if (gapHours > 0.01) return { startHour: cursor, hours: gapHours };
    }
    cursor = Math.max(cursor, slot.endHour);
  }

  if (cursor < workEndHour) {
    return { startHour: cursor, hours: workEndHour - cursor };
  }

  return null;
}

function addDaysLocal(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export async function autoPositionTask(params: AutoPositionParams): Promise<AutoPositionResult> {
  const {
    taskId, totalHours, assigneeId,
    dailyWorkHours, workStartHour, weekendDays, holidays,
  } = params;

  const empty: AutoPositionResult = {
    startDate: new Date(), startHour: workStartHour,
    dueDateStr: toDateKey(new Date()), overrides: [],
  };

  if (totalHours <= 0) return empty;

  const holidaySet = new Set(holidays);
  const workEndHour = workStartHour + dailyWorkHours;

  const occupation = await buildOccupationMap(
    assigneeId, taskId, dailyWorkHours, workStartHour, weekendDays, holidays,
  );

  // Walk forward day by day, allocating into the first free gap per day.
  // Constraint: UNIQUE(task_id, work_date) → max 1 slot per day.
  let remaining = totalHours;
  let firstDate: Date | null = null;
  let firstHour: number | null = null;
  let lastAllocatedDate: Date | null = null;

  // Collect allocated days: dateKey → { start_hour, hours }
  const allocated = new Map<string, { start_hour: number; hours: number }>();

  let currentDate = nextWorkDay(new Date(), weekendDays, holidaySet);

  for (let i = 0; i < 365 && remaining > 0.01; i++) {
    const key = toDateKey(currentDate);
    const daySlots = occupation.get(key) || [];
    const gap = findFirstFreeGap(daySlots, workStartHour, workEndHour);

    if (gap && gap.hours > 0.01) {
      const allocate = Math.min(gap.hours, remaining);

      if (!firstDate) {
        firstDate = new Date(currentDate);
        firstHour = gap.startHour;
      }
      lastAllocatedDate = new Date(currentDate);

      allocated.set(key, { start_hour: gap.startHour, hours: allocate });
      remaining -= allocate;
    }

    currentDate = nextWorkDay(addDaysLocal(currentDate, 1), weekendDays, holidaySet);
  }

  if (!firstDate || !lastAllocatedDate) return empty;

  // Build overrides for ALL work days between first and last allocated day.
  // Days with allocation get their hours; days without get hours:0 (skip signal).
  const overrides: ScheduleSlot[] = [];
  let walkDate = nextWorkDay(new Date(firstDate), weekendDays, holidaySet);
  const lastKey = toDateKey(lastAllocatedDate);

  for (let i = 0; i < 365; i++) {
    const key = toDateKey(walkDate);
    const alloc = allocated.get(key);

    overrides.push({
      work_date: key,
      start_hour: alloc?.start_hour ?? workStartHour,
      hours: alloc?.hours ?? 0,
    });

    if (key >= lastKey) break;
    walkDate = nextWorkDay(addDaysLocal(walkDate, 1), weekendDays, holidaySet);
  }

  return {
    startDate: firstDate,
    startHour: firstHour ?? workStartHour,
    dueDateStr: toDateKey(firstDate),
    overrides,
  };
}
