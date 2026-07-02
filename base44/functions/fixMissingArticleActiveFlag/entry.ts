// fixMissingArticleActiveFlag.ts
// Einmaliger Cleanup: Setzt is_active=true für alle Article-Datensätze, bei denen
// das Feld komplett fehlt (undefined). Ursache: ältere Artikel wurden angelegt, bevor
// is_active zum Schema hinzugefügt/verpflichtend wurde, und wurden nie nachträglich
// befüllt. Da viele UI-Stellen (QuickList, Fach-Zuordnung, Auffüllen) strikt nach
// is_active=true filtern, waren diese Artikel dort unsichtbar, obwohl sie real existieren.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

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

    const all = await db.Article.list('name', 1000);
    const missing = all.filter((a: any) => a.is_active !== true && a.is_active !== false);

    let fixedCount = 0;
    const fixedNames: string[] = [];
    for (const article of missing) {
      await db.Article.update(article.id, { is_active: true });
      fixedCount++;
      fixedNames.push(article.name);
    }

    return Response.json({
      success: true,
      total_articles: all.length,
      missing_flag_found: missing.length,
      fixed_count: fixedCount,
      fixed_names: fixedNames,
    });
  } catch (err) {
    return Response.json({ success: false, error: String(err) }, { status: 500 });
  }
});
