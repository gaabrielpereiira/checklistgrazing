import { useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useNotifications, useMarkNotificationRead, useUnreadNotificationCount } from "@/hooks/useNotifications";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

function timeAgo(dateStr: string): string {
  const diff = Math.max(0, Date.now() - new Date(dateStr).getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function NotificationPanel() {
  const [open, setOpen] = useState(false);
  const { data: notifications } = useNotifications();
  const markRead = useMarkNotificationRead();
  const unread = useUnreadNotificationCount();
  const qc = useQueryClient();

  const markAll = async () => {
    const un = notifications?.filter((n) => !n.is_read) || [];
    await Promise.all(un.map((n) => supabase.from("notifications").update({ is_read: true }).eq("id", n.id)));
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <Badge variant="destructive" className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px]">
              {unread > 9 ? "9+" : unread}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[380px] p-0 flex flex-col">
        <SheetHeader className="p-4 pb-2 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base">Notificações</SheetTitle>
            {unread > 0 && (
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={markAll}>
                <CheckCheck className="h-3.5 w-3.5" />Marcar todas
              </Button>
            )}
          </div>
        </SheetHeader>
        <ScrollArea className="flex-1">
          {!notifications || notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Bell className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">Nenhuma notificação</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => !n.is_read && markRead.mutate(n.id)}
                  className={cn("w-full text-left px-4 py-3 hover:bg-muted/50", !n.is_read && "bg-primary/5")}
                >
                  <p className="text-sm">{n.message}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{timeAgo(n.created_at)}</p>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
