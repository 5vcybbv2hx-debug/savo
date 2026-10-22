/**
 * VoucherReceipt — 80mm-Beleg für den Sam4s-Thermodrucker.
 *
 * Bildschirm: Vorschau-Karte (80mm-Breite) + Drucken-Button.
 * Druck: nur der Beleg selbst, randlos auf 80mm Rollenbreite (@page size 80mm auto).
 */
import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Button } from '@/components/ui/button';
import { Printer, X } from 'lucide-react';
import { voucherQrUrl } from '@/lib/vouchers';

const fmtEUR = (n) => (n ?? 0).toLocaleString('de-DE', {
    style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2,
});
const fmtDate = (d) => d ? d.slice(0, 10).split('-').reverse().join('.') : '—';

const RECEIPT_CSS = `
.receipt-bebas { font-family: 'Bebas Neue', 'Century Gothic', 'Jost', sans-serif; }
@media print {
  @page { size: 80mm auto; margin: 0; }
  body * { visibility: hidden !important; }
  #voucher-receipt, #voucher-receipt * { visibility: visible !important; }
  #voucher-receipt-overlay {
    position: static !important;
    background: transparent !important;
    overflow: visible !important;
  }
  #voucher-receipt {
    position: absolute !important;
    left: 0 !important; top: 0 !important;
    width: 80mm !important; max-width: 80mm !important;
    margin: 0 !important; padding: 0 3mm 4mm !important;
    border: 0 !important; border-radius: 0 !important;
    box-shadow: none !important; background: #ffffff !important;
  }
  .receipt-noprint { display: none !important; }
}
`;

export default function VoucherReceipt({ voucher, onClose }) {
    const [qr, setQr] = useState(null);

    useEffect(() => {
        let alive = true;
        QRCode.toDataURL(voucherQrUrl(voucher), { margin: 0, width: 480, errorCorrectionLevel: 'M' })
            .then((url) => { if (alive) setQr(url); });
        return () => { alive = false; };
    }, [voucher?.id, voucher?.access_token]);

    return (
        <div
            id="voucher-receipt-overlay"
            className="fixed inset-0 z-[100] overflow-auto bg-black/70"
            onClick={onClose}
        >
            <style>{RECEIPT_CSS}</style>
            <div className="min-h-full flex flex-col items-center justify-center gap-4 p-4">
                {/* ── Beleg (80mm) ── */}
                <div
                    id="voucher-receipt"
                    onClick={(e) => e.stopPropagation()}
                    className="w-[302px] bg-white text-black rounded-lg shadow-2xl px-5 py-6"
                >
                    <p className="receipt-bebas text-center text-[30px] leading-none tracking-[0.32em]">
                        SAVO
                    </p>
                    <div className="border-t-2 border-black mt-3 mb-3" />
                    <p className="receipt-bebas text-center text-[22px] leading-none tracking-[0.22em]">
                        GUTSCHEIN
                    </p>
                    <p className="text-center text-[42px] font-bold leading-none mt-3 tabular-nums">
                        {fmtEUR(voucher.original_value)}
                    </p>
                    <div className="border-t border-dashed border-black my-3.5" />
                    <div className="space-y-1.5 text-[12px]">
                        <div className="flex justify-between gap-3">
                            <span className="tracking-wide">GUTSCHEIN-NR.</span>
                            <span className="font-bold text-[15px] tabular-nums">{voucher.voucher_number}</span>
                        </div>
                        <div className="flex justify-between gap-3">
                            <span className="tracking-wide">KAUFDATUM</span>
                            <span className="font-semibold">{fmtDate(voucher.issue_date)}</span>
                        </div>
                    </div>
                    {qr && (
                        <img
                            src={qr}
                            alt={`QR-Code Gutschein ${voucher.voucher_number}`}
                            className="block w-[40mm] max-w-full mx-auto mt-3.5"
                        />
                    )}
                    <p className="text-[10px] text-center leading-snug mt-3">
                        Gültig 3 Jahre ab Kaufdatum.<br />Einlösbar nur in der SAVO Lounge.
                    </p>
                </div>

                {/* ── Bildschirm-Aktionen ── */}
                <div className="receipt-noprint flex items-center gap-2">
                    <Button variant="secondary" onClick={onClose}>
                        <X className="w-4 h-4 mr-1.5" />
                        Schließen
                    </Button>
                    <Button onClick={() => window.print()}>
                        <Printer className="w-4 h-4 mr-1.5" />
                        Drucken
                    </Button>
                </div>
            </div>
        </div>
    );
}