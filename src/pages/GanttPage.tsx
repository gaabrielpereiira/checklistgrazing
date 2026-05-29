import { useState, useMemo, useCallback, useRef } from "react";
import { AppLayout } from "@/components/AppLayout";
import { TaskDetailPanel } from "@/components/TaskDetailPanel";
import {
  useAllTasks, useCollections, useColumns, useAllColumns, useProfiles,
  useSectors, useUserSectors, useProjects, useUserRoles, useTeamMembers,
  useScheduleOverrides, useUpsertScheduleOverrides,
  useTaskKanbanHistory,
  type FullTaskWithCollection, type FullTask, type Project, type TaskKanbanHistoryRecord,
} from "@/hooks/useTaskData";
import { useWorkspaceSettings, useWorkspaceHolidays } from "@/hooks/useWorkspaceSettings";
import { distributeTask, toDateKey as distToDateKey, type TaskSegment } from "@/lib/taskDistribution";
import { GanttAssigneePopover } from "@/components/GanttAssigneePopover";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle, ChevronLeft, ChevronRight, Save, Undo2, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type GanttView = "day" | "week" | "month";
type BarColorMode = "status" | "assignee";

interface PendingChange {
  position_day?: number;
  duration_days?: number;
  position_hour?: number;
  duration_hours?: number;
  due_date?: string;
}

interface PendingOverride {
  task_id: string;
  work_date: string;
  start_hour: number;
  hours: number;
}

const ASSIGNEE_COLORS = [
  "bg-blue-500/70", "bg-purple-500/70", "bg-teal-500/70", "bg-orange-500/70",
  "bg-pink-500/70", "bg-cyan-500/70", "bg-lime-500/70", "bg-rose-500/70",
];

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateShort(d: Date): string {
  const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  return `${days[d.getDay()]} ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatDateFull(d: Date): string {
  const days = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
  const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  return `${days[d.getDay()]}, ${String(d.getDate()).padStart(2, "0")} de ${months[d.getMonth()]} de ${d.getFullYear()}`;
}

function formatHour(h: number): string {
  const hours = Math.floor(h);
  const mins = Math.round((h - hours) * 60);
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

export default function GanttPage() {
  const [searchParams] = useSearchParams();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: allTasks } = useAllTasks();
  const { data: collections } = useCollections();
  const { data: allColumns } = useAllColumns();
  const { data: profiles } = useProfiles();
  const { data: sectors } = useSectors();
  const { data: userSectors } = useUserSectors();
  const { data: projects } = useProjects();
  const { data: userRoles } = useUserRoles();
  const { data: teamMembers } = useTeamMembers();
  const { data: wsSettings } = useWorkspaceSettings();
  const { data: holidays } = useWorkspaceHolidays();
  const { data: scheduleOverrides } = useScheduleOverrides();
  const upsertOverrides = useUpsertScheduleOverrides();
  const { data: kanbanHistory } = useTaskKanbanHistory();

  const [filterCollection, setFilterCollection] = useState<string>("all");
  const [filterAssignee, setFilterAssignee] = useState<string>("all");
  const [filterProject, setFilterProject] = useState<string>(searchParams.get("projeto") || "all");
  const [showOnlyMine, setShowOnlyMine] = useState(false);
  const [ganttView, setGanttView] = useState<GanttView>("week");
  const [colorMode, setColorMode] = useState<BarColorMode>("status");
  const [selectedTask, setSelectedTask] = useState<FullTask | null>(null);
  const [selectedCollectionForPanel, setSelectedCollectionForPanel] = useState<string | null>(null);
  const [expandImpediments, setExpandImpediments] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [dayOffset, setDayOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  

  const [pendingChanges, setPendingChanges] = useState<Map<string, PendingChange>>(new Map());
  const [pendingOverrides, setPendingOverrides] = useState<PendingOverride[]>([]);
  const [saving, setSaving] = useState(false);


  const dailyHours = wsSettings?.daily_work_hours || 8;
  const workStart = (() => {
    const t = wsSettings?.work_start_time || "09:00";
    const [h, m] = t.split(":").map(Number);
    return h + (m || 0) / 60;
  })();
  const workEnd = workStart + dailyHours;
  const weekendDays = wsSettings?.weekend_days || [0, 6];
  const holidayDates = holidays?.map(h => h.holiday_date) || [];
  const holidaySet = useMemo(() => new Set(holidayDates), [holidayDates]);

  const currentRole = userRoles?.find(r => r.user_id === user?.id)?.role || "usuario";
  const isAdmin = currentRole === "admin";
  const isGestor = currentRole === "gestor";
  const isManager = isAdmin || isGestor;

  // IDs of users in the same teams as the current gestor
  const managedUserIds = useMemo(() => {
    if (!isGestor || !teamMembers || !user) return new Set<string>();
    const myTeamIds = teamMembers.filter(tm => tm.user_id === user.id).map(tm => tm.team_id);
    const memberIds = teamMembers
      .filter(tm => myTeamIds.includes(tm.team_id) && tm.user_id !== user.id)
      .map(tm => tm.user_id);
    return new Set(memberIds);
  }, [isGestor, teamMembers, user]);

  const assigneeColorMap = useMemo(() => {
    const map = new Map<string, string>();
    profiles?.forEach((p, i) => map.set(p.user_id, ASSIGNEE_COLORS[i % ASSIGNEE_COLORS.length]));
    return map;
  }, [profiles]);

  // Collection color map: collectionId → hex color
  const collectionColorMap = useMemo(() => {
    const map = new Map<string, string>();
    collections?.forEach(c => {
      if ((c as any).color) map.set(c.id, (c as any).color);
    });
    return map;
  }, [collections]);

  // Per-task history records grouped by task
  const taskHistoryMap = useMemo(() => {
    const map = new Map<string, TaskKanbanHistoryRecord[]>();
    if (!kanbanHistory) return map;
    for (const rec of kanbanHistory) {
      if (!map.has(rec.task_id)) map.set(rec.task_id, []);
      map.get(rec.task_id)!.push(rec);
    }
    return map;
  }, [kanbanHistory]);


  const lastColumnIds = useMemo(() => {
    const map = new Map<string, string>();
    if (!allColumns) return map;
    const byCollection = new Map<string, typeof allColumns>();
    for (const col of allColumns) {
      const arr = byCollection.get(col.collection_id) || [];
      arr.push(col);
      byCollection.set(col.collection_id, arr);
    }
    for (const [cid, cols] of byCollection) {
      const sorted = cols.sort((a, b) => a.position - b.position);
      if (sorted.length) map.set(cid, sorted[sorted.length - 1].id);
    }
    return map;
  }, [allColumns]);

   // Filter tasks — show all tasks independently (no linked task dedup)
  const filteredTasks = useMemo(() => {
    if (!allTasks) return [];

    let tasks = allTasks.filter(t => !(t as any).is_archived);

    // Admin sees all; gestor sees own + team members'; usuario sees own only
    if (!isAdmin && user) {
      if (isGestor) {
        tasks = tasks.filter(t => t.assignee_id === user.id || managedUserIds.has(t.assignee_id || ""));
      } else {
        tasks = tasks.filter(t => t.assignee_id === user.id);
      }
    }

    if (filterProject === "none") tasks = tasks.filter(t => !(t as any).project_id);
    else if (filterProject !== "all") tasks = tasks.filter(t => (t as any).project_id === filterProject);
    if (filterCollection !== "all") tasks = tasks.filter(t => t.collection_id === filterCollection);
    if (filterAssignee !== "all") tasks = tasks.filter(t => t.assignee_id === filterAssignee);
    if (showOnlyMine && user) tasks = tasks.filter(t => t.assignee_id === user.id);

    return tasks;
  }, [allTasks, filterProject, filterCollection, filterAssignee, showOnlyMine, isAdmin, isGestor, managedUserIds, user]);

  const selectedProject = useMemo(
    () => projects?.find(p => p.id === filterProject) || null,
    [projects, filterProject]
  );

  // Week navigation
  const weekStart = useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((day + 6) % 7) + weekOffset * 7);
    monday.setHours(0, 0, 0, 0);
    return monday;
  }, [weekOffset]);

  const weekDays = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  // Hour slots for week view
  const hourSlots = useMemo(() => {
    const slots: number[] = [];
    for (let h = workStart; h < workEnd; h += 1) {
      slots.push(h);
    }
    return slots;
  }, [workStart, workEnd]);

  const { data: panelColumns } = useColumns(selectedCollectionForPanel);

  const handleTaskClick = (task: FullTaskWithCollection) => {
    setSelectedTask(task);
    setSelectedCollectionForPanel(task.collection_id);
    setExpandImpediments(task.impediments?.some(imp => !imp.resolved_at) || false);
  };

  const isOffDay = useCallback((d: Date) => {
    if (weekendDays.includes(d.getDay())) return true;
    if (holidaySet.has(toDateKey(d))) return true;
    return false;
  }, [weekendDays, holidaySet]);

  // Day view: current day, skipping off days for navigation
  const currentDayDate = useMemo(() => addDays(new Date(), dayOffset), [dayOffset]);
  
  const navigateDay = useCallback((direction: 1 | -1) => {
    setDayOffset(prev => {
      let candidate = addDays(new Date(), prev + direction);
      let safety = 0;
      while (isOffDay(candidate) && safety < 30) {
        candidate = addDays(candidate, direction);
        safety++;
      }
      const diffMs = candidate.getTime() - new Date().getTime();
      return Math.round(diffMs / 86400000);
    });
  }, [isOffDay]);

  const getBarColor = useCallback((task: FullTaskWithCollection) => {
    // Primary: collection color
    const collColor = collectionColorMap.get(task.collection_id);
    if (collColor) return collColor; // hex color, applied via style

    if (colorMode === "assignee" && task.assignee_id) {
      return assigneeColorMap.get(task.assignee_id) || "bg-muted-foreground/30";
    }
    return "bg-emerald-500/60";
  }, [colorMode, assigneeColorMap, collectionColorMap]);

  // Helper: returns true if barColor is a hex color (from collection), false if it's a tailwind class
  const isHexColor = (color: string) => color.startsWith("#") || color.startsWith("rgb");

  // ─── Drag state ───
  const dragRef = useRef<{
    taskId: string;
    type: "move" | "resize";
    startX: number;
    startY: number;
    origHour: number;
    origDuration: number;
    origDay: number;
  } | null>(null);
  const [dragPreview, setDragPreview] = useState<{ taskId: string; day: number; hour: number; durationH: number } | null>(null);
  const dragPreviewRef = useRef(dragPreview);
  dragPreviewRef.current = dragPreview;

  const HOUR_HEIGHT = 48;
  const DAY_HOUR_HEIGHT = 72; // taller rows for day view
  const DAY_WIDTH = 160;

  const handleWeekMouseDown = (e: React.MouseEvent, taskId: string, type: "move" | "resize", origDay: number, origHour: number, origDuration: number, totalTaskHours?: number, segPartIndex?: number) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { taskId, type, startX: e.clientX, startY: e.clientY, origHour, origDuration, origDay };

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;

      if (type === "move") {
        const dayDelta = Math.round(dx / DAY_WIDTH);
        const hourDelta = Math.round(dy / HOUR_HEIGHT * 2) / 2; // 0.5h snap
        const newDay = Math.max(0, dragRef.current.origDay + dayDelta);
        const newHour = Math.max(workStart, Math.min(workEnd - 0.5, dragRef.current.origHour + hourDelta));
        setDragPreview({ taskId, day: newDay, hour: newHour, durationH: dragRef.current.origDuration });
      } else {
        const hourDelta = Math.round(dy / HOUR_HEIGHT * 2) / 2;
        const newSegDur = Math.max(0.5, dragRef.current.origDuration + hourDelta);
        setDragPreview({ taskId, day: dragRef.current.origDay, hour: dragRef.current.origHour, durationH: newSegDur });
      }
    };

    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      if (dragPreviewRef.current) {
        const { taskId: tid, day, hour, durationH } = dragPreviewRef.current;
        const targetDate = weekDays[day];
        if (targetDate) {
          if (type === "resize") {
            // Save override for this specific day — do NOT change total duration_hours
            const dateStr = toDateKey(targetDate);
            const cappedHours = Math.min(durationH, dailyHours);
            setPendingOverrides(prev => {
              const filtered = prev.filter(o => !(o.task_id === tid && o.work_date === dateStr));
              return [...filtered, { task_id: tid, work_date: dateStr, start_hour: hour, hours: cappedHours }];
            });
          } else {
            // Move: reposition this specific segment only via override
            const dateStr = toDateKey(targetDate);
            const origDateStr = toDateKey(weekDays[dragRef.current!.origDay]);

            // Find the current segment for the original day
            const origDaySegs = taskSegmentsMap.get(origDateStr) || [];
            const thisSeg = origDaySegs.find(s => s.task.id === tid);
            const segHours = thisSeg ? (thisSeg.endHour - thisSeg.startHour) : durationH;

            if (origDateStr === dateStr) {
              // Same day — just change the start hour
              const availableAtNewHour = workEnd - hour;

              if (segHours <= availableAtNewHour) {
                // Fits — override this day only
                setPendingOverrides(prev => {
                  const filtered = prev.filter(o => !(o.task_id === tid && o.work_date === dateStr));
                  return [...filtered, { task_id: tid, work_date: dateStr, start_hour: hour, hours: segHours }];
                });
              } else {
                // Overflows — cap today, send excess to last existing day of the task
                const fitsToday = Math.max(0.5, availableAtNewHour);
                const overflow = segHours - fitsToday;

                const allTaskSegs: { dateKey: string; seg: SegmentInfo }[] = [];
                for (const [dk, segs] of taskSegmentsMap) {
                  for (const s of segs) {
                    if (s.task.id === tid) allTaskSegs.push({ dateKey: dk, seg: s });
                  }
                }
                allTaskSegs.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
                const lastOtherDay = [...allTaskSegs].reverse().find(x => x.dateKey !== dateStr);

                setPendingOverrides(prev => {
                  let updated = prev.filter(o => !(o.task_id === tid && o.work_date === dateStr));
                  updated = [...updated, { task_id: tid, work_date: dateStr, start_hour: hour, hours: fitsToday }];

                  if (lastOtherDay) {
                    const lastDk = lastOtherDay.dateKey;
                    const lastSeg = lastOtherDay.seg;
                    const existingOverride = updated.find(o => o.task_id === tid && o.work_date === lastDk);
                    const currentLastHours = existingOverride ? existingOverride.hours : (lastSeg.endHour - lastSeg.startHour);
                    const currentLastStart = existingOverride ? existingOverride.start_hour : lastSeg.startHour;
                    const newLastHours = Math.min(currentLastHours + overflow, dailyHours);

                    updated = updated.filter(o => !(o.task_id === tid && o.work_date === lastDk));
                    updated = [...updated, { task_id: tid, work_date: lastDk, start_hour: currentLastStart, hours: newLastHours }];
                  }
                  return updated;
                });
              }
            } else {
              // Different day — move the segment: remove from original day, add to new day
              const availableAtNewHour = workEnd - hour;
              const fitsNewDay = Math.min(segHours, availableAtNewHour);

              setPendingOverrides(prev => {
                let updated = prev.filter(o => !(o.task_id === tid && o.work_date === origDateStr));
                // Zero out the original day
                updated = [...updated, { task_id: tid, work_date: origDateStr, start_hour: workStart, hours: 0 }];
                // Add to the new day (merge with existing if any)
                const existingNewDay = taskSegmentsMap.get(dateStr)?.find(s => s.task.id === tid);
                const existingNewHours = existingNewDay ? (existingNewDay.endHour - existingNewDay.startHour) : 0;
                const existingOverride = updated.find(o => o.task_id === tid && o.work_date === dateStr);
                const baseHours = existingOverride ? existingOverride.hours : existingNewHours;
                const newHours = Math.min(baseHours + fitsNewDay, dailyHours);

                updated = updated.filter(o => !(o.task_id === tid && o.work_date === dateStr));
                updated = [...updated, { task_id: tid, work_date: dateStr, start_hour: hour, hours: newHours }];
                return updated;
              });
            }
          }
        }
      }
      dragRef.current = null;
      setDragPreview(null);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  // ─── Day view drag handler ───
  const handleDayMouseDown = (e: React.MouseEvent, taskId: string, type: "move" | "resize", origHour: number, origDuration: number) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { taskId, type, startX: e.clientX, startY: e.clientY, origHour, origDuration, origDay: 0 };

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dy = ev.clientY - dragRef.current.startY;
      const hourDelta = Math.round(dy / DAY_HOUR_HEIGHT * 2) / 2; // 0.5h snap

      if (type === "move") {
        const newHour = Math.max(workStart, Math.min(workEnd - 0.5, dragRef.current.origHour + hourDelta));
        setDragPreview({ taskId, day: 0, hour: newHour, durationH: dragRef.current.origDuration });
      } else {
        const newDur = Math.max(0.5, dragRef.current.origDuration + hourDelta);
        setDragPreview({ taskId, day: 0, hour: dragRef.current.origHour, durationH: newDur });
      }
    };

    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      if (dragPreviewRef.current) {
        const { taskId: tid, hour, durationH } = dragPreviewRef.current;
        if (type === "resize") {
          // Save override for current day — do NOT change total duration_hours
          const dateStr = toDateKey(currentDayDate);
          const cappedHours = Math.min(durationH, dailyHours);
          setPendingOverrides(prev => {
            const filtered = prev.filter(o => !(o.task_id === tid && o.work_date === dateStr));
            return [...filtered, { task_id: tid, work_date: dateStr, start_hour: hour, hours: cappedHours }];
          });
        } else {
          // Move: reposition the task's segment within today
          // Find the current segment for this day to know how many hours it has
          const dateStr = distToDateKey(currentDayDate);
          const daySegs = taskSegmentsMap.get(dateStr) || [];
          const thisSeg = daySegs.find(s => s.task.id === tid);
          const segHours = thisSeg ? (thisSeg.endHour - thisSeg.startHour) : durationH;

          const availableAtNewHour = workEnd - hour;

          if (segHours <= availableAtNewHour) {
            // Fits entirely — only change this day's start hour, no redistribution
            setPendingOverrides(prev => {
              const filtered = prev.filter(o => !(o.task_id === tid && o.work_date === dateStr));
              return [...filtered, { task_id: tid, work_date: dateStr, start_hour: hour, hours: segHours }];
            });
          } else {
            // Overflows — cap today, send excess to the LAST existing day of the task
            const fitsToday = Math.max(0.5, availableAtNewHour);
            const overflow = segHours - fitsToday;

            // Find all segments for this task across all dates to locate the last day
            const allTaskSegs: { dateKey: string; seg: SegmentInfo }[] = [];
            for (const [dk, segs] of taskSegmentsMap) {
              for (const s of segs) {
                if (s.task.id === tid) allTaskSegs.push({ dateKey: dk, seg: s });
              }
            }
            allTaskSegs.sort((a, b) => a.dateKey.localeCompare(b.dateKey));

            // The last day that is NOT the current day
            const lastOtherDay = [...allTaskSegs].reverse().find(x => x.dateKey !== dateStr);

            setPendingOverrides(prev => {
              let updated = prev.filter(o => !(o.task_id === tid && o.work_date === dateStr));
              updated = [...updated, { task_id: tid, work_date: dateStr, start_hour: hour, hours: fitsToday }];

              if (lastOtherDay) {
                const lastDk = lastOtherDay.dateKey;
                const lastSeg = lastOtherDay.seg;
                // Find existing pending override or use current segment hours
                const existingOverride = updated.find(o => o.task_id === tid && o.work_date === lastDk);
                const currentLastHours = existingOverride ? existingOverride.hours : (lastSeg.endHour - lastSeg.startHour);
                const currentLastStart = existingOverride ? existingOverride.start_hour : lastSeg.startHour;
                const newLastHours = Math.min(currentLastHours + overflow, dailyHours);

                updated = updated.filter(o => !(o.task_id === tid && o.work_date === lastDk));
                updated = [...updated, { task_id: tid, work_date: lastDk, start_hour: currentLastStart, hours: newLastHours }];
              }

              return updated;
            });
          }
        }
      }
      dragRef.current = null;
      setDragPreview(null);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const promises: Promise<any>[] = [];
      // Save task field changes
      for (const [taskId, changes] of pendingChanges.entries()) {
        promises.push((async () => {
            await supabase.from("tasks").update(changes as any).eq("id", taskId);
          })());
      }
      // Save schedule overrides
      if (pendingOverrides.length > 0) {
        promises.push(upsertOverrides.mutateAsync(pendingOverrides));
      }
      await Promise.all(promises);
      setPendingChanges(new Map());
      setPendingOverrides([]);
      qc.invalidateQueries({ queryKey: ["all-tasks"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["schedule-overrides"] });
      toast.success("Alterações salvas");
    } catch {
      toast.error("Erro ao salvar alterações");
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setPendingChanges(new Map());
    setPendingOverrides([]);
  };
  const pendingCount = pendingChanges.size + pendingOverrides.length;

  // ─── Compute task segments for all views ───
  interface SegmentInfo {
    dateKey: string;
    startHour: number;
    endHour: number;
    task: FullTaskWithCollection;
    partIndex: number;
    totalParts: number;
    totalHours: number;
  }

  // Build overrides map per task from DB + pending
  const taskOverridesMap = useMemo(() => {
    const map = new Map<string, Map<string, { startHour: number; hours: number }>>();
    // From DB
    if (scheduleOverrides) {
      for (const o of scheduleOverrides) {
        if (!map.has(o.task_id)) map.set(o.task_id, new Map());
        map.get(o.task_id)!.set(o.work_date, { startHour: o.start_hour, hours: o.hours });
      }
    }
    // From pending (overwrite DB values)
    for (const o of pendingOverrides) {
      if (!map.has(o.task_id)) map.set(o.task_id, new Map());
      map.get(o.task_id)!.set(o.work_date, { startHour: o.start_hour, hours: o.hours });
    }
    return map;
  }, [scheduleOverrides, pendingOverrides]);

  const taskSegmentsMap = useMemo(() => {
    const map = new Map<string, SegmentInfo[]>();

    for (const task of filteredTasks) {
      const pending = pendingChanges.get(task.id);
      const totalHours = pending?.duration_hours ?? (task as any).duration_hours ?? ((task as any).duration_days || 1) * dailyHours;
      const posHour = pending?.position_hour ?? (task as any).position_hour ?? workStart;

      // Use due_date as start when set (scheduled position), otherwise created_at
      const startDate = pending?.due_date
        ? new Date(pending.due_date + "T00:00:00")
        : task.due_date
          ? new Date(task.due_date + "T00:00:00")
          : new Date(task.created_at);

      if (totalHours <= 0) continue;

      const overrides = taskOverridesMap.get(task.id);

      const segments = distributeTask({
        totalHours,
        startDate,
        startHour: posHour,
        dailyWorkHours: dailyHours,
        workStartHour: workStart,
        weekendDays,
        holidays: holidayDates,
        overrides,
      });

      const totalParts = segments.length;
      segments.forEach((seg, idx) => {
        const key = toDateKey(seg.date);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push({
          dateKey: key,
          startHour: seg.startHour,
          endHour: seg.endHour,
          task,
          partIndex: idx,
          totalParts,
          totalHours,
        });
      });
    }

    return map;
  }, [filteredTasks, pendingChanges, taskOverridesMap, dailyHours, workStart, weekendDays, holidayDates]);

  // ─── Month view ───
  const monthViewStart = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + monthOffset);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [monthOffset]);

  const monthDays = useMemo(() => {
    const year = monthViewStart.getFullYear();
    const month = monthViewStart.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => {
      const d = new Date(year, month, i + 1);
      d.setHours(0, 0, 0, 0);
      return d;
    });
  }, [monthViewStart]);

  const monthName = useMemo(() => {
    const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    return `${months[monthViewStart.getMonth()]} ${monthViewStart.getFullYear()}`;
  }, [monthViewStart]);

  // Compute which days each visible task occupies for month bars.
  // Each task is shown independently from its created_at through its duration.
  const taskMonthBars = useMemo(() => {
    const result = new Map<string, { dateKeys: Set<string>; firstDay: number; lastDay: number; task: FullTaskWithCollection; mergedTaskIds: Set<string> }>();
    const monthStartKey = toDateKey(monthDays[0]);
    const monthEndKey = toDateKey(monthDays[monthDays.length - 1]);

    for (const [dateKey, segments] of taskSegmentsMap) {
      if (dateKey < monthStartKey || dateKey > monthEndKey) continue;

      for (const seg of segments) {
        const dayIdx = monthDays.findIndex(d => toDateKey(d) === dateKey);
        if (dayIdx === -1) continue;

        const taskId = seg.task.id;
        const existing = result.get(taskId);
        if (existing) {
          existing.dateKeys.add(dateKey);
          existing.firstDay = Math.min(existing.firstDay, dayIdx);
          existing.lastDay = Math.max(existing.lastDay, dayIdx);
        } else {
          result.set(taskId, {
            dateKeys: new Set([dateKey]),
            firstDay: dayIdx,
            lastDay: dayIdx,
            task: seg.task,
            mergedTaskIds: new Set([taskId]),
          });
        }
      }
    }

    return result;
  }, [taskSegmentsMap, monthDays]);

  // Drill-down removed — each task shown independently

  // Month drag handler
  const MONTH_COL_WIDTH = 32;
  const handleMonthResize = (e: React.MouseEvent, taskId: string, origFirstDay: number, origSpan: number, origTotalHours: number) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { taskId, type: "resize", startX: e.clientX, startY: e.clientY, origHour: 0, origDuration: origTotalHours, origDay: origFirstDay };

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dayDelta = Math.round(dx / MONTH_COL_WIDTH);
      const newSpan = Math.max(1, origSpan + dayDelta);
      // Count only work days in span
      let workDays = 0;
      for (let i = 0; i < newSpan; i++) {
        const d = monthDays[origFirstDay + i];
        if (d && !isOffDay(d)) workDays++;
      }
      const newHours = Math.max(dailyHours, workDays * dailyHours);
      setDragPreview({ taskId, day: dragRef.current.origDay, hour: workStart, durationH: newHours });
    };

    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      if (dragPreviewRef.current) {
        const { taskId: tid, durationH } = dragPreviewRef.current;
        setPendingChanges(prev => {
          const next = new Map(prev);
          next.set(tid, {
            ...(prev.get(tid) || {}),
            duration_hours: durationH,
          });
          return next;
        });
      }
      dragRef.current = null;
      setDragPreview(null);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };



  // View switch context sync
  const handleViewSwitch = useCallback((newView: GanttView) => {
    if (ganttView === "week" && newView === "day") {
      // Try to set day to first day of current week
      const diffMs = weekStart.getTime() - new Date().getTime();
      setDayOffset(Math.round(diffMs / 86400000));
    } else if (ganttView === "day" && newView === "week") {
      const dayDate = addDays(new Date(), dayOffset);
      const dayOfWeek = dayDate.getDay();
      const mondayOfThatWeek = addDays(dayDate, -((dayOfWeek + 6) % 7));
      const now = new Date();
      const nowMonday = addDays(now, -((now.getDay() + 6) % 7));
      setWeekOffset(Math.round((mondayOfThatWeek.getTime() - nowMonday.getTime()) / (7 * 86400000)));
    } else if (newView === "month") {
      const refDate = ganttView === "day" ? addDays(new Date(), dayOffset) : weekStart;
      const now = new Date();
      setMonthOffset((refDate.getFullYear() - now.getFullYear()) * 12 + refDate.getMonth() - now.getMonth());
    }
    setGanttView(newView);
  }, [ganttView, weekStart, dayOffset]);

  // Project deadline for month view
  const projectDeadlineDayIdx = useMemo(() => {
    if (!selectedProject) return -1;
    const endDate = new Date(selectedProject.end_date);
    return monthDays.findIndex(d => toDateKey(d) === toDateKey(endDate));
  }, [selectedProject, monthDays]);

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  return (
    <AppLayout>
      <TooltipProvider>
        <div className="flex h-full flex-col">
          {/* Pending changes bar */}
          {pendingCount > 0 && (
            <div className="flex items-center gap-3 border-b bg-primary/5 px-6 py-2 shrink-0">
              <span className="text-sm font-medium text-primary">
                {pendingCount} alteração(ões) pendente(s)
              </span>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                <Save className="h-3.5 w-3.5 mr-1" /> Salvar
              </Button>
              <Button size="sm" variant="ghost" onClick={handleDiscard} disabled={saving}>
                <Undo2 className="h-3.5 w-3.5 mr-1" /> Descartar
              </Button>
            </div>
          )}

          {/* Toolbar */}
          <div className="flex items-center gap-2 border-b px-6 py-3 shrink-0 flex-wrap">
            <h1 className="font-heading text-xl font-bold mr-3">Agenda</h1>

            <Select value={filterProject} onValueChange={setFilterProject}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Projeto" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos projetos</SelectItem>
                <SelectItem value="none">Sem projeto</SelectItem>
                {projects?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={filterCollection} onValueChange={setFilterCollection}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Coleção" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas coleções</SelectItem>
                {collections?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>

            {isManager && (
              <Select value={filterAssignee} onValueChange={setFilterAssignee}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Responsável" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {profiles?.map(p => <SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}

            <Button
              variant={showOnlyMine ? "default" : "outline"}
              size="sm"
              className="text-xs gap-1.5"
              onClick={() => setShowOnlyMine(v => !v)}
            >
              <User className="h-3.5 w-3.5" />
              Minhas Tarefas
            </Button>

            <div className="flex items-center gap-1 ml-auto">
              <Button variant="ghost" size="sm" onClick={() => setColorMode(m => m === "status" ? "assignee" : "status")} className="text-xs">
                Cor: {colorMode === "status" ? "Status" : "Responsável"}
              </Button>

              <div className="flex items-center border rounded-md">
                {(["day", "week", "month"] as GanttView[]).map(v => (
                  <Button
                    key={v}
                    variant={ganttView === v ? "default" : "ghost"}
                    size="sm"
                    className="h-8 text-xs px-3"
                    onClick={() => handleViewSwitch(v)}
                  >
                    {v === "day" ? "Dia" : v === "week" ? "Semana" : "Mês"}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {filteredTasks.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              Nenhuma task encontrada com os filtros atuais.
            </div>
          ) : ganttView === "week" ? (
            /* ═══════ WEEK VIEW ═══════ */
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Week navigation */}
              <div className="flex items-center gap-2 px-6 py-2 border-b shrink-0">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setWeekOffset(w => w - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium text-card-foreground min-w-[220px] text-center">
                  {formatDateShort(weekStart)} — {formatDateShort(addDays(weekStart, 6))}
                </span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setWeekOffset(w => w + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => setWeekOffset(0)}>Hoje</Button>
              </div>

              <div className="flex-1 overflow-auto">
                <div className="flex min-w-max">
                  {/* Hour labels */}
                  <div className="w-14 shrink-0 border-r pt-8">
                    {hourSlots.map(h => (
                      <div key={h} className="flex items-start justify-end pr-2 text-[10px] text-muted-foreground" style={{ height: HOUR_HEIGHT }}>
                        {formatHour(h)}
                      </div>
                    ))}
                  </div>

                  {/* Day columns */}
                  {weekDays.map((day, dayIdx) => {
                    const off = isOffDay(day);
                    const isToday = day.toDateString() === today.toDateString();
                    const dateKey = toDateKey(day);
                    const daySegments = taskSegmentsMap.get(dateKey) || [];

                    // Stack segments to avoid overlap
                    const lanes: (typeof daySegments)[] = [];
                    for (const seg of daySegments.sort((a, b) => a.startHour - b.startHour)) {
                      let placed = false;
                      for (const lane of lanes) {
                        const last = lane[lane.length - 1];
                        if (last.endHour <= seg.startHour) {
                          lane.push(seg);
                          placed = true;
                          break;
                        }
                      }
                      if (!placed) lanes.push([seg]);
                    }
                    const laneCount = Math.max(1, lanes.length);

                    return (
                      <div key={dayIdx} className={cn("shrink-0 border-r", off && "bg-muted/30")} style={{ width: DAY_WIDTH }}>
                        {/* Day header */}
                        <div className={cn(
                          "h-8 flex items-center justify-center text-xs font-medium border-b",
                          isToday && "bg-primary/10 text-primary",
                          off && "text-muted-foreground"
                        )}>
                          {formatDateShort(day)}
                        </div>

                        {/* Hour grid */}
                        {off ? (
                          <div className="flex items-center justify-center text-[10px] text-muted-foreground" style={{ height: hourSlots.length * HOUR_HEIGHT }}>
                            Folga
                          </div>
                        ) : (
                          <div className="relative" style={{ height: hourSlots.length * HOUR_HEIGHT }}>
                            {/* Hour lines */}
                            {hourSlots.map((h, hi) => (
                              <div key={hi} className="absolute w-full border-b border-dashed border-border/50" style={{ top: hi * HOUR_HEIGHT, height: HOUR_HEIGHT }} />
                            ))}

                            {/* Task segments */}
                            {lanes.map((lane, laneIdx) =>
                              lane.map(seg => {
                                const preview = dragPreview?.taskId === seg.task.id ? dragPreview : null;
                                const startH = preview && preview.day === dayIdx ? preview.hour : seg.startHour;
                                const endH = preview && preview.day === dayIdx ? preview.hour + preview.durationH : seg.endHour;
                                const top = (startH - workStart) * HOUR_HEIGHT;
                                const height = Math.max(HOUR_HEIGHT / 2, (endH - startH) * HOUR_HEIGHT);
                                const laneWidth = (DAY_WIDTH - 4) / laneCount;
                                const left = 2 + laneIdx * laneWidth;
                                const barColor = getBarColor(seg.task);
                                const isPending = pendingChanges.has(seg.task.id);
                                const assignee = profiles?.find(p => p.user_id === seg.task.assignee_id);
                                const hexColor = isHexColor(barColor);

                                 return (
                                  <div
                                    key={`${seg.task.id}-${laneIdx}-${seg.startHour}`}
                                    className={cn(
                                      "absolute rounded-md flex flex-col justify-start p-1 text-[10px] text-white cursor-pointer select-none overflow-hidden",
                                      !hexColor && barColor,
                                      isPending && "ring-1 ring-primary/50",
                                      preview?.taskId === seg.task.id && "opacity-70 shadow-lg",
                                      
                                    )}
                                    style={{
                                      top, height, left, width: laneWidth - 2,
                                      backgroundColor: hexColor ? barColor : undefined,
                                    }}
                                    onClick={() => handleTaskClick(seg.task)}
                                    onMouseDown={(e) => handleWeekMouseDown(e, seg.task.id, "move", dayIdx, seg.startHour, endH - startH)}
                                  >
                                    {/* Assignee avatar */}
                                    {assignee && isManager ? (
                                      <GanttAssigneePopover
                                        taskId={seg.task.id}
                                        taskTitle={seg.task.title}
                                        currentAssigneeId={seg.task.assignee_id}
                                        currentHour={seg.startHour}
                                        totalHours={seg.totalHours}
                                        profiles={profiles || []}
                                        
                                        workStartHour={workStart}
                                        dailyWorkHours={dailyHours}
                                        weekendDays={weekendDays}
                                        holidays={holidayDates}
                                      >
                                        <div className="flex items-center gap-1 mb-0.5 cursor-pointer hover:opacity-80" onMouseDown={(e) => e.stopPropagation()}>
                                          <div className="w-4 h-4 rounded-full bg-background/30 flex items-center justify-center text-[8px] font-bold shrink-0">
                                            {assignee.name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                                          </div>
                                          {height > 30 && (
                                            <span className="truncate text-[9px] opacity-80">{assignee.name?.split(" ")[0]}</span>
                                          )}
                                        </div>
                                      </GanttAssigneePopover>
                                    ) : assignee ? (
                                      <div className="flex items-center gap-1 mb-0.5">
                                        <div className="w-4 h-4 rounded-full bg-background/30 flex items-center justify-center text-[8px] font-bold shrink-0">
                                          {assignee.name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                                        </div>
                                        {height > 30 && (
                                          <span className="truncate text-[9px] opacity-80">{assignee.name?.split(" ")[0]}</span>
                                        )}
                                      </div>
                                    ) : null}
                                    <span className="truncate font-medium leading-tight">{seg.task.title}</span>
                                    {height > 36 && (
                                      <span className="text-[9px] opacity-70">{formatHour(startH)}–{formatHour(endH)}</span>
                                    )}
                                    {/* Resize handle */}
                                    <div
                                      className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-white/20 rounded-b-md"
                                      onMouseDown={(e) => {
                                        e.stopPropagation();
                                        handleWeekMouseDown(e, seg.task.id, "resize", dayIdx, seg.startHour, endH - startH, seg.totalHours, seg.partIndex);
                                      }}
                                    />
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : ganttView === "day" ? (
            /* ═══════ DAY VIEW (agenda vertical — Google Calendar style) ═══════ */
            (() => {
              const dayDate = currentDayDate;
              const isDayOff = isOffDay(dayDate);
              const isToday = dayDate.toDateString() === today.toDateString();
              const dateKey = toDateKey(dayDate);
              const daySegments = taskSegmentsMap.get(dateKey) || [];

              // Lane stacking
              const lanes: (typeof daySegments)[] = [];
              for (const seg of [...daySegments].sort((a, b) => a.startHour - b.startHour)) {
                let placed = false;
                for (const lane of lanes) {
                  if (lane[lane.length - 1].endHour <= seg.startHour) { lane.push(seg); placed = true; break; }
                }
                if (!placed) lanes.push([seg]);
              }
              const laneCount = Math.max(1, lanes.length);

              // Current time indicator
              const now = new Date();
              const currentHourDecimal = now.getHours() + now.getMinutes() / 60;
              const showNowLine = isToday && currentHourDecimal >= workStart && currentHourDecimal <= workEnd;

              // Half-hour slots for finer grid
              const halfHourSlots: number[] = [];
              for (let h = workStart; h < workEnd; h += 0.5) {
                halfHourSlots.push(h);
              }

              return (
                <div className="flex-1 flex flex-col overflow-hidden">
                  {/* Day navigation */}
                  <div className="flex items-center gap-3 px-6 py-3 border-b shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateDay(-1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-semibold text-card-foreground min-w-[300px] text-center">
                      {formatDateFull(dayDate)}
                    </span>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateDay(1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => setDayOffset(0)}>Hoje</Button>
                    {isDayOff && (
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">Dia de folga</span>
                    )}
                  </div>

                  {isDayOff ? (
                    <div className="flex-1 flex items-center justify-center text-muted-foreground bg-muted/20">
                      <div className="text-center space-y-2">
                        <p className="text-lg font-medium">Dia de folga</p>
                        <p className="text-sm">Use as setas para navegar para o próximo dia útil.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 overflow-auto">
                      <div className="flex min-w-max">
                        {/* Hour labels */}
                        <div className="w-16 shrink-0 border-r bg-card">
                          {hourSlots.map(h => (
                            <div key={h} className="flex items-start justify-end pr-3 text-[11px] text-muted-foreground font-medium" style={{ height: DAY_HOUR_HEIGHT }}>
                              {formatHour(h)}
                            </div>
                          ))}
                        </div>

                        {/* Time grid + blocks */}
                        <div className="flex-1 relative" style={{ height: hourSlots.length * DAY_HOUR_HEIGHT }}>
                          {/* Hour lines */}
                          {hourSlots.map((h, hi) => (
                            <div key={hi} className="absolute w-full border-b border-border/40" style={{ top: hi * DAY_HOUR_HEIGHT, height: DAY_HOUR_HEIGHT }}>
                              {/* Half-hour line */}
                              <div className="absolute w-full border-b border-dashed border-border/20" style={{ top: DAY_HOUR_HEIGHT / 2 }} />
                            </div>
                          ))}

                          {/* Current time line */}
                          {showNowLine && (
                            <div
                              className="absolute w-full z-20 pointer-events-none flex items-center"
                              style={{ top: (currentHourDecimal - workStart) * DAY_HOUR_HEIGHT }}
                            >
                              <div className="w-2.5 h-2.5 rounded-full bg-destructive -ml-1" />
                              <div className="flex-1 h-[2px] bg-destructive" />
                            </div>
                          )}

                          {/* Task blocks */}
                          {lanes.map((lane, laneIdx) =>
                            lane.map(seg => {
                              const preview = dragPreview?.taskId === seg.task.id ? dragPreview : null;
                              const startH = preview ? preview.hour : seg.startHour;
                              const segDur = preview ? preview.durationH : seg.endHour - seg.startHour;
                              const top = (startH - workStart) * DAY_HOUR_HEIGHT;
                              const height = Math.max(DAY_HOUR_HEIGHT / 2, segDur * DAY_HOUR_HEIGHT);
                              const laneW = Math.min(600, (900 - 64) / laneCount);
                              const left = 8 + laneIdx * laneW;
                              const barColor = getBarColor(seg.task);
                              const isPending = pendingChanges.has(seg.task.id);
                              const assignee = profiles?.find(p => p.user_id === seg.task.assignee_id);
                              const isMultiPart = seg.totalParts > 1;
                              const hexColor = isHexColor(barColor);

                              return (
                                <div
                                  key={`${seg.task.id}-${seg.startHour}`}
                                  className={cn(
                                    "absolute rounded-xl flex flex-col p-3 text-white cursor-grab select-none overflow-hidden transition-shadow",
                                    !hexColor && barColor,
                                    isPending && "ring-2 ring-primary/60",
                                    preview?.taskId === seg.task.id && "opacity-75 shadow-xl cursor-grabbing",
                                    
                                  )}
                                  style={{
                                    top, height, left, width: laneW - 4,
                                    backgroundColor: hexColor ? barColor : undefined,
                                  }}
                                  onClick={() => handleTaskClick(seg.task)}
                                  onMouseDown={(e) => handleDayMouseDown(e, seg.task.id, "move", seg.startHour, seg.endHour - seg.startHour)}
                                >
                                  {/* Header row: avatar + title */}
                                  <div className="flex items-center gap-2 mb-1">
                                    {assignee && isManager ? (
                                      <GanttAssigneePopover
                                        taskId={seg.task.id}
                                        taskTitle={seg.task.title}
                                        currentAssigneeId={seg.task.assignee_id}
                                        currentHour={seg.startHour}
                                        totalHours={seg.totalHours}
                                        profiles={profiles || []}
                                        
                                        workStartHour={workStart}
                                        dailyWorkHours={dailyHours}
                                        weekendDays={weekendDays}
                                        holidays={holidayDates}
                                      >
                                        <div className="w-6 h-6 rounded-full bg-background/30 flex items-center justify-center text-[10px] font-bold shrink-0 cursor-pointer hover:ring-2 hover:ring-white/40" onMouseDown={(e) => e.stopPropagation()}>
                                          {assignee.name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                                        </div>
                                      </GanttAssigneePopover>
                                    ) : assignee ? (
                                      <div className="w-6 h-6 rounded-full bg-background/30 flex items-center justify-center text-[10px] font-bold shrink-0">
                                        {assignee.name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                                      </div>
                                    ) : null}
                                    <span className="font-semibold text-sm truncate">{seg.task.title}</span>
                                  </div>

                                  {/* Info row */}
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[11px] opacity-80">
                                      {formatHour(startH)}–{formatHour(startH + segDur)} · {segDur}h
                                    </span>
                                    {isMultiPart && (
                                      <span className="text-[10px] bg-white/20 rounded px-1.5 py-0.5 font-medium">
                                        Parte {seg.partIndex + 1}/{seg.totalParts}
                                      </span>
                                    )}
                                  </div>

                                  {height > 80 && assignee && (
                                    <span className="text-[11px] opacity-70 mt-1">{assignee.name}</span>
                                  )}

                                  {/* Drag tooltip */}
                                  {preview?.taskId === seg.task.id && (
                                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground text-[10px] px-2 py-1 rounded shadow-lg whitespace-nowrap z-30">
                                      Início: {formatHour(preview.hour)} · Duração: {preview.durationH}h
                                    </div>
                                  )}

                                  {/* Resize handle */}
                                  <div
                                    className="absolute bottom-0 left-0 right-0 h-3 cursor-ns-resize hover:bg-white/20 rounded-b-xl flex items-center justify-center"
                                    onMouseDown={(e) => {
                                      e.stopPropagation();
                                      handleDayMouseDown(e, seg.task.id, "resize", seg.startHour, seg.endHour - seg.startHour);
                                    }}
                                  >
                                    <div className="w-8 h-1 rounded-full bg-white/40" />
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()
          ) : (
            /* ═══════ MONTH VIEW ═══════ */
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Month navigation */}
              <div className="flex items-center gap-3 px-6 py-2 border-b shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMonthOffset(m => m - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-semibold text-card-foreground min-w-[180px] text-center">
                      {monthName}
                    </span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMonthOffset(m => m + 1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => setMonthOffset(0)}>Hoje</Button>
              </div>

              <div className="flex-1 overflow-auto">
                <div className="min-w-max relative">
                  {/* Header */}
                  <div className="flex border-b sticky top-0 bg-card z-10">
                    <div className="w-56 shrink-0 border-r p-2 bg-card">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Task</span>
                    </div>
                    <div className="flex relative">
                      {monthDays.map((d, i) => {
                        const dayIsToday = d.toDateString() === today.toDateString();
                        const off = isOffDay(d);
                        return (
                          <div key={i} className={cn(
                            "shrink-0 border-r text-center text-[9px] text-muted-foreground flex flex-col justify-center",
                            off && "bg-muted/40",
                            dayIsToday && "bg-primary/10"
                          )} style={{ width: MONTH_COL_WIDTH, minHeight: 36 }}>
                            <div className="font-medium leading-none">{d.getDate()}</div>
                            <div className="leading-none mt-0.5">{d.toLocaleDateString('pt-BR', { weekday: 'short' }).slice(0, 3)}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Rows — one per task that has segments in this month */}
                  {(() => {
                    const taskEntries = Array.from(taskMonthBars.values());
                    if (taskEntries.length === 0) {
                      return (
                        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                          Nenhuma task com horas alocadas neste mês.
                        </div>
                      );
                    }
                    return taskEntries.map(({ firstDay, lastDay, task, mergedTaskIds }) => {
                      const preview = dragPreview?.taskId === task.id ? dragPreview : null;
                      const barStart = preview ? preview.day : firstDay;
                      const barSpan = preview
                        ? Math.max(1, Math.ceil(preview.durationH / dailyHours))
                        : lastDay - firstDay + 1;
                      const barColor = getBarColor(task);
                      const assignee = profiles?.find(p => p.user_id === task.assignee_id);
                      const isPending = pendingChanges.has(task.id);
                      const totalHours = (() => {
                        const pending = pendingChanges.get(task.id);
                        return pending?.duration_hours ?? (task as any).duration_hours ?? ((task as any).duration_days || 1) * dailyHours;
                      })();

                      return (
                        <div
                          key={task.id}
                          className="flex border-b hover:bg-muted/20 transition-colors cursor-pointer"
                          style={{ minHeight: 36 }}
                          onClick={() => handleTaskClick(task)}
                        >
                          <div className="w-56 shrink-0 border-r p-1.5 flex items-center gap-1.5">
                            {assignee && (
                              <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[8px] font-bold text-primary shrink-0">
                                {assignee.name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <span className="text-xs truncate text-card-foreground">{task.title}</span>
                          </div>
                          <div className="flex relative" style={{ minHeight: 36 }}>
                            {monthDays.map((d, i) => (
                              <div key={i} className={cn(
                                "shrink-0 border-r",
                                isOffDay(d) && "bg-muted/20",
                                d.toDateString() === today.toDateString() && "bg-primary/5"
                              )} style={{ width: MONTH_COL_WIDTH }} />
                            ))}
                            {barStart < monthDays.length && (() => {
                              const effectiveStart = preview ? preview.day : firstDay;
                              const effectiveSpan = preview
                                ? Math.max(1, Math.ceil(preview.durationH / dailyHours))
                                : lastDay - firstDay + 1;
                              const clampedSpan = Math.min(effectiveSpan, monthDays.length - effectiveStart);

                              return (
                                <div
                                  className={cn(
                                    "absolute top-1.5 h-6 rounded-full flex items-center overflow-hidden cursor-grab select-none group",
                                    isPending && "ring-1 ring-primary/50",
                                    preview?.taskId === task.id && "opacity-70 shadow-lg"
                                  )}
                                  style={{
                                    left: effectiveStart * MONTH_COL_WIDTH + 1,
                                    width: Math.max(MONTH_COL_WIDTH, clampedSpan * MONTH_COL_WIDTH - 2),
                                  }}
                                  onClick={() => handleTaskClick(task)}
                                >
                                  {/* Render each day-cell inside the bar */}
                                  {Array.from({ length: clampedSpan }, (_, i) => {
                                    const dayIdx = effectiveStart + i;
                                    const dayDate = monthDays[dayIdx];
                                    const off = dayDate ? isOffDay(dayDate) : false;
                                    const collColor = collectionColorMap.get(task.collection_id);

                                    return (
                                      <div
                                        key={i}
                                        className={cn(
                                          "shrink-0 h-full",
                                          off && "brightness-[0.55]",
                                          !collColor && barColor,
                                        )}
                                        style={{
                                          width: MONTH_COL_WIDTH,
                                          backgroundColor: collColor || undefined,
                                          borderRight: i < clampedSpan - 1 ? '1px solid rgba(255,255,255,0.15)' : undefined,
                                        }}
                                      />
                                    );
                                  })}
                                  {/* Content overlay */}
                                  <div className="absolute inset-0 flex items-center px-2 text-[9px] text-white font-medium truncate">
                                    {assignee && isManager ? (
                                      <GanttAssigneePopover
                                        taskId={task.id}
                                        taskTitle={task.title}
                                        currentAssigneeId={task.assignee_id}
                                        currentHour={workStart}
                                        totalHours={totalHours}
                                        profiles={profiles || []}
                                        
                                        workStartHour={workStart}
                                        dailyWorkHours={dailyHours}
                                        weekendDays={weekendDays}
                                        holidays={holidayDates}
                                      >
                                        <div className="w-4 h-4 rounded-full bg-background/30 flex items-center justify-center text-[7px] font-bold mr-1 shrink-0 cursor-pointer hover:ring-1 hover:ring-white/40" onMouseDown={(e) => e.stopPropagation()}>
                                          {assignee.name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                                        </div>
                                      </GanttAssigneePopover>
                                    ) : assignee ? (
                                      <div className="w-4 h-4 rounded-full bg-background/30 flex items-center justify-center text-[7px] font-bold mr-1 shrink-0">
                                        {assignee.name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                                      </div>
                                    ) : null}
                                    {clampedSpan * MONTH_COL_WIDTH > 60 && <span className="truncate">{task.title}</span>}
                                  </div>
                                  {/* Right resize handle — changes duration */}
                                  <div
                                    className="absolute top-0 bottom-0 right-0 w-3 cursor-ew-resize opacity-0 group-hover:opacity-100 hover:bg-white/30 rounded-r-full z-10"
                                    onMouseDown={(e) => { e.stopPropagation(); handleMonthResize(e, task.id, firstDay, lastDay - firstDay + 1, totalHours); }}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      );
                    });
                  })()}
                  {/* Deadline lines — uses same flex layout as rows so label offset is structural, not guessed */}
                  <div className="absolute inset-0 z-20 pointer-events-none flex">
                    <div className="w-56 shrink-0" />
                    <div className="relative flex-1">
                      {/* Project deadline */}
                      {projectDeadlineDayIdx >= 0 && (
                        <div
                          className="absolute top-0 bottom-0 w-0"
                          style={{ left: (projectDeadlineDayIdx + 1) * MONTH_COL_WIDTH }}
                        >
                          <div className="absolute inset-y-0 w-[2px] -translate-x-1/2 bg-destructive" />
                          <div className="absolute top-0 -translate-x-1/2 bg-destructive text-destructive-foreground text-[7px] font-bold px-1.5 py-0.5 rounded-b whitespace-nowrap pointer-events-auto">FIM</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Legend */}
              {(() => {
                // Collect unique collection colors visible in the current month
                const visibleCollections = new Map<string, { name: string; color: string }>();
                for (const [, bar] of taskMonthBars) {
                  const allIds = bar.mergedTaskIds && bar.mergedTaskIds.size > 0 ? Array.from(bar.mergedTaskIds) : [bar.task.id];
                  for (const tid of allIds) {
                    const history = taskHistoryMap.get(tid);
                    if (!history) continue;
                    for (const rec of history) {
                      const col = collections?.find(c => c.id === rec.collection_id);
                      const color = (col as any)?.color;
                      if (col && color) {
                        visibleCollections.set(rec.collection_id, { name: col.name, color });
                      }
                    }
                  }
                }
                if (visibleCollections.size === 0) return null;
                return (
                  <div className="flex items-center gap-4 px-6 py-2 border-t bg-card shrink-0 flex-wrap">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Legenda:</span>
                    {Array.from(visibleCollections.values()).map(({ name, color }) => (
                      <div key={name} className="flex items-center gap-1.5">
                        <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
                        <span className="text-xs text-muted-foreground">{name}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </TooltipProvider>

      <TaskDetailPanel
        task={selectedTask}
        columns={panelColumns || []}
        profiles={profiles || []}
        onClose={() => { setSelectedTask(null); setExpandImpediments(false); }}
        expandImpediments={expandImpediments}
      />
    </AppLayout>
  );
}
