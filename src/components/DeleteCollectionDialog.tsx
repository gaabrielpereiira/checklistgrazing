import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle } from "lucide-react";
import type { Collection } from "@/hooks/useTaskData";

interface DeleteCollectionDialogProps {
  collection: Collection | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (id: string) => void;
  loading?: boolean;
}

export function DeleteCollectionDialog({ collection, open, onOpenChange, onConfirm, loading }: DeleteCollectionDialogProps) {
  const [confirmText, setConfirmText] = useState("");

  const handleOpenChange = (v: boolean) => {
    if (!v) setConfirmText("");
    onOpenChange(v);
  };

  const canDelete = confirmText === collection?.name;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Excluir Coleção
          </DialogTitle>
          <DialogDescription>
            Esta ação é irreversível. Todas as tasks, colunas e conexões desta coleção serão permanentemente excluídas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Para confirmar, digite o nome da coleção: <strong className="text-foreground">{collection?.name}</strong>
          </p>
          <Input
            placeholder="Digite o nome da coleção"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancelar</Button>
          <Button
            variant="destructive"
            disabled={!canDelete || loading}
            onClick={() => collection && onConfirm(collection.id)}
          >
            {loading ? "Excluindo…" : "Excluir Permanentemente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
