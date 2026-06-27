import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
    }

    try {
        const base44 = createClientFromRequest(req);
        const url = new URL(req.url);
        const tableNumber = url.searchParams.get('table');

        const [items, companyData] = await Promise.all([
            base44.asServiceRole.entities.MenuItem.list(),
            base44.asServiceRole.entities.CompanyInfo.list(),
        ]);

        const allItems = (items || []).sort((a, b) => (a.order_position || 999) - (b.order_position || 999));
        const companyInfo = (companyData || [])[0] || {};
        const barName = companyInfo.company_name || 'Getränkekarte';

        const esc = (s) => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

        const ICONS = { 'Bier':'🍺','Biere':'🍺','Wein':'🍷','Weine':'🍷','Sekt':'🥂','Champagner':'🥂','Cocktail':'🍹','Cocktails':'🍹','Moonshiner':'🍹','Longdrink':'🥃','Longdrinks':'🥃','Spirituosen':'🥃','Whisky':'🥃','Shot':'🥃','Shots':'🥃','Softdrink':'🥤','Softdrinks':'🥤','Alkoholfrei':'🥤','Wasser':'💧','Kaffee':'☕','Heißgetränke':'☕','Tee':'🍵','Saft':'🍊','Säfte':'🍊' };
        const getIcon = (cat) => { if (!cat) return '🍾'; for (const [k,v] of Object.entries(ICONS)) { if (cat.toLowerCase().includes(k.toLowerCase())) return v; } return '🍾'; };

        const cats = [...new Set(allItems.map(i => i.category || 'Sonstiges'))];

        const itemsJson = JSON.stringify(allItems.map(i => ({
            id: i.id,
            name: i.name || '',
            category: i.category || 'Sonstiges',
            price: i.price,
            size: i.size || '',
            description: i.description || '',
            alcohol_content: i.alcohol_content || '',
            is_seasonal: !!i.is_seasonal,
            is_special: !!i.is_special,
            is_available: i.is_available !== false,
            image_url: i.image_url || '',
            allergens_list: Array.isArray(i.allergens_list) ? i.allergens_list : [],
            additives: Array.isArray(i.additives) ? i.additives : [],
            allergens: i.allergens || '',
        })));

        const logoHtml = companyInfo.logo_url
            ? `<img src="${esc(companyInfo.logo_url)}" alt="${esc(barName)}" class="brand-logo">`
            : `<div class="brand-initial">${esc(barName.charAt(0))}</div>`;

        const html = `<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <meta name="theme-color" content="#09090b">
    <title>${esc(barName)} – Getränkekarte</title>
    <style>
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
        :root {
            --bg: #09090b; --card: #18181b; --muted: #27272a;
            --border: rgba(255,255,255,0.08); --border-md: rgba(255,255,255,0.14);
            --fg: #fafafa; --fg-muted: #a1a1aa; --fg-subtle: #71717a;
            --primary: #f59e0b; --primary-fg: #09090b;
            --radius: 1rem; --destructive: #ef4444; --green: #22c55e; --blue: #3b82f6;
        }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: var(--bg); color: var(--fg); min-height: 100dvh; overflow-x: hidden; -webkit-font-smoothing: antialiased; padding-bottom: calc(env(safe-area-inset-bottom) + 1rem); }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }

        .header { position: sticky; top: 0; z-index: 40; background: rgba(9,9,11,0.9); backdrop-filter: blur(16px) saturate(150%); border-bottom: 1px solid var(--border); padding: env(safe-area-inset-top, 0) 1rem 0; }
        .header-inner { max-width: 640px; margin: 0 auto; padding: 0.75rem 0 0; }
        .brand-row { display: flex; align-items: center; gap: 0.75rem; min-height: 44px; margin-bottom: 0.625rem; }
        .brand-logo { width: 40px; height: 40px; border-radius: 0.75rem; object-fit: contain; background: var(--card); border: 1px solid var(--border); padding: 3px; flex-shrink: 0; }
        .brand-initial { width: 40px; height: 40px; border-radius: 0.75rem; background: var(--primary); color: var(--primary-fg); font-size: 1.125rem; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .brand-name { font-size: 0.9375rem; font-weight: 700; color: var(--fg); line-height: 1.2; }
        .brand-count { font-size: 0.6875rem; color: var(--fg-muted); margin-top: 1px; }
        .search-row { display: flex; gap: 0.5rem; margin-bottom: 0.625rem; }
        .search-wrap { flex: 1; position: relative; }
        .search-ico { position: absolute; left: 0.875rem; top: 50%; transform: translateY(-50%); color: var(--fg-muted); pointer-events: none; }
        .search-input { width: 100%; height: 44px; padding: 0 2.75rem 0 2.625rem; border-radius: 9999px; border: 1px solid transparent; background: var(--muted); color: var(--fg); font-size: 1rem; outline: none; transition: border-color 0.15s, background 0.15s; }
        .search-input::placeholder { color: var(--fg-subtle); }
        .search-input:focus { border-color: var(--border-md); background: var(--card); }
        .search-clear { position: absolute; right: 0.75rem; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--fg-muted); cursor: pointer; display: none; padding: 0.25rem; }
        .search-clear.show { display: block; }
        .filter-btn { height: 44px; padding: 0 0.875rem; border-radius: 9999px; border: 1px solid var(--border); background: var(--card); color: var(--fg-muted); cursor: pointer; display: flex; align-items: center; gap: 0.375rem; font-size: 0.875rem; font-weight: 600; transition: all 0.15s; white-space: nowrap; position: relative; flex-shrink: 0; }
        .filter-btn.active { background: var(--primary); border-color: var(--primary); color: var(--primary-fg); }
        .filter-badge { position: absolute; top: -4px; right: -4px; width: 1rem; height: 1rem; background: var(--destructive); color: #fff; font-size: 0.6rem; font-weight: 700; border-radius: 9999px; display: none; align-items: center; justify-content: center; }
        .filter-badge.show { display: flex; }
        .filter-panel { overflow: hidden; max-height: 0; opacity: 0; transition: max-height 0.25s ease, opacity 0.2s ease; }
        .filter-panel.open { max-height: 200px; opacity: 1; }
        .filter-panel-inner { padding: 0.5rem 0 0.75rem; }
        .filter-label { font-size: 0.625rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--fg-muted); margin-bottom: 0.5rem; }
        .filter-chips { display: flex; flex-wrap: wrap; gap: 0.5rem; }
        .filter-chip { padding: 0.375rem 0.875rem; border-radius: 9999px; border: 1.5px solid var(--border-md); background: transparent; color: var(--fg-muted); cursor: pointer; font-size: 0.8125rem; font-weight: 600; transition: all 0.15s; }
        .filter-chip.on { border-color: var(--primary); background: rgba(245,158,11,0.12); color: var(--primary); }
        .filter-chip.on.gluten { border-color: #a78bfa; background: rgba(167,139,250,0.1); color: #a78bfa; }
        .filter-chip.on.laktose { border-color: #60a5fa; background: rgba(96,165,250,0.1); color: #60a5fa; }
        .filter-chip.on.vegan { border-color: var(--green); background: rgba(34,197,94,0.1); color: var(--green); }
        .filter-chip.on.alkoholfrei { border-color: #34d399; background: rgba(52,211,153,0.1); color: #34d399; }
        .cat-tabs { display: flex; gap: 0.375rem; overflow-x: auto; padding-bottom: 0.5rem; scrollbar-width: none; }
        .cat-tabs::-webkit-scrollbar { display: none; }
        .cat-tab { padding: 0.3125rem 0.875rem; border-radius: 9999px; border: 1.5px solid var(--border); background: transparent; color: var(--fg-muted); cursor: pointer; white-space: nowrap; font-size: 0.8125rem; font-weight: 600; transition: all 0.15s; flex-shrink: 0; }
        .cat-tab.on { border-color: var(--primary); background: rgba(245,158,11,0.12); color: var(--primary); }
        .main { max-width: 640px; margin: 0 auto; padding: 1rem; }
        .section { margin-bottom: 1.75rem; animation: fadeIn 0.3s ease-out both; }
        .section-header { display: flex; align-items: center; gap: 0.5rem; padding: 0.375rem 0; margin-bottom: 0.5rem; border-bottom: 1px solid var(--border); }
        .section-icon { font-size: 1rem; }
        .section-name { font-size: 0.75rem; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: var(--fg-muted); flex: 1; }
        .section-count { font-size: 0.6875rem; color: var(--fg-subtle); }
        .item-list { display: flex; flex-direction: column; gap: 0.375rem; }
        .item-card { width: 100%; text-align: left; border: 1px solid var(--border); border-radius: var(--radius); padding: 0.875rem 1rem; background: var(--card); cursor: pointer; transition: border-color 0.15s, background 0.15s; display: flex; align-items: flex-start; justify-content: space-between; gap: 0.75rem; min-height: 72px; }
        .item-card:hover, .item-card:active { border-color: rgba(245,158,11,0.3); background: rgba(245,158,11,0.04); }
        .item-card.unavailable { opacity: 0.4; cursor: default; }
        .item-card.unavailable:hover { border-color: var(--border); background: var(--card); }
        .item-left { flex: 1; min-width: 0; }
        .item-name { font-size: 0.9375rem; font-weight: 600; color: var(--fg); line-height: 1.3; margin-bottom: 0.25rem; }
        .item-meta { font-size: 0.75rem; color: var(--fg-muted); display: flex; align-items: center; gap: 0.375rem; flex-wrap: wrap; margin-bottom: 0.25rem; }
        .item-meta .sep { opacity: 0.4; }
        .item-desc { font-size: 0.75rem; color: var(--fg-muted); line-height: 1.4; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; }
        .badge-row { display: flex; gap: 0.375rem; flex-wrap: wrap; margin-top: 0.375rem; }
        .badge { font-size: 0.625rem; font-weight: 600; padding: 0.125rem 0.5rem; border-radius: 9999px; border: 1px solid; }
        .badge-seasonal { color: var(--green); border-color: rgba(34,197,94,0.3); background: rgba(34,197,94,0.08); }
        .badge-special { color: var(--primary); border-color: rgba(245,158,11,0.3); background: rgba(245,158,11,0.08); }
        .item-right { display: flex; flex-direction: column; align-items: flex-end; gap: 0.375rem; flex-shrink: 0; }
        .item-price { font-size: 1.0625rem; font-weight: 700; color: var(--fg); }
        .info-dot { width: 1rem; height: 1rem; color: var(--fg-subtle); }
        .empty { text-align: center; padding: 4rem 1rem; }
        .empty-icon { font-size: 2rem; margin-bottom: 0.625rem; }
        .empty-text { font-size: 0.9375rem; font-weight: 600; color: var(--fg-muted); margin-bottom: 0.25rem; }
        .empty-sub { font-size: 0.8125rem; color: var(--fg-subtle); }
        .footer { max-width: 640px; margin: 0 auto; padding: 1.25rem 1rem 2rem; border-top: 1px solid var(--border); }
        .footer-items { display: flex; flex-direction: column; gap: 0.375rem; }
        .footer-row { display: flex; align-items: center; gap: 0.5rem; font-size: 0.8125rem; color: var(--fg-muted); }
        .footer-row a { color: var(--fg-muted); text-decoration: none; }
        .footer-row a:hover { color: var(--fg); }
        .footer-legal { margin-top: 0.875rem; font-size: 0.6875rem; color: var(--fg-subtle); opacity: 0.5; text-align: center; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 100; display: none; align-items: flex-end; justify-content: center; }
        .modal-overlay.open { display: flex; }
        @media (min-width: 600px) { .modal-overlay { align-items: center; } }
        .modal { background: var(--card); border-radius: 1.5rem 1.5rem 0 0; width: 100%; max-width: 640px; max-height: 85dvh; overflow-y: auto; padding: 1.5rem 1.25rem; animation: slideUp 0.25s ease-out; position: relative; }
        @media (min-width: 600px) { .modal { border-radius: 1.5rem; margin: 1rem; max-height: 80dvh; } }
        .modal-handle { width: 3rem; height: 0.25rem; background: var(--muted); border-radius: 9999px; margin: 0 auto 1.25rem; }
        .modal-name { font-size: 1.25rem; font-weight: 700; color: var(--fg); line-height: 1.3; margin-bottom: 0.75rem; }
        .modal-img { width: 100%; height: 180px; object-fit: cover; border-radius: 0.875rem; margin-bottom: 1rem; }
        .modal-price-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.875rem; }
        .modal-price { font-size: 1.875rem; font-weight: 700; color: var(--fg); }
        .modal-chips { display: flex; gap: 0.375rem; flex-wrap: wrap; }
        .modal-chip { font-size: 0.75rem; padding: 0.25rem 0.75rem; border-radius: 9999px; border: 1px solid var(--border-md); color: var(--fg-muted); }
        .modal-desc { font-size: 0.875rem; color: var(--fg-muted); line-height: 1.6; margin-bottom: 1rem; }
        .modal-allergen-box { background: rgba(255,255,255,0.04); border-radius: 0.875rem; padding: 0.875rem; margin-bottom: 0.75rem; }
        .modal-allergen-title { font-size: 0.625rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--fg-muted); margin-bottom: 0.625rem; }
        .modal-allergen-group { margin-bottom: 0.625rem; }
        .modal-allergen-label { font-size: 0.625rem; font-weight: 700; color: var(--destructive); margin-bottom: 0.375rem; text-transform: uppercase; letter-spacing: 0.05em; }
        .modal-allergen-label.add { color: var(--blue); }
        .modal-tags { display: flex; flex-wrap: wrap; gap: 0.375rem; }
        .modal-tag { font-size: 0.75rem; padding: 0.125rem 0.625rem; border-radius: 0.375rem; border: 1px solid; }
        .modal-tag.allergen { background: rgba(239,68,68,0.1); border-color: rgba(239,68,68,0.25); color: var(--destructive); }
        .modal-tag.additive { background: rgba(59,130,246,0.1); border-color: rgba(59,130,246,0.25); color: var(--blue); }
        .modal-legal { font-size: 0.625rem; color: var(--fg-subtle); opacity: 0.5; text-align: center; margin-top: 1rem; }
    </style>
</head>
<body>

<header class="header">
    <div class="header-inner">
        <div class="brand-row">
            ${logoHtml}
            <div>
                <div class="brand-name">${esc(barName)}</div>
                <div class="brand-count" id="itemCount">${allItems.length} Getränke</div>
            </div>
        </div>
        <div class="search-row">
            <div class="search-wrap">
                <svg class="search-ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                <input class="search-input" type="search" id="search" placeholder="Getränk suchen…" autocomplete="off" autocorrect="off">
                <button class="search-clear" id="searchClear" onclick="clearSearch()">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
            </div>
            <button class="filter-btn" id="filterBtn" onclick="toggleFilters()">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>
                Filter
                <span class="filter-badge" id="filterBadge">0</span>
            </button>
        </div>
        <div class="filter-panel" id="filterPanel">
            <div class="filter-panel-inner">
                <div class="filter-label">Filtern nach</div>
                <div class="filter-chips">
                    <button class="filter-chip gluten" data-filter="glutenfrei" onclick="toggleFilter(this)">Glutenfrei</button>
                    <button class="filter-chip laktose" data-filter="laktosefrei" onclick="toggleFilter(this)">Laktosefrei</button>
                    <button class="filter-chip vegan" data-filter="vegan" onclick="toggleFilter(this)">Vegan</button>
                    <button class="filter-chip alkoholfrei" data-filter="alkoholfrei" onclick="toggleFilter(this)">Alkoholfrei</button>
                </div>
            </div>
        </div>
        <div class="cat-tabs" id="catTabs">
            <button class="cat-tab on" data-cat="Alle" onclick="selectCat(this)">✦ Alle</button>
            ${cats.map(c => `<button class="cat-tab" data-cat="${esc(c)}" onclick="selectCat(this)">${getIcon(c)} ${esc(c)}</button>`).join('')}
        </div>
    </div>
</header>

<main class="main" id="main"></main>

<footer class="footer">
    <div class="footer-items">
        ${companyInfo.address ? `<div class="footer-row"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>${esc(companyInfo.address)}</div>` : ''}
        ${companyInfo.phone ? `<div class="footer-row"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.01 1.18C.01.66.42.01 1 .01H4a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L5.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg><a href="tel:${esc(companyInfo.phone)}">${esc(companyInfo.phone)}</a></div>` : ''}
        ${(() => {
            if (!companyInfo.opening_hours) return '';
            let hoursStr = companyInfo.opening_hours;
            // Falls JSON-Objekt: kompakt lesbare Darstellung
            try {
                const parsed = typeof hoursStr === 'string' ? JSON.parse(hoursStr) : hoursStr;
                if (typeof parsed === 'object' && parsed !== null) {
                    const dayMap = { mo:'Mo', di:'Di', mi:'Mi', do:'Do', fr:'Fr', sa:'Sa', so:'So',
                                     Montag:'Mo', Dienstag:'Di', Mittwoch:'Mi', Donnerstag:'Do',
                                     Freitag:'Fr', Samstag:'Sa', Sonntag:'So' };
                    const lines = Object.entries(parsed).map(([d, v]) => {
                        const day = dayMap[d] || d;
                        if (!v || v.open === false) return day + ': geschlossen';
                        const from = v.from || v.open_time || '';
                        const to = v.to || v.close || v.close_time || '';
                        return day + ': ' + from + (to ? '–' + to : '');
                    });
                    hoursStr = lines.join(' · ');
                }
            } catch(e) { /* kein JSON, als Text verwenden */ }
            return '<div class="footer-row"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' + esc(hoursStr) + '</div>';
        })()}
    </div>
    <div class="footer-legal">Preise inkl. MwSt. · Alle Angaben ohne Gewähr · Bei Unverträglichkeiten bitte Personal ansprechen.</div>
</footer>

<div class="modal-overlay" id="modal" onclick="closeModal(event)">
    <div class="modal" id="modalContent">
        <div class="modal-handle"></div>
        <div id="modalBody"></div>
    </div>
</div>

<script>
var ALL_ITEMS = ${itemsJson};
var activeCat = 'Alle';
var activeFilters = new Set();
var searchQ = '';

function hasAllergenKeyword(item, kw) {
    var kl = kw.toLowerCase();
    var list = item.allergens_list || [];
    if (list.some(function(a) { return a.toLowerCase().includes(kl); })) return true;
    if ((item.allergens || '').toLowerCase().includes(kl)) return true;
    return false;
}
var ALLERGEN_CHECKS = {
    glutenfrei: function(i) { return !hasAllergenKeyword(i,'Gluten') && !hasAllergenKeyword(i,'Weizen') && !hasAllergenKeyword(i,'Gerste') && !hasAllergenKeyword(i,'Roggen'); },
    laktosefrei: function(i) { return !hasAllergenKeyword(i,'Milch') && !hasAllergenKeyword(i,'Laktose'); },
    vegan: function(i) { return !['Milch','Laktose','Ei','Eier','Fisch','Krebstiere','Weichtiere'].some(function(a) { return hasAllergenKeyword(i,a); }); },
    alkoholfrei: function(i) { return !i.alcohol_content || parseFloat(i.alcohol_content) === 0; },
};
function getFiltered() {
    return ALL_ITEMS.filter(function(item) {
        if (!item.is_available) return false;
        if (activeCat !== 'Alle' && item.category !== activeCat) return false;
        if (searchQ) { var q = searchQ.toLowerCase(); if (!item.name.toLowerCase().includes(q) && !item.description.toLowerCase().includes(q) && !item.category.toLowerCase().includes(q)) return false; }
        for (var f of activeFilters) { if (ALLERGEN_CHECKS[f] && !ALLERGEN_CHECKS[f](item)) return false; }
        return true;
    });
}
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
var ICONS = { 'Bier':'🍺','Biere':'🍺','Wein':'🍷','Weine':'🍷','Sekt':'🥂','Champagner':'🥂','Cocktail':'🍹','Cocktails':'🍹','Moonshiner':'🍹','Longdrink':'🥃','Longdrinks':'🥃','Spirituosen':'🥃','Whisky':'🥃','Shot':'🥃','Shots':'🥃','Softdrink':'🥤','Softdrinks':'🥤','Alkoholfrei':'🥤','Wasser':'💧','Kaffee':'☕','Heißgetränke':'☕','Tee':'🍵','Saft':'🍊','Säfte':'🍊' };
function getIcon(cat) { if (!cat) return '🍾'; for (var k in ICONS) { if (cat.toLowerCase().includes(k.toLowerCase())) return ICONS[k]; } return '🍾'; }
function render() {
    var filtered = getFiltered();
    var main = document.getElementById('main');
    document.getElementById('itemCount').textContent = filtered.length + ' Getränke';
    if (filtered.length === 0) { main.innerHTML = '<div class="empty"><div class="empty-icon">🔍</div><div class="empty-text">Keine Getränke gefunden</div><div class="empty-sub">Anderen Begriff oder Filter versuchen</div></div>'; return; }
    var groups = {}; var order = [];
    filtered.forEach(function(item) { if (!groups[item.category]) { groups[item.category] = []; order.push(item.category); } groups[item.category].push(item); });
    var html = '';
    order.forEach(function(cat, si) {
        var catItems = groups[cat];
        var cards = catItems.map(function(item) {
            var isAlkFrei = !item.alcohol_content || parseFloat(item.alcohol_content) === 0;
            var hasInfo = item.allergens_list.length > 0 || item.additives.length > 0 || item.allergens;
            var metaParts = [];
            if (item.size) metaParts.push('<span>' + esc(item.size) + '</span>');
            if (item.size && item.alcohol_content && parseFloat(item.alcohol_content) > 0) metaParts.push('<span class="sep">·</span>');
            if (item.alcohol_content && parseFloat(item.alcohol_content) > 0) metaParts.push('<span>' + esc(item.alcohol_content) + '% Vol.</span>');
            if (isAlkFrei) metaParts.push('<span style="color:#34d399;font-weight:600">Alkoholfrei</span>');
            var badges = '';
            if (item.is_seasonal) badges += '<span class="badge badge-seasonal">Saisonal</span>';
            if (item.is_special) badges += '<span class="badge badge-special">Special</span>';
            return '<button class="item-card' + (!item.is_available ? ' unavailable' : '') + '" data-item-id="' + item.id.replace(/-/g,'_') + '">' +
                '<div class="item-left">' +
                    '<div class="item-name">' + esc(item.name) + '</div>' +
                    (metaParts.length ? '<div class="item-meta">' + metaParts.join('') + '</div>' : '') +
                    (item.description ? '<div class="item-desc">' + esc(item.description) + '</div>' : '') +
                    (badges ? '<div class="badge-row">' + badges + '</div>' : '') +
                '</div>' +
                '<div class="item-right">' +
                    (item.price != null ? '<span class="item-price">€' + Number(item.price).toFixed(2) + '</span>' : '') +
                    (hasInfo ? '<svg class="info-dot" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="8" stroke-width="3" stroke-linecap="round"/><line x1="12" y1="12" x2="12" y2="16"/></svg>' : '') +
                '</div>' +
            '</button>';
        }).join('');
        html += '<section class="section" style="animation-delay:' + (si * 40) + 'ms">' +
            '<div class="section-header"><span class="section-icon">' + getIcon(cat) + '</span><span class="section-name">' + esc(cat) + '</span><span class="section-count">' + catItems.length + '</span></div>' +
            '<div class="item-list">' + cards + '</div></section>';
    });
    main.innerHTML = html;
    // Event Delegation für item-cards
    main.querySelectorAll('.item-card:not(.unavailable)').forEach(function(btn) {
        btn.addEventListener('click', function() { openModal(this.getAttribute('data-item-id')); });
    });
}
var itemMap = {};
ALL_ITEMS.forEach(function(i) { itemMap[i.id.replace(/-/g,'_')] = i; });
function openModal(id) {
    var item = itemMap[id]; if (!item) return;
    var isAlkFrei = !item.alcohol_content || parseFloat(item.alcohol_content) === 0;
    var chips = '';
    if (item.size) chips += '<span class="modal-chip">' + esc(item.size) + '</span>';
    if (item.alcohol_content && parseFloat(item.alcohol_content) > 0) chips += '<span class="modal-chip">' + esc(item.alcohol_content) + '% Vol.</span>';
    if (isAlkFrei) chips += '<span class="modal-chip" style="border-color:rgba(52,211,153,0.3);color:#34d399">Alkoholfrei</span>';
    var allergenHtml = '';
    if (item.allergens_list.length || item.additives.length || item.allergens) {
        allergenHtml = '<div class="modal-allergen-box"><div class="modal-allergen-title">Allergene &amp; Zusatzstoffe</div>';
        if (item.allergens_list.length) { allergenHtml += '<div class="modal-allergen-group"><div class="modal-allergen-label">Allergene</div><div class="modal-tags">' + item.allergens_list.map(function(a) { return '<span class="modal-tag allergen">' + esc(a) + '</span>'; }).join('') + '</div></div>'; }
        else if (item.allergens) { allergenHtml += '<div class="modal-allergen-group"><div class="modal-allergen-label">Allergene</div><p style="font-size:0.8125rem;color:#a1a1aa">' + esc(item.allergens) + '</p></div>'; }
        if (item.additives.length) { allergenHtml += '<div class="modal-allergen-group"><div class="modal-allergen-label add">Zusatzstoffe</div><div class="modal-tags">' + item.additives.map(function(a) { return '<span class="modal-tag additive">' + esc(a) + '</span>'; }).join('') + '</div></div>'; }
        allergenHtml += '</div>';
    }
    document.getElementById('modalBody').innerHTML =
        '<div class="modal-name">' + esc(item.name) + '</div>' +
        (item.image_url ? '<img class="modal-img" src="' + esc(item.image_url) + '" alt="' + esc(item.name) + '">' : '') +
        '<div class="modal-price-row"><' + (item.price != null ? 'span class="modal-price">€' + Number(item.price).toFixed(2) + '</span>' : 'span></span>') +
        '<div class="modal-chips">' + chips + '</div></div>' +
        (item.description ? '<p class="modal-desc">' + esc(item.description) + '</p>' : '') +
        allergenHtml +
        '<p class="modal-legal">Alle Angaben ohne Gewähr · Bei Unverträglichkeiten bitte Personal ansprechen.</p>';
    document.getElementById('modal').classList.add('open');
    document.body.style.overflow = 'hidden';
}
function closeModal(e) { if (!e || e.target === document.getElementById('modal')) { document.getElementById('modal').classList.remove('open'); document.body.style.overflow = ''; } }
document.getElementById('search').addEventListener('input', function() { searchQ = this.value.trim().toLowerCase(); document.getElementById('searchClear').classList.toggle('show', !!searchQ); render(); });
function clearSearch() { document.getElementById('search').value = ''; searchQ = ''; document.getElementById('searchClear').classList.remove('show'); render(); }
function selectCat(btn) {
    document.querySelectorAll('.cat-tab').forEach(function(b) { b.classList.remove('on'); });
    btn.classList.add('on'); activeCat = btn.getAttribute('data-cat'); render();
    if (activeCat === 'Alle') { window.scrollTo({ top: 0, behavior: 'smooth' }); }
}
function toggleFilters() { var panel = document.getElementById('filterPanel'); var btn = document.getElementById('filterBtn'); panel.classList.toggle('open'); btn.classList.toggle('active', panel.classList.contains('open') || activeFilters.size > 0); }
function toggleFilter(chip) { var f = chip.getAttribute('data-filter'); if (activeFilters.has(f)) { activeFilters.delete(f); chip.classList.remove('on'); } else { activeFilters.add(f); chip.classList.add('on'); } updateFilterBadge(); render(); }
function updateFilterBadge() { var n = activeFilters.size; var badge = document.getElementById('filterBadge'); var btn = document.getElementById('filterBtn'); badge.textContent = n; badge.classList.toggle('show', n > 0); btn.classList.toggle('active', n > 0 || document.getElementById('filterPanel').classList.contains('open')); }
render();
</script>
</body>
</html>`;

        return new Response(html, {
            headers: { 'Content-Type': 'text/html; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=30' }
        });
    } catch (err) {
        console.error('publicDrinkMenu error:', err);
        return new Response(`<html><body style="background:#09090b;color:#fafafa;font-family:sans-serif;padding:2rem"><h2>Getränkekarte momentan nicht verfügbar</h2><p style="color:#71717a;margin-top:0.5rem">${String(err)}</p></body></html>`, {
            status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
    }
});