export const hoursAfter = (date: Date, hours: number) => new Date(date.getTime() + hours * 3_600_000);

export interface ClosureMatch {
  status: string;
  startDateTime: Date;
  finishedAt?: Date | null;
  pendingRecovery?: boolean;
  pendingOriginalStart?: Date | null;
}

/** First and only planned status check: five hours after the last regular kickoff. */
export function closureTime(matches: ClosureMatch[]): Date | null {
  if (!matches.length) return null;
  const regular = matches.filter(m => !m.pendingRecovery && !['postponed', 'cancelled'].includes(m.status));
  const starts = regular.length ? regular.map(m => m.startDateTime) : matches.map(m => m.pendingOriginalStart ?? m.startDateTime);
  return hoursAfter(new Date(Math.max(...starts.map(start => start.getTime()))), 5);
}

/** Live matches also have scores: only an explicit terminal status confirms the final whistle. */
export function sportsMatchStatus(raw: unknown): 'scheduled' | 'in_progress' | 'finalizado' | 'postponed' | 'cancelled' {
  const status = String(raw ?? '').trim().toLowerCase();
  if (/postpon|suspend|interrupt/.test(status)) return 'postponed';
  if (/cancel|abandon/.test(status)) return 'cancelled';
  if (/\b(finished|ended|finalizado|final|ft|aet)\b|after penalties|after extra time/.test(status)) return 'finalizado';
  if (/progress|live|half|playing|inplay/.test(status)) return 'in_progress';
  return 'scheduled';
}

/** Competition ranking: equal scores share the first position occupied by the tied group. */
export function dateRewards(rows: Array<{ id: number; points: number }>) {
  const sorted = [...rows].sort((a, b) => b.points - a.points || a.id - b.id);
  let rank = 1;
  return sorted.map((row, index) => {
    if (index && row.points !== sorted[index - 1].points) rank = index + 1;
    return { id: row.id, rank, amount: 1_000_000 + Math.floor((rank - 1) / 3) * 500_000 };
  });
}

export function randomSelection<T>(pool: T[], count: number, random = Math.random): T[] {
  const remaining = [...pool];
  const result: T[] = [];
  while (remaining.length && result.length < count) result.push(remaining.splice(Math.floor(random() * remaining.length), 1)[0]);
  return result;
}

/** Stable tie break: highest offer, earliest bid, lowest persistent id. */
export function compareBids(a: { offeredAmount: number; bidDate: Date; id?: number }, b: { offeredAmount: number; bidDate: Date; id?: number }) {
  return b.offeredAmount - a.offeredAmount || a.bidDate.getTime() - b.bidDate.getTime() || (a.id ?? 0) - (b.id ?? 0);
}
