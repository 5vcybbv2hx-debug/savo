import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { STALE } from '@/lib/queryUtils';
import DigitalBusinessCard from '@/components/company/DigitalBusinessCard';
import { Building2, Settings } from 'lucide-react';

export default function BusinessCardPage() {
    const { data: companyInfo, isLoading } = useQuery({
        queryKey: ['company-info'],
        queryFn: async () => {
            const infos = await base44.entities.CompanyInfo.list();
            return infos[0] || null;
        },
        staleTime: STALE.SLOW,
    });

    // Öffnungszeiten aus CompanyInfo.opening_hours (JSON-String) parsen —
    // Format das CompanyInfoEditor speichert: Array von { day, open_time, close_time, is_open }
    // Fallback: leeres Array (DigitalBusinessCard rendert dann keinen Öffnungszeiten-Block)
    const openingHours = useMemo(() => {
        if (!companyInfo?.opening_hours) return [];
        try {
            const parsed = JSON.parse(companyInfo.opening_hours);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }, [companyInfo?.opening_hours]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-muted-foreground text-sm animate-pulse">Lädt...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background pb-24 md:pb-0">
            <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
                <div className="mb-6 flex items-start justify-between">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
                            <Building2 className="w-5 h-5 text-amber-500" />
                            Digitale Visitenkarte
                        </h1>
                        <p className="text-muted-foreground text-sm mt-1">
                            Zeig deinen Gästen den QR-Code zum Abscannen
                        </p>
                    </div>
                    {/* Direktlink zu Rechtliches-Tab → Firmendaten bearbeiten */}
                    <a
                        href="/MyArea?tab=rechtliches"
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors border border-border/50 rounded-lg px-3 py-2 min-h-[44px]"
                        title="Firmendaten bearbeiten"
                    >
                        <Settings className="w-3.5 h-3.5" />
                        Bearbeiten
                    </a>
                </div>
                <DigitalBusinessCard companyInfo={companyInfo || {}} openingHours={openingHours} />
            </div>
        </div>
    );
}