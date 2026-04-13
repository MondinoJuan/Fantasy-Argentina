import { CommonModule } from '@angular/common';
import { Component, Input, Output, EventEmitter, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';
import { ApiService } from '../../servicios/api.service';

export interface ResolvedMarketPlayer {
  dependantPlayerId: number;
  realPlayerId: number;
  marketId: number;
  name: string;
  position: string;
  teamName: string;
  totalScore: number;
  totalBids: number;
  translatedValue: number | null;
}

@Component({
  selector: 'app-real-player-market-card',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './real-player-market-card.component.html',
  styleUrl: './real-player-market-card.component.scss',
})
export class RealPlayerMarketCardComponent implements OnInit, OnChanges {
  @Input() dependantPlayerId!: number;
  @Input() marketId!: number;
  @Input() tournamentId!: number;
  @Input() leagueId: number | null = null;
  @Input() participantId!: number;
  @Input() availableMoney = 0;
  @Input() dependantPlayersById: Record<number, any> = {};
  @Input() realPlayersById: Record<number, any> = {};
  @Input() realTeamNameById: Record<number, string> = {};
  @Input() performancesByRealPlayerId: Record<number, number> = {};
  @Input() bidsByRealPlayerId: Record<number, any[]> = {};
  @Output() bidSaved = new EventEmitter<void>();

  player: ResolvedMarketPlayer | null = null;
  isLoading = true;
  hasError = false;

  showBidModal = false;
  bidAmount = 0;
  bidError = '';
  existingBidForSelectedPlayer: any = null;

  private _pendingRealPlayerId = 0;
  private _pendingRealPlayer: any = null;

  constructor(private readonly apiService: ApiService) {}

  ngOnInit(): void {
    this.resolvePlayer();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['dependantPlayersById'] || changes['realPlayersById'] || changes['performancesByRealPlayerId'] || changes['bidsByRealPlayerId']) {
      this.resolvePlayer();
    }
  }


  onBidClick(): void {
    this.bidAmount = Number(this.player?.translatedValue ?? 0);
    this.bidError = '';
    this.existingBidForSelectedPlayer = null;
    this.showBidModal = true;

    if (!this.tournamentId || !this.participantId || !this.player?.realPlayerId) return;

    const prefetchedBids = this.bidsByRealPlayerId[this.player.realPlayerId] ?? [];
    if (prefetchedBids.length > 0) {
      const participantBid = prefetchedBids.find((bid: any) => this.extractId(bid.participant) === this.participantId);
      if (participantBid) {
        this.existingBidForSelectedPlayer = participantBid;
        this.bidAmount = Number(participantBid?.offeredAmount ?? 100);
      }
      return;
    }

    this.apiService.searchBidsByTournamentAndRealPlayer(this.tournamentId, this.player.realPlayerId).subscribe({
      next: (response) => {
        const participantBid = (response?.data ?? []).find((bid: any) => this.extractId(bid.participant) === this.participantId);
        if (participantBid) {
          this.existingBidForSelectedPlayer = participantBid;
          this.bidAmount = Number(participantBid?.offeredAmount ?? 100);
        }
      },
      error: () => {
        this.existingBidForSelectedPlayer = null;
      },
    });
  }

  closeBidModal(): void {
    this.showBidModal = false;
    this.bidAmount = 0;
    this.bidError = '';
    this.existingBidForSelectedPlayer = null;
  }

  submitBid(): void {
    if (!this.player?.realPlayerId || !this.participantId) {
      this.bidError = 'No se pudo identificar el jugador para ofertar.';
      return;
    }

    const amount = Number(this.bidAmount);
    const previousAmount = Number(this.existingBidForSelectedPlayer?.offeredAmount ?? 0);
    const requiredIncrement = amount - previousAmount;
    const translatedValue = Number(this.player?.translatedValue ?? 0);

    if (!Number.isFinite(amount) || amount < 0) {
      this.bidError = 'Ingresá un monto válido.';
      return;
    }

    if (amount !== 0 && amount < translatedValue) {
      this.bidError = `La oferta debe ser 0 o al menos $${translatedValue}.`;
      return;
    }

    if (requiredIncrement > Number(this.availableMoney)) {
      this.bidError = 'El monto supera tu dinero disponible.';
      return;
    }

    const existingBidId = this.extractId(this.existingBidForSelectedPlayer);

    const request$ = existingBidId
      ? this.apiService.patchBid({
          id: existingBidId,
          offeredAmount: amount,
          bidDate: new Date(),
          status: 'active',
        })
      : this.apiService.postBid({
          matchdayMarket: this.marketId,
          participant: this.participantId,
          tournament: Number(this.tournamentId),
          realPlayer: this.player.realPlayerId,
          offeredAmount: amount,
          status: 'active',
          bidDate: new Date(),
        });

    request$.subscribe({
      next: () => {
        this.closeBidModal();
        this.bidSaved.emit();
        this.resolvePlayer();
      },
      error: (error) => {
        this.bidError = error?.error?.message ?? 'No se pudo registrar la oferta.';
      },
    });
  }

  private resolvePlayer(): void {
    this.isLoading = true;
    this.hasError = false;

    const dependant = this.dependantPlayersById[this.dependantPlayerId];
    const realPlayerIdFromCache = this.extractId(dependant?.realPlayer ?? dependant?.real_player);
    const cachedRealPlayer = realPlayerIdFromCache ? this.realPlayersById[realPlayerIdFromCache] : null;

    if (dependant && cachedRealPlayer) {
      const leagueId = Number(this.leagueId ?? 0);
      const applyPlayer = (leagueValues: any[]) => {
          const realPlayerId = this.extractId(cachedRealPlayer) ?? realPlayerIdFromCache ?? 0;
          const realTeamId = Number(
            cachedRealPlayer?.realTeamId ??
            cachedRealPlayer?.real_team_id ??
            this.extractId(cachedRealPlayer?.realTeam)
          );

          const translatedValue = leagueValues.find((v: any) => Number(v.realPlayerId) === realPlayerId)?.translatedValue ?? null;

          this.player = {
            dependantPlayerId: this.dependantPlayerId,
            realPlayerId,
            marketId: this.marketId,
            name: cachedRealPlayer?.name ?? `Jugador ${realPlayerId}`,
            position: this.normalizePosition(cachedRealPlayer?.position),
            teamName: this.realTeamNameById[realTeamId] ?? 'Sin equipo',
            totalScore: Number(this.performancesByRealPlayerId[realPlayerId] ?? 0),
            totalBids: Number((this.bidsByRealPlayerId[realPlayerId] ?? []).length),
            translatedValue,
          };
          this.isLoading = false;
      };

      if (!Number.isFinite(leagueId) || leagueId <= 0) {
        applyPlayer([]);
        return;
      }

      this.apiService.searchRealPlayerLeagueValuesByLeagueId(leagueId).subscribe({
        next: (response: any) => {
          applyPlayer(Array.isArray(response?.data) ? response.data : []);
        },
        error: () => {
          this.hasError = true;
          this.isLoading = false;
        },
      });
      return;
    }

    // For non-cached case
    const leagueId = Number(this.leagueId ?? 0);
    if (!Number.isFinite(leagueId) || leagueId <= 0) {
      this.hasError = true;
      this.isLoading = false;
      return;
    }

    this.apiService.searchDependantPlayerById(this.dependantPlayerId).pipe(
      map((dependantRes: any) => ({
        dependant: dependantRes?.data ?? dependantRes,
        leagueId,
      })),
      switchMap(({ dependant, leagueId }) => {
        const realPlayerId = Number(dependant?.realPlayer?.id ?? dependant?.real_player?.id);
        if (!realPlayerId) throw new Error('real_player_id no encontrado en dependantPlayer');

        this._pendingRealPlayerId = realPlayerId;
        return this.apiService.searchRealPlayerById(realPlayerId).pipe(
          map((realPlayerRes: any) => ({
            realPlayer: realPlayerRes?.data ?? realPlayerRes,
            leagueId
          }))
        );
      }),
      switchMap(({ realPlayer, leagueId }) => {
        this._pendingRealPlayer = realPlayer;

        const realTeamId = Number(
          realPlayer?.realTeamId ??
          realPlayer?.real_team_id ??
          this.extractId(realPlayer?.realTeam)
        );

        if (!realTeamId) throw new Error('real_team_id no encontrado en realPlayer');

        return this.apiService.searchRealTeamById(realTeamId).pipe(
          map((realTeamRes: any) => ({
            realTeam: realTeamRes?.data ?? realTeamRes,
            leagueId
          }))
        );
      }),
      switchMap(({ realTeam, leagueId }) => {
        return this.apiService.searchRealPlayerLeagueValuesByLeagueId(leagueId).pipe(
          map((leagueValuesRes: any) => ({
            realTeam,
            leagueValues: leagueValuesRes?.data ?? []
          }))
        );
      }),
      switchMap(({ realTeam, leagueValues }) => {
        const realPlayerId = this._pendingRealPlayerId;
        return forkJoin({
          performances: this.apiService.searchPlayerPerformances(),
          bidsInfo: this.apiService.searchBidsByTournamentAndRealPlayer(this.tournamentId, realPlayerId),
        }).pipe(
          map(({ performances, bidsInfo }) => ({
            realTeam,
            leagueValues,
            performances: performances?.data ?? [],
            bidsInfo
          }))
        );
      })
    ).subscribe({
      next: ({ realTeam, leagueValues, performances, bidsInfo }) => {
        const teamName = realTeam?.name ?? 'Sin equipo';
        const realPlayer = this._pendingRealPlayer;
        const realPlayerId = this._pendingRealPlayerId;

        const translatedValue = leagueValues.find((v: any) => v.realPlayerId === realPlayerId)?.translatedValue ?? null;
        const totalScore = this.getTotalPoints(realPlayerId, performances);

        this.player = {
          dependantPlayerId: this.dependantPlayerId,
          realPlayerId,
          marketId: this.marketId,
          name: realPlayer?.name ?? `Jugador ${realPlayerId}`,
          position: this.normalizePosition(realPlayer?.position),
          teamName,
          totalScore,
          totalBids: Number(bidsInfo?.totalParticipants ?? bidsInfo?.totalBids ?? bidsInfo?.data?.length ?? 0),
          translatedValue,
        };
        this.isLoading = false;
      },
      error: () => {
        this.hasError = true;
        this.isLoading = false;
      },
    });
  }

  isBidInvalid(): boolean {
    if (!this.player) return true;

    const amount = Number(this.bidAmount);
    const translatedValue = Number(this.player.translatedValue ?? 0);
    const previousAmount = Number(this.existingBidForSelectedPlayer?.offeredAmount ?? 0);
    const requiredIncrement = amount - previousAmount;

    if (!Number.isFinite(amount) || amount < 0) return true;
    if (amount !== 0 && amount < translatedValue) return true;
    if (requiredIncrement > Number(this.availableMoney)) return true;

    return false;
  }

  private getTotalPoints(realPlayerId: number, performances: any[]): number {
    const playerPerformances = performances.filter((perf: any) => {
      const perfRealPlayerId = Number(
        perf?.realPlayerId ??
        perf?.real_player_id ??
        this.extractId(perf?.realPlayer),
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
    if (position.includes('def')) return 'defender';
    if (position.includes('mid')) return 'midfielder';
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
