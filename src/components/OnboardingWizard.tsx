import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { X, ChevronLeft, ChevronRight, Check, SkipForward, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useOnboardingStatus } from "@/hooks/useOnboardingStatus";
import { StepWelcome } from "./onboarding/StepWelcome";
import { StepWorkspace } from "./onboarding/StepWorkspace";
import { StepProfile } from "./onboarding/StepProfile";
import { StepSectors } from "./onboarding/StepSectors";
import { StepCollection } from "./onboarding/StepCollection";
import { StepTeam } from "./onboarding/StepTeam";
import { StepWhatsApp } from "./onboarding/StepWhatsApp";
import { StepSlack } from "./onboarding/StepSlack";
import { StepNotifications } from "./onboarding/StepNotifications";
import { StepFinish } from "./onboarding/StepFinish";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const stepVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0, filter: "blur(6px)" }),
  center: { x: 0, opacity: 1, filter: "blur(0px)" },
  exit: (dir: number) => ({ x: dir < 0 ? 60 : -60, opacity: 0, filter: "blur(6px)" }),
};

export function OnboardingWizard({ isOpen, onClose }: Props) {
  const { profile } = useAuth();
  const { steps, refetch, markWizardSeen } = useOnboardingStatus();
  const [active, setActive] = useState(0);
  const [direction, setDirection] = useState(0);
  const [saving, setSaving] = useState(false);
  const saveFnRef = useRef<(() => Promise<boolean>) | null>(null);

  const workspaceId = profile?.workspace_id || null;

  const registerSave = useCallback((fn: () => Promise<boolean>) => {
    saveFnRef.current = fn;
  }, []);

  useEffect(() => {
    saveFnRef.current = null;
  }, [active]);

  const next = async () => {
    setSaving(true);
    let ok = true;
    if (saveFnRef.current) {
      ok = await saveFnRef.current();
    }
    setSaving(false);
    if (!ok) return;
    await refetch();
    if (active < steps.length - 1) {
      setDirection(1);
      setActive(active + 1);
    }
  };

  const skip = () => {
    if (active < steps.length - 1) {
      setDirection(1);
      setActive(active + 1);
    }
  };

  const prev = () => {
    if (active > 0) {
      setDirection(-1);
      setActive(active - 1);
    }
  };

  const finish = async () => {
    markWizardSeen();
    await refetch();
    confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
    setTimeout(() => confetti({ particleCount: 60, spread: 100, origin: { y: 0.5, x: 0.2 } }), 200);
    setTimeout(() => confetti({ particleCount: 60, spread: 100, origin: { y: 0.5, x: 0.8 } }), 400);
    setTimeout(onClose, 800);
  };

  const renderStep = () => {
    const id = steps[active]?.id;
    switch (id) {
      case "welcome": return <StepWelcome />;
      case "workspace": return <StepWorkspace workspaceId={workspaceId} onSaved={() => {}} registerSave={registerSave} />;
      case "profile": return <StepProfile onSaved={() => {}} registerSave={registerSave} />;
      case "sectors": return <StepSectors workspaceId={workspaceId} registerSave={registerSave} />;
      case "collection": return <StepCollection workspaceId={workspaceId} registerSave={registerSave} />;
      case "team": return <StepTeam workspaceId={workspaceId} />;
      case "whatsapp": return <StepWhatsApp />;
      case "slack": return <StepSlack workspaceId={workspaceId} />;
      case "notifications": return <StepNotifications />;
      case "finish": return <StepFinish steps={steps} />;
      default: return null;
    }
  };

  const isLast = active === steps.length - 1;
  const currentStep = steps[active];
  const isOptional = currentStep && !currentStep.isRequired && active !== 0 && !isLast;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="px-6 pt-5 pb-4 border-b border-border">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs text-muted-foreground">Configuração inicial</p>
                  <p className="text-sm font-semibold">Passo {active + 1} de {steps.length}</p>
                </div>
                <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
              {/* Progress segments */}
              <div className="flex gap-1">
                {steps.map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => { setDirection(i > active ? 1 : -1); setActive(i); }}
                    className={`relative h-1.5 flex-1 rounded-full overflow-hidden transition-colors ${
                      i <= active ? "bg-primary" : "bg-muted"
                    }`}
                    title={s.title}
                  >
                    {s.isComplete && i !== active && (
                      <span className="absolute inset-0 bg-emerald-500" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-6 min-h-[380px] relative overflow-hidden">
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={active}
                  custom={direction}
                  variants={stepVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.3, ease: "easeOut" }}
                >
                  {renderStep()}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border bg-muted/20 flex items-center justify-between gap-2">
              <Button variant="ghost" onClick={prev} disabled={active === 0} className="gap-1">
                <ChevronLeft className="h-4 w-4" /> Voltar
              </Button>
              <div className="flex items-center gap-2">
                {isOptional && (
                  <Button variant="ghost" onClick={skip} className="gap-1 text-muted-foreground">
                    <SkipForward className="h-4 w-4" /> Pular
                  </Button>
                )}
                {isLast ? (
                  <Button onClick={finish} className="gap-2">
                    <Check className="h-4 w-4" /> Concluir
                  </Button>
                ) : (
                  <Button onClick={next} disabled={saving} className="gap-1">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Continuar <ChevronRight className="h-4 w-4" /></>}
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
