import { CommonModule } from '@angular/common';
import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { switchMap } from 'rxjs/operators';
import { ApiService } from '../../servicios/api.service';

export interface ResolvedMarketPlayer {
  dependantPlayerId: number;
  realPlayerId: number;
  marketId: number;
  name: string;
  position: string;
  teamName: string;
  totalScore: number;
}

@Component({
  selector: 'app-real-player-market-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './real-player-market-card.component.html',
  styleUrl: './real-player-market-card.component.scss',
})
export class RealPlayerMarketCardComponent implements OnInit {
  /** ID del dependantPlayer que llega desde el *ngFor del padre */
  @Input() dependantPlayerId!: number;
  /** ID del market al que pertenece esta card, para el modal de oferta */
  @Input() marketId!: number;
  /** Emite el jugador resuelto al padre para abrir el modal */
  @Output() bidRequested = new EventEmitter<ResolvedMarketPlayer>();

  player: ResolvedMarketPlayer | null = null;
  isLoading = true;
  hasError = false;

  // Temporales para pasar datos entre los switchMap
  private _pendingRealPlayerId = 0;
  private _pendingRealPlayer: any = null;

  constructor(private readonly apiService: ApiService) {}

  ngOnInit(): void {
    this.resolvePlayer();
  }

  onBidClick(): void {
    if (this.player) {
      this.bidRequested.emit(this.player);
    }
  }

  private resolvePlayer(): void {
    this.isLoading = true;
    this.hasError = false;

    // Paso 1: traer el dependantPlayer por ID
    this.apiService.searchDependantPlayerById(this.dependantPlayerId).pipe(

      // Paso 2: con real_player_id traer el realPlayer
      switchMap((dependantRes: any) => {
        const dependant = dependantRes?.data ?? dependantRes;
        const realPlayerId = Number(dependant?.realPlayer.id ?? dependant?.real_player.id);
        if (!realPlayerId) throw new Error('real_player_id no encontrado en dependantPlayer');

        this._pendingRealPlayerId = realPlayerId;
        return this.apiService.searchRealPlayerById(realPlayerId);
      }),

      // Paso 3: con real_team_id traer el realTeam
      switchMap((realPlayerRes: any) => {
        const realPlayer = realPlayerRes?.data ?? realPlayerRes;
        this._pendingRealPlayer = realPlayer;

        const realTeamId = Number(
          realPlayer?.realTeamId ??
          realPlayer?.real_team_id ??
          this.extractId(realPlayer?.realTeam)
        );

        if (!realTeamId) throw new Error('real_team_id no encontrado en realPlayer');

        return this.apiService.searchRealTeamById(realTeamId);
      }),

    ).subscribe({
      next: (realTeamRes: any) => {
        const realTeam     = realTeamRes?.data ?? realTeamRes;
        const teamName     = realTeam?.name ?? 'Sin equipo';
        const realPlayer   = this._pendingRealPlayer;
        const realPlayerId = this._pendingRealPlayerId;

        // Paso 4: sumar todos los points_obtained de playerPerformances del realPlayer
        this.apiService.searchPlayerPerformances().subscribe({
          next: (perfRes: any) => {
            const performances: any[] = perfRes?.data ?? [];
            const totalScore = this.getTotalPoints(realPlayerId, performances);

            this.player = {
              dependantPlayerId: this.dependantPlayerId,
              realPlayerId,
              marketId: this.marketId,
              name:     realPlayer?.name ?? `Jugador ${realPlayerId}`,
              position: this.normalizePosition(realPlayer?.position),
              teamName,
              totalScore,
            };
            this.isLoading = false;
          },
          error: () => {
            // Si falla performances igualmente se muestra la card con score 0
            this.player = {
              dependantPlayerId: this.dependantPlayerId,
              realPlayerId,
              marketId: this.marketId,
              name:     realPlayer?.name ?? `Jugador ${realPlayerId}`,
              position: this.normalizePosition(realPlayer?.position),
              teamName,
              totalScore: 0,
            };
            this.isLoading = false;
          },
        });
      },
      error: () => {
        this.hasError = true;
        this.isLoading = false;
      },
    });
  }


  private getTotalPoints(realPlayerId: number, performances: any[]): number {
    const playerPerformances = performances.filter((perf: any) => {
      const perfRealPlayerId = Number(
        perf?.realPlayerId ??
        perf?.real_player_id ??
        this.extractId(perf?.realPlayer)
      );
      return perfRealPlayerId === realPlayerId;
    });

    return playerPerformances.reduce((sum: number, perf: any) => {
      return sum + Number(perf?.pointsObtained ?? perf?.points_obtained ?? 0);
    }, 0);
  }

  private normalizePosition(positionRaw: unknown): string {
    const position = String(positionRaw ?? '').toLowerCase();
    if (position.includes('goal')) return 'goalkeeper';
    if (position.includes('def'))  return 'defender';
    if (position.includes('mid'))  return 'midfielder';
    if (position.includes('for') || position.includes('att') || position.includes('strik')) return 'forward';
    return 'midfielder';
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