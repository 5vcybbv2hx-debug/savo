import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const url = new URL(req.url);

        const [items, companyData] = await Promise.all([
            base44.asServiceRole.entities.MenuItem.list(),
            base44.asServiceRole.entities.CompanyInfo.list(),
        ]);

        const sortedItems = items.sort((a, b) => (a.order_position || 999) - (b.order_position || 999));
        const companyInfo = companyData[0] || {};
        const barName = companyInfo.company_name || 'Bar';

        const esc = (str) => String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

        const ACCENT_MAP = {
            amber:  { from: '#f59e0b', via: '#f97316', glow: '#f59e0b33' },
            orange: { from: '#f97316', via: '#ef4444', glow: '#f9731633' },
            rose:   { from: '#f43f5e', via: '#e11d48', glow: '#f43f5e33' },
            violet: { from: '#7c3aed', via: '#6d28d9', glow: '#7c3aed33' },
            blue:   { from: '#3b82f6', via: '#2563eb', glow: '#3b82f633' },
            cyan:   { from: '#06b6d4', via: '#0891b2', glow: '#06b6d433' },
            green:  { from: '#22c55e', via: '#16a34a', glow: '#22c55e33' },
            pink:   { from: '#ec4899', via: '#db2777', glow: '#ec489933' },
        };
        const accent = ACCENT_MAP[companyInfo.accent_color_key] || ACCENT_MAP.amber;

        const BG_MAP = {
            default: { bg: '#111827', card: '#1e2d45' },
            deep:    { bg: '#0a0a0a', card: '#1c1c1c' },
            navy:    { bg: '#0d1a36', card: '#142347' },
            slate:   { bg: '#0f172a', card: '#1e2636' },
            wine:    { bg: '#1a0a12', card: '#2d1420' },
        };
        const bg = BG_MAP[companyInfo.bg_color_key] || BG_MAP.default;

        // Kategorie-Icons
        const CAT_ICONS = {
            'bier': '🍺', 'beer': '🍺',
            'wein': '🍷', 'wine': '🍷',
            'sekt': '🥂', 'champagner': '🥂', 'prosecco': '🥂',
            'cocktail': '🍹',
            'longdrink': '🥃', 'spirituosen': '🥃', 'whisky': '🥃', 'shot': '🥃',
            'softdrink': '🥤', 'alkoholfrei': '🥤', 'limonade': '🥤',
            'wasser': '💧',
            'kaffee': '☕', 'heißgetränk': '☕', 'heissgetraenk': '☕',
            'tee': '🍵',
            'saft': '🍊',
            'snack': '🍟', 'speise': '🍽️',
        };
        function getCatIcon(cat) {
            if (!cat) return '🍾';
            const lower = cat.toLowerCase();
            for (const [key, icon] of Object.entries(CAT_ICONS)) {
                if (lower.includes(key)) return icon;
            }
            return '🍾';
        }

        const categories = ['Alle', ...new Set(
            sortedItems.map(i => i.category || 'Sonstiges').filter(Boolean)
        )];

        const allAllergens = [...new Set(
            sortedItems.flatMap(i => Array.isArray(i.allergens_list) ? i.allergens_list : [])
        )].sort();
        const allAdditives = [...new Set(
            sortedItems.flatMap(i => Array.isArray(i.additives) ? i.additives : [])
        )].sort();
        const hasFilterData = allAllergens.length > 0 || allAdditives.length > 0;

        const allergenChipsHtml = allAllergens.map(a => `<button class="chip" data-allergen="${esc(a.toLowerCase())}" onclick="toggleChip(this,'a')">${esc(a)}</button>`).join('');
        const additiveChipsHtml = allAdditives.map(a => `<button class="chip add" data-additive="${esc(a.toLowerCase())}" onclick="toggleChip(this,'d')">${esc(a)}</button>`).join('');

        // Kategorie-Tabs mit Icons
        const categoryButtonsHtml = categories.map((c, i) => {
            const icon = c === 'Alle' ? '✦' : getCatIcon(c);
            return `<button class="cat-btn${i === 0 ? ' on' : ''}" data-cat="${esc(c)}">${icon} ${esc(c)}</button>`;
        }).join('');

        const allergenPanelHtml = !hasFilterData ? '' : `
        <div id="allergen-panel" class="allergen-panel">
            <div class="allergen-panel-inner">
                ${allAllergens.length > 0 ? `
                <div class="panel-label">Allergene ausblenden</div>
                <div class="chip-row">${allergenChipsHtml}</div>` : ''}
                ${allAdditives.length > 0 ? `
                <div class="panel-label">Zusatzstoffe ausblenden</div>
                <div class="chip-row">${additiveChipsHtml}</div>` : ''}
                <button class="panel-clear" onclick="clearFilters()">Alle zurücksetzen</button>
                <div style="font-size:0.7rem;color:var(--fg-subtle);margin-top:0.5rem">Kein Ersatz für individuelle Allergikerberatung.</div>
            </div>
        </div>
        <div id="filter-banner" class="filter-banner"></div>`;

        const filterButtonHtml = !hasFilterData ? '' : `<button id="allergen-btn" class="allergen-btn">
                <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/>
                </svg>
                Filter
                <span id="allergen-badge" class="allergen-badge">0</span>
            </button>`;

        // Items rendern — Kategorie-Badge nur bei "Alle" sinnvoll (wird per JS gesteuert)
        let itemsHtml = '';
        if (sortedItems.length === 0) {
            itemsHtml = '<div class="empty"><div class="empty-icon">🍹</div><div class="empty-text">Keine Getränke verfügbar</div></div>';
        } else {
            itemsHtml = sortedItems.map((item, idx) => {
                const allergenArr = Array.isArray(item.allergens_list) ? item.allergens_list : [];
                const additiveArr = Array.isArray(item.additives) ? item.additives : [];
                const legacyA = item.allergens || '';
                const searchA = [...allergenArr, ...additiveArr, legacyA].join(' ').toLowerCase();
                const imageHtml = item.image_url ? `<img class="card-img" src="${esc(item.image_url)}" alt="${esc(item.name)}" loading="lazy">` : '';
                const descHtml = item.description ? `<div class="card-desc">${esc(item.description)}</div>` : '';
                const price = item.price ? Number(item.price).toFixed(2) : '–';
                // Kategorie-Badge nur rendern — wird per JS bei "Alle" ein/ausgeblendet
                const categoryBadge = item.category ? `<span class="badge badge-cat cat-badge">${esc(item.category)}</span>` : '';
                const sizeBadge = item.size ? `<span class="badge badge-info">${esc(item.size)}</span>` : '';
                // Alkoholfrei nur wenn EXPLIZIT 0 eingetragen
                const alcVal = item.alcohol_content;
                const alcBadge = (alcVal !== null && alcVal !== undefined && alcVal !== '')
                    ? (parseFloat(alcVal) === 0
                        ? `<span class="badge badge-green">Alkoholfrei</span>`
                        : `<span class="badge badge-info">${alcVal}% Vol.</span>`)
                    : '';
                const seasonalBadge = item.is_seasonal ? '<span class="badge badge-special">Saisonal</span>' : '';
                const specialBadge = item.is_special ? '<span class="badge badge-special">Special</span>' : '';

                let allergenHtml = '';
                if (allergenArr.length || legacyA || additiveArr.length) {
                    allergenHtml = '<div class="allergen-info">';
                    if (allergenArr.length) {
                        allergenHtml += `<div><strong>Allergene:</strong> ${allergenArr.map(a => esc(a)).join(', ')}</div>`;
                    } else if (legacyA) {
                        allergenHtml += `<div><strong>Allergene:</strong> ${esc(legacyA)}</div>`;
                    }
                    if (additiveArr.length) {
                        allergenHtml += `<div><strong>Zusatzstoffe:</strong> ${additiveArr.map(a => esc(a)).join(', ')}</div>`;
                    }
                    allergenHtml += '</div>';
                }

                const allergenDataAttr = allergenArr.length ? ` data-allergens="${esc(allergenArr.join('|').toLowerCase())}"` : '';
                const additiveDataAttr = additiveArr.length ? ` data-additives="${esc(additiveArr.join('|').toLowerCase())}"` : '';

                // Detail-Dialog Daten als JSON im data-Attribut
                const dialogData = esc(JSON.stringify({
                    name: item.name || '',
                    description: item.description || '',
                    price: price,
                    category: item.category || '',
                    size: item.size || '',
                    alcohol_content: alcVal,
                    image_url: item.image_url || '',
                    allergens: allergenArr.length ? allergenArr : (legacyA ? [legacyA] : []),
                    additives: additiveArr,
                    is_seasonal: !!item.is_seasonal,
                    is_special: !!item.is_special,
                }));

                return `<div class="card" 
                    data-cat="${esc(item.category || 'Sonstiges')}" 
                    data-name="${esc((item.name || '').toLowerCase())}" 
                    data-desc="${esc((item.description || '').toLowerCase())}" 
                    data-sa="${esc(searchA)}"
                    ${allergenDataAttr}${additiveDataAttr}
                    data-dialog="${dialogData}"
                    onclick="openDialog(this)"
                    style="animation-delay:${idx * 30}ms">
                    ${imageHtml}
                    <div class="card-body">
                        <div class="card-top">
                            <div class="card-name">${esc(item.name)}</div>
                            <div class="price">€${price}</div>
                        </div>
                        ${descHtml}
                        <div class="card-badges">
                            ${categoryBadge}
                            ${sizeBadge}
                            ${alcBadge}
                            ${seasonalBadge}
                            ${specialBadge}
                        </div>
                        ${allergenHtml}
                    </div>
                </div>`;
            }).join('');
        }

        // Footer aus CompanyInfo
        const footerHtml = `
        <footer class="footer">
            <div class="footer-card">
                <div class="footer-brand">
                    ${companyInfo.logo_url
                        ? `<img src="${esc(companyInfo.logo_url)}" alt="${esc(barName)}" class="footer-logo">`
                        : `<div class="footer-initial">${esc(barName.charAt(0))}</div>`
                    }
                    <div>
                        <div class="footer-name">${esc(barName)}</div>
                        <div class="footer-sub">Getränkekarte</div>
                    </div>
                </div>
                ${companyInfo.address || companyInfo.phone || companyInfo.opening_hours ? `<div class="footer-rows">` : ''}
                ${companyInfo.address ? `
                <a href="https://maps.google.com/?q=${encodeURIComponent(companyInfo.address)}" target="_blank" rel="noopener" class="footer-row">
                    <div class="footer-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    </div>
                    <div>
                        <div class="footer-row-label">Adresse</div>
                        <div class="footer-row-value">${esc(companyInfo.address)}</div>
                    </div>
                </a>` : ''}
                ${companyInfo.phone ? `
                <a href="tel:${esc(companyInfo.phone)}" class="footer-row">
                    <div class="footer-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2.26h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.06 6.06l1.01-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 17z"/></svg>
                    </div>
                    <div>
                        <div class="footer-row-label">Telefon</div>
                        <div class="footer-row-value">${esc(companyInfo.phone)}</div>
                    </div>
                </a>` : ''}
                ${companyInfo.opening_hours ? `
                <div class="footer-row no-link">
                    <div class="footer-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    </div>
                    <div>
                        <div class="footer-row-label">Öffnungszeiten</div>
                        <div class="footer-row-value" style="white-space:pre-line">${esc(companyInfo.opening_hours)}</div>
                    </div>
                </div>` : ''}
                ${companyInfo.address || companyInfo.phone || companyInfo.opening_hours ? `</div>` : ''}
                <div class="footer-legal">Preise inkl. MwSt. · Bei Allergien bitte Personal ansprechen.</div>
            </div>
        </footer>`;

        const html = `<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <meta name="theme-color" content="${bg.bg}">
    <title>${esc(barName)} – Getränkekarte</title>
    <style>
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
        :root {
            --bg:           ${bg.bg};
            --card:         ${bg.card};
            --border:       rgba(148,163,184,0.12);
            --border-hover: rgba(148,163,184,0.22);
            --fg:           #f1f5f9;
            --fg-muted:     #94a3b8;
            --fg-subtle:    #64748b;
            --primary:      ${accent.from};
            --primary-via:  ${accent.via};
            --primary-glow: ${accent.glow};
            --radius:       0.75rem;
            --radius-lg:    1.25rem;
            --radius-full:  9999px;
        }
        html { font-size: 16px; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif;
            background-color: var(--bg);
            color: var(--fg);
            min-height: 100vh; min-height: 100dvh;
            overflow-x: hidden;
            padding-bottom: env(safe-area-inset-bottom, 1.5rem);
            -webkit-font-smoothing: antialiased;
        }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 9999px; }

        @keyframes fadeUp {
            from { opacity: 0; transform: translateY(14px); }
            to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideDown {
            from { opacity: 0; transform: translateY(-8px); }
            to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes dialogIn {
            from { opacity: 0; transform: scale(0.95) translateY(10px); }
            to   { opacity: 1; transform: scale(1) translateY(0); }
        }

        /* ── Header ── */
        .header {
            position: sticky; top: 0; z-index: 50;
            background: rgba(17,24,39,0.92);
            backdrop-filter: blur(20px) saturate(180%);
            -webkit-backdrop-filter: blur(20px) saturate(180%);
            border-bottom: 1px solid var(--border);
            padding: 0.75rem 1rem 0;
        }
        .header-top {
            display: flex; align-items: center; gap: 0.75rem;
            margin-bottom: 0.75rem;
        }
        .header-logo {
            width: 2.5rem; height: 2.5rem; border-radius: 0.625rem;
            object-fit: contain; background: rgba(255,255,255,0.05);
            flex-shrink: 0;
        }
        .header-initial {
            width: 2.5rem; height: 2.5rem; border-radius: 0.625rem;
            background: linear-gradient(135deg, var(--primary), var(--primary-via));
            display: flex; align-items: center; justify-content: center;
            font-weight: 800; font-size: 1.1rem; color: #fff;
            flex-shrink: 0;
        }
        .header-title { font-size: 1rem; font-weight: 700; color: var(--fg); }
        .header-sub { font-size: 0.75rem; color: var(--fg-muted); margin-top: 1px; }
        .header-actions { margin-left: auto; display: flex; gap: 0.5rem; }
        .search-row {
            display: flex; gap: 0.5rem;
            margin-bottom: 0.75rem;
        }
        .search-wrap {
            flex: 1; position: relative;
        }
        .search-icon {
            position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%);
            color: var(--fg-subtle); pointer-events: none;
        }
        .search-input {
            width: 100%; padding: 0.6rem 0.75rem 0.6rem 2.25rem;
            background: rgba(255,255,255,0.06); border: 1px solid var(--border);
            border-radius: var(--radius-full); color: var(--fg); font-size: 0.875rem;
            outline: none; transition: border-color 0.2s;
        }
        .search-input::placeholder { color: var(--fg-subtle); }
        .search-input:focus { border-color: var(--primary); }

        /* ── Allergen Filter ── */
        .allergen-btn {
            display: flex; align-items: center; gap: 0.375rem;
            padding: 0.6rem 0.875rem; border-radius: var(--radius-full);
            background: rgba(255,255,255,0.06); border: 1px solid var(--border);
            color: var(--fg-muted); font-size: 0.8rem; font-weight: 500;
            cursor: pointer; white-space: nowrap; transition: all 0.2s;
        }
        .allergen-btn.active { border-color: var(--primary); color: var(--primary); background: var(--primary-glow); }
        .allergen-badge { background: var(--primary); color: #fff; border-radius: 9999px; font-size: 0.65rem; font-weight: 700; padding: 0 0.35rem; display: none; }
        .allergen-badge.visible { display: inline; }
        .allergen-panel { max-height: 0; overflow: hidden; transition: max-height 0.3s ease; background: rgba(255,255,255,0.03); border-bottom: 1px solid var(--border); }
        .allergen-panel.open { max-height: 400px; }
        .allergen-panel-inner { padding: 1rem; }
        .panel-label { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--fg-subtle); margin-bottom: 0.5rem; margin-top: 0.75rem; }
        .panel-label:first-child { margin-top: 0; }
        .chip-row { display: flex; flex-wrap: wrap; gap: 0.375rem; }
        .chip { padding: 0.3rem 0.7rem; border-radius: var(--radius-full); border: 1px solid var(--border); background: transparent; color: var(--fg-muted); font-size: 0.75rem; cursor: pointer; transition: all 0.15s; }
        .chip.on { background: rgba(239,68,68,0.15); border-color: rgba(239,68,68,0.4); color: #f87171; }
        .chip.add.on { background: rgba(245,158,11,0.15); border-color: rgba(245,158,11,0.4); color: #fbbf24; }
        .panel-clear { margin-top: 0.75rem; padding: 0.4rem 0.875rem; border-radius: var(--radius-full); border: 1px solid var(--border); background: transparent; color: var(--fg-muted); font-size: 0.75rem; cursor: pointer; }
        .filter-banner { display: none; padding: 0.5rem 1rem; background: rgba(239,68,68,0.1); font-size: 0.75rem; color: #f87171; }
        .filter-banner.visible { display: block; }

        /* ── Kategorie-Tabs ── */
        .cat-bar {
            display: flex; gap: 0.5rem; overflow-x: auto; padding-bottom: 0.75rem;
            scrollbar-width: none; -ms-overflow-style: none;
        }
        .cat-bar::-webkit-scrollbar { display: none; }
        .cat-btn {
            display: flex; align-items: center; gap: 0.375rem;
            padding: 0.45rem 0.9rem; border-radius: var(--radius-full);
            border: 1px solid var(--border); background: transparent;
            color: var(--fg-muted); font-size: 0.8rem; font-weight: 500;
            white-space: nowrap; cursor: pointer; transition: all 0.2s;
            flex-shrink: 0;
        }
        .cat-btn.on {
            background: linear-gradient(135deg, var(--primary), var(--primary-via));
            border-color: transparent; color: #fff;
            box-shadow: 0 2px 12px var(--primary-glow);
        }
        .cat-btn:not(.on):hover { border-color: var(--border-hover); color: var(--fg); }

        /* ── Grid ── */
        .grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 0.75rem;
            padding: 1rem;
            max-width: 900px;
            margin: 0 auto;
        }
        @media (max-width: 400px) { .grid { grid-template-columns: 1fr; } }
        @media (min-width: 700px) { .grid { grid-template-columns: repeat(3, 1fr); } }

        /* ── Card ── */
        .card {
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: var(--radius-lg);
            overflow: hidden;
            cursor: pointer;
            transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
            animation: fadeUp 0.4s ease both;
        }
        .card:hover {
            transform: translateY(-2px);
            border-color: var(--border-hover);
            box-shadow: 0 8px 24px rgba(0,0,0,0.3);
        }
        .card:active { transform: scale(0.98); }
        .card-img { width: 100%; height: 8rem; object-fit: cover; display: block; }
        .card-body { padding: 0.75rem; }
        .card-top {
            display: flex; align-items: flex-start; justify-content: space-between;
            gap: 0.5rem; margin-bottom: 0.25rem;
        }
        .card-name {
            font-size: 0.875rem; font-weight: 600; color: var(--fg);
            line-height: 1.3; flex: 1;
        }
        .price {
            font-size: 0.9rem; font-weight: 700;
            color: var(--primary); white-space: nowrap; flex-shrink: 0;
        }
        .card-desc {
            font-size: 0.75rem; color: var(--fg-muted);
            line-height: 1.4; margin-bottom: 0.5rem;
            display: -webkit-box; -webkit-line-clamp: 2;
            -webkit-box-orient: vertical; overflow: hidden;
        }
        .card-badges { display: flex; flex-wrap: wrap; gap: 0.25rem; margin-top: 0.4rem; }
        .badge {
            font-size: 0.65rem; font-weight: 600; padding: 0.15rem 0.45rem;
            border-radius: var(--radius-full); letter-spacing: 0.02em;
        }
        .badge-cat {
            background: rgba(148,163,184,0.1); color: var(--fg-subtle);
            border: 1px solid rgba(148,163,184,0.15);
        }
        .badge-info {
            background: rgba(99,102,241,0.12); color: #a5b4fc;
            border: 1px solid rgba(99,102,241,0.2);
        }
        .badge-green {
            background: rgba(34,197,94,0.12); color: #86efac;
            border: 1px solid rgba(34,197,94,0.2);
        }
        .badge-special {
            background: linear-gradient(135deg, var(--primary-glow), transparent);
            color: var(--primary); border: 1px solid var(--primary-glow);
        }
        .allergen-info {
            font-size: 0.68rem; color: var(--fg-subtle);
            margin-top: 0.5rem; padding-top: 0.5rem;
            border-top: 1px solid var(--border);
            line-height: 1.5;
        }

        /* ── Empty ── */
        .empty { grid-column: 1/-1; text-align: center; padding: 4rem 1rem; }
        .empty-icon { font-size: 3rem; margin-bottom: 1rem; }
        .empty-text { color: var(--fg-muted); font-size: 0.95rem; }

        /* ── Detail-Dialog ── */
        .dialog-overlay {
            display: none; position: fixed; inset: 0; z-index: 200;
            background: rgba(0,0,0,0.75); backdrop-filter: blur(6px);
            -webkit-backdrop-filter: blur(6px);
            align-items: flex-end; justify-content: center;
        }
        .dialog-overlay.open { display: flex; }
        @media (min-width: 600px) {
            .dialog-overlay { align-items: center; }
            .dialog { border-radius: var(--radius-lg) !important; max-width: 480px !important; }
        }
        .dialog {
            background: #1e293b;
            border-radius: var(--radius-lg) var(--radius-lg) 0 0;
            width: 100%; max-width: 600px;
            max-height: 85vh; overflow-y: auto;
            animation: dialogIn 0.25s ease;
            border: 1px solid var(--border);
        }
        .dialog-img { width: 100%; max-height: 220px; object-fit: cover; display: block; }
        .dialog-body { padding: 1.25rem; }
        .dialog-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.75rem; margin-bottom: 0.75rem; }
        .dialog-name { font-size: 1.2rem; font-weight: 700; color: var(--fg); flex: 1; }
        .dialog-price { font-size: 1.3rem; font-weight: 800; color: var(--primary); }
        .dialog-close {
            position: absolute; top: 0.75rem; right: 0.75rem;
            width: 2rem; height: 2rem; border-radius: 50%;
            background: rgba(255,255,255,0.1); border: none;
            color: var(--fg); font-size: 1.1rem; cursor: pointer;
            display: flex; align-items: center; justify-content: center;
        }
        .dialog-desc { font-size: 0.875rem; color: var(--fg-muted); line-height: 1.6; margin-bottom: 0.75rem; }
        .dialog-badges { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-bottom: 0.75rem; }
        .dialog-allergens { font-size: 0.78rem; color: var(--fg-subtle); line-height: 1.6; padding: 0.75rem; background: rgba(255,255,255,0.03); border-radius: var(--radius); border: 1px solid var(--border); }
        .dialog-allergens strong { color: var(--fg-muted); }
        .dialog-handle { width: 2.5rem; height: 3px; border-radius: 9999px; background: var(--border); margin: 0.75rem auto 0; }

        /* ── Footer ── */
        .footer { padding: 1rem 1rem 2rem; max-width: 900px; margin: 0 auto; }
        .footer-card {
            border-radius: var(--radius-lg);
            border: 1px solid var(--border);
            background: var(--card);
            overflow: hidden;
        }
        .footer-brand {
            display: flex; align-items: center; gap: 0.875rem;
            padding: 1rem 1.25rem;
            border-bottom: 1px solid var(--border);
        }
        .footer-logo {
            width: 2.75rem; height: 2.75rem; border-radius: 0.625rem;
            object-fit: contain; background: rgba(255,255,255,0.05);
            border: 1px solid var(--border); padding: 3px; flex-shrink: 0;
        }
        .footer-initial {
            width: 2.75rem; height: 2.75rem; border-radius: 0.625rem;
            background: linear-gradient(135deg, var(--primary), var(--primary-via));
            display: flex; align-items: center; justify-content: center;
            font-weight: 800; font-size: 1.2rem; color: #fff; flex-shrink: 0;
        }
        .footer-name { font-weight: 700; font-size: 0.9rem; color: var(--fg); }
        .footer-sub { font-size: 0.72rem; color: var(--fg-subtle); margin-top: 1px; }
        .footer-rows { border-bottom: 1px solid var(--border); }
        .footer-row {
            display: flex; align-items: center; gap: 0.875rem;
            padding: 0.875rem 1.25rem;
            border-bottom: 1px solid var(--border);
            text-decoration: none; color: inherit;
            transition: background 0.15s;
        }
        .footer-row:last-child { border-bottom: none; }
        .footer-row:not(.no-link):hover { background: rgba(255,255,255,0.04); }
        .footer-icon {
            width: 2rem; height: 2rem; border-radius: 0.5rem;
            background: rgba(255,255,255,0.06); border: 1px solid var(--border);
            display: flex; align-items: center; justify-content: center;
            color: var(--fg-muted); flex-shrink: 0;
            transition: background 0.15s, color 0.15s;
        }
        .footer-row:not(.no-link):hover .footer-icon {
            background: var(--primary-glow); color: var(--primary);
        }
        .footer-row-label { font-size: 0.65rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--fg-subtle); }
        .footer-row-value { font-size: 0.85rem; color: var(--fg); margin-top: 1px; }
        .footer-legal {
            padding: 0.65rem 1.25rem;
            font-size: 0.68rem; color: var(--fg-subtle);
            text-align: center;
            background: rgba(255,255,255,0.02);
        }
    </style>
</head>
<body>

<!-- Header -->
<header class="header">
    <div class="header-top">
        ${companyInfo.logo_url
            ? `<img src="${esc(companyInfo.logo_url)}" alt="${esc(barName)}" class="header-logo">`
            : `<div class="header-initial">${esc(barName.charAt(0))}</div>`
        }
        <div>
            <div class="header-title">${esc(barName)}</div>
            <div class="header-sub">Getränkekarte</div>
        </div>
        <div class="header-actions">
            ${filterButtonHtml}
        </div>
    </div>
    <div class="search-row">
        <div class="search-wrap">
            <svg class="search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input type="search" id="search" class="search-input" placeholder="Suchen…" autocomplete="off">
        </div>
    </div>
    ${allergenPanelHtml}
    <div class="cat-bar" id="cat-bar">
        ${categoryButtonsHtml}
    </div>
</header>

<!-- Grid -->
<div class="grid" id="grid">
    ${itemsHtml}
</div>

${footerHtml}

<!-- Detail Dialog -->
<div class="dialog-overlay" id="dialog-overlay" onclick="closeDialog(event)">
    <div class="dialog" id="dialog">
        <div style="position:relative">
            <button class="dialog-close" onclick="closeDialogBtn()">✕</button>
            <img id="dialog-img" class="dialog-img" src="" alt="" style="display:none">
        </div>
        <div class="dialog-body">
            <div class="dialog-handle"></div>
            <div class="dialog-header" style="margin-top:0.75rem">
                <div id="dialog-name" class="dialog-name"></div>
                <div id="dialog-price" class="dialog-price"></div>
            </div>
            <div id="dialog-desc" class="dialog-desc" style="display:none"></div>
            <div id="dialog-badges" class="dialog-badges"></div>
            <div id="dialog-allergens" class="dialog-allergens" style="display:none"></div>
        </div>
    </div>
</div>

<script>
document.addEventListener('DOMContentLoaded', function() {
    var activeCat = 'Alle';
    var searchQ = '';
    var excludedA = new Set();
    var excludedD = new Set();
    var panelOpen = false;

    // Suche
    var searchEl = document.getElementById('search');
    if (searchEl) {
        searchEl.addEventListener('input', function() {
            searchQ = this.value.trim().toLowerCase();
            run();
        });
    }

    // Kategorie-Tabs
    document.querySelectorAll('.cat-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.cat-btn').forEach(function(b) { b.classList.remove('on'); });
            btn.classList.add('on');
            activeCat = btn.getAttribute('data-cat');
            // Kategorie-Badge: nur bei "Alle" anzeigen
            var showCatBadge = activeCat === 'Alle';
            document.querySelectorAll('.cat-badge').forEach(function(b) {
                b.style.display = showCatBadge ? '' : 'none';
            });
            run();
        });
    });
    // Initial: Kategorie-Badge bei "Alle" versteckt (wir fangen mit Alle an, also zeigen)
    // eigentlich soll Badge immer versteckt sein wenn Filter aktiv — zeigen wenn Alle
    // Initial: Alle — badges zeigen
    document.querySelectorAll('.cat-badge').forEach(function(b) { b.style.display = ''; });

    // Allergen-Filter
    var allergenBtn = document.getElementById('allergen-btn');
    var panel = document.getElementById('allergen-panel');
    if (allergenBtn && panel) {
        allergenBtn.addEventListener('click', function() {
            panelOpen = !panelOpen;
            panel.classList.toggle('open', panelOpen);
            syncBtn();
        });
    }
    window.toggleChip = function(chip, type) {
        var key = chip.getAttribute('data-allergen') || chip.getAttribute('data-additive');
        var set = type === 'a' ? excludedA : excludedD;
        if (set.has(key)) { set.delete(key); chip.classList.remove('on'); }
        else { set.add(key); chip.classList.add('on'); }
        syncBtn(); run();
    };
    window.clearFilters = function() {
        excludedA.clear(); excludedD.clear();
        document.querySelectorAll('.chip').forEach(function(c) { c.classList.remove('on'); });
        syncBtn(); run();
    };
    function syncBtn() {
        var total = excludedA.size + excludedD.size;
        var badge = document.getElementById('allergen-badge');
        var btn = document.getElementById('allergen-btn');
        var banner = document.getElementById('filter-banner');
        if (badge) { badge.textContent = total; badge.classList.toggle('visible', total > 0); }
        if (btn) btn.classList.toggle('active', total > 0 || panelOpen);
        if (banner) {
            if (total > 0) { banner.textContent = '⚠️ Ausgeblendet: ' + [...excludedA, ...excludedD].join(', '); banner.classList.add('visible'); }
            else { banner.classList.remove('visible'); }
        }
    }

    // Filter-Run
    function run() {
        var cards = document.querySelectorAll('#grid .card');
        var visible = 0;
        cards.forEach(function(card) {
            var cat = activeCat === 'Alle' || card.getAttribute('data-cat') === activeCat;
            var name = card.getAttribute('data-name') || '', desc = card.getAttribute('data-desc') || '', sa = card.getAttribute('data-sa') || '';
            var txt = !searchQ || name.includes(searchQ) || desc.includes(searchQ) || sa.includes(searchQ);
            var ing = true;
            if (excludedA.size > 0) { var cA = card.getAttribute('data-allergens') || ''; excludedA.forEach(function(a) { if (cA.includes(a)) ing = false; }); }
            if (excludedD.size > 0) { var cD = card.getAttribute('data-additives') || ''; excludedD.forEach(function(a) { if (cD.includes(a)) ing = false; }); }
            var show = cat && txt && ing;
            card.style.display = show ? '' : 'none';
            if (show) visible++;
        });
        var empty = document.getElementById('empty-state');
        if (visible === 0) {
            if (!empty) {
                empty = document.createElement('div');
                empty.id = 'empty-state'; empty.className = 'empty';
                empty.innerHTML = '<div class="empty-icon">🔍</div><div class="empty-text">Keine Getränke gefunden</div>';
                document.getElementById('grid').appendChild(empty);
            }
            empty.style.display = '';
        } else if (empty) { empty.style.display = 'none'; }
    }

    // Detail-Dialog
    window.openDialog = function(card) {
        try {
            var raw = card.getAttribute('data-dialog');
            var d = JSON.parse(raw);
            document.getElementById('dialog-name').textContent = d.name;
            document.getElementById('dialog-price').textContent = d.price !== '–' ? '€' + d.price : '–';
            // Bild
            var imgEl = document.getElementById('dialog-img');
            if (d.image_url) { imgEl.src = d.image_url; imgEl.alt = d.name; imgEl.style.display = 'block'; }
            else { imgEl.style.display = 'none'; }
            // Beschreibung
            var descEl = document.getElementById('dialog-desc');
            if (d.description) { descEl.textContent = d.description; descEl.style.display = 'block'; }
            else { descEl.style.display = 'none'; }
            // Badges
            var badgesEl = document.getElementById('dialog-badges');
            var badges = '';
            if (d.category) badges += '<span class="badge badge-cat">' + d.category + '</span>';
            if (d.size) badges += '<span class="badge badge-info">' + d.size + '</span>';
            if (d.alcohol_content !== null && d.alcohol_content !== undefined && d.alcohol_content !== '') {
                if (parseFloat(d.alcohol_content) === 0) badges += '<span class="badge badge-green">Alkoholfrei</span>';
                else badges += '<span class="badge badge-info">' + d.alcohol_content + '% Vol.</span>';
            }
            if (d.is_seasonal) badges += '<span class="badge badge-special">Saisonal</span>';
            if (d.is_special) badges += '<span class="badge badge-special">Special</span>';
            badgesEl.innerHTML = badges;
            // Allergene
            var alcEl = document.getElementById('dialog-allergens');
            var alcTxt = '';
            if (d.allergens && d.allergens.length) alcTxt += '<div><strong>Allergene:</strong> ' + d.allergens.join(', ') + '</div>';
            if (d.additives && d.additives.length) alcTxt += '<div><strong>Zusatzstoffe:</strong> ' + d.additives.join(', ') + '</div>';
            if (alcTxt) { alcEl.innerHTML = alcTxt; alcEl.style.display = 'block'; }
            else { alcEl.style.display = 'none'; }
            // Overlay öffnen
            document.getElementById('dialog-overlay').classList.add('open');
            document.body.style.overflow = 'hidden';
        } catch(e) { console.error('Dialog error', e); }
    };
    window.closeDialog = function(e) {
        if (e.target === document.getElementById('dialog-overlay')) {
            document.getElementById('dialog-overlay').classList.remove('open');
            document.body.style.overflow = '';
        }
    };
    window.closeDialogBtn = function() {
        document.getElementById('dialog-overlay').classList.remove('open');
        document.body.style.overflow = '';
    };
    // Swipe-down zum Schließen
    var dialog = document.getElementById('dialog');
    var startY = 0;
    dialog.addEventListener('touchstart', function(e) { startY = e.touches[0].clientY; }, { passive: true });
    dialog.addEventListener('touchend', function(e) {
        if (e.changedTouches[0].clientY - startY > 80) {
            document.getElementById('dialog-overlay').classList.remove('open');
            document.body.style.overflow = '';
        }
    }, { passive: true });
});
</script>
</body>
</html>`;

        return new Response(html, {
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
            }
        });
    } catch (err) {
        return new Response(`<!DOCTYPE html><html><body style="font-family:sans-serif;padding:2rem;background:#0f172a;color:#f1f5f9">
            <h2>⚠️ Menü konnte nicht geladen werden</h2>
            <p style="color:#94a3b8;margin-top:0.5rem">Bitte versuche es erneut oder wende dich ans Personal.</p>
        </body></html>`, { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
});
