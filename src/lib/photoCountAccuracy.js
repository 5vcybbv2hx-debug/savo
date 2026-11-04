import { MIN_CONFIDENCE } from '@/lib/photoCount';

function emptyBucket(key) {
  return { key, photos: 0, unsurePhotos: 0, compared: 0, hits: 0, deviationSum: 0 };
}

function withRates(b) {
  return {
    ...b,
    hitRate: b.compared > 0 ? b.hits / b.compared : null,
    avgDeviation: b.compared > 0 ? b.deviationSum / b.compared : null,
    unsureRate: b.photos > 0 ? b.unsurePhotos / b.photos : null,
  };
}

/**
 * Trefferquote der Foto-Zählung: suggested_counts gegen final_counts.
 * Treffer = Vorschlag wurde unverändert übernommen, Abweichung = |final - suggested|.
 */
export function analyzePhotoCounts(samples = []) {
  const slotMap = new Map();

  samples.forEach((sample) => {
    const suggested = Array.isArray(sample.suggested_counts) ? sample.suggested_counts : [];
    const final = Array.isArray(sample.final_counts) ? sample.final_counts : [];

    const key = sample.slot_full_name || 'Unbekanntes Fach';
    if (!slotMap.has(key)) slotMap.set(key, emptyBucket(key));
    const bucket = slotMap.get(key);

    const unsure = sample.photo_quality !== 'gut'
      || suggested.some((s) => (Number(s?.confidence) || 0) < MIN_CONFIDENCE);

    bucket.photos += 1;
    if (unsure) bucket.unsurePhotos += 1;

    final.forEach((f) => {
      const g = suggested.find((s) => s.article_id && s.article_id === f.article_id)
        || suggested.find((s) => (s.article_name || '').trim().toLowerCase() === (f.article_name || '').trim().toLowerCase());
      if (!g) return;
      const finalCount = Number(f.count);
      if (!Number.isFinite(finalCount)) return;
      const suggestedCount = g.count == null ? NaN : Number(g.count);
      bucket.compared += 1;
      if (Number.isFinite(suggestedCount)) {
        const deviation = Math.abs(finalCount - suggestedCount);
        bucket.deviationSum += deviation;
        if (deviation === 0) bucket.hits += 1;
      }
    });
  });

  const slots = Array.from(slotMap.values())
    .map(withRates)
    .sort((a, b) => b.photos - a.photos);

  const overall = withRates(
    slots.reduce((acc, s) => ({
      key: 'gesamt',
      photos: acc.photos + s.photos,
      unsurePhotos: acc.unsurePhotos + s.unsurePhotos,
      compared: acc.compared + s.compared,
      hits: acc.hits + s.hits,
      deviationSum: acc.deviationSum + s.deviationSum,
    }), emptyBucket('gesamt'))
  );

  return { overall, slots };
}