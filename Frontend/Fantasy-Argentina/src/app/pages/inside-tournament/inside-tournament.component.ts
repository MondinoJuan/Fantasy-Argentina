import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../servicios/api.service';

interface SquadPlayerView {
  id?: number;
  name: string;
  position: string;
  teamName: string;
  lastPoints?: number;
}

interface MarketPlayerView {
  id?: number;
  marketId: number;
  name: string;
  position: string;
  teamName: string;
  lastPoints?: number;
}

@Component({
  selector: 'app-inside-tournament',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './inside-tournament.component.html',
  styleUrl: './inside-tournament.component.scss'
})
export class InsideTournamentComponent implements OnInit {
  readonly formations = ['4-4-2', '4-3-3', '3-4-3', '5-4-1'];
  formationIndex = 0;

  tournament: any = null;
  participant: any = null;
  rivals: any[] = [];

  isLoading = true;
  errorMessage = '';

  squadPlayers: SquadPlayerView[] = [];
  squadSlots: { position: string; player: SquadPlayerView | null }[] = [];
  marketPlayers: MarketPlayerView[] = [];

  existingMarketEntries: any[] = [];
  negotiations: any[] = [];
  bids: any[] = [];

  showBidModal = false;
  selectedMarketPlayer: MarketPlayerView | null = null;
  bidAmount = 0;
  bidError = '';

  rankingMode: 'total' | 'byMatchday' = 'total';
  rankingRows: Array<{ participantName: string; points: number; }> = [];
  matchdaysForTournament: any[] = [];
  selectedMatchdayId: number | null = null;

  private tournamentId: number | null = null;
  private allParticipantSquads: any[] = [];
  private allRealPlayers: any[] = [];
  private allParticipantPoints: any[] = [];
  private allDependantPlayers: any[] = [];
  private allPlayerPerformances: any[] = [];

  constructor(
    private readonly apiService: ApiService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    const paramId = Number(this.route.snapshot.queryParamMap.get('tournamentId'));

    if (!Number.isFinite(paramId) || paramId <= 0) {
      this.errorMessage = 'No se recibió un torneo válido.';
      this.isLoading = false;
      return;
    }

    this.tournamentId = paramId;
    this.loadTournamentPage();
  }

  get selectedFormation(): string {
    return this.formations[this.formationIndex] ?? this.formations[0];
  }

  get participantName(): string {
    return localStorage.getItem('currentUsername') ?? 'Participante';
  }

  get tournamentCode(): string {
    return this.tournament?.publicCode ?? 'Sin código';
  }

  get availableMoney(): number {
    return Number(this.participant?.availableMoney ?? this.participant?.bankBudget ?? 0);
  }

  updateFormationFromSlider(): void {
    this.rebuildSquadFromFormation();
  }

  onRankingModeChange(): void {
    this.rebuildRanking();
  }

  onMatchdayChange(): void {
    this.rebuildRanking();
  }

  goBack(): void {
    this.router.navigate(['/landingPage']);
  }

  openBidModal(player: MarketPlayerView): void {
    this.selectedMarketPlayer = player;
    this.bidAmount = Number(player?.id ? 100 : 0);
    this.bidError = '';
    this.showBidModal = true;
  }

  closeBidModal(): void {
    this.showBidModal = false;
    this.selectedMarketPlayer = null;
    this.bidAmount = 0;
    this.bidError = '';
  }

  submitBid(): void {
    const participantId = this.extractId(this.participant);

    if (!this.selectedMarketPlayer || !participantId || !this.selectedMarketPlayer.id) {
      this.bidError = 'No se pudo identificar el jugador para ofertar.';
      return;
    }

    const amount = Number(this.bidAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      this.bidError = 'Ingresá un monto válido.';
      return;
    }

    if (amount > this.availableMoney) {
      this.bidError = 'El monto supera tu dinero disponible.';
      return;
    }

    this.apiService.postBid({
      matchdayMarket: this.selectedMarketPlayer.marketId,
      participant: participantId,
      realPlayer: this.selectedMarketPlayer.id,
      offeredAmount: amount,
      status: 'active',
      bidDate: new Date(),
    }).subscribe({
      next: () => {
        this.closeBidModal();
        this.loadTournamentPage();
      },
      error: (error) => {
        this.bidError = error?.error?.message ?? 'No se pudo registrar la oferta.';
      },
    });
  }

  private loadTournamentPage(): void {
    this.isLoading = true;
    this.errorMessage = '';

    forkJoin({
      tournaments: this.apiService.searchTournaments(),
      participants: this.apiService.searchParticipants(),
      participantSquads: this.apiService.searchParticipantSquads(),
      realPlayers: this.apiService.searchRealPlayers(),
      matchdayMarkets: this.apiService.searchMatchdayMarkets(),
      negotiations: this.apiService.searchNegotiations(),
      bids: this.apiService.searchBids(),
      matchdays: this.apiService.searchMatchdays(),
      participantMatchdayPoints: this.apiService.searchParticipantMatchdayPoints(),
      dependantPlayers: this.apiService.searchDependantPlayers(),
      playerPerformances: this.apiService.searchPlayerPerformances(),
    }).subscribe({
      next: (response) => {
        const currentUserId = Number(localStorage.getItem('currentUserId'));

        this.tournament = response.tournaments.data.find((item: any) => this.extractId(item) === this.tournamentId) ?? null;
        if (!this.tournament) {
          this.errorMessage = 'No encontramos el torneo solicitado.';
          this.isLoading = false;
          return;
        }

        const tournamentParticipants = response.participants.data.filter((item: any) => this.extractId(item.tournament) === this.tournamentId);

        this.participant = tournamentParticipants.find((item: any) => this.extractId(item.user) === currentUserId) ?? null;
        if (!this.participant) {
          this.errorMessage = 'No estás unido a este torneo.';
          this.isLoading = false;
          return;
        }

        const currentParticipantId = this.extractId(this.participant);
        this.rivals = tournamentParticipants.filter((item: any) => this.extractId(item) !== currentParticipantId);

        this.allParticipantSquads = response.participantSquads.data;
        this.allRealPlayers = response.realPlayers.data;
        this.allParticipantPoints = response.participantMatchdayPoints.data;
        this.allDependantPlayers = response.dependantPlayers?.data ?? [];
        this.allPlayerPerformances = response.playerPerformances?.data ?? [];

        this.existingMarketEntries = response.matchdayMarkets.data.filter((item: any) => this.extractId(item.tournament) === this.tournamentId);
        this.negotiations = response.negotiations.data.filter((item: any) => this.extractId(item.tournament) === this.tournamentId);

        const participantId = this.extractId(this.participant);
        this.bids = response.bids.data.filter((bid: any) => this.extractId(bid.participant) === participantId);

        this.matchdaysForTournament = response.matchdays.data.filter(
          (matchday: any) => this.extractId(matchday.league) === this.extractId(this.tournament.league)
        );

        this.selectedMatchdayId = this.matchdaysForTournament.length > 0
          ? this.extractId(this.matchdaysForTournament[0])
          : null;

        this.rebuildSquadFromFormation();
        this.rebuildMarketFromDatabase();
        this.rebuildRanking();

        this.isLoading = false;
      },
      error: (error) => {
        this.errorMessage = error?.error?.message ?? 'No se pudo cargar el torneo.';
        this.isLoading = false;
      }
    });
  }

  private getLastPoints(realPlayerId: number): number {
    const performances = this.allPlayerPerformances.filter(
      (perf: any) => this.extractId(perf.realPlayer) === realPlayerId
    );
    if (performances.length === 0) return 0;
    // Tomar la más reciente por updateDate
    const latest = performances.reduce((a: any, b: any) =>
      new Date(a.updateDate) > new Date(b.updateDate) ? a : b
    );
    return Number(latest.pointsObtained ?? 0);
  }

  private normalizeIdCollection(value: unknown): number[] {
    if (Array.isArray(value)) {
      return value
        .map((item) => Number.parseInt(String(item), 10))
        .filter((item) => Number.isFinite(item) && item > 0);
    }

    if (typeof value === 'string' && value.trim()) {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          return parsed
            .map((item) => Number.parseInt(String(item), 10))
            .filter((item) => Number.isFinite(item) && item > 0);
        }
      } catch {
        return value
          .split(',')
          .map((item) => Number.parseInt(item.replace(/[\[\]\s]/g, ''), 10))
          .filter((item) => Number.isFinite(item) && item > 0);
      }
    }

    return [];
  }

  private rebuildSquadFromFormation(): void {
    const participantId = this.extractId(this.participant);
    if (!participantId) {
      this.squadPlayers = [];
      return;
    }

    const squadEntry = this.allParticipantSquads.find((item) => this.extractId(item.participant) === participantId);

    const realPlayerIds = this.normalizeIdCollection(
      squadEntry?.realPlayerIds ?? squadEntry?.real_player_ids
    );

    const realPlayers = this.allRealPlayers
      .filter((player) => {
        const id = this.extractId(player);
        return id !== null && realPlayerIds.includes(id);
      });

    const grouped = {
      goalkeeper: realPlayers.filter((player) => this.normalizePosition(player.position) === 'goalkeeper'),
      defender: realPlayers.filter((player) => this.normalizePosition(player.position) === 'defender'),
      midfielder: realPlayers.filter((player) => this.normalizePosition(player.position) === 'midfielder'),
      forward: realPlayers.filter((player) => this.normalizePosition(player.position) === 'forward'),
    };

    const formationNeeded = this.parseFormation(this.selectedFormation);
    const selected = [
      ...this.pickRandom(grouped.goalkeeper, formationNeeded.goalkeeper),
      ...this.pickRandom(grouped.defender, formationNeeded.defender),
      ...this.pickRandom(grouped.midfielder, formationNeeded.midfielder),
      ...this.pickRandom(grouped.forward, formationNeeded.forward),
    ];

    this.squadPlayers = selected.slice(0, 11).map((player) => ({
      id: this.extractId(player) ?? undefined,
      name: player.name ?? `Player ${this.extractId(player) ?? '?'}`,
      position: this.normalizePosition(player.position),
      teamName: player.realTeam?.name ?? 'Sin equipo',
      lastPoints: this.getLastPoints(this.extractId(player) ?? 0),
    }));

    const formation = this.parseFormation(this.selectedFormation);
    const slots: { position: string; player: SquadPlayerView | null }[] = [];

    const addSlots = (pos: string, count: number, pool: any[]) => {
      for (let i = 0; i < count; i++) {
        const player = pool[i] ?? null;
        slots.push({
          position: pos,
          player: player ? {
            id: this.extractId(player) ?? undefined,
            name: player.name,
            position: pos,
            teamName: player.realTeam?.name ?? player.realTeam ?? 'Sin equipo',
            lastPoints: this.getLastPoints(this.extractId(player) ?? 0),
          } : null,
        });
      }
    };

    addSlots('goalkeeper', formation.goalkeeper, grouped.goalkeeper);
    addSlots('defender', formation.defender, grouped.defender);
    addSlots('midfielder', formation.midfielder, grouped.midfielder);
    addSlots('forward', formation.forward, grouped.forward);

    this.squadSlots = slots;
  }

  private rebuildMarketFromDatabase(): void {
    const dependantIds = this.existingMarketEntries.flatMap((entry: any) =>
      this.normalizeIdCollection(entry.dependantPlayerIds ?? entry.dependant_player_ids)
    );

    if (dependantIds.length === 0) {
      this.marketPlayers = [];
      return;
    }

    const uniqueDependantIds = [...new Set(dependantIds)];

    const marketDependants = this.allDependantPlayers.filter((item: any) => {
      const id = this.extractId(item);
      return id !== null && uniqueDependantIds.includes(id);
    });

    this.marketPlayers = marketDependants.map((dependant: any) => {
      const realPlayerId = dependant.realPlayerId ?? dependant.real_player_id;
      const realPlayer = this.allRealPlayers.find(
        (p) => this.extractId(p) === Number(realPlayerId)
      );
      const dependantId = this.extractId(dependant);
      const marketEntry = this.existingMarketEntries.find((entry: any) => {
        if (dependantId === null) return false;
        return this.normalizeIdCollection(
          entry.dependantPlayerIds ?? entry.dependant_player_ids
        ).includes(dependantId);
      });

      return {
        id: this.extractId(realPlayer) ?? undefined,
        marketId: this.extractId(marketEntry) ?? 0,
        name: realPlayer?.name ?? `Player ${realPlayerId ?? '?'}`,
        position: this.normalizePosition(realPlayer?.position),
        teamName: realPlayer?.realTeam?.name ?? realPlayer?.realTeam ?? 'Sin equipo',
        lastPoints: this.getLastPoints(this.extractId(realPlayer) ?? 0),
      };
    });
  }

  private rebuildRanking(): void {
    const tournamentParticipants = [this.participant, ...this.rivals].filter(Boolean);

    if (tournamentParticipants.length === 0 && this.participant) {
      this.rankingRows = [{
        participantName: this.resolveParticipantName(this.participant), // ← cambio aquí
        points: Number(this.participant?.totalScore ?? 0)
      }];
      return;
    }

    if (this.rankingMode === 'total') {
      this.rankingRows = tournamentParticipants
        .map((participant) => ({
          participantName: this.resolveParticipantName(participant),
          points: Number(participant?.totalScore ?? 0),
        }))
        .sort((a, b) => b.points - a.points);
      return;
    }

    const selectedMatchdayId = this.selectedMatchdayId;

    if (!selectedMatchdayId) {
      this.rankingRows = tournamentParticipants
        .map((participant) => ({
          participantName: this.resolveParticipantName(participant),
          points: Number(participant?.totalScore ?? 0),
        }))
        .sort((a, b) => b.points - a.points);
      return;
    }

    this.rankingRows = tournamentParticipants
      .map((participant) => {
        const participantId = this.extractId(participant);
        const row = this.allParticipantPoints.find((points) =>
          this.extractId(points.participant) === participantId && this.extractId(points.matchday) === selectedMatchdayId
        );

        return {
          participantName: this.resolveParticipantName(participant),
          points: Number(row?.matchdayPoints ?? 0),
        };
      })
      .sort((a, b) => b.points - a.points);
  }

  private resolveParticipantName(participant: any): string {
    if (participant?.user && typeof participant.user === 'object' && participant.user.username) {
      return participant.user.username;
    }

    const participantId = this.extractId(participant);
    const currentParticipantId = this.extractId(this.participant);
    if (participantId !== null && currentParticipantId !== null && participantId === currentParticipantId) {
      return this.participantName;
    }

    return `Participant #${participantId ?? '?'}`;
  }

  private parseFormation(formation: string): { goalkeeper: number; defender: number; midfielder: number; forward: number; } {
    switch (formation) {
      case '4-3-3':
        return { goalkeeper: 1, defender: 4, midfielder: 3, forward: 3 };
      case '3-4-3':
        return { goalkeeper: 1, defender: 3, midfielder: 4, forward: 3 };
      case '5-4-1':
        return { goalkeeper: 1, defender: 5, midfielder: 4, forward: 1 };
      case '4-4-2':
      default:
        return { goalkeeper: 1, defender: 4, midfielder: 4, forward: 2 };
    }
  }

  private normalizePosition(positionRaw: unknown): string {
    const position = String(positionRaw ?? '').toLowerCase();
    if (position.includes('goal')) return 'goalkeeper';
    if (position.includes('def')) return 'defender';
    if (position.includes('mid')) return 'midfielder';
    if (position.includes('for') || position.includes('att') || position.includes('strik')) return 'forward';
    return 'midfielder';
  }

  private pickRandom<T>(values: T[], limit: number): T[] {
    const clone = [...values];
    const selected: T[] = [];

    while (clone.length > 0 && selected.length < limit) {
      const index = Math.floor(Math.random() * clone.length);
      selected.push(clone[index]);
      clone.splice(index, 1);
    }

    return selected;
  }

  private extractId(value: unknown): number | null {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }

    if (typeof value === 'string' && value.trim()) {
      const parsed = Number.parseInt(value.trim(), 10);
      return Number.isFinite(parsed) ? parsed : null;
    }

    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;

      if (record['id'] !== undefined) {
        return this.extractId(record['id']);
      }

      if (record['userId'] !== undefined) {
        return this.extractId(record['userId']);
      }

      if (record['participantId'] !== undefined) {
        return this.extractId(record['participantId']);
      }
    }

    return null;
  }

  // Variables para drag & drop
  draggedIndex: number | null = null;
  dragOverIndex: number | null = null;

  onDragStart(event: DragEvent, index: number): void {
    this.draggedIndex = index;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/html', index.toString());
    }
  }

  onDragEnd(event: DragEvent): void {
    this.draggedIndex = null;
    this.dragOverIndex = null;
  }

  onDragOver(event: DragEvent, index: number): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    this.dragOverIndex = index;
  }

  onDragLeave(event: DragEvent): void {
    this.dragOverIndex = null;
  }

  onDrop(event: DragEvent, dropIndex: number): void {
    event.preventDefault();
    
    if (this.draggedIndex === null || this.draggedIndex === dropIndex) {
      this.draggedIndex = null;
      this.dragOverIndex = null;
      return;
    }

    // Intercambiar las posiciones de los jugadores
    const temp = this.squadSlots[this.draggedIndex];
    this.squadSlots[this.draggedIndex] = this.squadSlots[dropIndex];
    this.squadSlots[dropIndex] = temp;

    this.draggedIndex = null;
    this.dragOverIndex = null;
  }
}
