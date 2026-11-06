import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

export default function BulkImporter() {
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [file, setFile] = useState(null);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState(null);

    const importMutation = useMutation({
        mutationFn: async (file) => {
            // Upload file
            setProgress(20);
            const formData = new FormData();
            formData.append('file', file);
            const uploadResult = await base44.integrations.Core.UploadFile({ file });
            const fileUrl = uploadResult.file_url;

            // Extract data
            setProgress(40);
            const extractResult = await base44.integrations.Core.ExtractDataFromUploadedFile({
                file_url: fileUrl,
                json_schema: {
                    type: "object",
                    properties: {
                        articles: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    barcode: { type: "string" },
                                    name: { type: "string" },
                                    category: { type: "string" },
                                    suppliers: { type: "array", items: { type: "string" } },
                                    unit: { type: "string" },
                                    quantity: { type: "number" },
                                    content_amount: { type: "number" },
                                    content_unit: { type: "string" },
                                    purchase_price: { type: "number" },
                                    current_stock: { type: "number" },
                                    min_stock: { type: "number" }
                                }
                            }
                        }
                    }
                }
            });

            if (extractResult.status === 'error') {
                throw new Error(extractResult.details);
            }

            // Import articles
            setProgress(60);
            const articles = Array.isArray(extractResult.output) ? extractResult.output : extractResult.output?.articles || [];
            
            // Generate barcodes for articles without one
            const processedArticles = articles.map(article => {
                if (!article.barcode) {
                    article.barcode = `GEN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                }
                return article;
            });

            await base44.entities.Article.bulkCreate(processedArticles);
            setProgress(100);

            return { count: processedArticles.length };
        },
        onSuccess: (result) => {
            queryClient.invalidateQueries(['articles']);
            setStatus({ type: 'success', message: `${result.count} Artikel importiert` });
            setTimeout(() => {
                setOpen(false);
                setFile(null);
                setProgress(0);
                setStatus(null);
            }, 2000);
        },
        onError: (error) => {
            setStatus({ type: 'error', message: error.message });
            setProgress(0);
        }
    });

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            const ext = selectedFile.name.split('.').pop().toLowerCase();
            if (['csv', 'xlsx', 'xls', 'json'].includes(ext)) {
                setFile(selectedFile);
                setStatus(null);
            } else {
                setStatus({ type: 'error', message: 'Nur CSV, Excel oder JSON Dateien erlaubt' });
            }
        }
    };

    const handleImport = () => {
        if (file) {
            setProgress(0);
            setStatus(null);
            importMutation.mutate(file);
        }
    };

    return (
        <>
            <Button 
                onClick={() => setOpen(true)}
                variant="outline"
                className="border-primary/70 text-foreground bg-primary/70 hover:bg-primary/70"
            >
                <Upload className="w-4 h-4 mr-2" />
                Import
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FileSpreadsheet className="w-5 h-5" />
                            Artikel importieren
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 mt-4">
                        <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                            <input
                                type="file"
                                accept=".csv,.xlsx,.xls,.json"
                                onChange={handleFileChange}
                                className="hidden"
                                id="file-upload"
                                disabled={importMutation.isPending}
                            />
                            <label 
                                htmlFor="file-upload" 
                                className="cursor-pointer flex flex-col items-center gap-2"
                            >
                                <Upload className="w-12 h-12 text-muted-foreground" />
                                <p className="text-sm font-medium text-foreground">
                                    {file ? file.name : 'Datei auswählen'}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    CSV, Excel oder JSON
                                </p>
                            </label>
                        </div>

                        {progress > 0 && (
                            <div className="space-y-2">
                                <Progress value={progress} className="w-full" />
                                <p className="text-xs text-center text-muted-foreground">
                                    {progress < 40 ? 'Hochladen...' : 
                                     progress < 60 ? 'Daten extrahieren...' : 
                                     progress < 100 ? 'Artikel importieren...' : 
                                     'Fertig!'}
                                </p>
                            </div>
                        )}

                        {status && (
                            <div className={`p-3 rounded-lg flex items-center gap-2 ${
                                status.type === 'success' ? 'bg-status-ok/15 text-status-ok' : 'bg-status-danger/15 text-status-danger'
                            }`}>
                                {status.type === 'success' ? 
                                    <CheckCircle2 className="w-5 h-5" /> : 
                                    <AlertCircle className="w-5 h-5" />
                                }
                                <p className="text-sm font-medium">{status.message}</p>
                            </div>
                        )}

                        <div className="bg-primary/15 border border-primary/25 rounded-lg p-3">
                            <p className="text-xs text-primary font-medium mb-1">💡 Hinweis:</p>
                            <ul className="text-xs text-primary space-y-1">
                                <li>• Artikel ohne Barcode erhalten automatisch einen generierten Code</li>
                                <li>• Spalten: barcode, name, category, suppliers, purchase_price, etc.</li>
                                <li>• Bei Duplikaten wird der vorhandene Artikel übersprungen</li>
                            </ul>
                        </div>

                        <div className="flex gap-2">
                            <Button 
                                onClick={handleImport}
                                disabled={!file || importMutation.isPending}
                                className="flex-1 bg-primary/70 hover:bg-primary/70"
                            >
                                {importMutation.isPending ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Importiere...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="w-4 h-4 mr-2" />
                                        Importieren
                                    </>
                                )}
                            </Button>
                            <Button 
                                variant="outline"
                                onClick={() => {
                                    setOpen(false);
                                    setFile(null);
                                    setProgress(0);
                                    setStatus(null);
                                }}
                                disabled={importMutation.isPending}
                            >
                                Abbrechen
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}