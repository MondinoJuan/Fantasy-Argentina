import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, Output, EventEmitter, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CdkDrag, CdkDragDrop, CdkDropList, CdkDropListGroup, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';

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
    // forwards: centrados simétricamente en la fila de arriba
    { slotId: 'f-0', position: 'forward',    gridRow: 1, gridCol: 3 },
    { slotId: 'f-1', position: 'forward',    gridRow: 1, gridCol: 5 },
    // midfielders: distribuidos en las 4 columnas interiores
    { slotId: 'm-0', position: 'midfielder', gridRow: 3, gridCol: 1 },
    { slotId: 'm-1', position: 'midfielder', gridRow: 3, gridCol: 3 },
    { slotId: 'm-2', position: 'midfielder', gridRow: 3, gridCol: 5 },
    { slotId: 'm-3', position: 'midfielder', gridRow: 3, gridCol: 7 },
    // defenders: distribuidos en las 4 columnas interiores
    { slotId: 'd-0', position: 'defender',   gridRow: 5, gridCol: 1 },
    { slotId: 'd-1', position: 'defender',   gridRow: 5, gridCol: 3 },
    { slotId: 'd-2', position: 'defender',   gridRow: 5, gridCol: 5 },
    { slotId: 'd-3', position: 'defender',   gridRow: 5, gridCol: 7 },
    // goalkeeper: centrado
    { slotId: 'g-0', position: 'goalkeeper', gridRow: 7, gridCol: 4 },
  ],
  '4-3-3': [
    { slotId: 'f-0', position: 'forward',    gridRow: 1, gridCol: 1 },
    { slotId: 'f-1', position: 'forward',    gridRow: 1, gridCol: 4 },
    { slotId: 'f-2', position: 'forward',    gridRow: 1, gridCol: 7 },
    { slotId: 'm-0', position: 'midfielder', gridRow: 3, gridCol: 2 },
    { slotId: 'm-1', position: 'midfielder', gridRow: 3, gridCol: 4 },
    { slotId: 'm-2', position: 'midfielder', gridRow: 3, gridCol: 6 },
    { slotId: 'd-0', position: 'defender',   gridRow: 5, gridCol: 1 },
    { slotId: 'd-1', position: 'defender',   gridRow: 5, gridCol: 3 },
    { slotId: 'd-2', position: 'defender',   gridRow: 5, gridCol: 5 },
    { slotId: 'd-3', position: 'defender',   gridRow: 5, gridCol: 7 },
    { slotId: 'g-0', position: 'goalkeeper', gridRow: 7, gridCol: 4 },
  ],
  '3-4-3': [
    { slotId: 'f-0', position: 'forward',    gridRow: 1, gridCol: 1 },
    { slotId: 'f-1', position: 'forward',    gridRow: 1, gridCol: 4 },
    { slotId: 'f-2', position: 'forward',    gridRow: 1, gridCol: 7 },
    { slotId: 'm-0', position: 'midfielder', gridRow: 3, gridCol: 1 },
    { slotId: 'm-1', position: 'midfielder', gridRow: 3, gridCol: 3 },
    { slotId: 'm-2', position: 'midfielder', gridRow: 3, gridCol: 5 },
    { slotId: 'm-3', position: 'midfielder', gridRow: 3, gridCol: 7 },
    { slotId: 'd-0', position: 'defender',   gridRow: 5, gridCol: 2 },
    { slotId: 'd-1', position: 'defender',   gridRow: 5, gridCol: 4 },
    { slotId: 'd-2', position: 'defender',   gridRow: 5, gridCol: 6 },
    { slotId: 'g-0', position: 'goalkeeper', gridRow: 7, gridCol: 4 },
  ],
  '5-4-1': [
    { slotId: 'f-0', position: 'forward',    gridRow: 1, gridCol: 4 },
    { slotId: 'm-0', position: 'midfielder', gridRow: 3, gridCol: 1 },
    { slotId: 'm-1', position: 'midfielder', gridRow: 3, gridCol: 3 },
    { slotId: 'm-2', position: 'midfielder', gridRow: 3, gridCol: 5 },
    { slotId: 'm-3', position: 'midfielder', gridRow: 3, gridCol: 7 },
    { slotId: 'd-0', position: 'defender',   gridRow: 5, gridCol: 1 },
    { slotId: 'd-1', position: 'defender',   gridRow: 5, gridCol: 2 },
    { slotId: 'd-2', position: 'defender',   gridRow: 5, gridCol: 4 },
    { slotId: 'd-3', position: 'defender',   gridRow: 5, gridCol: 6 },
    { slotId: 'd-4', position: 'defender',   gridRow: 5, gridCol: 7 },
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
  /** Slots ya construidos con jugadores desde el padre */
  @Input() squadSlots: PitchSlot[] = [];
  /** Formación activa */
  @Input() formation: string = '4-4-2';
  /** Emite cuando el usuario cambia la formación */
  @Output() formationChange = new EventEmitter<string>();

  readonly formations = ['4-4-2', '4-3-3', '3-4-3', '5-4-1'];

  slots: PitchSlot[] = [];

  private slotsInitialized = false;

  
  ngOnChanges(changes: SimpleChanges): void {
    const squadChanged = changes['squadSlots'];
    const formationChanged = changes['formation'];
    
    if (formationChanged && this.slotsInitialized) {
      // Solo reordenar, no reconstruir desde el Input
      this.rebuildLayout();
      return;
    }
    
    if (squadChanged || (formationChanged && !this.slotsInitialized)) {
      this.buildSlots();
      this.slotsInitialized = true;
    }
  }
  
  private rebuildLayout(): void {
    // Reagrupa los players actuales de this.slots (no del Input)
    const layout = FORMATION_LAYOUTS[this.formation] ?? FORMATION_LAYOUTS['4-4-2'];
    const byPosition: Record<string, PitchPlayer[]> = {
      goalkeeper: [], defender: [], midfielder: [], forward: [],
    };
    for (const slot of this.slots) {
      for (const player of slot.players) {
        if (byPosition[player.position]) byPosition[player.position].push(player);
      }
    }
    this.slots = layout.map(s => {
      const pool = byPosition[s.position] ?? [];
      return { ...s, players: pool.splice(0, 1) };
    });
  }

  onFormationChange(): void {
    this.formationChange.emit(this.formation);
  }
  
  dropSlot(event: CdkDragDrop<PitchPlayer[]>): void {
    if (event.previousContainer === event.container) {
      moveItemInArray(
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );
    } else {
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );
    }
    //this.slots = [...this.slots];
  }

  isSlotMismatch(slot: PitchSlot): boolean {
    return slot.players.some(p => p.position !== slot.position);
  }

  private buildSlots(): void {
    const layout = FORMATION_LAYOUTS[this.formation] ?? FORMATION_LAYOUTS['4-4-2'];

    const byPosition: Record<string, PitchPlayer[]> = {
      goalkeeper: [], defender: [], midfielder: [], forward: [],
    };

    for (const slot of (this.squadSlots ?? [])) {
      for (const player of slot.players) {
        if (byPosition[player.position]) {
          byPosition[player.position].push({ ...player });
        }
      }
    }

    this.slots = layout.map(s => {
      const pool = byPosition[s.position] ?? [];
      const players = pool.splice(0, 1); // empieza con 1 jugador
      return { ...s, players };
    });
  }
}