// migrateVoucherTokens — Einmal-Migration für den Gutschein-QR-Workflow.
//
// Zieht für jeden Voucher ohne access_token einen 6-stelligen, kryptographisch
// zufälligen Zugriffscode nach. Nötig, weil die 318 importierten Gutscheine vor
// dem QR-Workflow angelegt wurden (sequenzielle Nummern wären sonst ratbar).
//
// Aufruf: Backend-Funktion ausführen (Admin). Idempotent — bereits migrierte
// Gutscheine werden unverändert gelassen.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

// Muss zu src/lib/vouchers.js passen (32 Zeichen, ohne I/O/0/1)
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateAccessToken(length = 6) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  // 256 ist durch 32 teilbar → keine Modulo-Verzerrung
  let token = '';
  for (let i = 0; i < length; i++) token += ALPHABET[bytes[i] % ALPHABET.length];
  return token;
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const db = base44.asServiceRole.entities;

    // Alle Gutscheine paginiert laden
    const vouchers: any[] = [];
    let cursor: string | null = null;
    while (true) {
      const page: any = await db.Voucher.filter({}, {
        sort: '-voucher_number',
        limit: 500,
        ...(cursor ? { cursor } : {}),
      });
      const items = page?.items ?? page ?? [];
      vouchers.push(...items);
      if (!page?.has_more || !page?.next_cursor) break;
      cursor = page.next_cursor;
    }

    const missing = vouchers.filter((v) => !v.access_token);
    let migrated = 0;
    const errors: string[] = [];

    // In Blöcken aktualisieren (bulkUpdate fasst bis zu 500 Datensätze)
    for (let i = 0; i < missing.length; i += 200) {
      const chunk = missing.slice(i, i + 200);
      try {
        await db.Voucher.bulkUpdate(
          chunk.map((v) => ({ id: v.id, access_token: generateAccessToken() })),
        );
        migrated += chunk.length;
      } catch (e) {
        errors.push(`Block ${i / 200 + 1}: ${String(e)}`);
      }
    }

    return Response.json({
      success: true,
      total_vouchers: vouchers.length,
      already_had_token: vouchers.length - missing.length,
      migrated,
      errors,
    });
  } catch (error) {
    return Response.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}