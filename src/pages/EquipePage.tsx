import { useState, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useProfiles, useUpdateProfile, useCollections, useCollectionUsers, useCollectionTeams, useTeamMembers, useAddCollectionUser, useRemoveCollectionUser } from "@/hooks/useTaskData";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Search, Users, X } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface TeamProfile {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  workspace_id: string | null;
}

interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
}

interface UserSector {
  id: string;
  user_id: string;
  sector_id: string;
}

interface Sector {
  id: string;
  name: string;
}

function useTeamProfiles() {
  return useQuery({
    queryKey: ["team-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_id, name, email, avatar_url, is_active, created_at, workspace_id")
        .order("created_at");
      if (error) throw error;
      return data as TeamProfile[];
    },
  });
}

function useUserRoles() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["team-user-roles"],
    queryFn: async () => {
      // Admin can see all workspace roles
      const { data, error } = await supabase.from("user_roles").select("*");
      if (error) throw error;
      return data as UserRole[];
    },
  });
}

function useUserSectors() {
  return useQuery({
    queryKey: ["team-user-sectors"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_sectors").select("*");
      if (error) throw error;
      return data as UserSector[];
    },
  });
}

function useSectors() {
  return useQuery({
    queryKey: ["sectors"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sectors").select("*").order("name");
      if (error) throw error;
      return data as Sector[];
    },
  });
}

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

function useUpdateUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase
        .from("user_roles")
        .update({ role })
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team-user-roles"] });
      toast.success("Role atualizada");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

function useUpdateProfileActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("profiles").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team-profiles"] });
      toast.success("Status atualizado");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

const roleBadge = (role: AppRole) => {
  const map: Record<AppRole, { label: string; className: string }> = {
    admin: { label: "Admin", className: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30" },
    gestor: { label: "Gestor", className: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30" },
    usuario: { label: "Usuário", className: "bg-muted text-muted-foreground border-border" },
  };
  const { label, className } = map[role] || map.usuario;
  return <Badge variant="outline" className={className}>{label}</Badge>;
};

export default function EquipePage() {
  const { profile: myProfile } = useAuth();
  const { data: profiles = [] } = useTeamProfiles();
  const { data: roles = [] } = useUserRoles();
  const { data: userSectors = [] } = useUserSectors();
  const { data: sectors = [] } = useSectors();
  const { data: currentRole } = useCurrentUserRole();
  const { data: collections = [] } = useCollections();
  const { data: collectionUsersData = [] } = useCollectionUsers();
  const { data: collectionTeamsData = [] } = useCollectionTeams();
  const { data: teamMembersData = [] } = useTeamMembers();
  const addCollectionUser = useAddCollectionUser();
  const removeCollectionUser = useRemoveCollectionUser();
  const updateRole = useUpdateUserRole();
  const updateActive = useUpdateProfileActive();
  const updateProfile = useUpdateProfile();

  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterSector, setFilterSector] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<TeamProfile | null>(null);

  const isAdmin = currentRole === "admin";

  const roleMap = useMemo(() => {
    const m: Record<string, AppRole> = {};
    roles.forEach((r) => (m[r.user_id] = r.role));
    return m;
  }, [roles]);

  const sectorMap = useMemo(() => {
    const m: Record<string, string[]> = {};
    userSectors.forEach((us) => {
      if (!m[us.user_id]) m[us.user_id] = [];
      m[us.user_id].push(us.sector_id);
    });
    return m;
  }, [userSectors]);

  const sectorNameMap = useMemo(() => {
    const m: Record<string, string> = {};
    sectors.forEach((s) => (m[s.id] = s.name));
    return m;
  }, [sectors]);

  const filtered = useMemo(() => {
    return profiles.filter((p) => {
      const q = search.toLowerCase();
      if (q && !p.name.toLowerCase().includes(q) && !(p.email || "").toLowerCase().includes(q)) return false;
      if (filterRole !== "all" && roleMap[p.user_id] !== filterRole) return false;
      if (filterSector !== "all" && !(sectorMap[p.user_id] || []).includes(filterSector)) return false;
      return true;
    });
  }, [profiles, search, filterRole, filterSector, roleMap, sectorMap]);

  const selectedRole = selectedUser ? roleMap[selectedUser.user_id] : undefined;
  const selectedSectors = selectedUser ? sectorMap[selectedUser.user_id] || [] : [];

  return (
    <AppLayout>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="p-4 md:p-6 border-b space-y-4">
          <div className="flex items-center gap-3">
            <Users className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Equipe</h1>
            <Badge variant="secondary" className="ml-2">{filtered.length} membros</Badge>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="gestor">Gestor</SelectItem>
                <SelectItem value="usuario">Usuário</SelectItem>
              </SelectContent>
            </Select>
            {sectors.length > 0 && (
              <Select value={filterSector} onValueChange={setFilterSector}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Setor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os setores</SelectItem>
                  {sectors.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto p-4 md:p-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Membro</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Setor(es)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Entrada</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => {
                const initials = p.name
                  ? p.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
                  : "?";
                const role = roleMap[p.user_id];
                const pSectors = (sectorMap[p.user_id] || []).map((sid) => sectorNameMap[sid]).filter(Boolean);
                return (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedUser(p)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary shrink-0">
                          {initials}
                        </div>
                        <span className="font-medium">{p.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{p.email || "—"}</TableCell>
                    <TableCell>{role ? roleBadge(role) : "—"}</TableCell>
                    <TableCell>
                      {pSectors.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {pSectors.map((s) => (
                            <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.is_active ? "default" : "secondary"}>
                        {p.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(p.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                    Nenhum membro encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Detail Sheet */}
      <Sheet open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <SheetContent className="overflow-y-auto">
          {selectedUser && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {selectedUser.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-lg font-semibold">{selectedUser.name}</p>
                    <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                  </div>
                </SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                {/* Name */}
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input
                    defaultValue={selectedUser.name}
                    disabled={!isAdmin}
                    onBlur={(e) => {
                      if (isAdmin && e.target.value !== selectedUser.name) {
                        updateProfile.mutate({ id: selectedUser.id, name: e.target.value });
                      }
                    }}
                  />
                </div>

                {/* Role */}
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select
                    value={selectedRole}
                    disabled={!isAdmin}
                    onValueChange={(v) => updateRole.mutate({ userId: selectedUser.user_id, role: v as AppRole })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="gestor">Gestor</SelectItem>
                      <SelectItem value="usuario">Usuário</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Sectors */}
                <div className="space-y-2">
                  <Label>Setores</Label>
                  <div className="flex flex-wrap gap-2">
                    {selectedSectors.map((sid) => (
                      <Badge key={sid} variant="outline" className="gap-1">
                        {sectorNameMap[sid] || sid}
                        {isAdmin && (
                          <button
                            className="ml-1 hover:text-destructive"
                            onClick={async () => {
                              await supabase.from("user_sectors").delete().eq("user_id", selectedUser.user_id).eq("sector_id", sid);
                              toast.success("Setor removido");
                              // Refetch
                              window.dispatchEvent(new Event("focus"));
                            }}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </Badge>
                    ))}
                    {sectors.filter((s) => !selectedSectors.includes(s.id)).length > 0 && isAdmin && (
                      <Select
                        onValueChange={async (sectorId) => {
                          const { error } = await supabase.from("user_sectors").insert({ user_id: selectedUser.user_id, sector_id: sectorId });
                          if (error) { toast.error(error.message); return; }
                          toast.success("Setor adicionado");
                        }}
                      >
                        <SelectTrigger className="w-[140px] h-8">
                          <SelectValue placeholder="+ Adicionar" />
                        </SelectTrigger>
                        <SelectContent>
                          {sectors.filter((s) => !selectedSectors.includes(s.id)).map((s) => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>

                {/* Active Status */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Status</Label>
                    <p className="text-sm text-muted-foreground">
                      {selectedUser.is_active ? "Usuário ativo" : "Usuário inativo"}
                    </p>
                  </div>
                  <Switch
                    checked={selectedUser.is_active}
                    disabled={!isAdmin || selectedUser.user_id === myProfile?.id}
                    onCheckedChange={(checked) => {
                      updateActive.mutate({ id: selectedUser.id, is_active: checked });
                      setSelectedUser({ ...selectedUser, is_active: checked });
                    }}
                  />
                </div>

                {/* Entry date */}
                <div className="space-y-1">
                  <Label>Data de entrada</Label>
                  <p className="text-sm text-muted-foreground">
                    {new Date(selectedUser.created_at).toLocaleDateString("pt-BR", {
                      day: "2-digit", month: "long", year: "numeric",
                    })}
                  </p>
                </div>

                {/* Direct collection access */}
                {isAdmin && (
                  <div className="space-y-2">
                    <Label>Coleções com acesso direto</Label>
                    <div className="space-y-1.5">
                      {collectionUsersData
                        .filter(cu => cu.user_id === selectedUser.user_id)
                        .map(cu => {
                          const col = collections.find(c => c.id === cu.collection_id);
                          return (
                            <div key={cu.id} className="flex items-center justify-between rounded-md bg-accent/50 px-3 py-2 text-sm">
                              <span>{col?.name || cu.collection_id}</span>
                              <button onClick={() => removeCollectionUser.mutate(cu.id)} className="text-muted-foreground hover:text-destructive">
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          );
                        })}
                    </div>
                    <Select onValueChange={(colId) => addCollectionUser.mutate({ collectionId: colId, userId: selectedUser.user_id })}>
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="+ Adicionar coleção" />
                      </SelectTrigger>
                      <SelectContent>
                        {collections
                          .filter(c => !c.is_archived && !collectionUsersData.some(cu => cu.collection_id === c.id && cu.user_id === selectedUser.user_id))
                          .map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Access via team (read-only) */}
                {(() => {
                  const userTeamIds = teamMembersData.filter(tm => tm.user_id === selectedUser.user_id).map(tm => tm.team_id);
                  const teamCollections = collectionTeamsData
                    .filter(ct => userTeamIds.includes(ct.team_id))
                    .map(ct => collections.find(c => c.id === ct.collection_id))
                    .filter(Boolean);
                  if (teamCollections.length === 0) return null;
                  return (
                    <div className="space-y-2">
                      <Label>Acesso via equipe</Label>
                      <div className="space-y-1">
                        {teamCollections.map((col: any) => (
                          <div key={col.id} className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                            {col.name}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}
