/**
 * Task distribution utility.
 * Distributes a task's total hours across multiple work days,
 * respecting daily work hours, weekend days, holidays, and per-day overrides.
 */

export interface TaskSegment {
  /** 0-indexed day offset from project/reference start date */
  dayOffset: number;
  /** Actual date for this segment */
  date: Date;
  /** Start hour within the day (e.g. 9.0 = 09:00, 13.5 = 13:30) */
  startHour: number;
  /** End hour within the day */
  endHour: number;
  /** Hours worked in this segment */
  hours: number;
}

export interface DistributeTaskParams {
  /** Total hours to distribute */
  totalHours: number;
  /** Starting date */
  startDate: Date;
  /** Hour to start work within the starting day (e.g. 9.0). If null, uses workStartHour */
  startHour?: number;
  /** Daily work capacity in hours */
  dailyWorkHours: number;
  /** Hour the workday begins (e.g. 9 for 09:00) */
  workStartHour: number;
  /** Weekend days (0=Sunday, 6=Saturday) */
  weekendDays: number[];
  /** Holiday dates as ISO strings (yyyy-MM-dd) */
  holidays: string[];
  /** Per-day overrides: dateKey (yyyy-MM-dd) -> hours allocated that day */
  overrides?: Map<string, { startHour: number; hours: number }>;
}

export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isWorkDay(date: Date, weekendDays: number[], holidaySet: Set<string>): boolean {
  if (weekendDays.includes(date.getDay())) return false;
  if (holidaySet.has(toDateKey(date))) return false;
  return true;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Get the next work day on or after the given date */
export function nextWorkDay(date: Date, weekendDays: number[], holidaySet: Set<string>): Date {
  let d = new Date(date);
  while (!isWorkDay(d, weekendDays, holidaySet)) {
    d = addDays(d, 1);
  }
  return d;
}

/**
 * Distribute a task across work days, respecting per-day overrides.
 * If overrides exist for specific days, those days use the override hours.
 * Remaining hours are distributed normally across subsequent days.
 * Total hours is always preserved.
 */
export function distributeTask(params: DistributeTaskParams): TaskSegment[] {
  const {
    totalHours,
    startDate,
    startHour,
    dailyWorkHours,
    workStartHour,
    weekendDays,
    holidays,
    overrides,
  } = params;

  if (totalHours <= 0) return [];

  const holidaySet = new Set(holidays);
  const segments: TaskSegment[] = [];
  let remaining = totalHours;
  let currentDate = nextWorkDay(new Date(startDate), weekendDays, holidaySet);
  let currentStartHour = startHour ?? workStartHour;
  const workEndHour = workStartHour + dailyWorkHours;
  let isFirstDay = true;

  const refDate = new Date(startDate);
  refDate.setHours(0, 0, 0, 0);

  while (remaining > 0.01) {
    const dateKey = toDateKey(currentDate);
    const override = overrides?.get(dateKey);

    let hoursThisDay: number;
    let segStartHour: number;

    if (override) {
      // Use override: exact hours for this day (capped at remaining)
      hoursThisDay = Math.min(override.hours, remaining);
      segStartHour = override.startHour;
    } else {
      // Default distribution
      segStartHour = isFirstDay ? currentStartHour : workStartHour;
      const availableInDay = Math.max(0, workEndHour - segStartHour);
      if (availableInDay <= 0) {
        currentDate = nextWorkDay(addDays(currentDate, 1), weekendDays, holidaySet);
        currentStartHour = workStartHour;
        isFirstDay = false;
        continue;
      }
      hoursThisDay = Math.min(remaining, availableInDay);
    }

    if (hoursThisDay > 0.01) {
      const dateForSegment = new Date(currentDate);
      dateForSegment.setHours(0, 0, 0, 0);

      const diffMs = dateForSegment.getTime() - refDate.getTime();
      const dayOffset = Math.round(diffMs / (1000 * 60 * 60 * 24));

      segments.push({
        dayOffset,
        date: new Date(dateForSegment),
        startHour: segStartHour,
        endHour: segStartHour + hoursThisDay,
        hours: hoursThisDay,
      });

      remaining -= hoursThisDay;
    }

    currentDate = nextWorkDay(addDays(currentDate, 1), weekendDays, holidaySet);
    currentStartHour = workStartHour;
    isFirstDay = false;
  }

  return segments;
}

/**
 * Find the first available slot for a task given existing task segments on the assignee's calendar.
 */
export interface ExistingSlot {
  date: Date;
  startHour: number;
  endHour: number;
}

export function findFirstAvailableSlot(params: {
  totalHours: number;
  searchStartDate: Date;
  dailyWorkHours: number;
  workStartHour: number;
  weekendDays: number[];
  holidays: string[];
  existingSlots: ExistingSlot[];
}): { startDate: Date; startHour: number } {
  const {
    totalHours,
    searchStartDate,
    dailyWorkHours,
    workStartHour,
    weekendDays,
    holidays,
  } = params;

  const holidaySet = new Set(holidays);
  let currentDate = nextWorkDay(new Date(searchStartDate), weekendDays, holidaySet);
  const workEndHour = workStartHour + dailyWorkHours;

  const slotsByDate = new Map<string, ExistingSlot[]>();
  for (const slot of params.existingSlots) {
    const key = toDateKey(slot.date);
    if (!slotsByDate.has(key)) slotsByDate.set(key, []);
    slotsByDate.get(key)!.push(slot);
  }

  const maxDaysToSearch = 365;
  for (let i = 0; i < maxDaysToSearch; i++) {
    const dateKey = toDateKey(currentDate);
    const daySlots = (slotsByDate.get(dateKey) || []).sort((a, b) => a.startHour - b.startHour);

    let cursor = workStartHour;
    for (const slot of daySlots) {
      if (slot.startHour > cursor) {
        const gapHours = slot.startHour - cursor;
        if (gapHours >= Math.min(totalHours, dailyWorkHours)) {
          return { startDate: new Date(currentDate), startHour: cursor };
        }
      }
      cursor = Math.max(cursor, slot.endHour);
    }

    if (cursor < workEndHour) {
      const remainingHours = workEndHour - cursor;
      if (remainingHours > 0) {
        return { startDate: new Date(currentDate), startHour: cursor };
      }
    }

    currentDate = nextWorkDay(addDays(currentDate, 1), weekendDays, holidaySet);
  }

  return { startDate: new Date(searchStartDate), startHour: workStartHour };
}

/**
 * Convert hours to a human-readable string relative to daily work hours.
 */
export function formatHoursDuration(hours: number, dailyWorkHours: number): string {
  if (hours <= 0) return "0h";
  const days = hours / dailyWorkHours;
  if (days === Math.floor(days) && days >= 1) {
    return `${hours}h (${days} dia${days > 1 ? "s" : ""})`;
  }
  if (hours > dailyWorkHours) {
    return `${hours}h (~${days.toFixed(1)} dias)`;
  }
  return `${hours}h`;
}
