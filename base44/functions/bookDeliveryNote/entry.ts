import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

const toNum = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

const isPackUnit = (unit) => /karton|kiste|pack|gebinde|flasche/i.test(String(unit || ''));

export default async function (req) {
  try {
    const body = await req.json().catch(() => ({}));
    const positions = Array.isArray(body.positions) ? body.positions : [];
    const header = body.deliveryNote && typeof body.deliveryNote === 'object' ? body.deliveryNote : {};
    if (positions.length === 0) {
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

    const note = await base44.asServiceRole.entities.DeliveryNote.create({
      supplier_name: supplierName,
      supplier_id: header.supplier_id || '',
      delivery_note_number: noteNumber,
      delivery_date: deliveryDate,
      file_url: header.file_url || fileUrls[0] || '',
      file_urls: fileUrls,
      page_count: pageCount,
      positions: positions.map((p) => ({
        raw_text: p.raw_text || '',
        article_name: p.article_name || '',
        article_id: p.article_id || '',
        quantity: toNum(p.quantity),
        unit: p.unit || '',
        packaging: p.unit || '',
        unit_size: toNum(p.unit_size),
        content_amount: toNum(p.content_amount),
        content_unit: p.content_unit || '',
        page_number: toNum(p.page_number) || 1,
        unit_price: toNum(p.unit_price),
        line_total: toNum(p.line_total),
        shopping_item_id: p.shopping_item_id || '',
        booked: false,
      })),
      positions_count: positions.length,
      total_net: totalNet ?? (hasAnyPrice ? sumLineTotals(positions) : null),
      status: 'entwurf',
      notes: header.notes || '',
    });

    const booked = [];
    const unbooked = [];
    const errors = [];
    const priceChanges = [];
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
        quantity: toNum(p.quantity),
        unit: p.unit || '',
        packaging: p.unit || '',
        unit_size: toNum(p.unit_size),
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

        const qty = toNum(p.quantity) || 0;
        const unitSize = toNum(p.unit_size);
        const addUnits = isPackUnit(p.unit) && unitSize > 0 ? qty * unitSize : qty;
        const oldStock = toNum(article.current_stock) || 0;

        await base44.asServiceRole.entities.Article.update(articleId, {
          current_stock: oldStock + addUnits,
        });

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
              delivered_quantity: qty,
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
      `${booked.length} Position${booked.length === 1 ? '' : 'en'} gebucht`,
      `${withPrice} mit Preis übernommen`,
      `${withoutPrice} ohne Preis`,
    ];
    if (shoppingClosed > 0) summaryParts.push(`${shoppingClosed} Bestellung${shoppingClosed === 1 ? '' : 'en'} abgeschlossen`);
    if (unbooked.length > 0) summaryParts.push(`${unbooked.length} Position${unbooked.length === 1 ? '' : 'en'} ohne Artikel`);
    if (errors.length > 0) summaryParts.push(`${errors.length} Fehler`);
    const summary = summaryParts.join(' · ');

    const updatedNote = await base44.asServiceRole.entities.DeliveryNote.update(note.id, {
      status: 'gebucht',
      booking_summary: summary,
      positions: storedPositions,
      positions_count: positions.length,
      total_net: totalNet ?? (hasAnyPrice ? sumLineTotals(positions) : null),
    });

    return Response.json({
      note: updatedNote,
      summary,
      counts: { booked: booked.length, withPrice, withoutPrice },
      booked,
      unbooked,
      priceChanges,
      errors,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}