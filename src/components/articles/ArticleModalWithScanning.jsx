import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Camera, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import BarcodeScannerEnhanced from '../restock/BarcodeScanner.enhanced';
import { cn } from '@/lib/utils';

/**
 * ArticleModalWithScanning
 * Extended article editor with integrated barcode/QR scanning
 */
export default function ArticleModalWithScanning({
  open,
  onClose,
  article,
  onSave,
  isSaving = false,
}) {
  const [formData, setFormData] = useState({
    barcode: '',
    qr_code: '',
    ...article,
  });

  const [scannerOpen, setScannerOpen] = useState(false);
  const [activeCodeField, setActiveCodeField] = useState(null); // 'barcode' | 'qr_code'
  const [scanSuccess, setScanSuccess] = useState(null); // null | 'barcode' | 'qr_code'

  // Reset form when article changes
  useEffect(() => {
    if (open && article) {
      setFormData({ barcode: '', qr_code: '', ...article });
      setScanSuccess(null);
    }
  }, [open, article]);

  const handleFieldChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleScanCode = (scannedArticle) => {
    if (activeCodeField && scannedArticle) {
      const code = scannedArticle[activeCodeField] || scannedArticle.barcode;
      if (code) {
        handleFieldChange(activeCodeField, code);
        setScanSuccess(activeCodeField);
        setTimeout(() => setScanSuccess(null), 2000);
      }
    }
  };

  const clearCode = (field) => {
    handleFieldChange(field, '');
  };

  const handleSubmit = () => {
    onSave(formData);
  };

  return (
    <>
      <Dialog open={open && !scannerOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {article?.id ? 'Artikel bearbeiten' : 'Neuer Artikel'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Name & Category (Essential) */}
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Artikelname *</Label>
                <Input
                  value={formData.name || ''}
                  onChange={e => handleFieldChange('name', e.target.value)}
                  placeholder="z.B. Corona Extra"
                  className="mt-2"
                />
              </div>

              <div>
                <Label className="text-sm font-medium">Kategorie</Label>
                <Input
                  value={formData.category || ''}
                  onChange={e => handleFieldChange('category', e.target.value)}
                  placeholder="z.B. Bier"
                  className="mt-2"
                />
              </div>
            </div>

            {/* Barcode / QR Codes */}
            <Card className="p-4 bg-primary/5 border-primary/20">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <Camera className="w-4 h-4 text-primary" />
                Codes scannen
              </h3>

              <div className="space-y-3">
                {/* Barcode */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs font-medium">Barcode / EAN</Label>
                    {scanSuccess === 'barcode' && (
                      <span className="text-xs text-status-ok flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Gescannt
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={formData.barcode || ''}
                      onChange={e => handleFieldChange('barcode', e.target.value)}
                      placeholder="Barcode eingeben oder scannen"
                      className="flex-1"
                    />
                    {formData.barcode && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => clearCode('barcode')}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setActiveCodeField('barcode');
                      setScannerOpen(true);
                    }}
                    className="w-full mt-2 text-sm"
                  >
                    <Camera className="w-3.5 h-3.5 mr-1.5" />
                    Barcode scannen
                  </Button>
                </div>

                {/* QR Code */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs font-medium">QR-Code (optional)</Label>
                    {scanSuccess === 'qr_code' && (
                      <span className="text-xs text-status-ok flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Gescannt
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={formData.qr_code || ''}
                      onChange={e => handleFieldChange('qr_code', e.target.value)}
                      placeholder="QR-Code eingeben oder scannen"
                      className="flex-1"
                    />
                    {formData.qr_code && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => clearCode('qr_code')}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setActiveCodeField('qr_code');
                      setScannerOpen(true);
                    }}
                    className="w-full mt-2 text-sm"
                  >
                    <Camera className="w-3.5 h-3.5 mr-1.5" />
                    QR-Code scannen
                  </Button>
                </div>
              </div>
            </Card>

            {/* Additional Fields */}
            <div className="space-y-3 border-t pt-4">
              <div>
                <Label className="text-xs font-medium">Einkaufspreis</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.purchase_price || ''}
                  onChange={e => handleFieldChange('purchase_price', parseFloat(e.target.value) || '')}
                  placeholder="0.00"
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-xs font-medium">Aktueller Bestand</Label>
                <Input
                  type="number"
                  value={formData.current_stock || ''}
                  onChange={e => handleFieldChange('current_stock', parseInt(e.target.value) || '')}
                  placeholder="0"
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-xs font-medium">Mindestbestand</Label>
                <Input
                  type="number"
                  value={formData.min_stock || ''}
                  onChange={e => handleFieldChange('min_stock', parseInt(e.target.value) || '')}
                  placeholder="0"
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-6 border-t">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Abbrechen
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSaving || !formData.name}
              className="flex-1 bg-status-ok/70 hover:bg-status-ok/70"
            >
              {isSaving ? 'Speichert…' : 'Speichern'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Enhanced Scanner with Debouncing */}
      <BarcodeScannerEnhanced
        open={scannerOpen}
        onClose={() => {
          setScannerOpen(false);
          setActiveCodeField(null);
        }}
        articles={[]} // We don't need article matching here
        onArticleSelected={(scannedArticle) => {
          handleScanCode(scannedArticle);
          setScannerOpen(false);
          setActiveCodeField(null);
        }}
      />
    </>
  );
}