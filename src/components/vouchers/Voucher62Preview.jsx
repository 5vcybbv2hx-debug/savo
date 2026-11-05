/**
 * Voucher62Preview — Bildschirm-Vorschau im echten Seitenverhältnis des Formats
 * (Basis 3 px je mm, also 186 px Breite bei 62 mm).
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

    const shell = 'mx-auto rounded-md bg-white text-black shadow-xl select-none overflow-hidden';

    // 1) Geschenkgutschein
    if (f.key === 'geschenkgutschein') {
        return (
            <div className={`${shell} px-3 py-3`} style={{ width, height }}>
                <p className="text-center font-bold tracking-[0.24em] text-[17px] leading-none">SAVO</p>
                <p className="text-center tracking-[0.18em] text-[5.5px] mt-1 text-neutral-500">LOUNGE · CLUB</p>
                <div className="h-px bg-neutral-400 my-1.5" />
                <p className="text-center font-bold tracking-[0.26em] text-[10px] mt-1">GUTSCHEIN</p>
                <p className="text-center font-bold text-[30px] leading-none mt-2 tabular-nums">
                    {fmtMoney(voucher.original_value)}
                </p>
                <div className="h-px bg-neutral-300 my-2" />
                <p className="text-center font-bold text-[9px]">Nr. {voucher.voucher_number}</p>
                <p className="text-center text-[6px] text-neutral-600 mt-0.5">Ausgestellt {fmtDate(voucher.issue_date)}</p>
                {qr && <img src={qr} alt="QR" className="block mx-auto mt-2" style={{ width: qrPx, height: qrPx }} />}
                <p className="text-center text-[4.6px] leading-snug mt-2 text-neutral-600">
                    SAVO Lounge-Club · Badstraße 1 · 72336 Balingen
                </p>
                <p className="text-center text-[4.6px] leading-snug text-neutral-600">
                    Einlösbar auf Speisen &amp; Getränke · Restwert jederzeit abrufbar
                </p>
            </div>
        );
    }

    // 2) Einlösebeleg
    if (f.key === 'einloese_beleg') {
        return (
            <div className={`${shell} px-3 py-3`} style={{ width, height }}>
                <p className="text-center font-bold tracking-[0.24em] text-[15px] leading-none">SAVO</p>
                <p className="text-center tracking-[0.18em] text-[5.2px] mt-1 text-neutral-500">LOUNGE · CLUB</p>
                <div className="h-px bg-neutral-400 my-1.5" />
                <p className="text-center font-bold tracking-[0.2em] text-[8.5px] mt-1">EINLÖSEBELEG</p>
                <p className="text-center font-bold tracking-[0.16em] text-[7px] mt-0.5">GUTSCHEIN</p>
                <p className="text-center font-bold text-[9px] mt-2">Nr. {voucher.voucher_number}</p>
                <p className="text-center text-[9px] mt-1.5">Eingelöst: {fmtMoney(amount)}</p>
                <p className="text-center font-bold text-[19px] leading-none mt-2 tabular-nums">Rest: {fmtMoney(remaining)}</p>
                <p className="text-center text-[6px] text-neutral-600 mt-1">{fmtDateTime(at)}</p>
                {qr && <img src={qr} alt="QR" className="block mx-auto mt-2" style={{ width: qrPx, height: qrPx }} />}
                <p className="text-center text-[4.8px] text-neutral-600 mt-2">Restwert mit QR prüfbar</p>
            </div>
        );
    }

    // 3) Kuvert-Siegel (62 × 30)
    if (f.key === 'siegel') {
        return (
            <div className={`${shell} flex items-center gap-2 px-2`} style={{ width, height }}>
                {qr
                    ? <img src={qr} alt="QR" className="block shrink-0" style={{ width: qrPx, height: qrPx }} />
                    : <div className="shrink-0 bg-neutral-200" style={{ width: qrPx, height: qrPx }} />}
                <div className="flex-1 text-center">
                    <p className="font-bold tracking-[0.2em] leading-none text-[10.5px]">SAVO</p>
                    <p className="text-neutral-500 leading-tight mt-1 text-[5px]">GUTSCHEIN · GESCHENKT</p>
                    <p className="font-bold leading-tight mt-1 tabular-nums text-[6.4px]">
                        {fmtMoney(voucher.original_value)} · Nr. {voucher.voucher_number}
                    </p>
                    <p className="text-neutral-500 leading-tight mt-1 text-[4.3px]">savo-lounge-club.de</p>
                </div>
            </div>
        );
    }

    // 4) Verkaufsbeleg (62 × 60)
    return (
        <div className={`${shell} px-2 py-2`} style={{ width, height }}>
            <p className="text-center font-bold tracking-[0.26em] text-[11px] leading-none">SAVO</p>
            <p className="text-center font-bold tracking-[0.1em] text-[5.4px] mt-1">BELEG GUTSCHEINVERKAUF</p>
            <div className="h-px bg-neutral-400 my-1.5" />
            <div className="flex justify-between text-[4.2px] leading-tight">
                <span>Datum: {fmtDateTime(voucher.created_date || voucher.issue_date)}</span>
                <span>Kasse: Theke</span>
            </div>
            <div className="flex justify-between text-[5.4px] font-bold leading-tight mt-1.5">
                <span>Gutschein Nr. {voucher.voucher_number}</span>
                <span className="tabular-nums">{fmtMoney(voucher.original_value)}</span>
            </div>
            <div className="h-px bg-neutral-300 my-1.5" />
            <div className="flex justify-between text-[4.4px] leading-tight">
                <span>Zahlart: {paymentLabel(voucher.payment_method)}</span>
                <span className="text-neutral-500">0 % USt (Verbindlichkeit)</span>
            </div>
            <div className="h-px bg-neutral-400 my-1.5" />
            <div className="flex justify-between text-[6.2px] font-bold leading-tight">
                <span>Summe</span>
                <span className="tabular-nums">{fmtMoney(voucher.original_value)}</span>
            </div>
            {qr && <img src={qr} alt="QR" className="block mx-auto mt-1.5" style={{ width: qrPx, height: qrPx }} />}
            <p className="text-center font-bold text-[4.6px] mt-1">Vielen Dank!</p>
        </div>
    );
}