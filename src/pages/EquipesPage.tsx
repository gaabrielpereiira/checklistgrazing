import { useState, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useProfiles, useTeams, useTeamMembers, useCreateTeam, useUpdateTeam, useDeleteTeam, useAddTeamMember, useRemoveTeamMember, useCollectionTeams, useCollectionUsers } from "@/hooks/useTaskData";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, Users, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

function useCurrentUserRole() {
  return useQuery({
    queryKey: ["current-user-role"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_user_role");
      if (error) throw error;
      return data as AppRole;
    },
  });
}

export default function EquipesPage() {
  const { data: profiles = [] } = useProfiles();
  const { data: teams = [] } = useTeams();
  const { data: teamMembers = [] } = useTeamMembers();
  const { data: collectionTeams = [] } = useCollectionTeams();
  const { data: currentRole } = useCurrentUserRole();
  const createTeam = useCreateTeam();
  const updateTeam = useUpdateTeam();
  const deleteTeam = useDeleteTeam();
  const addMember = useAddTeamMember();
  const removeMember = useRemoveTeamMember();

  const isAdmin = currentRole === "admin";

  const [search, setSearch] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [newTeamOpen, setNewTeamOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamMembers, setNewTeamMembers] = useState<string[]>([]);

  const selectedTeam = teams.find(t => t.id === selectedTeamId);

  const filteredTeams = useMemo(() => {
    const q = search.toLowerCase();
    return teams.filter(t => t.name.toLowerCase().includes(q));
  }, [teams, search]);

  const getMemberCount = (teamId: string) => teamMembers.filter(m => m.team_id === teamId).length;
  const getCollectionCount = (teamId: string) => collectionTeams.filter(ct => ct.team_id === teamId).length;
  const getTeamMemberIds = (teamId: string) => teamMembers.filter(m => m.team_id === teamId).map(m => m.user_id);

  const handleCreateTeam = () => {
    if (!newTeamName.trim()) return;
    createTeam.mutate({ name: newTeamName.trim(), memberIds: newTeamMembers }, {
      onSuccess: () => {
        setNewTeamOpen(false);
        setNewTeamName("");
        setNewTeamMembers([]);
        toast.success("Equipe criada!");
      },
      onError: (e: any) => toast.error(e.message),
    });
  };

  const handleDeleteTeam = (id: string) => {
    deleteTeam.mutate(id, {
      onSuccess: () => {
        setSelectedTeamId(null);
        toast.success("Equipe excluída!");
      },
    });
  };

  return (
    <AppLayout>
      <div className="flex flex-col h-full">
        <div className="p-4 md:p-6 border-b space-y-4">
          <div className="flex items-center gap-3">
            <Users className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Equipes</h1>
            <Badge variant="secondary" className="ml-2">{teams.length} equipes</Badge>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar equipe..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            {isAdmin && (
              <Button onClick={() => setNewTeamOpen(true)} className="gap-1.5">
                <Plus className="h-4 w-4" /> Nova Equipe
              </Button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 md:p-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredTeams.map(team => (
              <button
                key={team.id}
                onClick={() => setSelectedTeamId(team.id)}
                className="text-left rounded-lg border bg-card p-4 hover:bg-accent/50 transition-colors space-y-2"
              >
                <h3 className="font-semibold text-foreground">{team.name}</h3>
                <div className="flex gap-3 text-sm text-muted-foreground">
                  <span>{getMemberCount(team.id)} membros</span>
                  <span>{getCollectionCount(team.id)} coleções</span>
                </div>
              </button>
            ))}
            {filteredTeams.length === 0 && (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                Nenhuma equipe encontrada.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Team Detail Sheet */}
      <Sheet open={!!selectedTeam} onOpenChange={(open) => !open && setSelectedTeamId(null)}>
        <SheetContent className="overflow-y-auto">
          {selectedTeam && (
            <>
              <SheetHeader>
                <SheetTitle>Equipe</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                {/* Name */}
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input
                    defaultValue={selectedTeam.name}
                    disabled={!isAdmin}
                    onBlur={(e) => {
                      if (isAdmin && e.target.value !== selectedTeam.name) {
                        updateTeam.mutate({ id: selectedTeam.id, name: e.target.value });
                      }
                    }}
                  />
                </div>

                {/* Members */}
                <div className="space-y-2">
                  <Label>Membros ({getTeamMemberIds(selectedTeam.id).length})</Label>
                  <div className="space-y-1.5">
                    {getTeamMemberIds(selectedTeam.id).map(uid => {
                      const p = profiles.find(pr => pr.user_id === uid);
                      return (
                        <div key={uid} className="flex items-center justify-between rounded-md bg-accent/50 px-3 py-2 text-sm">
                          <span>{p?.name || uid}</span>
                          {isAdmin && (
                            <button onClick={() => removeMember.mutate({ teamId: selectedTeam.id, userId: uid })} className="text-muted-foreground hover:text-destructive">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {isAdmin && (
                    <Select onValueChange={(uid) => addMember.mutate({ teamId: selectedTeam.id, userId: uid })}>
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="+ Adicionar membro" />
                      </SelectTrigger>
                      <SelectContent>
                        {profiles.filter(p => !getTeamMemberIds(selectedTeam.id).includes(p.user_id)).map(p => (
                          <SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Collections (read-only) */}
                <div className="space-y-2">
                  <Label>Coleções associadas</Label>
                  {collectionTeams.filter(ct => ct.team_id === selectedTeam.id).length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhuma coleção associada. Configure na tela de configuração da coleção.</p>
                  ) : (
                    <div className="space-y-1">
                      {collectionTeams.filter(ct => ct.team_id === selectedTeam.id).map(ct => (
                        <Badge key={ct.id} variant="outline">{ct.collection_id}</Badge>
                      ))}
                    </div>
                  )}
                </div>

                {isAdmin && (
                  <Button variant="destructive" size="sm" onClick={() => handleDeleteTeam(selectedTeam.id)} className="w-full gap-1.5">
                    <Trash2 className="h-4 w-4" /> Excluir equipe
                  </Button>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* New Team Dialog */}
      <Dialog open={newTeamOpen} onOpenChange={setNewTeamOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Equipe</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da equipe</Label>
              <Input value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} placeholder="Ex: Desenvolvimento" />
            </div>
            <div className="space-y-2">
              <Label>Membros</Label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {newTeamMembers.map(uid => {
                  const p = profiles.find(pr => pr.user_id === uid);
                  return (
                    <Badge key={uid} variant="secondary" className="gap-1">
                      {p?.name || uid}
                      <button onClick={() => setNewTeamMembers(prev => prev.filter(id => id !== uid))}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
              <Select onValueChange={(uid) => setNewTeamMembers(prev => [...prev, uid])}>
                <SelectTrigger>
                  <SelectValue placeholder="Adicionar membro" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.filter(p => !newTeamMembers.includes(p.user_id)).map(p => (
                    <SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewTeamOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateTeam} disabled={!newTeamName.trim()}>Criar Equipe</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
