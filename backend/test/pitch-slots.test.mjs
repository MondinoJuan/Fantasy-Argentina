import test from 'node:test';
import assert from 'node:assert/strict';
import { moduleUrl, dataUrl } from './helpers/load-ts-module.mjs';

const component = new URL('../../Frontend/Fantasy-Argentina/src/app/components/football-pitch/football-pitch.component.ts', import.meta.url);
const angular = dataUrl(`export const Component = () => value => value;
 export const Input = () => () => undefined; export const Output = () => () => undefined;
 export class EventEmitter { emit() {} }`);
const aliases = new Map([
  ['@angular/core', angular], ['@angular/common', dataUrl('export class CommonModule {}')], ['@angular/forms', dataUrl('export class FormsModule {}')],
  ['@angular/cdk/drag-drop', dataUrl(`export class CdkDrag {} export class CdkDropList {} export class CdkDropListGroup {}
    export function moveItemInArray(a, from, to) { a.splice(to, 0, a.splice(from, 1)[0]); }
    export function transferArrayItem(a, b, from, to) { b.splice(to, 0, a.splice(from, 1)[0]); }`)],
  [new URL('../../servicios/api.service', component).href, dataUrl('export class ApiService {}')],
]);
const { FootballPitchComponent, FORMATION_LAYOUTS } = await import(moduleUrl(component, aliases));
function pitch() {
  let saved;
  const api = { patchParticipantSquad(payload) { saved = payload; return { subscribe({ next }) { next(); } }; } };
  const view = new FootballPitchComponent(api);
  view.participantSquadId = 1;
  view.startingPlayers = [{ id: 1, name: 'A', position: 'forward', teamName: 'Club' }, { id: 2, name: 'B', position: 'midfielder', teamName: 'Club' }];
  view.startingSlots = FORMATION_LAYOUTS['4-4-2'].map((s, i) => ({ slotId: s.slotId, realPlayerId: i === 1 ? 1 : i === 2 ? 2 : null }));
  view.ngOnChanges({ startingPlayers: {} });
  return { view, saved: () => saved };
}
test('pitch reload retains an empty first slot and saving does not shift following players', () => {
  const { view, saved } = pitch();
  assert.equal(view.slots[0].players.length, 0); assert.equal(view.slots[1].players[0].id, 1);
  view.toggleCaptain(view.slots[1].players[0]); view.saveSquad();
  assert.deepEqual(saved().startingRealPlayersIds.slice(0, 3), [0, 1, 2]);
  assert.deepEqual(saved().startingSlots.slice(0, 2), [{ slotId: 'f-0', realPlayerId: null }, { slotId: 'f-1', realPlayerId: 1 }]);
});
test('dropping into an occupied slot swaps players instead of stacking or losing them', () => {
  const { view } = pitch(); const source = view.slots[1], target = view.slots[2];
  view.dropSlot({ previousContainer: { id: source.slotId, data: source.players }, container: { id: target.slotId, data: target.players }, previousIndex: 0, currentIndex: 1 });
  assert.equal(source.players.length, 1); assert.equal(target.players.length, 1);
  assert.equal(source.players[0].id, 2); assert.equal(target.players[0].id, 1);
});
test('dropping into a full bench swaps and never creates a sixth substitute', () => {
  const { view } = pitch(); const source = view.slots[1];
  view.substitutes = [10, 11, 12, 13, 14].map(id => ({ id, name: String(id), position: 'forward', teamName: 'Club' }));
  view.dropSlot({ previousContainer: { id: source.slotId, data: source.players }, container: { id: 'substitutes-drop-list', data: view.substitutes }, previousIndex: 0, currentIndex: 5 });
  assert.equal(view.substitutes.length, 5); assert.equal(source.players[0].id, 14);
  assert.ok(view.substitutes.some(p => p.id === 1));
});

test('keyboard/touch assignment preserves holes, swaps occupied positions and clears a benched captain', () => {
  const { view } = pitch();
  view.toggleCaptain(view.slots[1].players[0]);
  view.selectedMovePlayerId = 1; view.selectedMoveTarget = view.slots[0].slotId;
  view.moveSelectedPlayer();
  assert.equal(view.slots[0].players[0].id, 1);
  assert.equal(view.slots[1].players.length, 0);
  view.selectedMoveTarget = view.slots[2].slotId; view.moveSelectedPlayer();
  assert.equal(view.slots[0].players[0].id, 2);
  assert.equal(view.slots[2].players[0].id, 1);
  view.selectedMoveTarget = 'substitutes-drop-list'; view.moveSelectedPlayer();
  assert.equal(view.substitutes[0].id, 1);
  assert.equal(view.selectedCaptainRealPlayerId, null);
  assert.equal(view.hasUnsavedChanges, true);
});
