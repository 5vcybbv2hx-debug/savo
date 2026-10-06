import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Download, QrCode } from 'lucide-react';
import QRCode from 'qrcode';
import JSZip from 'jszip';
import { PUBLIC_DRINK_MENU_URL } from '@/lib/publicRoutes';

export default function TableQRGenerator() {
    const [tableCount, setTableCount] = useState(10);
    const [tablePrefix, setTablePrefix] = useState('Tisch');
    const [isGenerating, setIsGenerating] = useState(false);

    const generateQRCode = async (tableNumber) => {
        const appId = window.location.hostname.split('--')[1]?.split('.')[0] || window.location.hostname.split('.')[0];
        const url = `${PUBLIC_DRINK_MENU_URL}?table=${tableNumber}`;
        const qrCodeDataUrl = await QRCode.toDataURL(url, {
            width: 800,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#ffffff'
            }
        });
        return qrCodeDataUrl;
    };

    const downloadSingle = async (tableNumber) => {
        try {
            const qrCodeDataUrl = await generateQRCode(tableNumber);
            const link = document.createElement('a');
            link.href = qrCodeDataUrl;
            link.download = `${tablePrefix}_${tableNumber}_QR.png`;
            link.click();
        } catch (error) {
            console.error('Fehler beim Generieren des QR-Codes:', error);
            alert('Fehler beim Generieren des QR-Codes');
        }
    };

    const downloadAll = async () => {
        setIsGenerating(true);
        try {
            const zip = new JSZip();
            const qrFolder = zip.folder('Tisch_QR_Codes');

            for (let i = 1; i <= tableCount; i++) {
                const qrCodeDataUrl = await generateQRCode(i);
                const base64Data = qrCodeDataUrl.split(',')[1];
                qrFolder.file(`${tablePrefix}_${i}_QR.png`, base64Data, { base64: true });
            }

            const content = await zip.generateAsync({ type: 'blob' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            link.download = 'Tisch_QR_Codes.zip';
            link.click();
        } catch (error) {
            console.error('Fehler beim Generieren der QR-Codes:', error);
            alert('Fehler beim Generieren der QR-Codes');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <QrCode className="w-5 h-5" />
                    Tisch QR-Codes generieren
                </CardTitle>
                <CardDescription>
                    Erstellen Sie QR-Codes für Ihre Tische. Gäste scannen den Code und sehen die digitale Getränkekarte.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="tableCount">Anzahl Tische</Label>
                        <Input
                            id="tableCount"
                            type="number"
                            min="1"
                            max="100"
                            value={tableCount}
                            onChange={(e) => setTableCount(parseInt(e.target.value) || 1)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="tablePrefix">Präfix</Label>
                        <Input
                            id="tablePrefix"
                            type="text"
                            value={tablePrefix}
                            onChange={(e) => setTablePrefix(e.target.value)}
                            placeholder="Tisch"
                        />
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                    <Button 
                        onClick={downloadAll}
                        disabled={isGenerating}
                        className="flex-1 bg-amber-500 hover:bg-amber-600"
                    >
                        <Download className="w-4 h-4 mr-2" />
                        {isGenerating ? 'Generiere...' : `Alle ${tableCount} QR-Codes als ZIP`}
                    </Button>
                </div>

                <div className="border-t pt-4">
                    <h4 className="text-sm font-semibold mb-3">Einzelne Tische</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {Array.from({ length: Math.min(tableCount, 20) }, (_, i) => i + 1).map((num) => (
                            <Button
                                key={num}
                                variant="outline"
                                size="sm"
                                onClick={() => downloadSingle(num)}
                            >
                                {tablePrefix} {num}
                            </Button>
                        ))}
                    </div>
                    {tableCount > 20 && (
                        <p className="text-xs text-muted-foreground mt-2">
                            ... und {tableCount - 20} weitere. Nutzen Sie "Alle herunterladen" für alle Tische.
                        </p>
                    )}
                </div>

                <div className="bg-muted/50 rounded-lg p-4 text-sm">
                    <p className="font-semibold mb-2">💡 So funktioniert's:</p>
                    <ol className="space-y-1 list-decimal list-inside text-muted-foreground">
                        <li>QR-Codes herunterladen und ausdrucken</li>
                        <li>QR-Codes auf den Tischen platzieren</li>
                        <li>Gäste scannen den Code mit dem Smartphone</li>
                        <li>Automatisch wird die Getränkekarte für den jeweiligen Tisch angezeigt</li>
                    </ol>
                </div>
            </CardContent>
        </Card>
    );
}