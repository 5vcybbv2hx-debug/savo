import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/* Zahlenblock: innere Fläche, Wert 20/600, Label 11,5 gedämpft */
export default function StatCard({ title, value, icon: Icon, color = "bg-surface", iconColor = "text-primary" }) {
    return (
        <Card className="p-4">
            <div className="flex items-center justify-between gap-3">
                <div className="rounded-xl bg-surface p-3 min-w-0 flex-1">
                    <p className="stat-label mb-1.5">{title}</p>
                    <p className="stat-value truncate">{value}</p>
                </div>
                {Icon && (
                    <div className={cn("p-2.5 rounded-xl shrink-0", color)}>
                        <Icon className={cn("w-4 h-4", iconColor)} />
                    </div>
                )}
            </div>
        </Card>
    );
}