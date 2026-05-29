import { useState, useMemo } from "react";
import { Check, ChevronDown, Plus, Search, Archive, Settings, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Collection } from "@/hooks/useTaskData";

interface CollectionSelectorProps {
  collections: Collection[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewCollection: () => void;
  onArchive: (id: string) => void;
  onUnarchive: (id: string) => void;
  onDelete: (collection: Collection) => void;
  onManage: () => void;
  userRole?: string;
}

export function CollectionSelector({
  collections,
  activeId,
  onSelect,
  onNewCollection,
  onArchive,
  onUnarchive,
  onDelete,
  onManage,
  userRole,
}: CollectionSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const active = useMemo(() => collections.filter(c => !c.is_archived), [collections]);
  const archived = useMemo(() => collections.filter(c => c.is_archived), [collections]);

  const filteredActive = useMemo(
    () => active.filter(c => c.name.toLowerCase().includes(search.toLowerCase())),
    [active, search]
  );
  const filteredArchived = useMemo(
    () => archived.filter(c => c.name.toLowerCase().includes(search.toLowerCase())),
    [archived, search]
  );

  const currentCollection = collections.find(c => c.id === activeId);
  const currentName = currentCollection?.name || "Selecionar coleção";
  const currentColor = (currentCollection as any)?.color as string | null;
  const isManager = userRole === "admin" || userRole === "gestor";

  const handleSelect = (id: string) => {
    onSelect(id);
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-56 justify-between font-medium">
          <span className="flex items-center gap-2 truncate">
            {currentColor && <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: currentColor }} />}
            {currentName}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        {/* Search */}
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar coleção…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 text-sm"
            />
          </div>
        </div>

        <div className="max-h-72 overflow-y-auto scrollbar-thin">
          {/* Active */}
          {filteredActive.length > 0 && (
            <div className="p-1">
              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Ativas
              </div>
              {filteredActive.map(c => (
                <button
                  key={c.id}
                  onClick={() => handleSelect(c.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent",
                    c.id === activeId && "bg-accent font-medium"
                  )}
                >
                  {c.id === activeId ? (
                    <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                  ) : (c as any).color ? (
                    <span className="h-3.5 w-3.5 rounded-full shrink-0" style={{ backgroundColor: (c as any).color }} />
                  ) : (
                    <span className="h-3.5 w-3.5 shrink-0" />
                  )}
                  <span className="truncate flex-1 text-left">{c.name}</span>
                  {isManager && c.id === activeId && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onArchive(c.id); }}
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                      title="Arquivar"
                    >
                      <Archive className="h-3.5 w-3.5" />
                    </button>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Archived */}
          {filteredArchived.length > 0 && (
            <div className="p-1 border-t">
              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Arquivadas
              </div>
              {filteredArchived.map(c => (
                <div key={c.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm">
                  <Archive className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate flex-1 text-muted-foreground">{c.name}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => { onUnarchive(c.id); }}
                      className="text-xs text-primary hover:underline"
                    >
                      Restaurar
                    </button>
                    {userRole === "admin" && (
                      <button
                        onClick={() => onDelete(c)}
                        className="text-muted-foreground hover:text-destructive"
                        title="Excluir"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {filteredActive.length === 0 && filteredArchived.length === 0 && (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Nenhuma coleção encontrada.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-1.5 space-y-0.5">
          {isManager && (
            <button
              onClick={() => { setOpen(false); onNewCollection(); }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-accent"
            >
              <Plus className="h-4 w-4" />
              Nova Coleção
            </button>
          )}
          {isManager && (
            <button
              onClick={() => { setOpen(false); onManage(); }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent"
            >
              <Settings className="h-4 w-4" />
              Gerenciar coleções
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
