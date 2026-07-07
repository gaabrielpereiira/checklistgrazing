import { useState } from "react";
import {
  Sun, Moon, Sparkles, LogOut, ChevronRight, ChevronDown, Plus,
  FileText, ListTodo, Folder as FolderIcon, MoreHorizontal, Trash2, Pencil, Settings,
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import { NotificationPanel } from "@/components/NotificationPanel";
import {
  useWorkspaceTree, useCreateSpace, useCreateFolder, useCreateList, useCreateDoc,
  useRenameNode, useDeleteNode, useMoveNode,
} from "@/hooks/useWorkspaceTree";

import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

function InlineCreate({ placeholder, onSubmit, onCancel }: { placeholder: string; onSubmit: (v: string) => void; onCancel: () => void }) {
  const [v, setV] = useState("");
  return (
    <Input
      autoFocus
      value={v}
      placeholder={placeholder}
      onChange={(e) => setV(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && v.trim()) onSubmit(v.trim());
        if (e.key === "Escape") onCancel();
      }}
      onBlur={() => { v.trim() ? onSubmit(v.trim()) : onCancel(); }}
      className="h-7 text-xs"
    />
  );
}

function NodeMenu({ onRename, onDelete, extra }: { onRename?: () => void; onDelete?: () => void; extra?: React.ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button onClick={(e) => e.stopPropagation()} className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-sidebar-accent">
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
        {extra}
        {onRename && <DropdownMenuItem onClick={onRename}><Pencil className="h-3.5 w-3.5 mr-2" />Renomear</DropdownMenuItem>}
        {onDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5 mr-2" />Excluir
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { profile, signOut } = useAuth();
  const { isDark, toggle } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const { data: tree } = useWorkspaceTree();
  const createSpace = useCreateSpace();
  const createFolder = useCreateFolder();
  const createList = useCreateList();
  const createDoc = useCreateDoc();
  const rename = useRenameNode();
  const del = useDeleteNode();
  const move = useMoveNode();

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [creatingIn, setCreatingIn] = useState<{ kind: "space" | "list" | "folder" | "doc"; parentId?: string; folderId?: string | null } | null>(null);
  const [renaming, setRenaming] = useState<{ table: "spaces" | "folders" | "lists"; id: string; current: string } | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const onDragStart = (e: React.DragEvent, table: "lists" | "docs" | "folders", id: string) => {
    e.dataTransfer.setData("application/x-node", JSON.stringify({ table, id }));
    e.dataTransfer.effectAllowed = "move";
  };
  const onDropOnSpace = (e: React.DragEvent, spaceId: string) => {
    e.preventDefault(); setDragOver(null);
    const raw = e.dataTransfer.getData("application/x-node");
    if (!raw) return;
    const { table, id } = JSON.parse(raw);
    if (table === "lists" || table === "docs") move.mutate({ table, id, patch: { space_id: spaceId, folder_id: null } });
    else if (table === "folders") move.mutate({ table, id, patch: { space_id: spaceId } });
  };
  const onDropOnFolder = (e: React.DragEvent, folder: { id: string; space_id: string }) => {
    e.preventDefault(); e.stopPropagation(); setDragOver(null);
    const raw = e.dataTransfer.getData("application/x-node");
    if (!raw) return;
    const { table, id } = JSON.parse(raw);
    if (table === "lists" || table === "docs") move.mutate({ table, id, patch: { space_id: folder.space_id, folder_id: folder.id } });
  };


  const toggle_ = (id: string) => setExpanded((p) => ({ ...p, [id]: !p[id] }));

  const initials = profile?.name?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "?";

  const isListActive = (id: string) => location.pathname === `/l/${id}`;
  const isDocActive = (id: string) => location.pathname === `/d/${id}`;

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

      <SidebarContent className="px-2">
        {!collapsed && (
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Espaços</span>
            <button
              onClick={() => setCreatingIn({ kind: "space" })}
              className="p-0.5 rounded hover:bg-sidebar-accent"
              title="Novo Espaço"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {creatingIn?.kind === "space" && !collapsed && (
          <div className="px-2 pb-1">
            <InlineCreate
              placeholder="Nome do espaço"
              onSubmit={(name) => {
                createSpace.mutate(name, { onSuccess: () => toast({ description: "Espaço criado" }) });
                setCreatingIn(null);
              }}
              onCancel={() => setCreatingIn(null)}
            />
          </div>
        )}

        <div className="space-y-0.5">
          {tree?.map((node) => {
            const spaceOpen = expanded[node.space.id] ?? true;
            return (
              <div key={node.space.id}>
                <div
                  className={cn(
                    "group flex items-center gap-1 px-2 py-1 rounded text-sm cursor-pointer hover:bg-sidebar-accent",
                  )}
                  onClick={() => toggle_(node.space.id)}
                >
                  {spaceOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                  <span className="h-3 w-3 rounded shrink-0" style={{ backgroundColor: node.space.color || "#6366f1" }} />
                  {!collapsed && (
                    <>
                      {renaming?.table === "spaces" && renaming.id === node.space.id ? (
                        <InlineCreate
                          placeholder="Nome"
                          onSubmit={(name) => { rename.mutate({ table: "spaces", id: node.space.id, name }); setRenaming(null); }}
                          onCancel={() => setRenaming(null)}
                        />
                      ) : (
                        <span className="flex-1 truncate font-medium">{node.space.name}</span>
                      )}
                      <NodeMenu
                        onRename={() => setRenaming({ table: "spaces", id: node.space.id, current: node.space.name })}
                        onDelete={() => { if (confirm("Excluir espaço e todo o conteúdo?")) del.mutate({ table: "spaces", id: node.space.id }); }}
                        extra={
                          <>
                            <DropdownMenuItem onClick={() => setCreatingIn({ kind: "folder", parentId: node.space.id })}>
                              <FolderIcon className="h-3.5 w-3.5 mr-2" />Nova pasta
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setCreatingIn({ kind: "list", parentId: node.space.id, folderId: null })}>
                              <ListTodo className="h-3.5 w-3.5 mr-2" />Nova lista
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setCreatingIn({ kind: "doc", parentId: node.space.id, folderId: null })}>
                              <FileText className="h-3.5 w-3.5 mr-2" />Novo documento
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        }
                      />
                    </>
                  )}
                </div>

                {spaceOpen && !collapsed && (
                  <div className="ml-5 space-y-0.5 border-l border-sidebar-border pl-2">
                    {node.folders.map((f) => {
                      const folderOpen = expanded[f.id] ?? true;
                      return (
                        <div key={f.id}>
                          <div className="group flex items-center gap-1 px-2 py-1 rounded text-sm cursor-pointer hover:bg-sidebar-accent" onClick={() => toggle_(f.id)}>
                            {folderOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                            <FolderIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            {renaming?.table === "folders" && renaming.id === f.id ? (
                              <InlineCreate placeholder="Nome" onSubmit={(name) => { rename.mutate({ table: "folders", id: f.id, name }); setRenaming(null); }} onCancel={() => setRenaming(null)} />
                            ) : (
                              <span className="flex-1 truncate">{f.name}</span>
                            )}
                            <NodeMenu
                              onRename={() => setRenaming({ table: "folders", id: f.id, current: f.name })}
                              onDelete={() => { if (confirm("Excluir pasta e todo o conteúdo?")) del.mutate({ table: "folders", id: f.id }); }}
                              extra={
                                <>
                                  <DropdownMenuItem onClick={() => setCreatingIn({ kind: "list", parentId: node.space.id, folderId: f.id })}>
                                    <ListTodo className="h-3.5 w-3.5 mr-2" />Nova lista
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setCreatingIn({ kind: "doc", parentId: node.space.id, folderId: f.id })}>
                                    <FileText className="h-3.5 w-3.5 mr-2" />Novo documento
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                </>
                              }
                            />
                          </div>
                          {folderOpen && (
                            <div className="ml-5 space-y-0.5 border-l border-sidebar-border pl-2">
                              {f.lists.map((l) => (
                                <div key={l.id} className={cn("group flex items-center gap-1 px-2 py-1 rounded text-sm cursor-pointer hover:bg-sidebar-accent", isListActive(l.id) && "bg-sidebar-accent text-primary font-medium")} onClick={() => navigate(`/l/${l.id}`)}>
                                  <ListTodo className="h-3.5 w-3.5 shrink-0" style={{ color: l.color || undefined }} />
                                  {renaming?.table === "lists" && renaming.id === l.id ? (
                                    <InlineCreate placeholder="Nome" onSubmit={(name) => { rename.mutate({ table: "lists", id: l.id, name }); setRenaming(null); }} onCancel={() => setRenaming(null)} />
                                  ) : (
                                    <span className="flex-1 truncate">{l.name}</span>
                                  )}
                                  <NodeMenu
                                    onRename={() => setRenaming({ table: "lists", id: l.id, current: l.name })}
                                    onDelete={() => { if (confirm("Excluir lista?")) del.mutate({ table: "lists", id: l.id }); }}
                                  />
                                </div>
                              ))}
                              {f.docs.map((d) => (
                                <div key={d.id} className={cn("group flex items-center gap-1 px-2 py-1 rounded text-sm cursor-pointer hover:bg-sidebar-accent", isDocActive(d.id) && "bg-sidebar-accent text-primary font-medium")} onClick={() => navigate(`/d/${d.id}`)}>
                                  <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                  <span className="flex-1 truncate">{d.title}</span>
                                  <NodeMenu
                                    onDelete={() => { if (confirm("Excluir documento?")) del.mutate({ table: "docs", id: d.id }); }}
                                  />
                                </div>
                              ))}
                              {creatingIn?.kind === "list" && creatingIn.folderId === f.id && (
                                <InlineCreate placeholder="Nome da lista" onSubmit={(name) => { createList.mutate({ space_id: node.space.id, folder_id: f.id, name }); setCreatingIn(null); }} onCancel={() => setCreatingIn(null)} />
                              )}
                              {creatingIn?.kind === "doc" && creatingIn.folderId === f.id && (
                                <InlineCreate placeholder="Título do doc" onSubmit={(title) => { createDoc.mutate({ space_id: node.space.id, folder_id: f.id, title }); setCreatingIn(null); }} onCancel={() => setCreatingIn(null)} />
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {node.looseLists.map((l) => (
                      <div key={l.id} className={cn("group flex items-center gap-1 px-2 py-1 rounded text-sm cursor-pointer hover:bg-sidebar-accent", isListActive(l.id) && "bg-sidebar-accent text-primary font-medium")} onClick={() => navigate(`/l/${l.id}`)}>
                        <ListTodo className="h-3.5 w-3.5 shrink-0" style={{ color: l.color || undefined }} />
                        <span className="flex-1 truncate">{l.name}</span>
                        <NodeMenu
                          onRename={() => setRenaming({ table: "lists", id: l.id, current: l.name })}
                          onDelete={() => { if (confirm("Excluir lista?")) del.mutate({ table: "lists", id: l.id }); }}
                        />
                      </div>
                    ))}
                    {node.looseDocs.map((d) => (
                      <div key={d.id} className={cn("group flex items-center gap-1 px-2 py-1 rounded text-sm cursor-pointer hover:bg-sidebar-accent", isDocActive(d.id) && "bg-sidebar-accent text-primary font-medium")} onClick={() => navigate(`/d/${d.id}`)}>
                        <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="flex-1 truncate">{d.title}</span>
                        <NodeMenu onDelete={() => { if (confirm("Excluir documento?")) del.mutate({ table: "docs", id: d.id }); }} />
                      </div>
                    ))}

                    {creatingIn?.kind === "folder" && creatingIn.parentId === node.space.id && (
                      <InlineCreate placeholder="Nome da pasta" onSubmit={(name) => { createFolder.mutate({ space_id: node.space.id, name }); setCreatingIn(null); }} onCancel={() => setCreatingIn(null)} />
                    )}
                    {creatingIn?.kind === "list" && creatingIn.parentId === node.space.id && creatingIn.folderId === null && (
                      <InlineCreate placeholder="Nome da lista" onSubmit={(name) => { createList.mutate({ space_id: node.space.id, folder_id: null, name }); setCreatingIn(null); }} onCancel={() => setCreatingIn(null)} />
                    )}
                    {creatingIn?.kind === "doc" && creatingIn.parentId === node.space.id && creatingIn.folderId === null && (
                      <InlineCreate placeholder="Título do doc" onSubmit={(title) => { createDoc.mutate({ space_id: node.space.id, folder_id: null, title }); setCreatingIn(null); }} onCancel={() => setCreatingIn(null)} />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {!collapsed && (
          <div className="mt-4 border-t pt-2 space-y-0.5">
            <button
              onClick={() => navigate("/configuracoes")}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-sidebar-accent",
                location.pathname === "/configuracoes" && "bg-sidebar-accent text-primary font-medium",
              )}
            >
              <Settings className="h-4 w-4" />
              Configurações
            </button>
          </div>
        )}
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
