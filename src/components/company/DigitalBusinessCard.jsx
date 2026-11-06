import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Phone, Mail, MapPin, Globe, Download, Share2, Instagram, Clock } from 'lucide-react';
import QRCode from 'qrcode';

const DAY_ORDER = ['mo','di','mi','do','fr','sa','so'];
const DAY_LABEL = { mo:'Mo', di:'Di', mi:'Mi', do:'Do', fr:'Fr', sa:'Sa', so:'So' };

// Öffnungszeiten aus OpeningHours-Entity aufbereiten
function formatHours(openingHours) {
    if (!openingHours?.length) return null;
    return openingHours
        .filter(h => h.is_open)
        .map(h => `${DAY_LABEL[h.day] || h.day}: ${h.open_time} – ${h.close_time}`)
        .join('\n') || null;
}

// Einmalige vCard-Builder-Funktion
function buildVCard(c) {
    return [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `FN:${c.company_name || ''}`,
        `ORG:${c.company_name || ''}`,
        c.phone    ? `TEL;TYPE=WORK:${c.phone}`     : '',
        c.email    ? `EMAIL;TYPE=WORK:${c.email}`   : '',
        (c.street || c.city)
            ? `ADR:;;${c.street || ''};${c.city || ''};${c.postal_code || ''};${c.country || ''}` : '',
        c.website  ? `URL:${c.website}`             : '',
        c.description ? `NOTE:${c.description}`     : '',
        'END:VCARD',
    ].filter(Boolean).join('\r\n');
}

export default function DigitalBusinessCard({ companyInfo, openingHours = [] }) {
    const [qrCodeUrl, setQrCodeUrl] = useState('');

    const generateQR = useCallback(async () => {
        if (!companyInfo?.company_name) return;
        try {
            const url = await QRCode.toDataURL(buildVCard(companyInfo), {
                width: 300,
                margin: 2,
                color: { dark: '#1e2d45', light: '#ffffff' },
            });
            setQrCodeUrl(url);
        } catch (e) {
            console.error('QR-Code Fehler:', e);
        }
    }, [companyInfo]);

    useEffect(() => { generateQR(); }, [generateQR]);

    const downloadVCard = () => {
        const blob = new Blob([buildVCard(companyInfo)], { type: 'text/vcard' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `${companyInfo.company_name || 'kontakt'}.vcf`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const shareCard = async () => {
        const vcard = buildVCard(companyInfo);
        if (navigator.share) {
            try {
                const file = new File([vcard], `${companyInfo.company_name || 'kontakt'}.vcf`, { type: 'text/vcard' });
                await navigator.share({ files: [file], title: companyInfo.company_name, text: `Kontaktdaten von ${companyInfo.company_name}` });
                return;
            } catch (_) {}
        }
        downloadVCard();
    };

    const downloadQR = () => {
        const a    = document.createElement('a');
        a.href     = qrCodeUrl;
        a.download = `${companyInfo.company_name || 'visitenkarte'}-qr.png`;
        a.click();
    };

    const hoursText = formatHours(openingHours);

    if (!companyInfo?.company_name) {
        return (
            <Card className="bg-card border-border">
                <CardContent className="py-12 text-center text-muted-foreground">
                    Bitte zuerst Firmendaten in den Einstellungen eingeben.
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* ── Visitenkarten-Vorschau ────────────────────────────── */}
            <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                    <CardTitle className="text-foreground text-base">Vorschau</CardTitle>
                    <CardDescription className="text-muted-foreground text-xs">
                        So sehen Gäste deine digitale Visitenkarte
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {/* Karte im Bar-Look */}
                    <div className="rounded-2xl overflow-hidden shadow-2xl"
                         style={{ background: 'linear-gradient(135deg, #111827 0%, #1e2d45 100%)' }}>

                        {/* Header */}
                        <div className="px-6 pt-6 pb-4 border-b border-white/10">
                            {companyInfo.logo_url ? (
                                <img src={companyInfo.logo_url} alt="Logo"
                                     className="h-12 object-contain mb-3" />
                            ) : (
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-status-warn to-status-warn flex items-center justify-center mb-3">
                                    <span className="text-muted-foreground font-bold text-lg">
                                        {(companyInfo.company_name || '?')[0].toUpperCase()}
                                    </span>
                                </div>
                            )}
                            <h2 className="text-xl font-bold text-white leading-tight">
                                {companyInfo.company_name}
                            </h2>
                            {companyInfo.description && (
                                <p className="text-sm text-white/60 mt-1 leading-snug">
                                    {companyInfo.description}
                                </p>
                            )}
                        </div>

                        {/* Kontaktdaten */}
                        <div className="px-6 py-4 space-y-3">
                            {companyInfo.phone && (
                                <a href={`tel:${companyInfo.phone}`}
                                   className="flex items-center gap-3 text-white/80 hover:text-status-warn transition-colors">
                                    <div className="w-8 h-8 rounded-lg bg-status-warn/20 flex items-center justify-center shrink-0">
                                        <Phone className="w-4 h-4 text-status-warn" />
                                    </div>
                                    <span className="text-sm">{companyInfo.phone}</span>
                                </a>
                            )}
                            {companyInfo.email && (
                                <a href={`mailto:${companyInfo.email}`}
                                   className="flex items-center gap-3 text-white/80 hover:text-status-warn transition-colors">
                                    <div className="w-8 h-8 rounded-lg bg-status-warn/20 flex items-center justify-center shrink-0">
                                        <Mail className="w-4 h-4 text-status-warn" />
                                    </div>
                                    <span className="text-sm">{companyInfo.email}</span>
                                </a>
                            )}
                            {(companyInfo.street || companyInfo.city) && (
                                <div className="flex items-start gap-3 text-white/80">
                                    <div className="w-8 h-8 rounded-lg bg-status-warn/20 flex items-center justify-center shrink-0 mt-0.5">
                                        <MapPin className="w-4 h-4 text-status-warn" />
                                    </div>
                                    <span className="text-sm leading-snug">
                                        {companyInfo.street && <>{companyInfo.street}<br /></>}
                                        {companyInfo.postal_code} {companyInfo.city}
                                    </span>
                                </div>
                            )}
                            {companyInfo.website && (
                                <a href={companyInfo.website} target="_blank" rel="noopener noreferrer"
                                   className="flex items-center gap-3 text-white/80 hover:text-status-warn transition-colors">
                                    <div className="w-8 h-8 rounded-lg bg-status-warn/20 flex items-center justify-center shrink-0">
                                        <Globe className="w-4 h-4 text-status-warn" />
                                    </div>
                                    <span className="text-sm truncate">{companyInfo.website.replace(/^https?:\/\//, '')}</span>
                                </a>
                            )}
                        </div>

                        {/* Öffnungszeiten */}
                        {hoursText && (
                            <div className="px-6 pb-4">
                                <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Clock className="w-3.5 h-3.5 text-status-warn" />
                                        <span className="text-xs font-semibold text-white/70 uppercase tracking-wide">Öffnungszeiten</span>
                                    </div>
                                    <p className="text-xs text-white/60 whitespace-pre-line leading-relaxed">{hoursText}</p>
                                </div>
                            </div>
                        )}

                        {/* Footer */}
                        <div className="px-6 pb-5">
                            <div className="h-px bg-gradient-to-r from-transparent via-status-warn/40 to-transparent mb-4" />
                            <div className="flex gap-2">
                                <Button
                                    onClick={downloadVCard}
                                    className="flex-1 bg-gradient-to-r from-status-warn to-status-warn hover:from-status-warn hover:to-status-warn text-muted-foreground font-semibold min-h-[44px] shadow-lg shadow-amber-500/20"
                                >
                                    <Download className="w-4 h-4 mr-2" />
                                    Kontakt speichern
                                </Button>
                                <Button
                                    onClick={shareCard}
                                    variant="outline"
                                    className="border-white/20 text-white/70 hover:bg-white/10 min-h-[44px] px-4"
                                >
                                    <Share2 className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* ── QR-Code ───────────────────────────────────────────── */}
            <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                    <CardTitle className="text-foreground text-base">QR-Code</CardTitle>
                    <CardDescription className="text-muted-foreground text-xs">
                        Einmal scannen → Kontakt direkt im Adressbuch
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                    {qrCodeUrl ? (
                        <>
                            <div className="rounded-2xl overflow-hidden p-6 flex items-center justify-center"
                                 style={{ background: 'linear-gradient(135deg, #1e2d45, #111827)' }}>
                                <div className="bg-card rounded-xl p-4 shadow-xl">
                                    <img src={qrCodeUrl} alt="QR Code" className="w-full max-w-[220px]" />
                                </div>
                            </div>
                            <Button
                                onClick={downloadQR}
                                variant="outline"
                                className="w-full border-border text-muted-foreground hover:bg-accent min-h-[44px]"
                            >
                                <Download className="w-4 h-4 mr-2" />
                                QR-Code als PNG herunterladen
                            </Button>
                            <div className="rounded-xl bg-secondary/50 border border-border p-4">
                                <p className="text-xs font-semibold text-foreground mb-2">💡 Verwendung</p>
                                <ul className="text-xs text-muted-foreground space-y-1.5">
                                    <li>• Auf Flyern, Menükarten oder Plakaten drucken</li>
                                    <li>• Auf einem Tablet an der Bar anzeigen</li>
                                    <li>• In E-Mail-Signaturen einbinden</li>
                                    <li>• Auf Social Media teilen</li>
                                </ul>
                            </div>
                        </>
                    ) : (
                        <div className="py-12 text-center text-muted-foreground text-sm animate-pulse">
                            QR-Code wird generiert…
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
