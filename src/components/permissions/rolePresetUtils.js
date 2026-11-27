import { PERMISSION_REGISTRY } from '@/lib/permissionRegistry';

// Rechte einer Vorlage auf das Level-Format der Toggles bringen:
// true → 'edit', false/leer → kein Recht, 'view'/'edit' bleiben erhalten.
export function normalizePresetPermissions(raw = {}) {
  const out = {};
  Object.entries(raw || {}).forEach(([key, value]) => {
    if (value === true) out[key] = 'edit';
    else if (value === 'view' || value === 'edit') out[key] = value;
  });
  return out;
}

// Anzahl aktiver Rechte einer Vorlage
export function countActivePermissions(raw = {}) {
  return Object.keys(normalizePresetPermissions(raw)).length;
}

// Seiten der Registry nach Kategorie gruppiert (wie in der Mitarbeiter-Maske)
export function permissionCategories() {
  const cats = {};
  Object.values(PERMISSION_REGISTRY).forEach(page => {
    const cat = page.category || 'Sonstige';
    if (!cats[cat]) cats[cat] = [];
    cats[cat].push(page);
  });
  return cats;
}

// Alle Permission-Keys einer Kategorie
export function categoryKeys(pages = []) {
  return pages.flatMap(p => Object.values(p.sections || {}).map(s => s.key));
}