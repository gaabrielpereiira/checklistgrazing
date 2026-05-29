import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Clock, Calendar, Zap } from "lucide-react";

interface AssigneeScheduleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assigneeName: string;
  onKeepCurrent: () => void;
  onAutoAdapt: () => void;
}

export function AssigneeScheduleModal({
  open,
  onOpenChange,
  assigneeName,
  onKeepCurrent,
  onAutoAdapt,
}: AssigneeScheduleModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Atribuir a {assigneeName}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Como deseja posicionar a task na agenda?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <button
            onClick={() => { onKeepCurrent(); onOpenChange(false); }}
            className="w-full flex items-start gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors text-left"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted shrink-0">
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-card-foreground">Manter agenda atual</p>
              <p className="text-xs text-muted-foreground">Datas e horários permanecem iguais</p>
            </div>
          </button>

          <button
            onClick={() => { onAutoAdapt(); onOpenChange(false); }}
            className="w-full flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3 hover:bg-primary/10 transition-colors text-left"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 shrink-0">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-card-foreground">Adaptar automaticamente</p>
              <p className="text-xs text-muted-foreground">
                Redistribuir nos horários disponíveis de {assigneeName}
              </p>
            </div>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
