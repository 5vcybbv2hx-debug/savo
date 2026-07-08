import React from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { usePermissions } from '@/components/auth/usePermissions';
import { cn } from '@/lib/utils';
import { Wine, BookOpen, TrendingUp, ClipboardCheck } from 'lucide-react';

function NavCard({ icon: Icon, label, description, page, permission }) {
    const navigate = useNavigate();
    const permissions = usePermissions();
    if (permission && !permissions[permission]) return null;
    return (
        <button
            onClick={() => navigate(createPageUrl(page))}
            className="flex items-center gap-4 w-full p-4 rounded-xl border text-left transition-all active:scale-[0.98] bg-card border-border/50 hover:border-border hover:bg-accent/20 cursor-pointer"
        >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{label}</p>
                {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
            </div>
        </button>
    );
}

export default function KarteHub() {
    const permissions = usePermissions();

    return (
        <div className="max-w-2xl mx-auto px-4 py-6 pb-32 md:pb-8">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-foreground">Karte & Rezepte</h1>
                <p className="text-muted-foreground text-sm mt-1">Rezeptur bauen → Preis kalkulieren → veröffentlichen</p>
            </div>

            <div className="space-y-2">
                <NavCard icon={BookOpen}   label="Rezepte"            description="Zutaten & Rezepturen bauen"                          page="Recipes"         permission="canViewRecipes"         />
                <NavCard icon={Wine}       label="Getränkekarte"      description="Getränk erstellen, Preis kalkulieren & veröffentlichen" page="DrinkMenu"       permission="canViewDrinkMenu"       />
                <NavCard icon={TrendingUp} label="Schnellkalkulation" description="Nur für lose Artikel ohne Rezept (optional)"          page="PriceCalculator" permission="canViewPriceCalculator" />
            </div>

            {(permissions.isManager || permissions.isAdmin) && (
                <div className="mt-6">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 px-1">Gelegentlich</p>
                    <NavCard
                        icon={ClipboardCheck}
                        label="Karte durchgehen"
                        description="Wie beim Neudruck: jedes Getränk prüfen — behalten, Preis anpassen oder raus"
                        page="MenuReview"
                    />
                </div>
            )}
        </div>
    );
}
