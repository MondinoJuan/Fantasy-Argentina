export interface InitialDrawPlayer { id: number; position: string }
const formation = [['forward', 2], ['midfielder', 4], ['defender', 4], ['goalkeeper', 1]] as const;
function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** One joint draw. Pitch positions constrain the eleven; only sporting quality balances teams. */
export function drawInitialSquads<T extends InitialDrawPlayer>(players: T[], participantIds: number[], quality: Map<number, number>, random: () => number = Math.random): Map<number, T[]> {
  if (!participantIds.length || participantIds.some(id => !Number.isSafeInteger(id) || id <= 0)
    || new Set(participantIds).size !== participantIds.length) throw new Error('Invalid draw participants');
  if (new Set(players.map(p => p.id)).size !== players.length) throw new Error('Duplicate draw player');
  for (const player of players) if (!Number.isFinite(quality.get(player.id))) throw new Error(`Missing quality for player ${player.id}`);
  for (const [position, count] of formation) {
    if (players.filter(p => p.position === position).length < count * participantIds.length) throw new Error(`Not enough players for ${position}`);
  }
  let best = new Map<number, T[]>(), bestSpread = Infinity;
  // Every attempt draws for everybody from one pool, independent of join order.
  for (let attempt = 0; attempt < 64; attempt++) {
    const order = shuffle([...participantIds].sort((a, b) => a - b), random);
    const squads = new Map<number, T[]>(order.map(id => [id, []]));
    const totals = new Map<number, number>(order.map(id => [id, 0]));
    for (const [position, count] of formation) {
      const selected = shuffle(players.filter(p => p.position === position), random).slice(0, count * order.length)
        .sort((a, b) => quality.get(b.id)! - quality.get(a.id)!);
      for (let round = 0; round < count; round++) {
        // Highest remaining quality goes to the currently weakest squad.
        const recipients = shuffle(order, random).sort((a, b) => totals.get(a)! - totals.get(b)!);
        recipients.forEach((id, i) => {
          const player = selected[round * order.length + i];
          squads.get(id)!.push(player);
          totals.set(id, totals.get(id)! + quality.get(player.id)!);
        });
      }
    }
    const spread = Math.max(...totals.values()) - Math.min(...totals.values());
    if (spread < bestSpread) { best = squads; bestSpread = spread; }
    if (spread < 1e-9) break;
  }
  return best;
}
