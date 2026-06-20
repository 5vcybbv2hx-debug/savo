import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { applyBranding, PRESET_COLORS, hexToHsl } from '@/lib/branding';
import { Paintbrush, Check, Upload } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function BrandingTab({ company, onSave }) {
  const [color, setColor] = useState(company?.branding_color || '#0891b2');
  const [preview, setPreview] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoUrl, setLogoUrl] = useState(company?.logo_url || '');

  const handlePreview = (hex) => {
    setColor(hex);
    applyBranding({ primaryHex: hex, barName: company?.company_name });
    setPreview(true);
  };

  const handleSave = async () => {
    await onSave({ branding_color: color, logo_url: logoUrl || undefined });
    applyBranding({ primaryHex: color, barName: company?.company_name });
    toast.success('Branding gespeichert ✓');
    setPreview(false);
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setLogoUrl(file_url);
      toast.success('Logo hochgeladen');
    } catch {
      toast.error('Upload fehlgeschlagen');
    } finally {
      setLogoUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Primärfarbe */}
      <Card className="p-5">
        <h3 className="font-semibold text-foreground mb-1 flex items-center gap-2">
          <Paintbrush className="w-4 h-4 text-primary" /> Primärfarbe der App
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Definiert Sidebar, Buttons und Highlights. Ändert sich sofort in der gesamten App.
        </p>

        {/* Preset-Farben */}
        <div className="flex flex-wrap gap-2 mb-4">
          {PRESET_COLORS.map(p => (
            <button
              key={p.hex}
              onClick={() => handlePreview(p.hex)}
              className="relative w-10 h-10 rounded-full border-2 transition-all"
              style={{
                backgroundColor: p.hex,
                borderColor: color === p.hex ? 'white' : 'transparent',
                boxShadow: color === p.hex ? `0 0 0 2px ${p.hex}` : 'none'
              }}
              title={p.name}
            >
              {color === p.hex && <Check className="w-4 h-4 text-white absolute inset-0 m-auto" />}
            </button>
          ))}
        </div>

        {/* Hex-Eingabe + nativer Colorpicker */}
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="color"
            value={color}
            onChange={(e) => handlePreview(e.target.value)}
            className="w-11 h-11 rounded-lg cursor-pointer border border-border bg-transparent"
          />
          <Input
            value={color}
            onChange={(e) => {
              const v = e.target.value;
              setColor(v);
              if (/^#[0-9A-Fa-f]{6}$/.test(v)) handlePreview(v);
            }}
            placeholder="#0891b2"
            className="font-mono w-36"
            maxLength={7}
          />
          <span className="text-xs text-muted-foreground">HSL: {hexToHsl(color)}</span>
        </div>
      </Card>

      {/* Logo-Upload */}
      <Card className="p-5">
        <h3 className="font-semibold text-foreground mb-1 flex items-center gap-2">
          <Upload className="w-4 h-4 text-primary" /> App-Logo
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Wird in der Sidebar anstelle des Buchstabens angezeigt. Empfohlen: quadratisches PNG/SVG.
        </p>
        <div className="flex items-center gap-4">
          {logoUrl && (
            <img src={logoUrl} alt="Logo" className="w-14 h-14 rounded-xl object-contain border border-border bg-card" />
          )}
          <Label
            htmlFor="logo-upload"
            className="cursor-pointer flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-secondary hover:bg-accent transition-all text-sm font-medium min-h-[44px]"
          >
            <Upload className="w-4 h-4" />
            {logoUploading ? 'Lädt...' : 'Logo hochladen'}
            <input
              id="logo-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoUpload}
              disabled={logoUploading}
            />
          </Label>
          {logoUrl && (
            <button
              onClick={() => setLogoUrl('')}
              className="text-xs text-muted-foreground hover:text-destructive transition-colors"
            >
              Entfernen
            </button>
          )}
        </div>
      </Card>

      {/* Live-Vorschau-Banner */}
      {preview && (
        <div className="p-3 rounded-lg bg-primary/10 border border-primary/30 text-sm text-primary font-medium">
          ✓ Vorschau aktiv — klicke Speichern um die Farbe dauerhaft zu übernehmen
        </div>
      )}

      <Button onClick={handleSave} className="w-full min-h-[44px]">
        Branding speichern
      </Button>
    </div>
  );
}