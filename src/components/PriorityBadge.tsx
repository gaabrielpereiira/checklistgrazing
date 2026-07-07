import { cn } from "@/lib/utils";

const priorityConfig: Record<string, { label: string; className: string }> = {
  urgente: { label: 'Urgente', className: 'bg-priority-urgent/15 text-priority-urgent border-priority-urgent/30' },
  alta: { label: 'Alta', className: 'bg-priority-high/15 text-priority-high border-priority-high/30' },
  media: { label: 'Média', className: 'bg-priority-medium/15 text-priority-medium border-priority-medium/30' },
  baixa: { label: 'Baixa', className: 'bg-priority-low/15 text-priority-low border-priority-low/30' },
};

export function PriorityBadge({ priority }: { priority: string }) {
  const config = priorityConfig[priority] || priorityConfig.media;
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold", config.className)}>
      {config.label}
    </span>
  );
}

export function PriorityDot({ priority }: { priority: string }) {
  const colorMap: Record<string, string> = {
    urgente: 'bg-priority-urgent',
    alta: 'bg-priority-high',
    media: 'bg-priority-medium',
    baixa: 'bg-priority-low',
  };
  return <span className={cn("inline-block h-2 w-2 rounded-full", colorMap[priority] || colorMap.media)} />;
}
