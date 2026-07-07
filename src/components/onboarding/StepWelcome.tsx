import { motion } from "framer-motion";
import { Sparkles, MessageSquare, Users, Calendar, Bot } from "lucide-react";

export function StepWelcome() {
  const features = [
    { icon: Calendar, label: "Kanban + Gantt + Meu Dia" },
    { icon: Users, label: "Equipes, setores e permissões" },
    { icon: MessageSquare, label: "WhatsApp & Slack opcionais" },
    { icon: Bot, label: "IA conversacional integrada" },
  ];

  return (
    <div className="flex flex-col items-center text-center space-y-6 py-4">
      <motion.div
        initial={{ scale: 0, rotate: -30 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
        className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-primary to-primary/60 shadow-lg shadow-primary/40"
      >
        <Sparkles className="h-10 w-10 text-primary-foreground" />
      </motion.div>
      <div className="space-y-2">
        <h2 className="font-heading text-3xl font-bold">Bem-vindo ao Alexandre</h2>
        <p className="text-muted-foreground max-w-md">
          Vamos configurar tudo em poucos passos. Você pode pular o que quiser e voltar depois nas Configurações.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 w-full max-w-md pt-2">
        {features.map((f, i) => (
          <motion.div
            key={f.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.08 }}
            className="flex items-center gap-2 rounded-lg border border-border bg-card/50 px-3 py-2 text-left"
          >
            <f.icon className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm">{f.label}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
