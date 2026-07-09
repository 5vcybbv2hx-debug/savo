// importArticleGebinde.ts
// Einmaliger Import: übernimmt die vom User in der "Artikel_Gebinde_Erfassung.xlsx"
// ausgefüllten Gebinde-Infos (Gebinde-Typ, Stück pro Gebinde, EK-Preis pro Gebinde,
// Standard-Bestell-Gebinde) in die Article-Datensätze.
//
// Pro Update-Zeile:
// - Sucht/erstellt in Article.supplier_details den Eintrag für den angegebenen Lieferanten
//   (case-insensitive Name-Match), markiert ihn als is_primary (alle anderen auf false).
// - Innerhalb dieses Lieferanten wird die bestehende Standard-Gebinde-Option (is_default)
//   aktualisiert (Typ/Stück/Preis/price_per_unit neu berechnet) bzw. neu angelegt, falls
//   noch keine existiert. Andere, zusätzliche (nicht-default) Gebinde-Optionen bleiben
//   unangetastet.
// - Aktualisiert das Legacy-Feld supplier.purchase_price sowie die Top-Level-Felder
//   Article.purchase_price (Preis pro Einzeleinheit) und Article.quantity (Stück pro
//   Standard-Gebinde), da diese app-weit als Quelle der Wahrheit für Wareneinsatz-
//   Berechnungen genutzt werden (siehe src/lib/recipeCosting.js).
// - content_amount/content_unit/price_per_liter bleiben unverändert (price_per_liter ist
//   totes Legacy-Feld, wird nirgends berechnet verwendet).

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function genId() {
  return `pkg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  try {
    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole.entities;

    const body = await req.json().catch(() => ({}));
    const updates: Array<{
      id: string;
      name?: string;
      supplier_name: string;
      packaging_type: string;
      units_per_pack: number;
      price_per_pack: number;
    }> = Array.isArray(body?.updates) ? body.updates : [];

    if (updates.length === 0) {
      return Response.json({ success: false, error: 'Keine updates im Payload gefunden.' }, { status: 400 });
    }

    let updatedCount = 0;
    const results: any[] = [];
    const errors: string[] = [];

    for (const u of updates) {
      try {
        const matches = await db.Article.filter({ id: u.id });
        const article = matches?.[0];
        if (!article) {
          errors.push(`${u.name || u.id}: Artikel nicht gefunden`);
          continue;
        }

        const supplierNameTrim = (u.supplier_name || '').trim();
        const pricePerUnit = u.units_per_pack > 0
          ? Math.round((u.price_per_pack / u.units_per_pack) * 10000) / 10000
          : null;

        const supplierDetails: any[] = Array.isArray(article.supplier_details)
          ? JSON.parse(JSON.stringify(article.supplier_details))
          : [];

        let idx = supplierDetails.findIndex(
          (s: any) => (s.supplier_name || '').trim().toLowerCase() === supplierNameTrim.toLowerCase()
        );

        if (idx === -1) {
          supplierDetails.push({
            supplier_name: supplierNameTrim,
            is_primary: true,
            packaging_options: [],
          });
          idx = supplierDetails.length - 1;
        }

        // Nur dieser Lieferant ist primär (Sheet-Spalte "Lieferant (primär)")
        supplierDetails.forEach((s: any, i: number) => { s.is_primary = i === idx; });

        const supplier = supplierDetails[idx];
        if (!Array.isArray(supplier.packaging_options)) supplier.packaging_options = [];

        let optIdx = supplier.packaging_options.findIndex((o: any) => o.is_default);
        if (optIdx === -1 && supplier.packaging_options.length === 1) optIdx = 0;

        const newOption = {
          id: optIdx !== -1 ? (supplier.packaging_options[optIdx].id || genId()) : genId(),
          label: `${u.units_per_pack}× ${u.packaging_type}`,
          packaging_type: u.packaging_type,
          units_per_pack: u.units_per_pack,
          price_per_pack: u.price_per_pack,
          price_per_unit: pricePerUnit,
          is_default: true,
          min_order_qty: optIdx !== -1 ? supplier.packaging_options[optIdx].min_order_qty : undefined,
          deposit_per_unit: optIdx !== -1 ? supplier.packaging_options[optIdx].deposit_per_unit : undefined,
          deposit_type: optIdx !== -1 ? supplier.packaging_options[optIdx].deposit_type : undefined,
        };

        if (optIdx !== -1) {
          supplier.packaging_options[optIdx] = { ...supplier.packaging_options[optIdx], ...newOption };
        } else {
          supplier.packaging_options.push(newOption);
        }

        supplier.purchase_price = pricePerUnit;

        // Legacy suppliers-Array (Rückwärtskompatibilität) synchron halten
        const suppliersList: string[] = Array.isArray(article.suppliers) ? [...article.suppliers] : [];
        if (supplierNameTrim && !suppliersList.some(s => s.trim().toLowerCase() === supplierNameTrim.toLowerCase())) {
          suppliersList.push(supplierNameTrim);
        }

        await db.Article.update(u.id, {
          supplier_details: supplierDetails,
          suppliers: suppliersList,
          purchase_price: pricePerUnit,
          quantity: u.units_per_pack,
        });

        updatedCount++;
        results.push({ id: u.id, name: u.name, price_per_unit: pricePerUnit });
      } catch (e) {
        errors.push(`${u.name || u.id}: ${String(e)}`);
      }
      await sleep(150);
    }

    return Response.json({
      success: true,
      total_received: updates.length,
      updated_count: updatedCount,
      errors,
      results,
    });
  } catch (err) {
    return Response.json({ success: false, error: String(err) }, { status: 500 });
  }
});
