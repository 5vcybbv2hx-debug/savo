export default function PriceLabelPreview({ price, name, volume, qrUrl }) {
    return (
        <div
            className="bg-card text-muted-foreground"
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
                <div style={{ fontSize: '3.2mm', fontWeight: 700, lineHeight: 1.15, maxHeight: '7.6mm', overflow: 'hidden' }}>{name}</div>
                <div style={{ fontSize: '5.2mm', fontWeight: 700, lineHeight: 1.1, marginTop: '1.4mm' }}>{price}</div>
                {volume && <div style={{ fontSize: '2.4mm', color: '#52525b' }}>{volume}</div>}
            </div>
        </div>
    );
}