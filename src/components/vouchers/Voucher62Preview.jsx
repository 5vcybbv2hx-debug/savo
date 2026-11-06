/**
 * Voucher62Preview — Bildschirm-Vorschau im echten Seitenverhältnis des Formats
 * (Basis 3 px je mm: 186 × 300 px bei 62 × 100 mm, 186 × 90 px beim Siegel,
 * 186 × 180 px beim Verkaufsbeleg).
 * Reine Anzeige; gedruckt wird ausschließlich das PDF aus voucherPrint62.
 */
import React from 'react';
import { getVoucherFormat, fmtDateTime, fmtDate, fmtMoney, paymentLabel } from '@/lib/voucherPrint62';

const PX_PER_MM = 3;

export default function Voucher62Preview({ format, voucher, amount, remaining, at, qr }) {
    if (!voucher) return null;

    const f = getVoucherFormat(format);
    const width = f.width * PX_PER_MM;
    const height = f.height * PX_PER_MM;
    const qrPx = f.qr * PX_PER_MM;

    const shell = 'mx-auto rounded-md bg-card text-foreground shadow-xl select-none overflow-hidden';

    // 1) Geschenkgutschein · 62 × 100 mm
    if (f.key === 'geschenkgutschein') {
        return (
            <div className={`${shell} px-3 py-2.5`} style={{ width, height }}>
                <p className="text-center font-bold tracking-[0.22em] text-[18px] leading-none">SAVO</p>
                <p className="text-center tracking-[0.18em] text-[5.9px] mt-1 text-muted-foreground">LOUNGE · CLUB</p>
                <div className="h-px bg-muted mt-2" />
                <p className="text-center font-bold tracking-[0.26em] text-[6.3px] mt-2.5">GUTSCHEIN</p>
                <p className="text-center font-bold text-[31px] leading-none mt-2 tabular-nums">
                    {fmtMoney(voucher.original_value)}
                </p>
                <p className="text-center font-bold text-[8px] mt-2">Nr. {voucher.voucher_number}</p>
                <p className="text-center text-[5.5px] text-muted-foreground mt-0.5">Ausgestellt {fmtDate(voucher.issue_date)}</p>
                {qr && <img src={qr} alt="QR" className="block mx-auto mt-2" style={{ width: qrPx, height: qrPx }} />}
                <p className="text-center text-[4.9px] leading-tight mt-3 text-muted-foreground">
                    SAVO Lounge-Club · Badstraße 1 · 72336 Balingen
                </p>
                <p className="text-center text-[4.9px] leading-tight text-muted-foreground">
                    Einlösbar auf Speisen &amp; Getränke
                </p>
            </div>
        );
    }

    // 2) Einlösebeleg · 62 × 100 mm
    if (f.key === 'einloese_beleg') {
        return (
            <div className={`${shell} px-3 py-2.5`} style={{ width, height }}>
                <p className="text-center font-bold tracking-[0.22em] text-[14px] leading-none">SAVO</p>
                <div className="h-px bg-muted mt-2" />
                <p className="text-center font-bold tracking-[0.16em] text-[5.7px] mt-2.5">EINLÖSEBELEG GUTSCHEIN</p>
                <p className="text-center font-bold text-[7.4px] mt-2">Nr. {voucher.voucher_number}</p>
                <p className="text-center text-[9.5px] mt-2.5">Eingelöst: {fmtMoney(amount)}</p>
                <p className="text-center font-bold text-[17px] leading-none mt-2 tabular-nums">Rest: {fmtMoney(remaining)}</p>
                <p className="text-center text-[5.7px] text-muted-foreground mt-1.5">{fmtDateTime(at)}</p>
                {qr && <img src={qr} alt="QR" className="block mx-auto mt-2" style={{ width: qrPx, height: qrPx }} />}
                <p className="text-center text-[4.9px] text-muted-foreground mt-3">Restwert mit QR prüfbar</p>
            </div>
        );
    }

    // 3) Kuvert-Siegel · 62 × 30 mm — QR links, Text rechts
    if (f.key === 'siegel') {
        return (
            <div className={`${shell} flex items-center gap-1.5 px-2`} style={{ width, height }}>
                {qr
                    ? <img src={qr} alt="QR" className="shrink-0" style={{ width: qrPx, height: qrPx }} />
                    : <div className="shrink-0 bg-card" style={{ width: qrPx, height: qrPx }} />}
                <div className="min-w-0">
                    <p className="font-bold tracking-[0.16em] text-[11.5px] leading-none">SAVO</p>
                    <p className="text-[4.9px] mt-1 text-muted-foreground">GUTSCHEIN · GESCHENKT</p>
                    <p className="font-bold text-[10.5px] leading-tight mt-1 tabular-nums">
                        {fmtMoney(voucher.original_value)} · Nr. {voucher.voucher_number}
                    </p>
                    <p className="text-[4.7px] text-muted-foreground mt-0.5">savo-lounge-club.de</p>
                </div>
            </div>
        );
    }

    // 4) Verkaufsbeleg (Kasse) · 62 × 60 mm
    return (
        <div className={`${shell} px-2 py-1.5`} style={{ width, height }}>
            <p className="text-center font-bold tracking-[0.22em] text-[10.5px] leading-none">SAVO</p>
            <p className="text-center font-bold tracking-[0.1em] text-[5.1px] mt-0.5">BELEG GUTSCHEINVERKAUF</p>
            <div className="h-px bg-muted mt-1" />
            <div className="flex justify-between text-[5.1px] leading-tight mt-1">
                <span>Datum: {fmtDateTime(voucher.created_date || voucher.issue_date)}</span>
                <span>Kasse: Theke</span>
            </div>
            <div className="h-px bg-muted mt-1" />
            <div className="flex justify-between text-[6.3px] font-bold leading-tight mt-1">
                <span>Gutschein Nr. {voucher.voucher_number}</span>
                <span className="tabular-nums">{fmtMoney(voucher.original_value)}</span>
            </div>
            <div className="flex justify-between text-[4.9px] leading-tight mt-1">
                <span>Zahlart: {paymentLabel(voucher.payment_method)}</span>
                <span className="text-muted-foreground">0 % USt (Verbindlichkeit)</span>
            </div>
            <p className="text-center text-[4.4px] text-muted-foreground mt-1">Einlösbar auf Speisen &amp; Getränke</p>
            <div className="h-px bg-muted mt-1" />
            <div className="flex justify-between text-[7.4px] font-bold leading-tight mt-1">
                <span>Summe</span>
                <span className="tabular-nums">{fmtMoney(voucher.original_value)}</span>
            </div>
            {qr && <img src={qr} alt="QR" className="block mx-auto mt-1" style={{ width: qrPx, height: qrPx }} />}
            <p className="text-center font-bold text-[4.2px] mt-1">Vielen Dank!</p>
        </div>
    );
}