import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Trash2, Clock, CalendarOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  useWorkspaceSettings,
  useUpdateWorkspaceSettings,
  useWorkspaceHolidays,
  useCreateHoliday,
  useDeleteHoliday,
} from "@/hooks/useWorkspaceSettings";
import { toast } from "sonner";

const WEEKDAYS = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Segunda" },
  { value: 2, label: "Terça" },
  { value: 3, label: "Quarta" },
  { value: 4, label: "Quinta" },
  { value: 5, label: "Sexta" },
  { value: 6, label: "Sábado" },
];

export function WorkScheduleSettings() {
  const { data: settings } = useWorkspaceSettings();
  const updateSettings = useUpdateWorkspaceSettings();
  const { data: holidays } = useWorkspaceHolidays();
  const createHoliday = useCreateHoliday();
  const deleteHoliday = useDeleteHoliday();

  const [newHolidayDate, setNewHolidayDate] = useState<Date>();
  const [newHolidayLabel, setNewHolidayLabel] = useState("");

  if (!settings) return null;

  const workEndTime = (() => {
    const [h, m] = (settings.work_start_time || "09:00").split(":").map(Number);
    const totalMinutes = h * 60 + m + (settings.daily_work_hours || 8) * 60;
    const endH = Math.floor(totalMinutes / 60) % 24;
    const endM = totalMinutes % 60;
    return `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
  })();

  const handleHoursChange = (val: string) => {
    const n = parseInt(val);
    if (n >= 1 && n <= 24) {
      updateSettings.mutate({ daily_work_hours: n });
    }
  };

  const handleStartTimeChange = (val: string) => {
    updateSettings.mutate({ work_start_time: val });
  };

  const handleWeekendToggle = (day: number, checked: boolean) => {
    const current = settings.weekend_days || [];
    const updated = checked
      ? [...current, day]
      : current.filter((d) => d !== day);
    updateSettings.mutate({ weekend_days: updated });
  };

  const handleAddHoliday = () => {
    if (!newHolidayDate) return;
    const dateStr = format(newHolidayDate, "yyyy-MM-dd");
    createHoliday.mutate(
      { holiday_date: dateStr, label: newHolidayLabel.trim() || undefined },
      {
        onSuccess: () => {
          setNewHolidayDate(undefined);
          setNewHolidayLabel("");
          toast.success("Feriado adicionado!");
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      {/* Work hours config */}
      <div className="rounded-xl border bg-card p-6 space-y-4">
        <h3 className="font-heading text-base font-semibold text-card-foreground">Carga horária</h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Horas por dia</label>
            <Input
              type="number"
              min={1}
              max={24}
              value={settings.daily_work_hours}
              onChange={(e) => handleHoursChange(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Início do expediente</label>
            <Input
              type="time"
              value={settings.work_start_time?.slice(0, 5) || "09:00"}
              onChange={(e) => handleStartTimeChange(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Fim (calculado)</label>
            <Input type="time" value={workEndTime} disabled className="w-full bg-muted" />
          </div>
        </div>
      </div>

      {/* Weekend days */}
      <div className="rounded-xl border bg-card p-6 space-y-4">
        <h3 className="font-heading text-base font-semibold text-card-foreground">Dias de folga semanais</h3>
        <div className="flex flex-wrap gap-3">
          {WEEKDAYS.map((day) => (
            <label
              key={day.value}
              className="flex items-center gap-2 text-sm cursor-pointer"
            >
              <Checkbox
                checked={(settings.weekend_days || []).includes(day.value)}
                onCheckedChange={(checked) =>
                  handleWeekendToggle(day.value, !!checked)
                }
              />
              <span className="text-card-foreground">{day.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Holidays */}
      <div className="rounded-xl border bg-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <CalendarOff className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-heading text-base font-semibold text-card-foreground">Feriados e datas especiais</h3>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[180px] justify-start text-left font-normal", !newHolidayDate && "text-muted-foreground")}>
                {newHolidayDate ? format(newHolidayDate, "dd/MM/yyyy") : "Selecionar data"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={newHolidayDate}
                onSelect={setNewHolidayDate}
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          <Input
            placeholder="Label (ex: Natal)"
            value={newHolidayLabel}
            onChange={(e) => setNewHolidayLabel(e.target.value)}
            className="flex-1"
          />
          <Button onClick={handleAddHoliday} disabled={!newHolidayDate || createHoliday.isPending}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar
          </Button>
        </div>

        <div className="space-y-2">
          {holidays?.map((h) => (
            <div key={h.id} className="flex items-center justify-between rounded-lg border bg-background p-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-card-foreground">
                  {format(new Date(h.holiday_date + "T12:00:00"), "dd/MM/yyyy")}
                </span>
                {h.label && (
                  <span className="text-xs text-muted-foreground">— {h.label}</span>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => deleteHoliday.mutate(h.id)}
              >
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </div>
          ))}
          {(!holidays || holidays.length === 0) && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nenhum feriado cadastrado.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
