import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { useWorkspaceTree } from "@/hooks/useWorkspaceTree";

export default function HomePage() {
  const { data: tree, isLoading } = useWorkspaceTree();
  const navigate = useNavigate();

  useEffect(() => {
    if (!tree) return;
    for (const node of tree) {
      for (const f of node.folders) {
        if (f.lists[0]) { navigate(`/l/${f.lists[0].id}`, { replace: true }); return; }
      }
      if (node.looseLists[0]) { navigate(`/l/${node.looseLists[0].id}`, { replace: true }); return; }
    }
  }, [tree, navigate]);

  return (
    <AppLayout>
      <div className="flex items-center justify-center h-full py-24 text-muted-foreground">
        {isLoading ? "Carregando…" : "Crie uma Lista na barra lateral para começar."}
      </div>
    </AppLayout>
  );
}
