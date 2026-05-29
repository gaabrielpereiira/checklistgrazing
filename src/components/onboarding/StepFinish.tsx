import { motion } from "framer-motion";
import { CheckCircle, Sparkles } from "lucide-react";
import type { OnboardingStep } from "@/hooks/useOnboardingStatus";

interface Props {
  steps: OnboardingStep[];
}

export function StepFinish({ steps }: Props) {
  const done = steps.filter(s => s.isComplete).length;
  return (
    <div className="flex flex-col items-center text-center space-y-6 py-2">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 12 }}
        className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/40"
      >
        <Sparkles className="h-12 w-12 text-white" />
      </motion.div>
      <div className="space-y-2">
        <h2 className="font-heading text-3xl font-bold">Tudo pronto!</h2>
        <p className="text-muted-foreground max-w-md">
          Você concluiu {done} de {steps.length} passos. Tudo o que você pulou pode ser configurado depois nas <strong>Configurações</strong>.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 w-full max-w-md text-left">
        {steps.map((s) => (
          <div
            key={s.id}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
              s.isComplete
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                : "bg-muted/50 border-border text-muted-foreground"
            }`}
          >
            <CheckCircle className={`h-3.5 w-3.5 ${s.isComplete ? "" : "opacity-30"}`} />
            <span>{s.title}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
