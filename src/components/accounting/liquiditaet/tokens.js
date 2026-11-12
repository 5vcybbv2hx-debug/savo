/* Design-Konstanten des Liquiditätsmoduls */
export const ACCENT = '#0099db';
export const GRID = 'rgba(255,255,255,0.06)';
export const BORDER_SOFT = 'rgba(255,255,255,0.085)';

/** Ampel-Punkte in den Vorgabefarben */
export const AMPEL_CLASS = {
    gruen: 'bg-[#3FBF7F]',
    gelb: 'bg-[#E2A03F]',
    rot: 'bg-[#E2574C]',
};

/** Kontostand: positiv grün, negativ rot */
export const TONE = {
    pos: 'text-status-ok',
    neg: 'text-status-danger',
};

export const toneFor = (value) => (Number(value) < 0 ? TONE.neg : TONE.pos);