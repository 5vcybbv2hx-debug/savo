import { splitLabelName } from '@/lib/slotLabels';

/**
 * Vorschau in echter 62-mm-Breite (CSS-Millimeter = physische Größe am Bildschirm).
 */
export default function SlotLabelPreview({ code, name, path, qrUrl }) {
    const { first, rest } = splitLabelName(name);

    return (
        <div
            className="bg-white text-zinc-900"
            style={{
                width: '62mm',
                height: '30mm',
                position: 'relative',
                border: '1px solid #d4d4d8',
                borderRadius: '1mm',
                overflow: 'hidden',
                flexShrink: 0,
            }}
        >
            {qrUrl ? (
                <img
                    src={qrUrl}
                    alt="QR"
                    style={{ position: 'absolute', left: '2mm', top: '4mm', width: '22mm', height: '22mm', imageRendering: 'pixelated' }}
                />
            ) : (
                <div style={{ position: 'absolute', left: '2mm', top: '4mm', width: '22mm', height: '22mm', background: '#f4f4f5' }} />
            )}

            <div style={{ position: 'absolute', left: '25.5mm', top: '3mm', bottom: '3mm', width: '0.2mm', background: '#a1a1aa' }} />

            <div style={{ position: 'absolute', left: '27mm', right: '2mm', top: '3.2mm' }}>
                <div style={{ fontSize: '1.9mm', color: '#52525b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {path}
                </div>
                <div style={{ fontSize: '3.4mm', fontWeight: 700, lineHeight: 1.15, marginTop: '1.4mm' }}>{first}</div>
                {rest && <div style={{ fontSize: '2.6mm', lineHeight: 1.15 }}>{rest}</div>}
            </div>

            <div style={{ position: 'absolute', left: '27mm', bottom: '1.6mm', fontFamily: 'monospace', fontWeight: 700, fontSize: '3.1mm' }}>
                {code}
            </div>
        </div>
    );
}