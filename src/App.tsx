import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import AuthPage from "./pages/AuthPage";
import KanbanPage from "./pages/KanbanPage";
import MeuDiaPage from "./pages/MeuDiaPage";
import GanttPage from "./pages/GanttPage";
import ChatPage from "./pages/ChatPage";
import PanoramicPage from "./pages/PanoramicPage";
import SolicitacoesPage from "./pages/SolicitacoesPage";
import ConfiguracoesPage from "./pages/ConfiguracoesPage";
import EquipePage from "./pages/EquipePage";
import EquipesPage from "./pages/EquipesPage";
import ProjectsPage from "./pages/ProjectsPage";
import ProjectDetailPage from "./pages/ProjectDetailPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  return (
    <Routes>
      <Route path="/" element={<KanbanPage />} />
      <Route path="/meu-dia" element={<MeuDiaPage />} />
      <Route path="/gantt" element={<GanttPage />} />
      <Route path="/chat" element={<ChatPage />} />
      <Route path="/panoramica" element={<PanoramicPage />} />
      <Route path="/solicitacoes" element={<SolicitacoesPage />} />
      <Route path="/equipe" element={<EquipePage />} />
      <Route path="/equipes" element={<EquipesPage />} />
      <Route path="/projetos" element={<ProjectsPage />} />
      <Route path="/projetos/:projectId" element={<ProjectDetailPage />} />
      <Route path="/configuracoes" element={<ConfiguracoesPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/*" element={<ProtectedRoutes />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
