/**
 * Design Token System
 * 
 * Alle Farben, Größen und Typografie sind in index.css als CSS-Variablen definiert.
 * Diese Datei dokumentiert die verfügbaren Tokens und zeigt Best Practices.
 */

// ── FARBEN (via CSS-Variablen) ────────────────────────────────────────
// Alle Tokens sind als Tailwind-Klassen verfügbar:
// 
// - bg-background, text-foreground (Standard Hintergrund/Text)
// - bg-card, text-card-foreground (Karten)
// - bg-primary, text-primary-foreground (Aktionen, Links)
// - bg-secondary, text-secondary-foreground (Sekundär)
// - bg-muted, text-muted-foreground (Deaktiviert, schwach)
// - bg-accent, text-accent-foreground (Betonung)
// - border-border, border-input, ring-ring (Ränder)
// - bg-destructive, text-destructive (Fehler, Löschen)
//
// Brand Gradient: --brand-from, --brand-via, --brand-fg
// Nutze `.brand-gradient` oder `.brand-gradient-r` für Verläufe

// ── BEST PRACTICES ────────────────────────────────────────────────────

export const DESIGN_TOKENS = {
  // ── Farbpalette ────────────────────
  colors: {
    // Standard-Hintergrund (dark: warm charcoal)
    background: 'bg-background',
    foreground: 'text-foreground',
    
    // Karten/Container
    card: 'bg-card',
    cardForeground: 'text-card-foreground',
    
    // Primär (Amber/Orange - Brand)
    primary: 'bg-primary text-primary-foreground',
    
    // Sekundär (Dunkler)
    secondary: 'bg-secondary text-secondary-foreground',
    
    // Muted (deaktiviert, placeholder)
    muted: 'bg-muted text-muted-foreground',
    
    // Accent (Betonung)
    accent: 'bg-accent text-accent-foreground',
    
    // Fehler/Destruktiv
    destructive: 'bg-destructive text-destructive-foreground',
  },

  // ── Größen ────────────────────
  spacing: {
    radius: 'rounded-[var(--radius)]',
    radiusMd: 'rounded-[calc(var(--radius)-2px)]',
    radiusSm: 'rounded-[calc(var(--radius)-4px)]',
  },

  // ── Icons + UI-Pattern ────────────────────
  patterns: {
    // Spinner (Amber gradient)
    spinner: 'border-4 border-status-warn/30 border-t-amber-500 rounded-full animate-spin',
    
    // Card mit hover
    card: 'rounded-xl border bg-card text-card-foreground shadow hover:shadow-md transition-shadow',
    
    // Button primär
    buttonPrimary: 'bg-primary text-primary-foreground shadow hover:bg-primary/90',
    
    // Input
    input: 'border border-input bg-transparent rounded-md px-3 py-1 text-base shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
    
    // Badge
    badge: 'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold',
  },
};

// ── USAGE EXAMPLES ────────────────────────────────────────────────────
//
// ✅ RICHTIG:
// <div className="bg-card text-card-foreground rounded-xl p-4 border border-border">
// <button className="bg-primary text-primary-foreground hover:bg-primary/90">
// <Badge className="bg-status-warn/15 text-status-warn">Special</Badge>
//
// ❌ FALSCH:
// <div className="bg-[#ffffff] text-[#000000]">  (hardcoded)
// <button className="bg-status-danger/70">  (wenn primary sein sollte)
// <div className="border-2 border-border">  (sollte border-border sein)

export default DESIGN_TOKENS;