/**
 * Voucher62Preview — Bildschirm-Vorschau im echten Seitenverhältnis des Formats
 * (Basis 3 px je mm, also 186 × 210 px bei 62 × 70 mm).
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
            <div className={`${shell} px-3 py-2.5`} style={{ width, height }}>
                <p className="text-center font-bold tracking-[0.22em] text-[16px] leading-none">SAVO</p>
                <p className="text-center tracking-[0.18em] text-[5.1px] mt-1 text-neutral-500">LOUNGE · CLUB</p>
                <div className="h-px bg-neutral-400 mt-1.5" />
                <p className="text-center font-bold tracking-[0.26em] text-[6px] mt-2">GUTSCHEIN</p>
                <p className="text-center font-bold text-[27.5px] leading-none mt-1.5 tabular-nums">
                    {fmtMoney(voucher.original_value)}
                </p>
                <p className="text-center font-bold text-[7.4px] mt-1.5">Nr. {voucher.voucher_number}</p>
                <p className="text-center text-[4.9px] text-neutral-600 mt-0.5">Ausgestellt {fmtDate(voucher.issue_date)}</p>
                {qr && <img src={qr} alt="QR" className="block mx-auto mt-1.5" style={{ width: qrPx, height: qrPx }} />}
                <p className="text-center text-[4.4px] leading-tight mt-2 text-neutral-600">
                    SAVO Lounge-Club · Badstraße 1 · 72336 Balingen
                </p>
                <p className="text-center text-[4.4px] leading-tight text-neutral-600">
                    Einlösbar auf Speisen &amp; Getränke
                </p>
            </div>
        );
    }

    // 2) Einlösebeleg
    if (f.key === 'einloese_beleg') {
        return (
            <div className={`${shell} px-3 py-2.5`} style={{ width, height }}>
                <p className="text-center font-bold tracking-[0.22em] text-[13px] leading-none">SAVO</p>
                <div className="h-px bg-neutral-400 mt-1.5" />
                <p className="text-center font-bold tracking-[0.16em] text-[5.4px] mt-2">EINLÖSEBELEG GUTSCHEIN</p>
                <p className="text-center font-bold text-[7px] mt-1.5">Nr. {voucher.voucher_number}</p>
                <p className="text-center text-[8.5px] mt-2">Eingelöst: {fmtMoney(amount)}</p>
                <p className="text-center font-bold text-[16px] leading-none mt-1.5 tabular-nums">Rest: {fmtMoney(remaining)}</p>
                <p className="text-center text-[5.1px] text-neutral-600 mt-1">{fmtDateTime(at)}</p>
                {qr && <img src={qr} alt="QR" className="block mx-auto mt-1.5" style={{ width: qrPx, height: qrPx }} />}
                <p className="text-center text-[4.6px] text-neutral-600 mt-2">Restwert mit QR prüfbar</p>
            </div>
        );
    }

    // 3) Kuvert-Siegel
    if (f.key === 'siegel') {
        return (
            <div className={`${shell} px-3 py-2.5`} style={{ width, height }}>
                <p className="text-center font-bold tracking-[0.22em] text-[15px] leading-none mt-1">SAVO</p>
                <p className="text-center text-[4.9px] mt-1 text-neutral-500">GUTSCHEIN · GESCHENKT</p>
                <div className="h-px bg-neutral-400 mt-1.5" />
                <p className="text-center font-bold text-[21px] leading-none mt-2 tabular-nums">
                    {fmtMoney(voucher.original_value)}
                </p>
                <p className="text-center font-bold text-[7px] mt-1.5">Nr. {voucher.voucher_number}</p>
                {qr && <img src={qr} alt="QR" className="block mx-auto mt-1.5" style={{ width: qrPx, height: qrPx }} />}
                <p className="text-center text-[4.4px] text-neutral-600 mt-2">savo-lounge-club.de</p>
                <p className="text-center text-[4.2px] text-neutral-600">SAVO Lounge-Club · Badstraße 1 · 72336 Balingen</p>
            </div>
        );
    }

    // 4) Verkaufsbeleg (Kasse)
    return (
        <div className={`${shell} px-2 py-2`} style={{ width, height }}>
            <p className="text-center font-bold tracking-[0.22em] text-[10px] leading-none">SAVO</p>
            <p className="text-center font-bold tracking-[0.1em] text-[4.9px] mt-1">GUTSCHEINVERKAUF</p>
            <div className="h-px bg-neutral-400 mt-1.5" />
            <div className="flex justify-between text-[4.6px] leading-tight mt-1">
                <span>Datum: {fmtDateTime(voucher.created_date || voucher.issue_date)}</span>
                <span>Kasse: Theke</span>
            </div>
            <div className="flex justify-between text-[5.9px] font-bold leading-tight mt-1.5">
                <span>Gutschein Nr. {voucher.voucher_number}</span>
                <span className="tabular-nums">{fmtMoney(voucher.original_value)}</span>
            </div>
            <div className="flex justify-between text-[4.4px] leading-tight mt-1">
                <span>Zahlart: {paymentLabel(voucher.payment_method)}</span>
                <span className="text-neutral-500">0 % USt (Verbindlichkeit)</span>
            </div>
            <p className="text-center text-[4.4px] text-neutral-600 mt-1">Einlösbar auf Speisen &amp; Getränke</p>
            <div className="h-px bg-neutral-400 mt-1.5" />
            <div className="flex justify-between text-[6.9px] font-bold leading-tight">
                <span>Summe</span>
                <span className="tabular-nums">{fmtMoney(voucher.original_value)}</span>
            </div>
            <p className="text-center text-[4.2px] text-neutral-600 mt-1">0 % USt, keine Umsatzsteuer (Verbindlichkeit)</p>
            {qr && <img src={qr} alt="QR" className="block mx-auto mt-1" style={{ width: qrPx, height: qrPx }} />}
            <p className="text-center font-bold text-[4.8px] mt-1.5">Vielen Dank!</p>
        </div>
    );
}