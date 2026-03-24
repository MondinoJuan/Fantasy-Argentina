import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, Output, EventEmitter, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CdkDrag, CdkDragDrop, CdkDropList, CdkDropListGroup, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { ApiService } from '../../servicios/api.service';

export interface PitchPlayer {
  id?: number;
  name: string;
  position: string;
  teamName: string;
  lastScore?: number;
}

export interface PitchSlot {
  slotId: string;
  position: string;
  gridRow?: number;
  gridCol?: number;
  players: PitchPlayer[];
}

export const FORMATION_LAYOUTS: Record<string, Omit<PitchSlot, 'players'>[]> = {
  '4-4-2': [
    { slotId: 'f-0', position: 'forward', gridRow: 1, gridCol: 3 },
    { slotId: 'f-1', position: 'forward', gridRow: 1, gridCol: 5 },
    { slotId: 'm-0', position: 'midfielder', gridRow: 3, gridCol: 1 },
    { slotId: 'm-1', position: 'midfielder', gridRow: 3, gridCol: 3 },
    { slotId: 'm-2', position: 'midfielder', gridRow: 3, gridCol: 5 },
    { slotId: 'm-3', position: 'midfielder', gridRow: 3, gridCol: 7 },
    { slotId: 'd-0', position: 'defender', gridRow: 5, gridCol: 1 },
    { slotId: 'd-1', position: 'defender', gridRow: 5, gridCol: 3 },
    { slotId: 'd-2', position: 'defender', gridRow: 5, gridCol: 5 },
    { slotId: 'd-3', position: 'defender', gridRow: 5, gridCol: 7 },
    { slotId: 'g-0', position: 'goalkeeper', gridRow: 7, gridCol: 4 },
  ],
  '4-3-3': [
    { slotId: 'f-0', position: 'forward', gridRow: 1, gridCol: 1 },
    { slotId: 'f-1', position: 'forward', gridRow: 1, gridCol: 4 },
    { slotId: 'f-2', position: 'forward', gridRow: 1, gridCol: 7 },
    { slotId: 'm-0', position: 'midfielder', gridRow: 3, gridCol: 2 },
    { slotId: 'm-1', position: 'midfielder', gridRow: 3, gridCol: 4 },
    { slotId: 'm-2', position: 'midfielder', gridRow: 3, gridCol: 6 },
    { slotId: 'd-0', position: 'defender', gridRow: 5, gridCol: 1 },
    { slotId: 'd-1', position: 'defender', gridRow: 5, gridCol: 3 },
    { slotId: 'd-2', position: 'defender', gridRow: 5, gridCol: 5 },
    { slotId: 'd-3', position: 'defender', gridRow: 5, gridCol: 7 },
    { slotId: 'g-0', position: 'goalkeeper', gridRow: 7, gridCol: 4 },
  ],
  '3-4-3': [
    { slotId: 'f-0', position: 'forward', gridRow: 1, gridCol: 1 },
    { slotId: 'f-1', position: 'forward', gridRow: 1, gridCol: 4 },
    { slotId: 'f-2', position: 'forward', gridRow: 1, gridCol: 7 },
    { slotId: 'm-0', position: 'midfielder', gridRow: 3, gridCol: 1 },
    { slotId: 'm-1', position: 'midfielder', gridRow: 3, gridCol: 3 },
    { slotId: 'm-2', position: 'midfielder', gridRow: 3, gridCol: 5 },
    { slotId: 'm-3', position: 'midfielder', gridRow: 3, gridCol: 7 },
    { slotId: 'd-0', position: 'defender', gridRow: 5, gridCol: 2 },
    { slotId: 'd-1', position: 'defender', gridRow: 5, gridCol: 4 },
    { slotId: 'd-2', position: 'defender', gridRow: 5, gridCol: 6 },
    { slotId: 'g-0', position: 'goalkeeper', gridRow: 7, gridCol: 4 },
  ],
  '5-4-1': [
    { slotId: 'f-0', position: 'forward', gridRow: 1, gridCol: 4 },
    { slotId: 'm-0', position: 'midfielder', gridRow: 3, gridCol: 1 },
    { slotId: 'm-1', position: 'midfielder', gridRow: 3, gridCol: 3 },
    { slotId: 'm-2', position: 'midfielder', gridRow: 3, gridCol: 5 },
    { slotId: 'm-3', position: 'midfielder', gridRow: 3, gridCol: 7 },
    { slotId: 'd-0', position: 'defender', gridRow: 5, gridCol: 1 },
    { slotId: 'd-1', position: 'defender', gridRow: 5, gridCol: 2 },
    { slotId: 'd-2', position: 'defender', gridRow: 5, gridCol: 4 },
    { slotId: 'd-3', position: 'defender', gridRow: 5, gridCol: 6 },
    { slotId: 'd-4', position: 'defender', gridRow: 5, gridCol: 7 },
    { slotId: 'g-0', position: 'goalkeeper', gridRow: 7, gridCol: 4 },
  ],
};

@Component({
  selector: 'app-football-pitch',
  standalone: true,
  imports: [CommonModule, FormsModule, CdkDrag, CdkDropList, CdkDropListGroup],
  templateUrl: './football-pitch.component.html',
  styleUrl: './football-pitch.component.scss',
})
export class FootballPitchComponent implements OnChanges {
  @Input() participantSquadId: number | null = null;
  @Input() startingPlayers: PitchPlayer[] = [];
  @Input() substitutePlayers: PitchPlayer[] = [];
  @Input() formation = '4-4-2';
  @Input() playerPerformances: any[] = [];

  @Output() formationChange = new EventEmitter<string>();
  @Output() squadSaved = new EventEmitter<void>();

  readonly formations = ['4-4-2', '4-3-3', '3-4-3', '5-4-1'];
  slots: PitchSlot[] = [];
  substitutes: PitchPlayer[] = [];
  hasUnsavedChanges = false;
  isSaving = false;
  saveError = '';

  private initialStartingIds: number[] = [];
  private initialSubstituteIds: number[] = [];
  private initialFormation = this.formation;

  constructor(private readonly apiService: ApiService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['startingPlayers'] ||
      changes['substitutePlayers'] ||
      changes['formation'] ||
      changes['playerPerformances'] ||
      changes['participantSquadId']
    ) {
      this.initializeStateFromInputs();
    }
  }

  onFormationSelect(): void {
    this.buildSlotsFromPlayers(this.getCurrentStartingPlayers());
    this.formationChange.emit(this.formation);
    this.updateDirtyState();
  }

  dropSlot(event: CdkDragDrop<PitchPlayer[]>): void {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      transferArrayItem(event.previousContainer.data, event.container.data, event.previousIndex, event.currentIndex);
    }

    this.updateDirtyState();
  }

  saveSquad(): void {
    if (!this.participantSquadId || this.isSaving || !this.hasUnsavedChanges) return;

    this.isSaving = true;
    this.saveError = '';

    this.apiService.patchParticipantSquad({
      id: this.participantSquadId,
      formation: this.formation as any,
      startingRealPlayersIds: this.getCurrentStartingPlayers().map((player) => player.id).filter((id): id is number => Number.isFinite(Number(id))),
      substitutesRealPlayersIds: this.substitutes.map((player) => player.id).filter((id): id is number => Number.isFinite(Number(id))),
    }).subscribe({
      next: () => {
        this.initialStartingIds = this.getCurrentStartingPlayers().map((player) => player.id).filter((id): id is number => Number.isFinite(Number(id)));
        this.initialSubstituteIds = this.substitutes.map((player) => player.id).filter((id): id is number => Number.isFinite(Number(id)));
        this.initialFormation = this.formation;
        this.hasUnsavedChanges = false;
        this.isSaving = false;
        this.squadSaved.emit();
      },
      error: (error) => {
        this.saveError = error?.error?.message ?? 'No se pudo guardar la formación.';
        this.isSaving = false;
      },
    });
  }

  isSlotMismatch(slot: PitchSlot): boolean {
    return slot.players.some((player) => this.normalizePosition(player.position) !== this.normalizePosition(slot.position));
  }

  get substitutesConnectedTo(): string[] {
    return this.slots.map((slot) => slot.slotId);
  }

  connectedDropListsFor(slotId: string): string[] {
    return [
      ...this.slots.map((slot) => slot.slotId),
      'substitutes-drop-list',
    ].filter((id) => id !== slotId);
  }

  private initializeStateFromInputs(): void {
    const normalizedStarting = (this.startingPlayers ?? []).map((player) => this.normalizePlayer(player));
    const normalizedSubstitutes = (this.substitutePlayers ?? []).map((player) => this.normalizePlayer(player));

    this.initialStartingIds = normalizedStarting.map((player) => player.id).filter((id): id is number => Number.isFinite(Number(id)));
    this.initialSubstituteIds = normalizedSubstitutes.map((player) => player.id).filter((id): id is number => Number.isFinite(Number(id)));
    this.initialFormation = this.formation;

    this.substitutes = normalizedSubstitutes;
    this.buildSlotsFromPlayers(normalizedStarting);
    this.hasUnsavedChanges = false;
    this.saveError = '';
  }

  private buildSlotsFromPlayers(startingPlayers: PitchPlayer[]): void {
    const layout = FORMATION_LAYOUTS[this.formation] ?? FORMATION_LAYOUTS['4-4-2'];
    const orderedStartingPlayers = [...startingPlayers];

    this.slots = layout.map((layoutSlot, index) => ({
      ...layoutSlot,
      players: orderedStartingPlayers[index] ? [{ ...orderedStartingPlayers[index] }] : [],
    }));

    const overflowPlayers = orderedStartingPlayers.slice(layout.length);

    if (overflowPlayers.length > 0) {
      this.substitutes.push(...overflowPlayers);
    }
  }

  private getCurrentStartingPlayers(): PitchPlayer[] {
    return this.slots.flatMap((slot) => slot.players ?? []);
  }

  private updateDirtyState(): void {
    const currentStarting = this.getCurrentStartingPlayers().map((player) => player.id).filter((id): id is number => Number.isFinite(Number(id)));
    const currentSubstitutes = this.substitutes.map((player) => player.id).filter((id): id is number => Number.isFinite(Number(id)));

    this.hasUnsavedChanges =
      this.initialFormation !== this.formation ||
      !this.areSameIdArrays(this.initialStartingIds, currentStarting) ||
      !this.areSameIdArrays(this.initialSubstituteIds, currentSubstitutes);
  }

  private areSameIdArrays(left: number[], right: number[]): boolean {
    if (left.length !== right.length) return false;
    return left.every((value, index) => value === right[index]);
  }

  private normalizePlayer(player: PitchPlayer): PitchPlayer {
    const id = this.extractId(player.id);
    return {
      ...player,
      id: id ?? undefined,
      position: this.normalizePosition(player.position),
      lastScore: this.getLastPoints(id ?? 0),
    };
  }

  private normalizePosition(positionRaw: unknown): string {
    const position = String(positionRaw ?? '').toLowerCase();
    if (position.includes('goal')) return 'goalkeeper';
    if (position.includes('def')) return 'defender';
    if (position.includes('mid')) return 'midfielder';
    if (position.includes('for') || position.includes('att') || position.includes('strik')) return 'forward';
    return 'midfielder';
  }

  private getLastPoints(realPlayerId: number): number {
    const performances = (this.playerPerformances ?? []).filter(
      (performance) => this.extractId(performance?.realPlayer ?? performance?.realPlayerId ?? performance?.real_player_id) === realPlayerId,
    );

    if (performances.length === 0) return 0;

    const latestPerformance = performances.reduce((a: any, b: any) =>
      new Date(a?.updateDate ?? a?.update_date ?? 0).getTime() > new Date(b?.updateDate ?? b?.update_date ?? 0).getTime() ? a : b,
    );

    return Number(latestPerformance?.pointsObtained ?? latestPerformance?.points_obtained ?? 0);
  }

  private extractId(value: unknown): number | null {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number.parseInt(value.trim(), 10);
      return Number.isFinite(parsed) ? parsed : null;
    }
    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      if (record['id'] !== undefined) return this.extractId(record['id']);
    }
    return null;
  }
}
