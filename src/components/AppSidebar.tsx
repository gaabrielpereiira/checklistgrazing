import { Sun, Moon, Columns, GanttChart, MessageSquare, Settings, Sparkles, LogOut, LayoutGrid, Users, UsersRound, FolderOpen } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarMenu,
  SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import { useReceivedRequests } from "@/hooks/useTaskData";
import { NotificationPanel } from "@/components/NotificationPanel";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { profile, signOut } = useAuth();
  const { isDark, toggle } = useTheme();
  // unreadCount is now handled by NotificationPanel

  const navItems = [
    { title: "Meu Dia", url: "/meu-dia", icon: Sun, badge: 0 },
    { title: "Kanban", url: "/", icon: Columns, badge: 0 },
    { title: "Panorâmica", url: "/panoramica", icon: LayoutGrid, badge: 0 },
    { title: "Agenda", url: "/gantt", icon: GanttChart, badge: 0 },
    { title: "Projetos", url: "/projetos", icon: FolderOpen, badge: 0 },
    { title: "Chat IA", url: "/chat", icon: MessageSquare, badge: 0 },
    { title: "Equipe", url: "/equipe", icon: Users, badge: 0 },
    { title: "Equipes", url: "/equipes", icon: UsersRound, badge: 0 },
    { title: "Configurações", url: "/configuracoes", icon: Settings, badge: 0 },
  ];

  const initials = profile?.name
    ? profile.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shrink-0">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          {!collapsed && <span className="font-heading text-lg font-bold text-foreground">Galileu's</span>}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      activeClassName="bg-sidebar-accent text-primary font-semibold"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span className="flex-1">{item.title}</span>}
                      {!collapsed && item.badge > 0 && (
                        <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-xs">
                          {item.badge}
                        </Badge>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-3 space-y-2">
        <div className="flex items-center gap-1">
          {!collapsed ? (
            <Button variant="ghost" size="sm" className="flex-1 justify-start gap-2" onClick={toggle}>
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {isDark ? "Modo claro" : "Modo escuro"}
            </Button>
          ) : (
            <Button variant="ghost" size="icon" onClick={toggle}>
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          )}
          <NotificationPanel />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary shrink-0">
            {initials}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{profile?.name}</p>
              <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
            </div>
          )}
          {!collapsed && (
            <Button variant="ghost" size="icon" onClick={signOut} className="shrink-0">
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
