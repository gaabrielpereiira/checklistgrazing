import { useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const PALETTE = [
  "#3B82F6", "#6366F1", "#8B5CF6", "#EC4899",
  "#EF4444", "#F97316", "#EAB308", "#22C55E",
  "#14B8A6", "#06B6D4", "#64748B", "#1E293B",
];

interface ColorPickerProps {
  value: string | null;
  onChange: (color: string) => void;
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const [customMode, setCustomMode] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {PALETTE.map(color => (
          <button
            key={color}
            type="button"
            onClick={() => { onChange(color); setCustomMode(false); }}
            className={cn(
              "h-7 w-7 rounded-full border-2 transition-transform hover:scale-110",
              value === color ? "border-foreground scale-110" : "border-transparent"
            )}
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
        <button
          type="button"
          onClick={() => setCustomMode(!customMode)}
          className={cn(
            "h-7 w-7 rounded-full border-2 border-dashed flex items-center justify-center text-xs font-bold text-muted-foreground hover:border-foreground transition-colors",
            customMode && "border-foreground"
          )}
          title="Cor customizada"
        >
          #
        </button>
      </div>
      {customMode && (
        <div className="flex items-center gap-2">
          <div
            className="h-7 w-7 rounded-full border shrink-0"
            style={{ backgroundColor: value || "#000" }}
          />
          <Input
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder="#FF5500"
            className="h-8 text-sm font-mono"
            maxLength={7}
          />
        </div>
      )}
    </div>
  );
}
