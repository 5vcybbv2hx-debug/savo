/**
 * ReserviertSchilder — druckfertige A4-Vorlage "Reserviert-Schilder" (4 Schilder pro Blatt).
 *
 * Es wird ausschließlich die offizielle Vorlage gedruckt (1:1, kein Nachbau,
 * keine Skalierung). Der Bildschirm zeigt nur eine Vorschau.
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Printer, ExternalLink } from 'lucide-react';

export const RESERVIERT_VORLAGE_URL =
  'https://base44.app/api/apps/69e6756d3c5299b2c62399f2/files/mp/public/69e6756d3c5299b2c62399f2/1051a9a35_reserviert_schilder_a4.jpg';

const PRINT_CSS = `
@media print {
  @page { size: A4; margin: 0; }
  html, body { background: #fff !important; height: auto !important; overflow: visible !important; }
  body * { visibility: hidden !important; }
  .reserviert-print-area, .reserviert-print-area * { visibility: visible !important; }
  .reserviert-print-area {
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
  }
  .reserviert-print-area img {
    display: block !important;
    width: 100% !important;
    height: auto !important;
    max-width: none !important;
    margin: 0 !important;
    page-break-inside: avoid;
  }
}
`;

export default function ReserviertSchilder() {
  const [failed, setFailed] = useState(false);

  const openTemplate = () => window.open(RESERVIERT_VORLAGE_URL, '_blank', 'noopener,noreferrer');

  return (
    <div className="min-h-screen bg-background">
      <style>{PRINT_CSS}</style>

      {/* Toolbar (wird beim Drucken ausgeblendet) */}
      <div className="sticky top-0 z-30 bg-card/95 backdrop-blur border-b border-border">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-2 px-4 py-3">
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-foreground">Reserviert-Schilder</h1>
            <p className="text-xs text-muted-foreground">1 Blatt A4 = 4 Schilder</p>
          </div>
          <Button
            onClick={() => window.print()}
            disabled={failed}
            className="h-9 gap-1.5 text-sm font-semibold shrink-0"
          >
            <Printer className="w-4 h-4" />
            Drucken
          </Button>
        </div>
      </div>

      {/* Vorschau der Vorlage */}
      <div className="max-w-2xl mx-auto px-4 py-4">
        <div className="reserviert-print-area">
          <img
            src={RESERVIERT_VORLAGE_URL}
            alt="Reserviert-Schilder Vorlage A4 mit 4 Schildern"
            loading="eager"
            onError={() => setFailed(true)}
            className="w-full block rounded-lg border border-border"
          />
        </div>

        {failed ? (
          <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-600 dark:text-amber-400">
            Vorlage konnte nicht geladen werden.{' '}
            <button onClick={openTemplate} className="underline font-medium inline-flex items-center gap-1">
              Vorlage öffnen <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <p className="mt-3 text-[11px] text-muted-foreground text-center">
            Im Druckdialog zusätzlich „Hintergrundgrafiken“ aktivieren – dann druckt die Vorlage randlos.
          </p>
        )}
      </div>
    </div>
  );
}