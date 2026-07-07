import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useProfiles, useStatuses, type Task, type TaskPriority } from "@/hooks/useListData";

interface TaskModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  listId: string;
  breadcrumb?: string;
  task?: Task | null;
  onSubmit: (patch: Partial<Task>) => void;
}

export function TaskModal({ open, onOpenChange, listId, breadcrumb, task, onSubmit }: TaskModalProps) {
  const { data: profiles = [] } = useProfiles();
  const { data: statuses = [] } = useStatuses(listId);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [statusId, setStatusId] = useState<string>("");
  const [priority, setPriority] = useState<TaskPriority>("media");
  const [startDate, setStartDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [useTime, setUseTime] = useState(false);
  const [dueTime, setDueTime] = useState("");
  const [assignee, setAssignee] = useState<string>("none");

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || "");
      setStatusId(task.status_id || "");
      setPriority(task.priority);
      setStartDate(task.start_date || new Date().toISOString().slice(0, 10));
      setDueDate(task.due_date || "");
      setDueTime(task.due_time || "");
      setUseTime(!!task.due_time);
      setAssignee(task.assignee_id || "none");
    } else {
      setTitle(""); setDescription(""); setStatusId(statuses[0]?.id || "");
      setPriority("media"); setStartDate(new Date().toISOString().slice(0, 10));
      setDueDate(""); setDueTime(""); setUseTime(false); setAssignee("none");
    }
  }, [task, open, statuses]);

  const submit = () => {
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      description: description.trim() || null,
      status_id: statusId || null,
      priority,
      start_date: startDate || null,
      due_date: dueDate || null,
      due_time: useTime && dueTime ? dueTime : null,
      assignee_id: assignee === "none" ? null : assignee,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{task ? "Editar tarefa" : "Nova tarefa"}</DialogTitle>
          {breadcrumb && <p className="text-xs text-muted-foreground">{breadcrumb}</p>}
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Título *</Label>
            <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && title.trim() && submit()} />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[80px]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={statusId} onValueChange={setStatusId}>
                <SelectTrigger><SelectValue placeholder="Sem status" /></SelectTrigger>
                <SelectContent>
                  {statuses.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                        {s.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Data de início</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Prazo</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="use-time" checked={useTime} onCheckedChange={(c) => setUseTime(!!c)} />
            <Label htmlFor="use-time" className="cursor-pointer">Incluir horário</Label>
            {useTime && <Input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} className="w-32 ml-2" />}
          </div>
          <div className="space-y-1.5">
            <Label>Responsável</Label>
            <Select value={assignee} onValueChange={setAssignee}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {profiles.map((p: any) => <SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={!title.trim()}>{task ? "Salvar" : "Criar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
