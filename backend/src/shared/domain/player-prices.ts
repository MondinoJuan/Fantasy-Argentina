export interface RatedMatch { id: number; kickoff: number; score: number }
const bound = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/** Replay sporting chronology, never ingestion order. Identical ratings give identical prices. */
export function priceHistory(base: number, ratings: RatedMatch[], min: number, max: number) {
  if (![base, min, max].every(Number.isFinite) || max <= min) throw new Error('Invalid price limits');
  let value = Math.round(bound(base, min, max));
  const scores: number[] = [];
  const weights = [.5, .3, .2, .1, .05];
  return [...ratings].filter(r => Number.isFinite(r.score) && Number.isFinite(r.kickoff))
    .sort((a, b) => a.kickoff - b.kickoff || a.id - b.id).map(r => {
      scores.unshift(r.score);
      scores.splice(5);
      const form = scores.reduce((sum, score, i) => sum + score * weights[i], 0)
        / weights.slice(0, scores.length).reduce((sum, w) => sum + w, 0);
      const p = (value - min) / (max - min);
      const deviation = form - p * 10;
      const before = value;
      value = Math.round(bound(value + .05 * deviation * (deviation >= 0 ? 1 - p : p) * value, min, max));
      return { matchId: r.id, kickoff: r.kickoff, score: r.score, form, before, after: value };
    });
}

