import test from 'node:test';
import assert from 'node:assert/strict';
import { moduleUrl, dataUrl } from './helpers/load-ts-module.mjs';

const angular = dataUrl(`export const Component = () => value => value; export const Directive = Component;
export const Input = () => () => {}; export const Output = Input; export const HostListener = Input;
export class EventEmitter { calls = 0; emit() { this.calls++; } }`);
const aliases = new Map([['@angular/core', angular], ['@angular/common', dataUrl('export class CommonModule {}')],
  ['@angular/forms', dataUrl('export class FormsModule {}')], ['rxjs', dataUrl('export function forkJoin() {} export function of() {}')],
  ['rxjs/operators', dataUrl('export function switchMap() {} export function map() {} export function catchError() {}')]]);
const base = new URL('../../Frontend/Fantasy-Argentina/src/app/components/', import.meta.url);
aliases.set(new URL('../servicios/api.service', base).href, dataUrl('export class ApiService {}'));
const dialogUrl = moduleUrl(new URL('accessible-dialog.directive.ts', base), aliases);
aliases.set(new URL('accessible-dialog.directive', base).href, dialogUrl);
const { AccessibleDialogDirective } = await import(dialogUrl);
const { RealPlayerMarketCardComponent } = await import(moduleUrl(new URL('real-player-market-card/real-player-market-card.component.ts', base), aliases));
aliases.set(new URL('football-pitch/football-pitch.component', base).href, dataUrl('export class FootballPitchComponent {} export const FORMATION_LAYOUTS = {};'));
aliases.set(new URL('real-player-market-card/real-player-market-card.component', base).href, dataUrl('export class RealPlayerMarketCardComponent {}'));
aliases.set(new URL('rivals-real-player-list/rivals-real-player-list.component', base).href, dataUrl('export class RivalsRealPlayerListComponent {}'));
const { InsideTournamentComponent } = await import(moduleUrl(new URL('../pages/inside-tournament/inside-tournament.component.ts', base), aliases));

test('dialog focuses controls, traps Tab, handles Escape and restores the trigger', () => {
  const control = () => ({ isConnected: true, getClientRects: () => [1], focus() { document.activeElement = this; } });
  const trigger = control(), first = control(), last = control();
  globalThis.document = { activeElement: trigger };
  const root = { querySelectorAll: () => [first, last], focus() { document.activeElement = this; } };
  const dialog = new AccessibleDialogDirective({ nativeElement: root });
  dialog.ngAfterViewInit(); assert.equal(document.activeElement, first);
  const key = (key, shiftKey = false) => ({ key, shiftKey, preventDefault() {}, stopPropagation() {} });
  dialog.keydown(key('Tab', true)); assert.equal(document.activeElement, last);
  dialog.keydown(key('Tab')); assert.equal(document.activeElement, first);
  dialog.keydown(key('Escape')); assert.equal(dialog.dialogEscape.calls, 1);
  dialog.ngOnDestroy(); assert.equal(document.activeElement, trigger);
});

test('cancel bid sends DELETE once, waits for success and emits a balance refresh', () => {
  let result, calls = 0;
  const view = new RealPlayerMarketCardComponent({ removeBid(id) { assert.equal(id, 8); calls++; return { subscribe(observer) { result = observer; } }; } });
  view.existingBidForSelectedPlayer = { id: 8 }; view.showBidModal = true;
  view.cancelBid(); view.cancelBid();
  assert.equal(calls, 1); assert.equal(view.showBidModal, true);
  result.next();
  assert.equal(view.showBidModal, false); assert.equal(view.bidSaved.calls, 1);
});

test('cancel bid errors preserve the dialog and offer for retry', () => {
  const view = new RealPlayerMarketCardComponent({ removeBid() { return { subscribe(observer) { observer.error({ error: { message: 'Mercado cerrado' } }); } }; } });
  view.existingBidForSelectedPlayer = { id: 8 }; view.showBidModal = true;
  view.cancelBid();
  assert.equal(view.bidError, 'Mercado cerrado'); assert.equal(view.isSubmitting, false);
  assert.equal(view.showBidModal, true); assert.equal(view.existingBidForSelectedPlayer.id, 8);
});

test('lobby start controls enforce creator identity, avoid duplicate submissions and refresh assigned squads', () => {
  globalThis.localStorage = { getItem: () => '1' };
  let calls = 0, response, loaded = 0;
  const invalidated = [];
  const view = new InsideTournamentComponent({ startTournament(id) { assert.equal(id, 7); calls++; return { subscribe(observer) { response = observer; } }; } },
    { invalidateByPrefix: key => invalidated.push(key) }, {}, {});
  view.tournament = { creatorUserId: 2, initialDrawState: 'waiting' }; view.tournamentId = 7;
  view.startTournament(); assert.equal(calls, 0);
  view.selectSection('market'); assert.equal(view.activeSection, 'home');
  view.tournament.creatorUserId = 1;
  view.loadTournamentPage = () => loaded++;
  view.startTournament(); view.startTournament();
  assert.equal(calls, 1); assert.equal(view.isStartingTournament, true);
  response.next();
  assert.equal(view.isStartingTournament, false); assert.equal(loaded, 1);
  assert.ok(invalidated.includes('participant-squads')); assert.ok(invalidated.includes('matchday-markets'));
});

test('refreshing the lobby invalidates empty squad/market caches after another member starts it', () => {
  const invalidated = [];
  const view = new InsideTournamentComponent({}, { invalidateByPrefix: key => invalidated.push(key) }, {}, {});
  view.isLoading = false; let loaded = 0; view.loadTournamentPage = () => loaded++;
  view.refreshLobby();
  assert.equal(loaded, 1);
  assert.ok(invalidated.includes('participant-squads')); assert.ok(invalidated.includes('matchday-markets'));
});
