import React, { useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { Download, Printer, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function QRCodeGenerator({ itemId, itemName, type = 'recipe' }) {
    const canvasRef = useRef(null);
    
    const generateShareUrl = () => {
        const baseUrl = window.location.origin;
        return `${baseUrl}?item=${itemId}&type=${type}`;
    };

    useEffect(() => {
        const generateQR = async () => {
            if (canvasRef.current) {
                try {
                    const shareUrl = generateShareUrl();
                    await QRCode.toCanvas(canvasRef.current, shareUrl, {
                        width: 300,
                        margin: 2,
                        color: {
                            dark: '#1e1b4b',
                            light: '#f3f4f6'
                        }
                    });
                } catch (err) {
                    console.error('QR Code generation error:', err);
                }
            }
        };
        generateQR();
    }, [itemId, type]);

    const handleDownload = () => {
        if (canvasRef.current) {
            const link = document.createElement('a');
            link.href = canvasRef.current.toDataURL('image/png');
            link.download = `QR-${itemName.replace(/\s+/g, '-')}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success('QR-Code heruntergeladen');
        }
    };

    const handlePrint = () => {
        if (canvasRef.current) {
            const printWindow = window.open('', '', 'width=600,height=600');
            printWindow.document.write(`<style>@page{size:A6 portrait;margin:5mm}</style>
                <html>
                <head>
                    <title>QR-Code: ${itemName}</title>
                    <style>
                        body { 
                            display: flex; 
                            flex-direction: column; 
                            align-items: center; 
                            justify-content: center; 
                            min-height: 100vh;
                            margin: 0;
                            font-family: Arial, sans-serif;
                        }
                        h2 { margin-bottom: 20px; }
                        canvas { max-width: 100%; }
                    </style>
                </head>
                <body>
                    <h2>${itemName}</h2>
                    <img src="${canvasRef.current.toDataURL()}" style="max-width: 400px;" />
                </body>
                </html>
            `);
            printWindow.document.close();
            printWindow.print();
            toast.success('Druckvorschau geöffnet');
        }
    };

    const handleCopyLink = () => {
        navigator.clipboard.writeText(generateShareUrl());
        toast.success('Link kopiert');
    };

    return (
        <div className="flex flex-col gap-4 items-center">
            <canvas 
                ref={canvasRef} 
                className="border-2 border-border rounded-lg p-2 bg-card"
            />
            <div className="flex gap-2 flex-wrap justify-center">
                <Button
                    size="sm"
                    onClick={handleDownload}
                    className="gap-2 bg-primary/70 hover:bg-primary/70"
                >
                    <Download className="w-4 h-4" />
                    Download
                </Button>
                <Button
                    size="sm"
                    onClick={handlePrint}
                    variant="outline"
                    className="gap-2"
                >
                    <Printer className="w-4 h-4" />
                    Drucken
                </Button>
                <Button
                    size="sm"
                    onClick={handleCopyLink}
                    variant="outline"
                    className="gap-2"
                >
                    <Copy className="w-4 h-4" />
                    Link
                </Button>
            </div>
        </div>
    );
}