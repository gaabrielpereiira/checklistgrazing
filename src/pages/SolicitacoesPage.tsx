import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Check, X, Inbox, Calendar } from "lucide-react";
import { useReceivedRequests, useSentRequests, useAcceptRequest, useRefuseRequest, useCollections, useColumns } from "@/hooks/useTaskData";
import { useProfiles } from "@/hooks/useTaskData";
import { toast } from "sonner";

const statusBadgeMap: Record<string, React.ReactNode> = {
  pending: <Badge variant="secondary">Pendente</Badge>,
  accepted: <Badge className="bg-status-on-track/15 text-status-on-track border-status-on-track/30 border">Aceita</Badge>,
  refused: <Badge variant="destructive">Recusada</Badge>,
};

export default function SolicitacoesPage() {
  const { data: received } = useReceivedRequests();
  const { data: sent } = useSentRequests();
  const { data: collections } = useCollections();
  const { data: profiles } = useProfiles();
  const acceptRequest = useAcceptRequest();
  const refuseRequest = useRefuseRequest();

  const [refuseDialogOpen, setRefuseDialogOpen] = useState(false);
  const [refuseRequestId, setRefuseRequestId] = useState<string | null>(null);
  const [refuseReason, setRefuseReason] = useState("");

  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false);
  const [acceptRequestId, setAcceptRequestId] = useState<string | null>(null);
  const [acceptCollectionId, setAcceptCollectionId] = useState<string>("");

  // Get columns for selected collection
  const { data: acceptColumns } = useColumns(acceptCollectionId || null);

  const handleAcceptOpen = (requestId: string) => {
    setAcceptRequestId(requestId);
    setAcceptCollectionId(collections?.[0]?.id || "");
    setAcceptDialogOpen(true);
  };

  const handleAcceptConfirm = () => {
    if (!acceptRequestId || !acceptCollectionId || !acceptColumns?.length) return;
    acceptRequest.mutate({
      requestId: acceptRequestId,
      collectionId: acceptCollectionId,
      columnId: acceptColumns[0].id,
    }, {
      onSuccess: () => {
        toast.success("Solicitação aceita! Task criada.");
        setAcceptDialogOpen(false);
      },
    });
  };

  const handleRefuseOpen = (requestId: string) => {
    setRefuseRequestId(requestId);
    setRefuseReason("");
    setRefuseDialogOpen(true);
  };

  const handleRefuseConfirm = () => {
    if (!refuseRequestId || !refuseReason.trim()) {
      toast.error("Justificativa obrigatória");
      return;
    }
    refuseRequest.mutate({ requestId: refuseRequestId, reason: refuseReason.trim() }, {
      onSuccess: () => {
        toast.success("Solicitação recusada.");
        setRefuseDialogOpen(false);
      },
    });
  };

  const getProfileName = (userId: string) => {
    const p = profiles?.find(p => p.user_id === userId);
    return p?.name || "Usuário";
  };

  const getProfileInitials = (userId: string) => {
    const name = getProfileName(userId);
    return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  };

  const pendingReceived = received?.filter(r => r.status === 'pending') || [];

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl p-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
            <Inbox className="h-5 w-5 text-muted-foreground" />
          </div>
          <h1 className="font-heading text-2xl font-bold">Solicitações</h1>
        </div>

        <Tabs defaultValue="recebidas">
          <TabsList>
            <TabsTrigger value="recebidas">
              Recebidas {pendingReceived.length > 0 && `(${pendingReceived.length})`}
            </TabsTrigger>
            <TabsTrigger value="enviadas">Enviadas</TabsTrigger>
          </TabsList>

          <TabsContent value="recebidas" className="mt-4 space-y-3">
            {(!received || received.length === 0) ? (
              <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border bg-card">
                <Inbox className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">Nenhuma solicitação recebida.</p>
              </div>
            ) : (
              received.map(req => (
                <div key={req.id} className="rounded-lg border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {getProfileInitials(req.from_user_id)}
                      </div>
                      <span className="text-sm font-medium text-card-foreground">{getProfileName(req.from_user_id)}</span>
                    </div>
                    {statusBadgeMap[req.status]}
                  </div>

                  <div className="rounded-md border p-3">
                    <h4 className="text-sm font-semibold text-card-foreground">{req.task_title}</h4>
                    {req.task_description && <p className="mt-1 text-xs text-muted-foreground">{req.task_description}</p>}
                    {req.suggested_due_date && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" /> Prazo: {new Date(req.suggested_due_date).toLocaleDateString('pt-BR')}
                      </p>
                    )}
                  </div>

                  {req.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button size="sm" className="gap-1" onClick={() => handleAcceptOpen(req.id)}>
                        <Check className="h-3.5 w-3.5" /> Aceitar
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => handleRefuseOpen(req.id)}>
                        <X className="h-3.5 w-3.5" /> Recusar
                      </Button>
                    </div>
                  )}

                  {req.status === 'refused' && req.refusal_reason && (
                    <p className="text-xs text-status-overdue">Motivo: {req.refusal_reason}</p>
                  )}
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="enviadas" className="mt-4 space-y-3">
            {(!sent || sent.length === 0) ? (
              <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border bg-card">
                <Inbox className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">Nenhuma solicitação enviada.</p>
              </div>
            ) : (
              sent.map(req => (
                <div key={req.id} className="flex items-center justify-between rounded-lg border bg-card p-4">
                  <div>
                    <h4 className="text-sm font-medium text-card-foreground">{req.task_title}</h4>
                    {req.to_user_id && (
                      <p className="text-xs text-muted-foreground mt-1">Para: {getProfileName(req.to_user_id)}</p>
                    )}
                    {req.status === 'refused' && req.refusal_reason && (
                      <p className="text-xs text-status-overdue mt-1">Motivo: {req.refusal_reason}</p>
                    )}
                  </div>
                  {statusBadgeMap[req.status]}
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Accept Dialog */}
      <Dialog open={acceptDialogOpen} onOpenChange={setAcceptDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Aceitar Solicitação</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Escolha em qual coleção a task será criada:</p>
          <Select value={acceptCollectionId} onValueChange={setAcceptCollectionId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {collections?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={handleAcceptConfirm} disabled={acceptRequest.isPending}>
            {acceptRequest.isPending ? "Criando..." : "Confirmar"}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Refuse Dialog */}
      <Dialog open={refuseDialogOpen} onOpenChange={setRefuseDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Recusar Solicitação</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Justificativa obrigatória:</p>
          <Textarea
            placeholder="Explique o motivo da recusa..."
            value={refuseReason}
            onChange={(e) => setRefuseReason(e.target.value)}
            className="min-h-[80px]"
          />
          <Button variant="destructive" onClick={handleRefuseConfirm} disabled={refuseRequest.isPending || !refuseReason.trim()}>
            {refuseRequest.isPending ? "Recusando..." : "Confirmar Recusa"}
          </Button>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
