import { expectedPositions } from './lineup-history.js';

export class GameRuleError extends Error {
  constructor(message: string, readonly status = 409) { super(message); this.name = 'GameRuleError'; }
}
export const entityId = (value: any): number => Number(value?.id ?? value);
export function money(value: unknown, allowZero = false): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < (allowZero ? 0 : 1)) {
    throw new GameRuleError('El importe debe ser un entero positivo en moneda del juego', 400);
  }
  return value;
}
export function balances(account: { bankBudget: number; reservedMoney: number; availableMoney: number }) {
  const bank = money(Number(account.bankBudget), true), reserved = money(Number(account.reservedMoney), true);
  const available = money(Number(account.availableMoney), true);
  if (bank !== reserved + available) throw new GameRuleError('Saldo inconsistente: disponible + reservado debe ser igual al banco');
  return { bankBudget: bank, reservedMoney: reserved, availableMoney: available };
}
export function moneyChange(account: { bankBudget: number; reservedMoney: number; availableMoney: number }, bankDelta: number, reserveDelta: number) {
  const before = balances(account);
  if (!Number.isSafeInteger(bankDelta) || !Number.isSafeInteger(reserveDelta)) throw new GameRuleError('Movimiento monetario inválido');
  const after = { bankBudget: before.bankBudget + bankDelta, reservedMoney: before.reservedMoney + reserveDelta,
    availableMoney: before.availableMoney + bankDelta - reserveDelta };
  if (Object.values(after).some(v => !Number.isSafeInteger(v) || v < 0)) throw new GameRuleError('Saldo insuficiente o reserva inválida');
  balances(after);
  return { before, after };
}
export interface StartingSlot { slotId: string; realPlayerId: number | null }
export function slotNames(formation: string): string[] {
  const counts: Record<string, number> = {};
  let positions;
  try { positions = expectedPositions(formation); } catch { throw new GameRuleError('Formación no permitida', 400); }
  return positions.map(position => {
    const prefix = position[0]; const index = counts[prefix] ?? 0; counts[prefix] = index + 1;
    return `${prefix}-${index}`;
  });
}
export function normalizeSquad(squad: any, slots?: StartingSlot[]) {
  const names = slotNames(squad.formation);
  let starters = squad.startingRealPlayersIds ?? [];
  if (slots !== undefined) {
    if (!Array.isArray(slots) || slots.length !== 11 || new Set(slots.map(s => s.slotId)).size !== 11
      || slots.some(s => !names.includes(s.slotId))) throw new GameRuleError('Debe haber exactamente un registro por puesto', 400);
    starters = names.map(name => slots.find(s => s.slotId === name)!.realPlayerId ?? 0);
  }
  if (!Array.isArray(starters) || starters.length > 11 || starters.some((id: any) => id !== null && (!Number.isSafeInteger(id) || id < 0))) {
    throw new GameRuleError('La alineación admite once puestos como máximo', 400);
  }
  const startingRealPlayersIds: number[] = names.map((_, i) => starters[i] ?? 0);
  const substitutesRealPlayersIds = squad.substitutesRealPlayersIds ?? [];
  if (!Array.isArray(substitutesRealPlayersIds) || substitutesRealPlayersIds.length > 5
    || substitutesRealPlayersIds.some((id: any) => !Number.isSafeInteger(id) || id <= 0)) throw new GameRuleError('Se permiten cinco suplentes como máximo', 400);
  const ids = [...startingRealPlayersIds.filter(Boolean), ...substitutesRealPlayersIds] as number[];
  if (new Set(ids).size !== ids.length) throw new GameRuleError('Un jugador no puede ocupar dos puestos', 400);
  const captainRealPlayerId = squad.captainRealPlayerId ?? null;
  if (captainRealPlayerId !== null && (!Number.isSafeInteger(captainRealPlayerId) || captainRealPlayerId <= 0 || !startingRealPlayersIds.includes(captainRealPlayerId))) throw new GameRuleError('El capitán debe ser titular', 400);
  return { startingRealPlayersIds, substitutesRealPlayersIds: [...substitutesRealPlayersIds], captainRealPlayerId,
    startingSlots: names.map((slotId, i) => ({ slotId, realPlayerId: startingRealPlayersIds[i] || null })) };
}
export function ownedIds(squad: any): number[] {
  return [...squad.startingRealPlayersIds, ...squad.substitutesRealPlayersIds].filter(id => Number.isSafeInteger(id) && id > 0);
}
export function removePlayer(squad: any, playerId: number) {
  squad.startingRealPlayersIds = squad.startingRealPlayersIds.map((id: number) => id === playerId ? 0 : id);
  squad.substitutesRealPlayersIds = squad.substitutesRealPlayersIds.filter((id: number) => id !== playerId);
  if (squad.captainRealPlayerId === playerId) squad.captainRealPlayerId = null;
  Object.assign(squad, normalizeSquad(squad));
}
export function receivePlayer(squad: any, playerId: number) {
  if (ownedIds(squad).includes(playerId)) throw new GameRuleError('El comprador ya tiene este jugador');
  if (ownedIds(squad).length >= 16 || squad.substitutesRealPlayersIds.length >= 5) throw new GameRuleError('El plantel no tiene lugar para otra compra');
  squad.substitutesRealPlayersIds = [...squad.substitutesRealPlayersIds, playerId];
  Object.assign(squad, normalizeSquad(squad));
}
