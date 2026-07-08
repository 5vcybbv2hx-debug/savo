/**
 * StorageLabelPrint — Brother QL-800 label generator
 *
 * Output formats:
 * - PDF: jsPDF with embedded Roboto TrueType font → vector glyphs, printer-ready
 * - PNG: Canvas-rendered at 300 DPI → direct thermal printer compatible, pixel-perfect
 */

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, Download, QrCode, Share2, Loader2, Image } from 'lucide-react';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import { usePrintSettings } from '@/lib/usePrintSettings';

// ─── Brother QL-800 label dimensions (mm) ────────────────────────────────────
const LABEL_CONFIGS = {
    standard: { wMM: 62, hMM: 29, label: '62×29mm' },
    tall:     { wMM: 62, hMM: 62, label: '62×62mm' },
};

const DPI = 300;
const MM_TO_PX = DPI / 25.4;

// ─── Font loader — fetches Roboto TTF and returns ArrayBuffer ─────────────────
let _fontCache = null;
async function loadFonts() {
    if (_fontCache) return _fontCache;
    const [boldBuf, regularBuf] = await Promise.all([
        fetch('https://cdn.jsdelivr.net/npm/@fontsource/roboto@5.0.8/files/roboto-latin-700-normal.ttf')
            .then(r => r.ok ? r.arrayBuffer() : null).catch(() => null),
        fetch('https://cdn.jsdelivr.net/npm/@fontsource/roboto@5.0.8/files/roboto-latin-400-normal.ttf')
            .then(r => r.ok ? r.arrayBuffer() : null).catch(() => null),
    ]);

    const toB64 = (buf) => {
        const bytes = new Uint8Array(buf);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        return btoa(binary);
    };

    if (!boldBuf || !regularBuf) return null;
    _fontCache = { bold: toB64(boldBuf), regular: toB64(regularBuf) };
    return _fontCache;
}

// ─── Extract structured data from location ───────────────────────────────────
function getLabelData(location) {
    const articles = location.article_names || [];
    const displayName = location.position || location.name || '';
    const pathParts = [location.area, location.furniture, location.container].filter(Boolean);
    const pathStr = pathParts.join(' › ');
    const min_stock = location.min_stock != null ? String(location.min_stock) : '--';
    // Lager/Keller-Fächer bekommen bewusst simple Codes (K1, K2 …) — die werden auf dem
    // Etikett riesig dargestellt, damit sie im Keller auf einen Blick lesbar sind.
    const emphasizeCode = location.area_type === 'lager';
    return { articles, displayName, pathStr, short_code: location.short_code || '', min_stock, emphasizeCode };
}

// ─── Generate QR canvas at given pixel size ───────────────────────────────────
async function generateQrCanvas(locationId, sizePx) {
    const url = `${window.location.origin}/StorageLocationScan/${locationId}`;
    return QRCode.toCanvas(document.createElement('canvas'), url, {
        width: sizePx,
        margin: 2,
        errorCorrectionLevel: 'H',
        color: { dark: '#000000', light: '#ffffff' },
    });
}

async function generateQrPng(locationId) {
    const c = await generateQrCanvas(locationId, 600);
    return c.toDataURL('image/png');
}

// ─── PNG builder at 300 DPI via Canvas ───────────────────────────────────────
async function buildLabelPNG(location, configKey) {
    const cfg = LABEL_CONFIGS[configKey];
    const W = Math.round(cfg.wMM * MM_TO_PX);
    const H = Math.round(cfg.hMM * MM_TO_PX);

    const { articles, displayName, pathStr, short_code, min_stock, emphasizeCode } = getLabelData(location);

    // QR at full canvas resolution
    const QR_PX = Math.round(22 * MM_TO_PX);
    const qrCanvas = await generateQrCanvas(location.id, QR_PX * 2); // 2× for crispness

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    // QR Code
    const PAD = Math.round(2 * MM_TO_PX);
    const QR_Y = Math.round((H - QR_PX) / 2);
    ctx.drawImage(qrCanvas, PAD, QR_Y, QR_PX, QR_PX);

    // Divider line
    const DIV_X = PAD + QR_PX + Math.round(1.5 * MM_TO_PX);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = Math.round(0.35 * MM_TO_PX);
    ctx.beginPath();
    ctx.moveTo(DIV_X, PAD);
    ctx.lineTo(DIV_X, H - PAD);
    ctx.stroke();

    // Text area
    const TEXT_X = DIV_X + Math.round(2 * MM_TO_PX);
    const TEXT_W = W - TEXT_X - PAD;
    let y = PAD + Math.round(3 * MM_TO_PX);

    const wrapText = (ctx, text, x, y, maxWidth, lineHeight) => {
        const words = text.split(' ');
        let line = '';
        let lines = [];
        for (const word of words) {
            const test = line ? line + ' ' + word : word;
            if (ctx.measureText(test).width > maxWidth && line) {
                lines.push(line);
                line = word;
            } else {
                line = test;
            }
        }
        if (line) lines.push(line);
        lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
        return lines.length * lineHeight;
    };

    const ptToPx = (pt) => Math.round((pt / 72) * DPI);

    // 1. SHORT CODE — bei Lager/Keller-Fächern riesig, damit die Fach-Nummer auf einen Blick lesbar ist
    if (short_code) {
        const fs = ptToPx(emphasizeCode ? 26 : 11);
        ctx.font = `700 ${fs}px Arial, sans-serif`;
        ctx.fillStyle = '#000000';
        ctx.letterSpacing = '2px';
        ctx.fillText(short_code, TEXT_X, y);
        y += fs * 1.35;
        ctx.letterSpacing = '0px';
    }

    // 2. FACHNAME
    if (displayName) {
        const fs = ptToPx(10);
        ctx.font = `700 ${fs}px Arial, sans-serif`;
        ctx.fillStyle = '#000000';
        y += wrapText(ctx, displayName, TEXT_X, y, TEXT_W, fs * 1.3);
        y += Math.round(1 * MM_TO_PX);
    }

    // 3. LAGERPFAD (bei Lager/Keller-Fächern weggelassen — Platz für den großen Fach-Code)
    if (pathStr && !emphasizeCode) {
        const s = pathStr.length > 45 ? pathStr.slice(0, 42) + '…' : pathStr;
        const fs = ptToPx(7.5);
        ctx.font = `700 ${fs}px Arial, sans-serif`;
        ctx.fillStyle = '#000000';
        y += wrapText(ctx, s, TEXT_X, y, TEXT_W, fs * 1.3);
        y += Math.round(1.5 * MM_TO_PX);
    }

    // Separator
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = Math.round(0.2 * MM_TO_PX);
    ctx.beginPath();
    ctx.moveTo(TEXT_X, y);
    ctx.lineTo(TEXT_X + TEXT_W, y);
    ctx.stroke();
    y += Math.round(1.5 * MM_TO_PX);

    // 4. INHALT
    if (articles.length > 0) {
        const labelFs = ptToPx(6.5);
        ctx.font = `700 ${labelFs}px Arial, sans-serif`;
        ctx.fillStyle = '#000000';
        ctx.fillText('INHALT', TEXT_X, y);
        y += labelFs * 1.4;

        const MAX = 3;
        const shown = articles.slice(0, MAX);
        const extra = articles.length - MAX;
        const artText = shown.join(' · ') + (extra > 0 ? ` +${extra}` : '');
        const artFs = ptToPx(8.5);
        ctx.font = `700 ${artFs}px Arial, sans-serif`;
        ctx.fillStyle = '#000000';
        wrapText(ctx, artText, TEXT_X, y, TEXT_W, artFs * 1.3);
    } else {
        const fs = ptToPx(6.5);
        ctx.font = `700 ${fs}px Arial, sans-serif`;
        ctx.fillStyle = '#000000';
        ctx.fillText('Keine Artikel zugeordnet', TEXT_X, y);
    }

    // MIN STOCK — bottom right corner
    const minFs = ptToPx(7);
    ctx.font = `700 ${minFs}px Arial, sans-serif`;
    ctx.fillStyle = '#000000';
    const minLabel = `Min: ${min_stock}`;
    const minW = ctx.measureText(minLabel).width;
    ctx.fillText(minLabel, W - PAD - minW, H - PAD - Math.round(1 * MM_TO_PX));

    return canvas;
}

// ─── PDF builder ─────────────────────────────────────────────────────────────
async function buildLabelPDF(location, qrPng, configKey) {
    const cfg = LABEL_CONFIGS[configKey];
    const W = cfg.wMM;
    const H = cfg.hMM;

    const { articles, displayName, pathStr, short_code, emphasizeCode } = getLabelData(location);
    const fonts = await loadFonts();

    const doc = new jsPDF({
        unit: 'mm',
        format: [Math.min(W, H), Math.max(W, H)],
        orientation: W >= H ? 'landscape' : 'portrait',
        compress: false,
    });

    const FONT_NAME = fonts ? 'Roboto' : 'helvetica';
    if (fonts) {
        doc.addFileToVFS('Roboto-Bold.ttf', fonts.bold);
        doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');
        doc.addFileToVFS('Roboto-Regular.ttf', fonts.regular);
        doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
    }

    const PAD = 2.0;
    const QR_SIZE = 22;
    const QR_X = PAD;
    const QR_Y = (H - QR_SIZE) / 2;
    const DIV_X = PAD + QR_SIZE + 1.5;
    const TEXT_X = DIV_X + 2.0;
    const TEXT_W = W - TEXT_X - PAD;

    const ptMm = (pt) => pt * 0.3528;
    const lhMm = (pt) => ptMm(pt) * 1.25;

    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, W, H, 'F');
    doc.addImage(qrPng, 'PNG', QR_X, QR_Y, QR_SIZE, QR_SIZE, undefined, 'NONE');
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.35);
    doc.line(DIV_X, PAD, DIV_X, H - PAD);

    let y = PAD + ptMm(10);

    const draw = (text, pt, weight, r, g, b) => {
        doc.setFont(FONT_NAME, weight);
        doc.setFontSize(pt);
        doc.setTextColor(r, g, b);
        const lines = doc.splitTextToSize(String(text), TEXT_W);
        doc.text(lines, TEXT_X, y);
        return lines.length * lhMm(pt);
    };

    if (short_code) { y += draw(short_code, emphasizeCode ? 24 : 11, 'bold', 0, 0, 0); y += 0.6; }
    if (displayName) { y += draw(displayName, 10, 'bold', 0, 0, 0); y += 0.5; }
    if (pathStr && !emphasizeCode) {
        const s = pathStr.length > 40 ? pathStr.slice(0, 37) + '…' : pathStr;
        y += draw(s, 7.5, 'normal', 50, 50, 50);
        y += 0.8;
    }

    doc.setDrawColor(150, 150, 150);
    doc.setLineWidth(0.2);
    doc.line(TEXT_X, y, TEXT_X + TEXT_W, y);
    y += 1.0;

    if (articles.length > 0) {
        y += draw('INHALT', 6.5, 'bold', 100, 100, 100);
        y += 0.3;
        const MAX = 3;
        const shown = articles.slice(0, MAX);
        const extra = articles.length - MAX;
        const artText = shown.join(' · ') + (extra > 0 ? ` +${extra}` : '');
        draw(artText, 8.5, 'bold', 0, 0, 0);
    } else {
        draw('Keine Artikel zugeordnet', 6.5, 'normal', 170, 170, 170);
    }

    return doc;
}

// ─── Label Preview (HTML) ─────────────────────────────────────────────────────
function LabelPreview({ location, qrDataUrl, configKey }) {
    const cfg = LABEL_CONFIGS[configKey];
    const SCALE = 4;
    const W = cfg.wMM * SCALE;
    const H = cfg.hMM * SCALE;
    const QR_PX = 22 * SCALE;
    const { articles, displayName, pathStr, short_code, min_stock, emphasizeCode } = getLabelData(location);

    return (
        <div style={{
            width: W, height: H, background: '#fff',
            border: '2px solid #222', display: 'flex',
            fontFamily: '"Roboto", Arial, sans-serif',
            flexShrink: 0, overflow: 'hidden', borderRadius: 2,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}>
            <div style={{ padding: 8, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                {qrDataUrl
                    ? <img src={qrDataUrl} alt="QR" style={{ width: QR_PX, height: QR_PX, display: 'block', imageRendering: 'pixelated' }} />
                    : <div style={{ width: QR_PX, height: QR_PX, background: '#f0f0f0' }} />
                }
            </div>
            <div style={{ width: 1.5, background: '#000', margin: '8px 0', flexShrink: 0 }} />
            <div style={{ flex: 1, padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden', minWidth: 0, justifyContent: 'center' }}>
                {short_code && <div style={{ fontSize: emphasizeCode ? 30 : 13, fontWeight: 700, color: '#000', lineHeight: 1.1, letterSpacing: '0.05em' }}>{short_code}</div>}
                {displayName && <div style={{ fontSize: 10, fontWeight: 700, color: '#0a0a0a', lineHeight: 1.2, wordBreak: 'break-word' }}>{displayName}</div>}
                {pathStr && !emphasizeCode && <div style={{ fontSize: 7, fontWeight: 400, color: '#555', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pathStr}</div>}
                <div style={{ borderTop: '1px solid #ddd', paddingTop: 2, marginTop: 1 }}>
                    {articles.length > 0 ? (
                        <>
                            <div style={{ fontSize: 5.5, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', marginBottom: 1 }}>Inhalt</div>
                            <div style={{ fontSize: 7, fontWeight: 700, color: '#111', lineHeight: 1.3 }}>
                                {articles.slice(0, 3).join(' · ')}{articles.length > 3 ? ` +${articles.length - 3}` : ''}
            </div>
                        </>
                    ) : (
                        <div style={{ fontSize: 7, color: '#ccc' }}>Keine Artikel</div>
                    )}
                </div>
                <div style={{ fontSize: 6, fontWeight: 700, color: '#000', marginTop: 'auto', paddingTop: 2, textAlign: 'right' }}>
                    Min: {min_stock}
                </div>
            </div>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function StorageLabelPrint({ open, onClose, location }) {
    const [qrPng, setQrPng] = useState('');
    const [configKey, setConfigKey] = useState('standard');
    const [outputFormat, setOutputFormat] = useState('png'); // 'pdf' | 'png'
    const [loading, setLoading] = useState(false);
    const { settings, PRINT_AREAS } = usePrintSettings();

    useEffect(() => {
        if (!location?.id || !open) return;
        setQrPng('');
        Promise.all([
            generateQrPng(location.id),
            loadFonts(),
        ]).then(([png]) => setQrPng(png)).catch(console.error);
    }, [location?.id, open]);

    const getCode = () => location.short_code || location.id?.slice(0, 8) || 'etikett';

    const handleDownloadPDF = async () => {
        if (!qrPng || loading) return;
        setLoading(true);
        try {
            const doc = await buildLabelPDF(location, qrPng, configKey);
            doc.save(`etikett_${getCode()}.pdf`);
        } finally { setLoading(false); }
    };

    const handleDownloadPNG = async () => {
        if (!qrPng || loading) return;
        setLoading(true);
        try {
            const canvas = await buildLabelPNG(location, configKey);
            const a = document.createElement('a');
            a.href = canvas.toDataURL('image/png');
            a.download = `etikett_${getCode()}_300dpi.png`;
            a.click();
        } finally { setLoading(false); }
    };

    const handlePrint = async () => {
        if (!qrPng || loading) return;
        setLoading(true);
        try {
            let url;
            if (outputFormat === 'png') {
                const canvas = await buildLabelPNG(location, configKey);
                const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
                url = URL.createObjectURL(blob);
                const win = window.open('', '_blank');
                if (win) {
                    const labelFmt = PRINT_AREAS[settings.labels || 'label_62']?.format || '62mm 29mm';
                    win.document.write(`<html><head><style>@page{size:${labelFmt};margin:0}body{margin:0}</style></head><body style="margin:0"><img src="${url}" style="width:100%;display:block" onload="window.print()"/></body></html>`);
                    win.document.close();
                }
            } else {
                const doc = await buildLabelPDF(location, qrPng, configKey);
                const blob = doc.output('blob');
                url = URL.createObjectURL(blob);
                const win = window.open(url, '_blank');
                if (win) setTimeout(() => { try { win.print(); } catch {} }, 1000);
            }
        } finally { setLoading(false); }
    };

    const handleShare = async () => {
        if (!qrPng || !navigator.share || loading) return;
        setLoading(true);
        try {
            if (outputFormat === 'png') {
                const canvas = await buildLabelPNG(location, configKey);
                const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
                const file = new File([blob], `etikett_${getCode()}.png`, { type: 'image/png' });
                await navigator.share({ files: [file], title: `Etikett ${getCode()}` });
            } else {
                const doc = await buildLabelPDF(location, qrPng, configKey);
                const blob = doc.output('blob');
                const file = new File([blob], `etikett_${getCode()}.pdf`, { type: 'application/pdf' });
                await navigator.share({ files: [file], title: `Etikett ${getCode()}` });
            }
        } catch { /* cancelled or unsupported */ }
        finally { setLoading(false); }
    };

    if (!location) return null;

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-base">
                        <QrCode className="w-5 h-5 text-amber-500" />
                        Etikett drucken
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Label size selector */}
                    <div className="flex gap-2">
                        {Object.entries(LABEL_CONFIGS).map(([key, cfg]) => (
                            <button
                                key={key}
                                onClick={() => setConfigKey(key)}
                                className={`flex-1 py-2 px-3 rounded-lg border text-xs font-medium transition-all ${
                                    configKey === key
                                        ? 'bg-amber-500 text-slate-900 border-amber-500'
                                        : 'border-border text-muted-foreground hover:bg-accent'
                                }`}
                            >
                                {cfg.label}
                            </button>
                        ))}
                    </div>

                    {/* Output format selector */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => setOutputFormat('png')}
                            className={`flex-1 py-2 px-3 rounded-lg border text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                                outputFormat === 'png'
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'border-border text-muted-foreground hover:bg-accent'
                            }`}
                        >
                            <Image className="w-3.5 h-3.5" />
                            PNG · 300 DPI
                        </button>
                        <button
                            onClick={() => setOutputFormat('pdf')}
                            className={`flex-1 py-2 px-3 rounded-lg border text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                                outputFormat === 'pdf'
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'border-border text-muted-foreground hover:bg-accent'
                            }`}
                        >
                            <Download className="w-3.5 h-3.5" />
                            PDF · Vektor
                        </button>
                    </div>

                    {/* Preview */}
                    <div className="bg-gray-100 rounded-xl p-4 flex justify-center items-center min-h-[80px] overflow-auto">
                        {qrPng ? (
                            <LabelPreview location={location} qrDataUrl={qrPng} configKey={configKey} />
                        ) : (
                            <div className="flex items-center gap-2 text-muted-foreground text-sm">
                                <Loader2 className="w-4 h-4 animate-spin" /> Wird vorbereitet…
                            </div>
                        )}
                    </div>

                    <p className="text-xs text-muted-foreground text-center">
                        {outputFormat === 'png'
                            ? 'PNG · 300 DPI · direkt für Thermodrucker'
                            : 'PDF · Roboto TrueType · Vektorgrafik'}
                    </p>

                    {/* Actions */}
                    <div className="flex flex-col gap-2">
                        <Button
                            onClick={outputFormat === 'png' ? handleDownloadPNG : handleDownloadPDF}
                            disabled={!qrPng || loading}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white gap-2"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                            {outputFormat === 'png' ? 'Als PNG herunterladen (300 DPI)' : 'Als PDF herunterladen'}
                        </Button>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={onClose} className="flex-1" disabled={loading}>
                                Abbrechen
                            </Button>
                            {navigator.share && (
                                <Button variant="outline" onClick={handleShare} disabled={!qrPng || loading} className="px-3">
                                    <Share2 className="w-4 h-4" />
                                </Button>
                            )}
                            <Button
                                onClick={handlePrint}
                                disabled={!qrPng || loading}
                                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white gap-2"
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                                Drucken
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ─── Batch export ─────────────────────────────────────────────────────────────
export async function exportBatchPDF(locations, configKey = 'standard') {
    if (!locations?.length) return;
    const cfg = LABEL_CONFIGS[configKey];
    const qrPngs = await Promise.all(locations.map(loc => generateQrPng(loc.id)));
    const docs = await Promise.all(locations.map((loc, i) => buildLabelPDF(loc, qrPngs[i], configKey)));

    const master = docs[0];
    for (let i = 1; i < docs.length; i++) {
        master.addPage([cfg.wMM, cfg.hMM]);
        const srcPages = docs[i].internal.pages;
        master.internal.pages[master.internal.pages.length - 1] = srcPages[srcPages.length - 1];
    }
    master.save('etiketten_batch.pdf');
}

export async function exportBatchPNG(locations, configKey = 'standard') {
    if (!locations?.length) return;
    // Download each PNG individually
    for (const loc of locations) {
        const canvas = await buildLabelPNG(loc, configKey);
        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/png');
        const code = loc.short_code || loc.id?.slice(0, 8) || 'etikett';
        a.download = `etikett_${code}_300dpi.png`;
        a.click();
        await new Promise(r => setTimeout(r, 200)); // small delay between downloads
    }
}