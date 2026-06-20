// Konvertiert Hex (#8A9B6E) zu HSL-String "83 18% 52%"
export function hexToHsl(hex) {
  if (!hex || !/^#[0-9A-Fa-f]{6}$/.test(hex)) return '187 92% 50%';
  let r = parseInt(hex.slice(1,3),16)/255;
  let g = parseInt(hex.slice(3,5),16)/255;
  let b = parseInt(hex.slice(5,7),16)/255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  let h, s, l = (max+min)/2;
  if (max===min) { h=s=0; } else {
    const d=max-min; s=l>0.5?d/(2-max-min):d/(max+min);
    switch(max){case r:h=((g-b)/d+(g<b?6:0))/6;break;case g:h=((b-r)/d+2)/6;break;default:h=((r-g)/d+4)/6;}
  }
  return `${Math.round(h*360)} ${Math.round(s*100)}% ${Math.round(l*100)}%`;
}

// Berechnet eine dunklere Variante für --brand-via
export function darkenHex(hex, amount = 15) {
  if (!hex || !/^#[0-9A-Fa-f]{6}$/.test(hex)) return hex;
  let r = parseInt(hex.slice(1,3),16);
  let g = parseInt(hex.slice(3,5),16);
  let b = parseInt(hex.slice(5,7),16);
  r = Math.max(0, r - amount); g = Math.max(0, g - amount); b = Math.max(0, b - amount);
  return '#' + [r,g,b].map(x=>x.toString(16).padStart(2,'0')).join('');
}

// Wendet Branding sofort auf :root an
export function applyBranding({ primaryHex, logoUrl, barName } = {}) {
  if (!primaryHex) return;
  const hsl = hexToHsl(primaryHex);
  const darker = darkenHex(primaryHex, 20);
  const root = document.documentElement;
  root.style.setProperty('--primary', hsl);
  root.style.setProperty('--ring', hsl);
  root.style.setProperty('--sidebar-primary', hsl);
  root.style.setProperty('--sidebar-ring', hsl);
  root.style.setProperty('--brand-from', primaryHex);
  root.style.setProperty('--brand-via', darker);
  if (barName) document.title = barName;
}

export const PRESET_COLORS = [
  { name: 'SAVO Cyan',   hex: '#0891b2' },
  { name: 'Salvia Grün', hex: '#8A9B6E' },
  { name: 'Bordeaux',   hex: '#8B1A1A' },
  { name: 'Mitternacht', hex: '#1a1a2e' },
  { name: 'Gold',        hex: '#B8860B' },
  { name: 'Violett',     hex: '#6B21A8' },
  { name: 'Koralle',     hex: '#E05C3A' },
  { name: 'Petrol',      hex: '#0F7173' },
];