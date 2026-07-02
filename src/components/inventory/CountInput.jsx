import { Input } from "@/components/ui/input";
import { Plus, Minus } from "lucide-react";

/**
 * Wiederverwendbares Zähl-Input mit +/- Buttons.
 * value ist undefined solange nichts gezählt wurde.
 */
export default function CountInput({ value, onChange, placeholder = "—" }) {
    const displayValue = value !== undefined && value !== null ? value : '';
    return (
        <div className="flex items-center gap-1">
            <button
                type="button"
                onClick={() => onChange(Math.max(0, (value || 0) - 1))}
                className="w-8 h-8 flex items-center justify-center rounded bg-secondary hover:bg-secondary text-foreground transition-colors active:bg-slate-500"
            >
                <Minus className="w-3.5 h-3.5" />
            </button>
            <Input
                type="number"
                value={displayValue}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-16 text-center bg-background border-border text-foreground text-lg font-semibold px-1"
                min="0"
            />
            <button
                type="button"
                onClick={() => onChange((value || 0) + 1)}
                className="w-8 h-8 flex items-center justify-center rounded bg-secondary hover:bg-secondary text-foreground transition-colors active:bg-slate-500"
            >
                <Plus className="w-3.5 h-3.5" />
            </button>
        </div>
    );
}