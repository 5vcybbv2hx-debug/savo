/**
 * Voucher62Preview — Bildschirm-Vorschau im Seitenverhältnis 62 : 100 mm.
 * Reine Anzeige; gedruckt wird ausschließlich das PDF aus voucherPrint62.
 */
import React from 'react';
import { fmtDateTime, fmtDate, fmtMoney } from '@/lib/voucherPrint62';

export default function Voucher62Preview({ kind, voucher, amount, remaining, at, qr }) {
    if (!voucher) return null;

    return (
        <div className="mx-auto w-[186px] rounded-md bg-white text-black shadow-xl px-3 py-3 select-none">
            <p className="text-center font-bold tracking-[0.24em] text-[17px] leading-none">SAVO</p>
            <p className="text-center tracking-[0.18em] text-[5.5px] mt-1 text-neutral-500">LOUNGE · CLUB</p>
            <div className="h-px bg-neutral-400 my-1.5" />

            {kind === 'gift' ? (
                <>
                    <p className="text-center font-bold tracking-[0.26em] text-[10px] mt-1">GUTSCHEIN</p>
                    <p className="text-center font-bold text-[30px] leading-none mt-2 tabular-nums">
                        {fmtMoney(voucher.original_value)}
                    </p>
                    <div className="h-px bg-neutral-300 my-2" />
                    <p className="text-center font-bold text-[9px]">Nr. {voucher.voucher_number}</p>
                    <p className="text-center text-[6px] text-neutral-600 mt-0.5">
                        Ausgestellt {fmtDate(voucher.issue_date)}
                    </p>
                    {qr && <img src={qr} alt="QR" className="block w-[84px] h-[84px] mx-auto mt-2" />}
                    <p className="text-center text-[4.6px] leading-snug mt-2 text-neutral-600">
                        SAVO Lounge-Club · Badstraße 1 · 72336 Balingen
                    </p>
                    <p className="text-center text-[4.6px] leading-snug text-neutral-600">
                        Einlösbar auf Speisen &amp; Getränke · Restwert jederzeit abrufbar
                    </p>
                </>
            ) : (
                <>
                    <p className="text-center font-bold tracking-[0.2em] text-[8.5px] mt-1">EINLÖSEBELEG</p>
                    <p className="text-center font-bold tracking-[0.16em] text-[7px] mt-0.5">GUTSCHEIN</p>
                    <p className="text-center font-bold text-[9px] mt-2">Nr. {voucher.voucher_number}</p>
                    <p className="text-center text-[9px] mt-1.5">Eingelöst: {fmtMoney(amount)}</p>
                    <p className="text-center font-bold text-[19px] leading-none mt-2 tabular-nums">
                        Rest: {fmtMoney(remaining)}
                    </p>
                    <p className="text-center text-[6px] text-neutral-600 mt-1">{fmtDateTime(at)}</p>
                    {qr && <img src={qr} alt="QR" className="block w-[72px] h-[72px] mx-auto mt-2" />}
                    <p className="text-center text-[4.8px] text-neutral-600 mt-2">Restwert mit QR prüfbar</p>
                </>
            )}
        </div>
    );
}