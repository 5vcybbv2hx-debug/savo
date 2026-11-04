import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

const toNum = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

const isPackUnit = (unit) => /karton|kiste|kasten|pack|gebinde|flasche|dose/i.test(String(unit || ''));

/**
 * Menge in Lagereinheiten. quantity_units kommt bereits umgerechnet vom Client
 * (quantity_packages × units_per_packaging; Fass = Anzahl Fässer). Ohne diesen
 * Wert greift die Alt-Logik über Einheit + Gebindegröße.
 */
const addUnitsOf = (p) => {
  const explicit = toNum(p.quantity_units);
  if (explicit !== null) return explicit;

  const qty = toNum(p.quantity_packages) ?? toNum(p.quantity) ?? 0;
  const perPack = toNum(p.units_per_packaging) ?? toNum(p.unit_size);
  const code = String(p.unit_code || '');
  if (code === 'Fa') return qty;
  if (code && code !== 'St' && code !== 'kg' && perPack > 0) return qty * perPack;
  if (isPackUnit(p.unit) && perPack > 0) return qty * perPack;
  return qty;
};

const normalizeNumber = (value) => String(value ?? '').trim().replace(/^0+/, '').toLowerCase();

export default async function (req) {
  try {
    const body = await req.json().catch(() => ({}));
    const positions = Array.isArray(body.positions) ? body.positions : [];
    const returnPositionsRaw = Array.isArray(body.return_positions) ? body.return_positions : [];
    const header = body.deliveryNote && typeof body.deliveryNote === 'object' ? body.deliveryNote : {};
    if (positions.length === 0 && returnPositionsRaw.length === 0) {
      return Response.json({ error: 'Keine Positionen übergeben' }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });

    let allowed = user.role === 'admin';
    if (!allowed) {
      const res = await base44.asServiceRole.entities.Employee.filter({ email: user.email });
      const employee = Array.isArray(res) ? res[0] : (res?.items || [])[0];
      const perms = employee?.permissions || {};
      allowed = employee?.role === 'Manager'
        || perms.shopping_articles === 'edit'
        || perms.canEditArticles === true;
    }
    if (!allowed) {
      return Response.json({ error: 'Keine Berechtigung für den Wareneingang' }, { status: 403 });
    }

    const supplierName = String(header.supplier_name || '').trim();
    const noteNumber = String(header.delivery_note_number || '').trim();
    const deliveryDate = header.delivery_date || new Date().toISOString().slice(0, 10);
    const totalNet = toNum(header.total_net);

    const fileUrls = Array.isArray(header.file_urls) && header.file_urls.length > 0
      ? header.file_urls.filter(Boolean)
      : (header.file_url ? [header.file_url] : []);
    const pageCount = Math.max(toNum(header.page_count) || 0, fileUrls.length, 1);
    const sumLineTotals = (list) => list.reduce((sum, p) => sum + (toNum(p.line_total) || 0), 0);
    const hasAnyPrice = positions.some((p) => toNum(p.unit_price) !== null);

    // Leergut/Rückgabe: nur informativ, kein Bestand, kein Preis.
    const returnPositions = returnPositionsRaw.map((r) => ({
      raw_text: r.raw_text || '',
      article_name: r.article_name || '',
      supplier_article_number: r.supplier_article_number || '',
      quantity: toNum(r.quantity) ?? toNum(r.quantity_packages),
      unit_code: r.unit_code || '',
      unit: r.unit || '',
      units_per_packaging: toNum(r.units_per_packaging),
      quantity_units: toNum(r.quantity_units),
      content_amount: toNum(r.content_amount),
      content_unit: r.content_unit || '',
      page_number: toNum(r.page_number) || 1,
    }));

    const documentType = ['lieferschein', 'leergut', 'rechnung', 'unbekannt'].includes(header.document_type)
      ? header.document_type
      : 'lieferschein';

    const note = await base44.asServiceRole.entities.DeliveryNote.create({
      supplier_name: supplierName,
      supplier_id: header.supplier_id || '',
      delivery_note_number: noteNumber,
      delivery_date: deliveryDate,
      document_type: documentType,
      file_url: header.file_url || fileUrls[0] || '',
      file_urls: fileUrls,
      page_count: pageCount,
      positions: positions.map((p) => ({
        raw_text: p.raw_text || '',
        article_name: p.article_name || '',
        article_id: p.article_id || '',
        supplier_article_number: p.supplier_article_number || '',
        match_source: p.match_source || '',
        quantity: toNum(p.quantity_packages) ?? toNum(p.quantity),
        quantity_packages: toNum(p.quantity_packages) ?? toNum(p.quantity),
        quantity_units: addUnitsOf(p),
        unit_code: p.unit_code || '',
        unit: p.unit || '',
        packaging: p.unit || '',
        unit_size: toNum(p.units_per_packaging) ?? toNum(p.unit_size),
        units_per_packaging: toNum(p.units_per_packaging) ?? toNum(p.unit_size),
        content_amount: toNum(p.content_amount),
        content_unit: p.content_unit || '',
        page_number: toNum(p.page_number) || 1,
        unit_price: toNum(p.unit_price),
        line_total: toNum(p.line_total),
        shopping_item_id: p.shopping_item_id || '',
        booked: false,
      })),
      return_positions: returnPositions,
      return_positions_count: returnPositions.length,
      positions_count: positions.length,
      total_net: totalNet ?? (hasAnyPrice ? sumLineTotals(positions) : null),
      status: 'entwurf',
      notes: header.notes || '',
    });

    const booked = [];
    const unbooked = [];
    const errors = [];
    const priceChanges = [];
    const learned = [];
    const storedPositions = [];
    let shoppingClosed = 0;
    let withPrice = 0;
    let withoutPrice = 0;

    for (let i = 0; i < positions.length; i += 1) {
      const p = positions[i];
      const label = p.article_name || p.raw_text || `Position ${i + 1}`;
      const articleId = p.article_id || '';
      const base = {
        raw_text: p.raw_text || '',
        article_name: p.article_name || '',
        article_id: articleId,
        supplier_article_number: p.supplier_article_number || '',
        match_source: p.match_source || '',
        quantity: toNum(p.quantity_packages) ?? toNum(p.quantity),
        quantity_packages: toNum(p.quantity_packages) ?? toNum(p.quantity),
        quantity_units: addUnitsOf(p),
        unit_code: p.unit_code || '',
        unit: p.unit || '',
        packaging: p.unit || '',
        unit_size: toNum(p.units_per_packaging) ?? toNum(p.unit_size),
        units_per_packaging: toNum(p.units_per_packaging) ?? toNum(p.unit_size),
        content_amount: toNum(p.content_amount),
        content_unit: p.content_unit || '',
        page_number: toNum(p.page_number) || 1,
        unit_price: toNum(p.unit_price),
        line_total: toNum(p.line_total),
        shopping_item_id: p.shopping_item_id || '',
        booked: false,
      };

      if (!articleId) {
        unbooked.push({ position: i + 1, name: p.raw_text || p.article_name || `Position ${i + 1}` });
        storedPositions.push(base);
        continue;
      }

      try {
        const article = await base44.asServiceRole.entities.Article
          .get(articleId)
          .catch((e) => (e.status === 404 ? null : Promise.reject(e)));
        if (!article) throw new Error('Artikel nicht gefunden');

        const addUnits = addUnitsOf(p);
        const oldStock = toNum(article.current_stock) || 0;

        await base44.asServiceRole.entities.Article.update(articleId, {
          current_stock: oldStock + addUnits,
        });

        // Lernmodus: manuell zugeordnete Zeile mit Lieferanten-Art.-Nr. lernt die Nummer am Artikel.
        const supplierNumber = String(p.supplier_article_number || '').trim();
        if (p.match_source === 'manuell' && supplierNumber && supplierName) {
          const map = { ...(article.supplier_article_numbers || {}) };
          const existingKey = Object.keys(map).find((k) => String(k).trim().toLowerCase() === supplierName.toLowerCase());
          const slotFilled = existingKey ? String(map[existingKey] || '').trim() : false;
          if (!existingKey || !slotFilled) {
            map[existingKey || supplierName] = supplierNumber;
            await base44.asServiceRole.entities.Article.update(articleId, { supplier_article_numbers: map });
            learned.push({ article_name: article.name, supplier_name: supplierName, article_number: supplierNumber });
          }
        }

        const oldPrice = toNum(article.purchase_price);
        // Ohne erkannten Preis (Lieferscheine enthalten meist keine Preise) wird
        // weder purchase_price geändert noch ein PriceHistory-Eintrag geschrieben.
        const newPrice = p.price_missing === true ? null : toNum(p.unit_price);
        if (newPrice !== null && newPrice > 0) withPrice += 1;
        else withoutPrice += 1;
        if (newPrice !== null && newPrice > 0 && newPrice !== oldPrice) {
          await base44.asServiceRole.entities.PriceHistory.create({
            article_id: articleId,
            article_name: article.name,
            old_price: oldPrice ?? 0,
            new_price: newPrice,
            changed_by: user.email,
            changed_by_name: user.full_name || '',
            change_date: deliveryDate,
            supplier_name: supplierName,
            price_type: 'ek',
            note: `Lieferschein ${noteNumber || '-'}`,
          });
          await base44.asServiceRole.entities.Article.update(articleId, { purchase_price: newPrice });
          priceChanges.push({ article_name: article.name, old_price: oldPrice ?? 0, new_price: newPrice });
        }

        if (p.shopping_item_id) {
          const item = await base44.asServiceRole.entities.ShoppingList
            .get(p.shopping_item_id)
            .catch((e) => (e.status === 404 ? null : Promise.reject(e)));
          if (item) {
            await base44.asServiceRole.entities.ShoppingList.update(item.id, {
              delivered_quantity: toNum(p.quantity_packages) ?? toNum(p.quantity),
              delivered_units: addUnits,
              delivery_note: noteNumber || supplierName,
              received_at: new Date().toISOString(),
              status: 'erhalten',
            });
            shoppingClosed += 1;
          }
        }

        booked.push({ position: i + 1, name: article.name, units: addUnits });

        storedPositions.push({
          ...base,
          article_name: article.name,
          unit_price: newPrice,
          booked: true,
          booked_units: addUnits,
        });
      } catch (error) {
        errors.push({ position: i + 1, name: label, message: error.message });
        storedPositions.push(base);
      }
    }

    if (header.file_url) {
      try {
        await base44.asServiceRole.entities.Document.create({
          name: `Lieferschein ${supplierName || 'Unbekannt'} ${deliveryDate}`,
          category: 'belege',
          file_url: header.file_url,
          file_type: /\.pdf($|\?)/i.test(header.file_url) ? 'PDF' : 'Bild',
          linked_entity_type: 'DeliveryNote',
          linked_entity_id: note.id,
          linked_entity_name: `${supplierName} ${noteNumber}`.trim(),
        });
      } catch (error) {
        errors.push({ position: 0, name: 'Beleg-Ablage', message: error.message });
      }
    }

    const summaryParts = [
      `${booked.length} Position${booked.length === 1 ? '' : 'en'} Ware gebucht`,
      `${withPrice} mit Preis übernommen`,
      `${withoutPrice} ohne Preis`,
    ];
    if (shoppingClosed > 0) summaryParts.push(`${shoppingClosed} Bestellung${shoppingClosed === 1 ? '' : 'en'} abgeschlossen`);
    if (returnPositions.length > 0) summaryParts.push(`${returnPositions.length} Position${returnPositions.length === 1 ? '' : 'en'} Leergut (nicht gebucht)`);
    if (unbooked.length > 0) summaryParts.push(`${unbooked.length} Position${unbooked.length === 1 ? '' : 'en'} ohne Artikel`);
    if (learned.length > 0) summaryParts.push(`${learned.length} Art.-Nr. gelernt`);
    if (errors.length > 0) summaryParts.push(`${errors.length} Fehler`);
    const summary = summaryParts.join(' · ');

    const updatedNote = await base44.asServiceRole.entities.DeliveryNote.update(note.id, {
      status: 'gebucht',
      booking_summary: summary,
      positions: storedPositions,
      positions_count: positions.length,
      return_positions: returnPositions,
      return_positions_count: returnPositions.length,
      total_net: totalNet ?? (hasAnyPrice ? sumLineTotals(positions) : null),
    });

    return Response.json({
      note: updatedNote,
      summary,
      counts: { booked: booked.length, withPrice, withoutPrice, leergut: returnPositions.length },
      booked,
      unbooked,
      priceChanges,
      learned,
      errors,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}