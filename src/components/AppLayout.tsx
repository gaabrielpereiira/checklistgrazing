import { useState, useEffect } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { OnboardingBanner } from "@/components/OnboardingBanner";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import { useOnboardingStatus } from "@/hooks/useOnboardingStatus";

interface AppLayoutProps {
  children: React.ReactNode;
}

const AUTO_OPEN_KEY = "taskai_onboarding_auto_opened";

export function AppLayout({ children }: AppLayoutProps) {
  const [wizardOpen, setWizardOpen] = useState(false);
  const { loading, isComplete, isAdmin, hasSeenWizard } = useOnboardingStatus();

  // Auto-open wizard once for admins who haven't seen it
  useEffect(() => {
    if (loading) return;
    if (!isAdmin || isComplete || hasSeenWizard) return;
    if (sessionStorage.getItem(AUTO_OPEN_KEY) === "true") return;
    sessionStorage.setItem(AUTO_OPEN_KEY, "true");
    const t = setTimeout(() => setWizardOpen(true), 600);
    return () => clearTimeout(t);
  }, [loading, isAdmin, isComplete, hasSeenWizard]);

  // Allow ConfiguracoesPage (or anywhere) to open the wizard via custom event
  useEffect(() => {
    const open = () => setWizardOpen(true);
    window.addEventListener("taskai:open-onboarding", open);
    return () => window.removeEventListener("taskai:open-onboarding", open);
  }, []);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center border-b px-4 shrink-0">
            <SidebarTrigger />
          </header>
          <main className="flex-1 overflow-auto">
            <div className="px-4 pt-4">
              <OnboardingBanner onOpenWizard={() => setWizardOpen(true)} />
            </div>
            {children}
          </main>
        </div>
        <OnboardingWizard isOpen={wizardOpen} onClose={() => setWizardOpen(false)} />
      </div>
    </SidebarProvider>
  );
}
