import { Rocket, CheckCircle, Circle, AlertCircle, ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOnboardingStatus } from "@/hooks/useOnboardingStatus";
import { useState } from "react";

interface Props {
  onOpenWizard: () => void;
}

const DISMISS_KEY = "galileus_onboarding_banner_dismissed";

export function OnboardingBanner({ onOpenWizard }: Props) {
  const { loading, isComplete, steps, completionPercentage, isAdmin } = useOnboardingStatus();
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(DISMISS_KEY) === "true");

  if (loading || isComplete || !isAdmin || dismissed) return null;

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "true");
    setDismissed(true);
  };

  return (
    <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-r from-primary/10 via-card to-primary/5 p-4 mb-4">
      <div className="absolute -top-16 -right-16 w-32 h-32 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1 rounded hover:bg-muted transition-colors"
        aria-label="Dispensar"
      >
        <X className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/20 border border-primary/30 shrink-0">
              <Rocket className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground truncate">Configure o Galileu's</h3>
              <p className="text-xs text-muted-foreground truncate">Termine os passos para tirar o máximo da plataforma</p>
            </div>
          </div>
          <div className="mb-2">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
              <span>Progresso</span>
              <span className="text-primary font-medium">{completionPercentage}%</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-500"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {steps.map((s) => (
              <div
                key={s.id}
                className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border ${
                  s.isComplete
                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                    : s.isRequired
                    ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                    : "bg-muted text-muted-foreground border-border"
                }`}
              >
                {s.isComplete ? <CheckCircle className="h-2.5 w-2.5" /> : s.isRequired ? <AlertCircle className="h-2.5 w-2.5" /> : <Circle className="h-2.5 w-2.5" />}
                <span className="hidden sm:inline">{s.title}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="shrink-0">
          <Button onClick={onOpenWizard} size="sm" className="gap-1.5 whitespace-nowrap">
            Continuar
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
