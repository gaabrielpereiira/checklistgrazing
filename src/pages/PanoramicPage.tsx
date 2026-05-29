import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { useCollections, useAllTasks, useAllColumns, useColumnConnections, useUserRoles, useArchiveCollection, type FullTaskWithCollection } from "@/hooks/useTaskData";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowRight, AlertTriangle, Clock, CheckCircle2, Link2, BarChart3, Shield, Eye, Archive } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface CollectionSummary {
  id: string;
  name: string;
  totalTasks: number;
  doneTasks: number;
  overdueTasks: number;
  activeImpediments: number;
  urgentTasks: number;
  linkedOutgoing: number;
  linkedIncoming: number;
  progressPercent: number;
}

export default function PanoramicPage() {
  const { user } = useAuth();
  const { data: collections } = useCollections();
  const { data: allTasks } = useAllTasks();
  const { data: allColumns } = useAllColumns();
  const { data: connections } = useColumnConnections();
  const { data: roles } = useUserRoles();
  const archiveCollection = useArchiveCollection();

  const today = new Date(new Date().toDateString());

  const userRole = useMemo(() => {
    if (!roles || !user) return "usuario";
    const r = roles.find(r => r.user_id === user.id);
    return r?.role || "usuario";
  }, [roles, user]);

  // Build summaries per collection
  const summaries = useMemo<CollectionSummary[]>(() => {
    if (!collections || !allTasks || !allColumns) return [];

    return collections.filter(c => !c.is_archived).map(col => {
      const tasks = allTasks.filter(t => t.collection_id === col.id && !(t as any).is_archived);
      const doneTasks = tasks.filter(t => (t as any).is_done).length;
      const overdueTasks = tasks.filter(t => t.due_date && new Date(t.due_date) < today).length;
      const activeImpediments = tasks.reduce((acc, t) => acc + (t.impediments?.filter(i => !i.resolved_at).length || 0), 0);
      const urgentTasks = tasks.filter(t => t.priority === "urgente").length;
      const linkedOutgoing = tasks.filter(t => t.linked_task_id && allTasks.some(lt => lt.id === t.linked_task_id && lt.collection_id !== col.id)).length;
      const linkedIncoming = allTasks.filter(t => t.linked_task_id && tasks.some(ct => ct.id === t.linked_task_id) && t.collection_id !== col.id).length;

      return {
        id: col.id,
        name: col.name,
        totalTasks: tasks.length,
        doneTasks,
        overdueTasks,
        activeImpediments,
        urgentTasks,
        linkedOutgoing,
        linkedIncoming,
        progressPercent: tasks.length > 0 ? Math.round((doneTasks / tasks.length) * 100) : 0,
      };
    });
  }, [collections, allTasks, allColumns, today]);

  // Cross-collection flows from connections
  const flows = useMemo(() => {
    if (!connections || !allColumns || !collections) return [];
    return connections.map(conn => {
      const srcCol = allColumns.find(c => c.id === conn.source_column_id);
      const tgtCol = allColumns.find(c => c.id === conn.target_column_id);
      if (!srcCol || !tgtCol) return null;
      const srcCollection = collections.find(c => c.id === srcCol.collection_id);
      const tgtCollection = collections.find(c => c.id === tgtCol.collection_id);
      if (!srcCollection || !tgtCollection || srcCollection.id === tgtCollection.id) return null;
      return {
        id: conn.id,
        from: { collection: srcCollection.name, column: srcCol.name },
        to: { collection: tgtCollection.name, column: tgtCol.name },
      };
    }).filter(Boolean);
  }, [connections, allColumns, collections]);

  const navigate = useNavigate();

  return (
    <AppLayout>
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground">Visão Panorâmica</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Resumo de todas as coleções e fluxos do workspace
            </p>
          </div>
          <Badge variant="outline" className="gap-1.5">
            <Shield className="h-3 w-3" />
            {userRole === "admin" ? "Admin" : userRole === "gestor" ? "Gestor" : "Usuário"}
          </Badge>
        </div>

        {/* Role notice for usuario */}
        {userRole === "usuario" && (
          <div className="flex items-center gap-2 rounded-lg border border-muted bg-muted/30 px-4 py-3">
            <Eye className="h-4 w-4 text-muted-foreground shrink-0" />
            <p className="text-sm text-muted-foreground">
              Você está vendo apenas as coleções disponíveis. Contate um administrador para acesso completo.
            </p>
          </div>
        )}

        {/* Collection cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {summaries.map(s => (
            <div
              key={s.id}
              onClick={() => navigate("/")}
              className={cn(
                "group cursor-pointer rounded-xl border bg-card p-5 transition-all hover:shadow-lg hover:border-primary/30",
                s.activeImpediments > 0 && "border-status-attention/30",
                s.overdueTasks > 0 && s.activeImpediments === 0 && "border-status-overdue/20"
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-heading font-semibold text-card-foreground group-hover:text-primary transition-colors">
                  {s.name}
                </h3>
                <div className="flex items-center gap-2">
                  {s.progressPercent === 100 && s.totalTasks > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        archiveCollection.mutate(s.id);
                        toast.success("Coleção arquivada!");
                      }}
                      className="inline-flex items-center gap-1 rounded-full bg-status-on-track/15 px-2 py-0.5 text-[11px] font-medium text-status-on-track hover:bg-status-on-track/25 transition-colors"
                    >
                      <Archive className="h-3 w-3" /> Arquivar
                    </button>
                  )}
                  <span className="text-xs text-muted-foreground">{s.totalTasks} tasks</span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-muted-foreground">Progresso</span>
                  <span className="text-[11px] font-medium text-foreground">{s.progressPercent}%</span>
                </div>
                <Progress value={s.progressPercent} className="h-2" />
              </div>

              {/* Stats row */}
              <div className="flex flex-wrap gap-2">
                {s.doneTasks > 0 && (
                  <TooltipProvider><Tooltip><TooltipTrigger asChild>
                    <span className="inline-flex items-center gap-1 rounded-full bg-status-on-track/10 px-2 py-0.5 text-[11px] font-medium text-status-on-track">
                      <CheckCircle2 className="h-3 w-3" /> {s.doneTasks}
                    </span>
                  </TooltipTrigger><TooltipContent>Concluídas</TooltipContent></Tooltip></TooltipProvider>
                )}
                {s.overdueTasks > 0 && (
                  <TooltipProvider><Tooltip><TooltipTrigger asChild>
                    <span className="inline-flex items-center gap-1 rounded-full bg-status-overdue/10 px-2 py-0.5 text-[11px] font-medium text-status-overdue">
                      <Clock className="h-3 w-3" /> {s.overdueTasks}
                    </span>
                  </TooltipTrigger><TooltipContent>Atrasadas</TooltipContent></Tooltip></TooltipProvider>
                )}
                {s.activeImpediments > 0 && (
                  <TooltipProvider><Tooltip><TooltipTrigger asChild>
                    <span className="inline-flex items-center gap-1 rounded-full bg-status-attention/10 px-2 py-0.5 text-[11px] font-medium text-status-attention">
                      <AlertTriangle className="h-3 w-3" /> {s.activeImpediments}
                    </span>
                  </TooltipTrigger><TooltipContent>Impedimentos ativos</TooltipContent></Tooltip></TooltipProvider>
                )}
                {s.urgentTasks > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
                    🔥 {s.urgentTasks}
                  </span>
                )}
                {(s.linkedOutgoing > 0 || s.linkedIncoming > 0) && (
                  <TooltipProvider><Tooltip><TooltipTrigger asChild>
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                      <Link2 className="h-3 w-3" /> {s.linkedOutgoing + s.linkedIncoming}
                    </span>
                  </TooltipTrigger><TooltipContent>{s.linkedOutgoing} saindo, {s.linkedIncoming} entrando</TooltipContent></Tooltip></TooltipProvider>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Cross-collection flows */}
        {flows.length > 0 && (
          <div>
            <h2 className="font-heading text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Fluxos entre Coleções
            </h2>
            <div className="space-y-2">
              {flows.map((flow: any) => (
                <div key={flow.id} className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-sm font-medium text-card-foreground truncate">{flow.from.collection}</span>
                    <span className="text-xs text-muted-foreground">({flow.from.column})</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-sm font-medium text-card-foreground truncate">{flow.to.collection}</span>
                    <span className="text-xs text-muted-foreground">({flow.to.column})</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {summaries.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">Nenhuma coleção encontrada</p>
            <p className="text-sm mt-1">Crie coleções no Kanban para visualizá-las aqui.</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
