import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Check, CheckCheck, Inbox as InboxIcon, AlertTriangle, ArrowRight, Clock, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useNotifications, useMarkNotificationRead, useUnreadNotificationCount } from "@/hooks/useTaskData";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import type { Notification } from "@/hooks/useTaskData";

const NOTIFICATION_CONFIG: Record<string, { icon: typeof Bell; color: string; label: string }> = {
  request_received: { icon: InboxIcon, color: "text-primary", label: "Solicitação recebida" },
  request_accepted: { icon: Check, color: "text-emerald-500", label: "Solicitação aceita" },
  request_refused: { icon: X, color: "text-destructive", label: "Solicitação recusada" },
  task_due_today: { icon: Clock, color: "text-amber-500", label: "Prazo hoje" },
  impediment_resolved: { icon: AlertTriangle, color: "text-emerald-500", label: "Impedimento resolvido" },
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.max(0, now - then);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `há ${days}d`;
  return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function NotificationPanel() {
  const [open, setOpen] = useState(false);
  const { data: notifications } = useNotifications();
  const markRead = useMarkNotificationRead();
  const unreadCount = useUnreadNotificationCount();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const handleMarkAllRead = async () => {
    const unread = notifications?.filter(n => !n.is_read) || [];
    await Promise.all(unread.map(n =>
      supabase.from("notifications").update({ is_read: true }).eq("id", n.id)
    ));
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  const handleClick = (notif: Notification) => {
    if (!notif.is_read) {
      markRead.mutate(notif.id);
    }
    // Navigate based on reference type
    if (notif.reference_type === "request") {
      navigate("/solicitacoes");
    } else if (notif.reference_type === "task") {
      navigate("/");
    }
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] flex items-center justify-center"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[380px] p-0 flex flex-col">
        <SheetHeader className="p-4 pb-2 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base">Notificações</SheetTitle>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={handleMarkAllRead}>
                <CheckCheck className="h-3.5 w-3.5" />
                Marcar todas como lidas
              </Button>
            )}
          </div>
        </SheetHeader>
        <ScrollArea className="flex-1">
          {(!notifications || notifications.length === 0) ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Bell className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">Nenhuma notificação</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map(notif => {
                const config = NOTIFICATION_CONFIG[notif.type] || { icon: Bell, color: "text-muted-foreground", label: notif.type };
                const Icon = config.icon;
                return (
                  <button
                    key={notif.id}
                    onClick={() => handleClick(notif)}
                    className={cn(
                      "w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-muted/50 transition-colors",
                      !notif.is_read && "bg-primary/5"
                    )}
                  >
                    <div className={cn("mt-0.5 shrink-0", config.color)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                          {config.label}
                        </span>
                        {!notif.is_read && (
                          <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                        )}
                      </div>
                      <p className="text-sm text-foreground mt-0.5 line-clamp-2">{notif.message}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">{timeAgo(notif.created_at)}</p>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground mt-1 shrink-0 opacity-0 group-hover:opacity-100" />
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
