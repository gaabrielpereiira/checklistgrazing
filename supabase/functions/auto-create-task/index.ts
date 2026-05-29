import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── helpers ──────────────────────────────────────────────────────────
function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function isWorkDay(
  d: Date,
  weekendDays: number[],
  holidaySet: Set<string>,
): boolean {
  return !weekendDays.includes(d.getDay()) && !holidaySet.has(toDateKey(d));
}

function nextWorkDay(
  d: Date,
  weekendDays: number[],
  holidaySet: Set<string>,
): Date {
  let cur = new Date(d);
  while (!isWorkDay(cur, weekendDays, holidaySet)) cur = addDays(cur, 1);
  return cur;
}

// ── distribute a single task into day segments ──────────────────────
interface Segment {
  dateKey: string;
  startHour: number;
  endHour: number;
  hours: number;
}

function distributeTask(p: {
  totalHours: number;
  startDate: Date;
  startHour: number;
  dailyWorkHours: number;
  workStartHour: number;
  weekendDays: number[];
  holidaySet: Set<string>;
  overrides?: Map<string, { startHour: number; hours: number }>;
}): Segment[] {
  const {
    totalHours, startDate, startHour, dailyWorkHours,
    workStartHour, weekendDays, holidaySet, overrides,
  } = p;
  if (totalHours <= 0) return [];

  const segs: Segment[] = [];
  let remaining = totalHours;
  let cur = nextWorkDay(new Date(startDate), weekendDays, holidaySet);
  let curStart = startHour;
  const workEnd = workStartHour + dailyWorkHours;
  let first = true;

  while (remaining > 0.01) {
    const key = toDateKey(cur);
    const ov = overrides?.get(key);
    let hrs: number;
    let segStart: number;

    if (ov) {
      hrs = Math.min(ov.hours, remaining);
      segStart = ov.startHour;
    } else {
      segStart = first ? curStart : workStartHour;
      const avail = Math.max(0, workEnd - segStart);
      if (avail <= 0) {
        cur = nextWorkDay(addDays(cur, 1), weekendDays, holidaySet);
        curStart = workStartHour;
        first = false;
        continue;
      }
      hrs = Math.min(remaining, avail);
    }

    if (hrs > 0.01) {
      segs.push({ dateKey: key, startHour: segStart, endHour: segStart + hrs, hours: hrs });
      remaining -= hrs;
    }

    cur = nextWorkDay(addDays(cur, 1), weekendDays, holidaySet);
    curStart = workStartHour;
    first = false;
  }
  return segs;
}

// ── build occupation map ────────────────────────────────────────────
async function buildOccupation(
  supabase: any,
  assigneeId: string,
  excludeTaskId: string | null,
  dailyWorkHours: number,
  workStartHour: number,
  weekendDays: number[],
  holidaySet: Set<string>,
): Promise<Map<string, { startHour: number; endHour: number }[]>> {
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, due_date, created_at, duration_hours, position_hour")
    .eq("assignee_id", assigneeId)
    .eq("is_done", false)
    .eq("is_archived", false);

  const taskRows = (tasks || []) as {
    id: string; due_date: string | null; created_at: string;
    duration_hours: number | null; position_hour: number | null;
  }[];

  const ids = taskRows.filter((t) => t.id !== excludeTaskId).map((t) => t.id);

  // fetch overrides for these tasks
  const ovMap = new Map<string, Map<string, { startHour: number; hours: number }>>();
  if (ids.length > 0) {
    const { data: ovRows } = await supabase
      .from("task_schedule_overrides")
      .select("*")
      .in("task_id", ids);

    for (const o of (ovRows || []) as { task_id: string; work_date: string; start_hour: number; hours: number }[]) {
      if (!ovMap.has(o.task_id)) ovMap.set(o.task_id, new Map());
      ovMap.get(o.task_id)!.set(o.work_date, { startHour: o.start_hour, hours: o.hours });
    }
  }

  const occ = new Map<string, { startHour: number; endHour: number }[]>();
  for (const t of taskRows) {
    if (t.id === excludeTaskId) continue;
    const hrs = t.duration_hours || dailyWorkHours;
    if (hrs <= 0) continue;

    const sd = t.due_date ? new Date(t.due_date + "T00:00:00") : new Date(t.created_at);
    const segs = distributeTask({
      totalHours: hrs,
      startDate: sd,
      startHour: t.position_hour ?? workStartHour,
      dailyWorkHours,
      workStartHour,
      weekendDays,
      holidaySet,
      overrides: ovMap.get(t.id),
    });

    for (const s of segs) {
      if (!occ.has(s.dateKey)) occ.set(s.dateKey, []);
      occ.get(s.dateKey)!.push({ startHour: s.startHour, endHour: s.endHour });
    }
  }
  return occ;
}

// ── find first free gap in a day ────────────────────────────────────
function findFirstGap(
  slots: { startHour: number; endHour: number }[],
  workStart: number,
  workEnd: number,
): { startHour: number; hours: number } | null {
  const sorted = [...slots].sort((a, b) => a.startHour - b.startHour);
  let cursor = workStart;
  for (const s of sorted) {
    if (s.startHour > cursor) {
      const gap = Math.min(s.startHour, workEnd) - cursor;
      if (gap > 0.01) return { startHour: cursor, hours: gap };
    }
    cursor = Math.max(cursor, s.endHour);
  }
  if (cursor < workEnd) return { startHour: cursor, hours: workEnd - cursor };
  return null;
}

// ── main handler ────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // authenticate caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) throw new Error("Invalid token");

    const body = await req.json();
    const {
      // task fields
      title, description, collection_id, column_id,
      assignee_id, priority, due_date: rawDueDate,
      project_id, duration_days, duration_hours,
      // workspace settings for auto-position
      auto_position,
      daily_work_hours, work_start_hour, weekend_days, holidays,
    } = body;

    if (!title || !collection_id || !column_id)
      throw new Error("title, collection_id, column_id required");

    const dailyHours = daily_work_hours || 8;
    const workStart = work_start_hour ?? 9;
    const wkDays: number[] = weekend_days || [0, 6];
    const hols: string[] = holidays || [];
    const holidaySet = new Set(hols);
    const workEnd = workStart + dailyHours;
    const totalHours = duration_hours || (duration_days || 1) * dailyHours;

    let finalDueDate: string | null = rawDueDate || null;
    let positionHour: number | null = null;
    let overrides: { work_date: string; start_hour: number; hours: number }[] = [];

    // ── auto-position calculation ──
    if (auto_position && assignee_id && totalHours > 0) {
      const occ = await buildOccupation(
        supabase, assignee_id, null,
        dailyHours, workStart, wkDays, holidaySet,
      );

      let remaining = totalHours;
      let firstDate: Date | null = null;
      let firstHour: number | null = null;
      let lastDate: Date | null = null;
      const allocated = new Map<string, { start_hour: number; hours: number }>();

      let cur = nextWorkDay(new Date(), wkDays, holidaySet);
      for (let i = 0; i < 365 && remaining > 0.01; i++) {
        const key = toDateKey(cur);
        const gap = findFirstGap(occ.get(key) || [], workStart, workEnd);

        if (gap && gap.hours > 0.01) {
          const alloc = Math.min(gap.hours, remaining);
          if (!firstDate) { firstDate = new Date(cur); firstHour = gap.startHour; }
          lastDate = new Date(cur);
          allocated.set(key, { start_hour: gap.startHour, hours: alloc });
          remaining -= alloc;
        }

        cur = nextWorkDay(addDays(cur, 1), wkDays, holidaySet);
      }

      if (firstDate && lastDate) {
        finalDueDate = toDateKey(firstDate);
        positionHour = firstHour;

        // generate overrides for ALL work days between first → last
        const lastKey = toDateKey(lastDate);
        let walk = nextWorkDay(new Date(firstDate), wkDays, holidaySet);
        for (let i = 0; i < 365; i++) {
          const key = toDateKey(walk);
          const a = allocated.get(key);
          overrides.push({
            work_date: key,
            start_hour: a?.start_hour ?? workStart,
            hours: a?.hours ?? 0,
          });
          if (key >= lastKey) break;
          walk = nextWorkDay(addDays(walk, 1), wkDays, holidaySet);
        }
      }
    }

    // ── insert task ──
    const taskInsert: Record<string, unknown> = {
      title,
      collection_id,
      column_id,
      created_by: user.id,
    };
    if (description) taskInsert.description = description;
    if (assignee_id) taskInsert.assignee_id = assignee_id;
    if (priority) taskInsert.priority = priority;
    if (finalDueDate) taskInsert.due_date = finalDueDate;
    if (project_id) taskInsert.project_id = project_id;
    if (duration_days) taskInsert.duration_days = duration_days;
    if (duration_hours) taskInsert.duration_hours = duration_hours;
    if (positionHour != null) taskInsert.position_hour = positionHour;

    const { data: newTask, error: taskErr } = await supabase
      .from("tasks")
      .insert(taskInsert)
      .select("id")
      .single();

    if (taskErr) throw taskErr;

    // ── insert overrides ──
    if (overrides.length > 0 && newTask?.id) {
      const rows = overrides.map((o) => ({
        task_id: newTask.id,
        work_date: o.work_date,
        start_hour: o.start_hour,
        hours: o.hours,
      }));

      const { error: ovErr } = await supabase
        .from("task_schedule_overrides")
        .insert(rows);

      if (ovErr) {
        console.error("Override insert error:", ovErr);
        // task was created; overrides failed — log but don't fail the whole request
      }
    }

    return new Response(
      JSON.stringify({ task_id: newTask.id, overrides_count: overrides.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("auto-create-task error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
