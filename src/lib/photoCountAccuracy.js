import { MIN_CONFIDENCE } from '@/lib/photoCount';

function emptyBucket(key) {
  return { key, photos: 0, baselinePhotos: 0, compared: 0, hits: 0, deviationSum: 0, segTotal: 0, segLow: 0 };
}

function withRates(b) {
  return {
    ...b,
    hitRate: b.compared > 0 ? b.hits / b.compared : null,
    avgDeviation: b.compared > 0 ? b.deviationSum / b.compared : null,
    lowConfRate: b.segTotal > 0 ? b.segLow / b.segTotal : null,
    baselineRate: b.photos > 0 ? b.baselinePhotos / b.photos : null,
  };
}

/**
 * Trefferquote der Foto-Zählung: suggested_counts gegen final_counts.
 * Treffer = Vorschlag wurde unverändert übernommen, Abweichung = |final - suggested|.
 * lowConfRate = Anteil der Sorten mit confidence < 0,5.
 */
export function analyzePhotoCounts(samples = []) {
  const slotMap = new Map();

  samples.forEach((sample) => {
    const suggested = Array.isArray(sample.suggested_counts) ? sample.suggested_counts : [];
    const final = Array.isArray(sample.final_counts) ? sample.final_counts : [];
    const segs = Array.isArray(sample.segments) ? sample.segments : [];

    const key = sample.slot_full_name || 'Unbekanntes Fach';
    if (!slotMap.has(key)) slotMap.set(key, emptyBucket(key));
    const bucket = slotMap.get(key);

    bucket.photos += 1;
    if (sample.baseline_used) bucket.baselinePhotos += 1;

    const confidences = segs.length
      ? segs.map((s) => Number(s?.confidence) || 0)
      : suggested.map((s) => Number(s?.confidence) || 0);
    bucket.segTotal += confidences.length;
    bucket.segLow += confidences.filter((c) => c < MIN_CONFIDENCE).length;

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
      baselinePhotos: acc.baselinePhotos + s.baselinePhotos,
      compared: acc.compared + s.compared,
      hits: acc.hits + s.hits,
      deviationSum: acc.deviationSum + s.deviationSum,
      segTotal: acc.segTotal + s.segTotal,
      segLow: acc.segLow + s.segLow,
    }), emptyBucket('gesamt'))
  );

  return { overall, slots };
}