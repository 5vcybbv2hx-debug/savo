import { usePrintSettings } from '@/lib/usePrintSettings';
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Printer, FileDown } from 'lucide-react';
import { cn } from "@/lib/utils";
import JsBarcode from 'jsbarcode';
import jsPDF from 'jspdf';

export default function LabelPrinter({ articles = [] }) {
    const [open, setOpen] = useState(false);
    const [selectedArticles, setSelectedArticles] = useState([]);
    const { settings, PRINT_AREAS } = usePrintSettings();

    const toggleArticle = (articleId) => {
        setSelectedArticles(prev =>
            prev.includes(articleId)
                ? prev.filter(id => id !== articleId)
                : [...prev, articleId]
        );
    };

    const generateBarcodeSVG = (barcode) => {
        const canvas = document.createElement('canvas');
        try {
            JsBarcode(canvas, barcode, {
                format: 'CODE128',
                width: 3,
                height: 80,
                displayValue: false,
                margin: 0
            });
            return canvas.toDataURL('image/png');
        } catch (e) {
            return null;
        }
    };

    const generateHighResBarcode = (barcode) => {
        const canvas = document.createElement('canvas');
        canvas.width = 400;
        canvas.height = 150;
        try {
            JsBarcode(canvas, barcode, {
                format: 'CODE128',
                width: 4,
                height: 120,
                displayValue: false,
                margin: 5,
                background: '#ffffff',
                lineColor: '#000000'
            });
            return canvas.toDataURL('image/png', 1.0);
        } catch (e) {
            return null;
        }
    };

    const handlePDFExport = () => {
        const articlesToPrint = articles.filter(a => selectedArticles.includes(a.id));
        
        // 62mm x 29mm in points (1mm = 2.834645669 points)
        const labelWidth = 62 * 2.834645669;
        const labelHeight = 29 * 2.834645669;
        
        const pdf = new jsPDF({
            orientation: 'landscape',
            unit: 'pt',
            format: [labelWidth, labelHeight],
            compress: false
        });

        articlesToPrint.forEach((article, index) => {
            if (index > 0) {
                pdf.addPage([labelWidth, labelHeight], 'landscape');
            }

            const padding = 5.67; // 2mm
            
            // Name (oben links, mehrzeilig möglich)
            pdf.setFontSize(12);
            pdf.setFont('helvetica', 'bold');
            const nameLines = pdf.splitTextToSize(article.name, 110);
            pdf.text(nameLines, padding, padding + 10);

            // Barcode (oben rechts) - hochauflösend
            if (article.barcode) {
                const barcodeImg = generateHighResBarcode(article.barcode);
                if (barcodeImg) {
                    // Barcode größer und schärfer
                    const barcodeWidth = 100;
                    const barcodeHeight = 37.5;
                    pdf.addImage(barcodeImg, 'PNG', labelWidth - barcodeWidth - padding, padding, barcodeWidth, barcodeHeight, undefined, 'FAST');
                    
                    // Barcode-Text direkt darunter
                    pdf.setFontSize(8);
                    pdf.setFont('courier', 'normal');
                    pdf.text(article.barcode, labelWidth - (barcodeWidth / 2) - padding, padding + barcodeHeight + 8, { align: 'center' });
                }
            }

            // Kategorie (unten links)
            if (article.category) {
                pdf.setFontSize(10);
                pdf.setFont('helvetica', 'normal');
                pdf.setTextColor(60, 60, 60);
                pdf.text(article.category, padding, labelHeight - padding - 3);
            }

            // Lieferanten (unten rechts)
            if (article.suppliers?.length > 0) {
                pdf.setFontSize(8);
                pdf.setTextColor(90, 90, 90);
                const supplierText = article.suppliers.join(', ');
                const supplierLines = pdf.splitTextToSize(supplierText, 95);
                pdf.text(supplierLines[0], labelWidth - padding, labelHeight - padding - 3, { align: 'right' });
            }

            pdf.setTextColor(0, 0, 0);
        });

        pdf.save('etiketten_62x29mm.pdf');
    };

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        const articlesToPrint = articles.filter(a => selectedArticles.includes(a.id));

        const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Etiketten</title>
    <style>
        @page {
            size: ${PRINT_AREAS[settings.labels || 'label_62']?.format || '62mm 29mm'};
            margin: 0;
        }
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: Arial, sans-serif;
        }
        .label {
            width: 62mm;
            height: 29mm;
            padding: 2mm;
            page-break-after: always;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            border: 1px solid #ddd;
        }
        .label:last-child {
            page-break-after: auto;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1mm;
        }
        .name {
            font-size: 10pt;
            font-weight: bold;
            line-height: 1.2;
            max-width: 35mm;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .barcode-img {
            height: 10mm;
            width: auto;
        }
        .barcode-text {
            font-size: 7pt;
            font-family: 'Courier New', monospace;
            text-align: center;
            margin-top: 0.5mm;
        }
        .info {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
        }
        .category {
            font-size: 8pt;
            color: #555;
        }
        .suppliers {
            font-size: 7pt;
            color: #666;
            text-align: right;
            max-width: 30mm;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        @media print {
            .label {
                border: none;
            }
        }
    </style>
</head>
<body>
${articlesToPrint.map(article => {
    const barcodeSVG = article.barcode ? generateBarcodeSVG(article.barcode) : null;
    return `
    <div class="label">
        <div class="header">
            <div class="name">${article.name}</div>
            ${barcodeSVG ? `
                <div>
                    <img src="${barcodeSVG}" class="barcode-img" />
                    <div class="barcode-text">${article.barcode}</div>
                </div>
            ` : ''}
        </div>
        <div class="info">
            <div class="category">${article.category || ''}</div>
            ${article.suppliers?.length > 0 ? `<div class="suppliers">${article.suppliers.join(', ')}</div>` : ''}
        </div>
    </div>
`;
}).join('')}
</body>
</html>
        `;

        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.onload = () => {
            printWindow.print();
        };
    };

    return (
        <>
            <Button
                onClick={() => setOpen(true)}
                variant="outline"
                className="border-primary/70 text-foreground bg-primary/70 hover:bg-primary/70"
            >
                <Printer className="w-4 h-4 mr-2" />
                Etiketten drucken
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-card text-foreground border-border">
                    <DialogHeader>
                        <DialogTitle>Etiketten drucken (62mm x 29mm)</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-primary/20 rounded-lg border border-primary/70">
                            <div className="text-sm text-primary/25">
                                <p className="font-semibold mb-1">Brother QL-800 Tipp:</p>
                                <p>• Format: 62mm Endlos-Etikettenrolle</p>
                                <p>• Im Druckdialog: "Tatsächliche Größe" wählen</p>
                                <p>• Randlos-Druck aktivieren</p>
                            </div>
                        </div>

                        <div className="flex items-center justify-between mb-2">
                            <p className="text-sm text-muted-foreground">
                                {selectedArticles.length} von {articles.length} ausgewählt
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setSelectedArticles(articles.map(a => a.id))}
                                    className="border-border/70 text-foreground bg-secondary hover:bg-secondary"
                                >
                                    Alle
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setSelectedArticles([])}
                                    className="border-border/70 text-foreground bg-secondary hover:bg-secondary"
                                >
                                    Keine
                                </Button>
                            </div>
                        </div>

                        <div className="grid gap-2 max-h-96 overflow-y-auto">
                            {articles.map(article => (
                                <div
                                    key={article.id}
                                    onClick={() => toggleArticle(article.id)}
                                    className={cn(
                                        "p-3 rounded-lg cursor-pointer transition-all border-2",
                                        selectedArticles.includes(article.id)
                                            ? "bg-primary/30 border-primary/70"
                                            : "bg-background border-border hover:border-border/70"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            "w-5 h-5 rounded border-2 flex items-center justify-center",
                                            selectedArticles.includes(article.id)
                                                ? "bg-primary/70 border-primary/70"
                                                : "border-border/70"
                                        )}>
                                            {selectedArticles.includes(article.id) && (
                                                <svg className="w-3 h-3 text-foreground" fill="none" strokeWidth="2" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-semibold text-foreground text-sm">{article.name}</p>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                                {article.barcode && <span className="font-mono">{article.barcode}</span>}
                                                {article.category && <span>• {article.category}</span>}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-2 pt-4 border-t border-border">
                            <Button
                                onClick={() => setOpen(false)}
                                variant="outline"
                                className="flex-1 border-border/70 text-foreground bg-secondary hover:bg-secondary"
                            >
                                Abbrechen
                            </Button>
                            <Button
                                onClick={handlePDFExport}
                                disabled={selectedArticles.length === 0}
                                className="flex-1 bg-status-ok/70 hover:bg-status-ok/70"
                            >
                                <FileDown className="w-4 h-4 mr-2" />
                                PDF
                            </Button>
                            <Button
                                onClick={handlePrint}
                                disabled={selectedArticles.length === 0}
                                className="flex-1 bg-primary/70 hover:bg-primary/70"
                            >
                                <Printer className="w-4 h-4 mr-2" />
                                Drucken
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}