import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiService } from '../../servicios/api.service';
import { RequestCacheService } from '../../servicios/request-cache.service';
import { FootballPitchComponent, PitchPlayer } from '../../components/football-pitch/football-pitch.component';
import { RealPlayerMarketCardComponent } from '../../components/real-player-market-card/real-player-market-card.component';
import { RivalsRealPlayerListComponent } from '../../components/rivals-real-player-list/rivals-real-player-list.component';

interface SquadPlayerView {
  id?: number;
  name: string;
  position: string;
  teamName: string;
  lastScore?: number;
}

@Component({
  selector: 'app-inside-tournament',
  standalone: true,
  imports: [CommonModule, FormsModule, FootballPitchComponent, RealPlayerMarketCardComponent, RivalsRealPlayerListComponent],
  templateUrl: './inside-tournament.component.html',
  styleUrl: './inside-tournament.component.scss'
})
export class InsideTournamentComponent implements OnInit {
  readonly formations = ['4-4-2', '4-3-3', '3-4-3', '5-4-1'];
  selectedFormation = this.formations[0];

  tournament: any = null;
  participant: any = null;
  rivals: any[] = [];
  participantsOrdered: any[] = [];

  isLoading = true;
  errorMessage = '';

  squadPlayers: SquadPlayerView[] = [];
  substitutePlayers: SquadPlayerView[] = [];
  existingMarketEntries: any[] = [];
  negotiations: any[] = [];
  bids: any[] = [];
  startingPlayersForPitch: PitchPlayer[] = [];
  substitutePlayersForPitch: PitchPlayer[] = [];
  marketDependantIds: Array<{ dependantPlayerId: number; marketId: number }> = [];
  filteredMarketDependantIds: Array<{ dependantPlayerId: number; marketId: number }> = [];
  marketSearchTerm = '';
  marketPositionFilter = 'all';
  marketSortOption: 'nameAsc' | 'nameDesc' | 'scoreDesc' | 'scoreAsc' = 'nameAsc';
  showLoggedParticipantBids = false;

  marketDependantById: Record<number, any> = {};
  marketRealPlayerById: Record<number, any> = {};
  marketRealTeamNameById: Record<number, string> = {};
  marketPerformanceByRealPlayerId: Record<number, number> = {};
  marketBidsByRealPlayerId: Record<number, any[]> = {};

  selectedRankingScope: 'total' | number = 'total';
  rankingRows: Array<{ participantName: string; points: number; }> = [];
  matchdaysForTournament: any[] = [];

  participantSquadId: number | null = null;
  participantCaptainRealPlayerId: number | null = null;

  private tournamentId: number | null = null;
  tournamentLeagueId: number | null = null;
  private allParticipantSquads: any[] = [];
  private allRealPlayers: any[] = [];
  private allRealTeams: any[] = [];
  private allParticipantPoints: any[] = [];
  allPlayerPerformances: any[] = [];
  allDependantPlayers: any[] = [];
  allPlayerClauses: any[] = [];

  participantById = new Map<number, any>();
  realPlayerById = new Map<number, any>();
  dependantByRealPlayerId = new Map<number, any>();
  playerClauseByDependantId = new Map<number, any>();
  visibleNegotiations: any[] = [];
  showAcceptedNegotiations = false;
  showNegotiationAmountModal = false;
  negotiationForAmountEdit: any = null;
  negotiationAmountInput = 0;
  negotiationAmountError = '';
  isSavingNegotiationAmount = false;
  private serverClockSkewMs = 0;

  constructor(
    private readonly apiService: ApiService,
    private readonly requestCacheService: RequestCacheService,
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

  get participantName(): string {
    return localStorage.getItem('currentUsername') ?? 'Participante';
  }

  get tournamentCode(): string {
    return this.tournament?.publicCode ?? 'Sin código';
  }


  get rankingScopeOptions(): Array<{ value: 'total' | number; label: string }> {
    const matchdayOptions = [...this.matchdaysForTournament]
      .sort((left: any, right: any) => Number(left?.matchdayNumber ?? 0) - Number(right?.matchdayNumber ?? 0))
      .map((matchday: any) => ({
        value: this.extractId(matchday) ?? 0,
        label: `Fecha ${Number(matchday?.matchdayNumber ?? 0)}`,
      }))
      .filter((option) => option.value > 0);

    return [{ value: 'total', label: 'Total' }, ...matchdayOptions];
  }

  get availableMoney(): number {
    return Number(this.participant?.availableMoney ?? this.participant?.bankBudget ?? 0);
  }

  get loggedParticipantBidSummaries(): Array<{ bidId: number; realPlayerName: string; amount: number }> {
    const participantId = this.loggedParticipantId;
    if (!participantId) return [];

    return this.bids
      .filter((bid: any) => this.extractId(bid?.participant) === participantId)
      .map((bid: any) => {
        const realPlayerId = this.extractId(bid?.realPlayer);
        const realPlayer = realPlayerId ? this.marketRealPlayerById[realPlayerId] : null;
        const fallbackPlayer = realPlayerId ? this.allRealPlayers.find((player: any) => this.extractId(player) === realPlayerId) : null;
        const amount = Number(bid?.offeredAmount ?? bid?.monto ?? 0);

        return {
          bidId: this.extractId(bid) ?? 0,
          realPlayerName: String(realPlayer?.name ?? fallbackPlayer?.name ?? `Player #${realPlayerId ?? '?'}`),
          amount: Number.isFinite(amount) ? amount : 0,
        };
      });
  }

  onRankingScopeChange(): void {
    this.rebuildRanking();
  }

  goBack(): void {
    this.router.navigate(['/landingPage']);
  }

  onBidSaved(): void {
    this.refreshTournamentState('bid');
  }

  onSquadSaved(): void {
    this.refreshTournamentState('squad');
  }

  onMarketFiltersChange(): void {
    this.applyMarketFilters();
  }

  onNegotiationVisibilityToggle(): void {
    this.rebuildMapsAndNegotiationViews();
  }

  private loadTournamentPage(): void {
    this.isLoading = true;
    this.errorMessage = '';

    forkJoin({
      tournaments: this.requestCacheService.getOrSet('tournaments', () => this.apiService.searchTournaments(), 60_000),
      participants: this.requestCacheService.getOrSet('participants', () => this.apiService.searchParticipants(), 20_000),
      participantSquads: this.requestCacheService.getOrSet('participant-squads', () => this.apiService.searchParticipantSquads(), 20_000),
      realPlayers: this.requestCacheService.getOrSet('real-players', () => this.apiService.searchRealPlayers(), 120_000),
      realTeams: this.requestCacheService.getOrSet('real-teams', () => this.apiService.searchRealTeams(), 120_000),
      dependantPlayers: this.requestCacheService.getOrSet('dependant-players', () => this.apiService.searchDependantPlayers(), 20_000),
      playerClauses: this.requestCacheService.getOrSet('player-clauses', () => this.apiService.searchPlayerClauses(), 20_000),
      matchdayMarkets: this.requestCacheService.getOrSet('matchday-markets', () => this.apiService.searchMatchdayMarkets(), 20_000),
      negotiations: this.requestCacheService.getOrSet('negotiations', () => this.apiService.searchNegotiations(), 15_000),
      bids: this.requestCacheService.getOrSet('bids', () => this.apiService.searchBids(), 15_000),
      matchdays: this.requestCacheService.getOrSet('matchdays', () => this.apiService.searchMatchdays(), 120_000),
      participantMatchdayPoints: this.requestCacheService.getOrSet('participant-matchday-points', () => this.apiService.searchParticipantMatchdayPoints(), 20_000),
      playerPerformances: this.requestCacheService.getOrSet('player-performances', () => this.apiService.searchPlayerPerformances(), 20_000),
      serverTime: this.apiService.getServerTime().pipe(catchError(() => of(null))),
    }).subscribe({
      next: (response) => {
        const serverNowMs = Number(response.serverTime?.data?.nowMs);
        if (Number.isFinite(serverNowMs) && serverNowMs > 0) {
          this.serverClockSkewMs = serverNowMs - Date.now();
        }

        const currentUserId = Number(localStorage.getItem('currentUserId'));

        this.tournament = response.tournaments.data.find((item: any) => this.extractId(item) === this.tournamentId) ?? null;
        if (!this.tournament) {
          this.errorMessage = 'No encontramos el torneo solicitado.';
          this.isLoading = false;
          return;
        }
        this.tournamentLeagueId = this.extractId(this.tournament?.league);

        const tournamentParticipants = response.participants.data.filter((item: any) => this.extractId(item.tournament) === this.tournamentId);

        this.participant = tournamentParticipants.find((item: any) => this.extractId(item.user) === currentUserId) ?? null;
        if (!this.participant) {
          this.errorMessage = 'No estás unido a este torneo.';
          this.isLoading = false;
          return;
        }

        const currentParticipantId = this.extractId(this.participant);
        this.rivals = tournamentParticipants.filter((item: any) => this.extractId(item) !== currentParticipantId);
        this.participantsOrdered = [
          ...tournamentParticipants.filter((item: any) => this.extractId(item) === currentParticipantId),
          ...tournamentParticipants.filter((item: any) => this.extractId(item) !== currentParticipantId),
        ];

        this.allParticipantSquads = response.participantSquads.data;
        this.allRealPlayers = response.realPlayers.data;
        this.allRealTeams = response.realTeams?.data ?? [];
        this.allDependantPlayers = response.dependantPlayers?.data ?? [];
        this.allPlayerClauses = response.playerClauses?.data ?? [];
        this.allParticipantPoints = response.participantMatchdayPoints.data;
        this.allPlayerPerformances = response.playerPerformances?.data ?? [];

        this.existingMarketEntries = response.matchdayMarkets.data.filter((item: any) => this.extractId(item.tournament) === this.tournamentId);
        this.negotiations = response.negotiations.data.filter((item: any) =>
          this.extractId(item.tournament) === this.tournamentId
          && !this.isHiddenNegotiationStatus(item?.status)
        );

        this.bids = response.bids.data.filter((bid: any) => this.extractId(bid.tournament) === this.tournamentId);

        this.matchdaysForTournament = response.matchdays.data
          .filter((matchday: any) => this.extractId(matchday.league) === this.extractId(this.tournament.league))
          .sort((left: any, right: any) => Number(left?.matchdayNumber ?? 0) - Number(right?.matchdayNumber ?? 0));

        this.selectedRankingScope = 'total';
        this.rebuildMapsAndNegotiationViews();

        this.rebuildSquadFromFormation();
        this.rebuildMarketFromDatabase();
        this.rebuildMarketReferenceData();
        this.rebuildRanking();

        this.isLoading = false;
      },
      error: (error) => {
        this.errorMessage = error?.error?.message ?? 'No se pudo cargar el torneo.';
        this.isLoading = false;
      }
    });
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
      this.substitutePlayers = [];
      this.startingPlayersForPitch = [];
      this.substitutePlayersForPitch = [];
      this.participantSquadId = null;
      this.participantCaptainRealPlayerId = null;
      return;
    }

    const squadEntry = this.allParticipantSquads.find((item) => this.extractId(item.participant) === participantId);
    this.participantSquadId = this.extractId(squadEntry);
    this.participantCaptainRealPlayerId = this.extractId(
      squadEntry?.captainRealPlayerId ?? squadEntry?.captain_real_player_id
    );

    this.selectedFormation = String(squadEntry?.formation ?? this.formations[0]);

    const startingRealPlayerIds = this.normalizeIdCollection(
      squadEntry?.startingRealPlayersIds ?? squadEntry?.starting_real_players_ids ?? squadEntry?.realPlayerIds ?? squadEntry?.real_player_ids
    );

    const substitutesRealPlayersIds = this.normalizeIdCollection(
      squadEntry?.substitutesRealPlayersIds ?? squadEntry?.substitutes_real_players_ids
    );

    const mapToPlayerView = (player: any): SquadPlayerView => ({
      id: this.extractId(player) ?? undefined,
      name: player.name ?? `Player ${this.extractId(player) ?? '?'}`,
      position: String(player.position ?? ''),
      teamName: player.realTeam?.name ?? 'Sin equipo',
    });

    const realPlayerById = new Map<number, any>();
    for (const player of this.allRealPlayers) {
      const id = this.extractId(player);
      if (id !== null) {
        realPlayerById.set(id, player);
      }
    }

    this.squadPlayers = startingRealPlayerIds
      .map((id) => realPlayerById.get(id))
      .filter((player) => !!player)
      .map(mapToPlayerView);

    this.substitutePlayers = substitutesRealPlayersIds
      .map((id) => realPlayerById.get(id))
      .filter((player) => !!player)
      .map(mapToPlayerView);

    this.startingPlayersForPitch = this.squadPlayers.map((player) => ({ ...player }));
    this.substitutePlayersForPitch = this.substitutePlayers.map((player) => ({ ...player }));
  }

  private rebuildMarketFromDatabase(): void {
    this.marketDependantIds = this.existingMarketEntries.flatMap((entry: any) => {
      const marketId = this.extractId(entry) ?? 0;
      const dependantIds = this.normalizeIdCollection(
        entry.dependantPlayerIds
        ?? entry.dependant_player_ids
        ?? entry.dependantPlayersIds
        ?? entry.dependant_players_ids
        ?? entry.dependantPlayerId
        ?? entry.dependant_player_id
        ?? entry.dependantPlayer
        ?? entry.dependant_player
      );
      return dependantIds.map(depId => ({
        dependantPlayerId: depId,
        marketId,
      }));
    });
    this.applyMarketFilters();
  }

  private rebuildMarketReferenceData(): void {
    const dependantById: Record<number, any> = {};
    for (const dependant of this.allDependantPlayers) {
      const dependantId = this.extractId(dependant);
      if (dependantId) {
        dependantById[dependantId] = dependant;
      }
    }

    const realPlayerById: Record<number, any> = {};
    for (const player of this.allRealPlayers) {
      const playerId = this.extractId(player);
      if (playerId) {
        realPlayerById[playerId] = { ...player };
      }
    }

    const teamNameById: Record<number, string> = {};
    for (const team of this.allRealTeams) {
      const teamId = this.extractId(team);
      if (teamId) {
        teamNameById[teamId] = String(team?.name ?? 'Sin equipo');
      }
    }

    const performanceByRealPlayerId: Record<number, number> = {};
    for (const perf of this.allPlayerPerformances) {
      const realPlayerId = this.extractId((perf as any)?.realPlayer);
      if (!realPlayerId) continue;
      performanceByRealPlayerId[realPlayerId] = Number(performanceByRealPlayerId[realPlayerId] ?? 0) + Number((perf as any)?.pointsObtained ?? 0);
    }

    const bidsByRealPlayerId: Record<number, any[]> = {};
    for (const bid of this.bids) {
      const realPlayerId = this.extractId((bid as any)?.realPlayer);
      if (!realPlayerId) continue;
      if (!Array.isArray(bidsByRealPlayerId[realPlayerId])) {
        bidsByRealPlayerId[realPlayerId] = [];
      }
      bidsByRealPlayerId[realPlayerId].push(bid);
    }

    this.marketDependantById = dependantById;
    this.marketRealPlayerById = realPlayerById;
    this.marketRealTeamNameById = teamNameById;
    this.marketPerformanceByRealPlayerId = performanceByRealPlayerId;
    this.marketBidsByRealPlayerId = bidsByRealPlayerId;
    this.applyMarketFilters();
  }

  get marketPositionOptions(): Array<{ value: string; label: string }> {
    return [
      { value: 'all', label: 'Todas las posiciones' },
      { value: 'goalkeeper', label: 'Arquero' },
      { value: 'defender', label: 'Defensor' },
      { value: 'midfielder', label: 'Mediocampista' },
      { value: 'forward', label: 'Delantero' },
    ];
  }

  private applyMarketFilters(): void {
    const term = this.marketSearchTerm.trim().toLocaleLowerCase();
    const selectedPosition = this.marketPositionFilter;

    let visible = [...this.marketDependantIds].filter((item) => {
      const dependant = this.marketDependantById[item.dependantPlayerId];
      const realPlayerId = this.extractId(dependant?.realPlayer ?? dependant?.real_player);
      const realPlayer = realPlayerId ? this.marketRealPlayerById[realPlayerId] : null;
      const name = String(realPlayer?.name ?? '').toLocaleLowerCase();
      const position = String(realPlayer?.position ?? '').toLocaleLowerCase();

      const matchesName = !term || name.includes(term);
      const matchesPosition = selectedPosition === 'all' || position === selectedPosition;
      return matchesName && matchesPosition;
    });

    visible.sort((left, right) => {
      const leftDependant = this.marketDependantById[left.dependantPlayerId];
      const rightDependant = this.marketDependantById[right.dependantPlayerId];
      const leftRealPlayerId = this.extractId(leftDependant?.realPlayer ?? leftDependant?.real_player);
      const rightRealPlayerId = this.extractId(rightDependant?.realPlayer ?? rightDependant?.real_player);
      const leftPlayer = leftRealPlayerId ? this.marketRealPlayerById[leftRealPlayerId] : null;
      const rightPlayer = rightRealPlayerId ? this.marketRealPlayerById[rightRealPlayerId] : null;

      const leftName = String(leftPlayer?.name ?? '');
      const rightName = String(rightPlayer?.name ?? '');
      const leftScore = Number(this.marketPerformanceByRealPlayerId[leftRealPlayerId ?? 0] ?? 0);
      const rightScore = Number(this.marketPerformanceByRealPlayerId[rightRealPlayerId ?? 0] ?? 0);

      if (this.marketSortOption === 'nameDesc') {
        return rightName.localeCompare(leftName, 'es');
      }

      if (this.marketSortOption === 'scoreDesc') {
        return rightScore - leftScore;
      }

      if (this.marketSortOption === 'scoreAsc') {
        return leftScore - rightScore;
      }

      return leftName.localeCompare(rightName, 'es');
    });

    this.filteredMarketDependantIds = visible;
  }

  private rebuildRanking(): void {
    const tournamentParticipants = [this.participant, ...this.rivals].filter(Boolean);

    if (tournamentParticipants.length === 0 && this.participant) {
      this.rankingRows = [{ participantName: this.participantName, points: Number(this.participant?.totalScore ?? 0) }];
      return;
    }

    if (this.selectedRankingScope === 'total') {
      this.rankingRows = tournamentParticipants
        .map((participant) => ({
          participantName: this.resolveParticipantName(participant),
          points: Number(participant?.totalScore ?? 0),
        }))
        .sort((a, b) => b.points - a.points);
      return;
    }

    const selectedMatchdayId = Number(this.selectedRankingScope);

    if (!Number.isFinite(selectedMatchdayId) || selectedMatchdayId <= 0) {
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

  get loggedParticipantId(): number {
    return this.extractId(this.participant) ?? 0;
  }

  get isClauseEnabled(): boolean {
    const clauseDate = this.tournament?.clauseEnableDate ? new Date(this.tournament.clauseEnableDate) : null;
    if (!clauseDate || Number.isNaN(clauseDate.getTime())) {
      return false;
    }

    return clauseDate.getTime() <= Date.now() + this.serverClockSkewMs;
    //return true;
  }

  getParticipantSquad(participant: any): any | null {
    const participantId = this.extractId(participant);
    if (!participantId) return null;
    return this.allParticipantSquads.find((item) => this.extractId(item.participant) === participantId) ?? null;
  }

  getNegotiationPlayerName(negotiation: any): string {
    const dependantId = this.extractId(negotiation?.dependantPlayer) ?? 0;
    const dependant = this.allDependantPlayers.find((item) => this.extractId(item) === dependantId);
    const realPlayerId = this.extractId(dependant?.realPlayer) ?? 0;
    const realPlayer = this.realPlayerById.get(realPlayerId);
    return realPlayer?.name ?? `Jugador #${realPlayerId || '?'}`;
  }

  isNegotiationBuyer(negotiation: any): boolean {
    return this.extractId(negotiation?.buyerParticipant) === this.loggedParticipantId;
  }

  canCancelNegotiation(negotiation: any): boolean {
    return this.isNegotiationBuyer(negotiation) && String(negotiation?.status ?? '').toLowerCase() !== 'accepted';
  }

  isNegotiationSeller(negotiation: any): boolean {
    return this.extractId(negotiation?.sellerParticipant) === this.loggedParticipantId;
  }

  canRespondToNegotiation(negotiation: any): boolean {
    return this.getNegotiationResponderParticipantId(negotiation) === this.loggedParticipantId;
  }

  canAcceptNegotiation(negotiation: any): boolean {
    return this.getNegotiationAcceptHint(negotiation) === null;
  }

  getNegotiationAcceptHint(negotiation: any): string | null {
    if (!this.canRespondToNegotiation(negotiation)) return null;

    const buyerId = this.extractId(negotiation?.buyerParticipant) ?? 0;
    const buyer = this.participantById.get(buyerId);
    const amount = Number(negotiation?.agreedAmount ?? 0);
    const buyerAvailable = Number(buyer?.availableMoney ?? 0);

    if (!Number.isFinite(amount) || amount <= 0) return 'La negociación no tiene un monto válido.';

    if (amount >= buyerAvailable) {
      return `No se puede aceptar: la oferta debe ser menor al disponible del comprador ($${buyerAvailable.toLocaleString('es-AR')}).`;
    }

    return null;
  }

  openCounterNegotiationModal(negotiation: any): void {
    if (!this.canRespondToNegotiation(negotiation)) return;
    this.negotiationForAmountEdit = negotiation;
    this.negotiationAmountInput = Number(negotiation?.agreedAmount ?? 0);
    this.negotiationAmountError = '';
    this.isSavingNegotiationAmount = false;
    this.showNegotiationAmountModal = true;
  }

  closeCounterNegotiationModal(): void {
    this.showNegotiationAmountModal = false;
    this.negotiationForAmountEdit = null;
    this.negotiationAmountInput = 0;
    this.negotiationAmountError = '';
    this.isSavingNegotiationAmount = false;
  }

  cancelNegotiation(negotiation: any): void {
    if (!this.canCancelNegotiation(negotiation)) return;
    this.rollbackNegotiationAndDelete(negotiation);
  }

  rejectNegotiation(negotiation: any): void {
    if (!this.canRespondToNegotiation(negotiation)) return;
    this.rollbackNegotiationAndDelete(negotiation);
  }

  saveNegotiationAmountChange(): void {
    const negotiation = this.negotiationForAmountEdit;
    if (!negotiation) return;
    if (!this.canRespondToNegotiation(negotiation)) {
      this.negotiationAmountError = 'No te toca responder esta oferta.';
      return;
    }

    const nextAmount = Number(this.negotiationAmountInput);
    if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
      this.negotiationAmountError = 'Ingresá un monto válido.';
      return;
    }

    const buyerId = this.extractId(negotiation?.buyerParticipant) ?? 0;
    const sellerId = this.extractId(negotiation?.sellerParticipant) ?? 0;
    const buyer = this.participantById.get(buyerId);
    if (!buyer) return;

    const dependantId = this.extractId(negotiation?.dependantPlayer) ?? 0;
    const dependant = this.allDependantPlayers.find((item) => this.extractId(item) === dependantId);
    const realPlayerId = this.extractId(dependant?.realPlayer) ?? 0;
    const realPlayer = this.realPlayerById.get(realPlayerId);
    const translatedValue = Number(realPlayer?.translatedValue ?? 0);
    if (nextAmount <= translatedValue) {
      this.negotiationAmountError = `El nuevo monto debe ser mayor al translatedValue ($${translatedValue.toLocaleString('es-AR')}).`;
      return;
    }

    const buyerAvailable = Number(buyer?.availableMoney ?? 0);

    if (nextAmount >= buyerAvailable) {
      this.negotiationAmountError = `El nuevo monto debe ser menor al availableMoney del comprador ($${buyerAvailable.toLocaleString('es-AR')}).`;
      return;
    }
    this.isSavingNegotiationAmount = true;

    this.apiService.patchNegotiation({
      id: this.extractId(negotiation)!,
      agreedAmount: nextAmount,
      status: this.loggedParticipantId === sellerId ? 'countered' : 'active',
      publicationDate: new Date(),
    }).subscribe({
      next: () => {
        this.closeCounterNegotiationModal();
        this.refreshTournamentState('negotiation');
      },
      error: (error: any) => {
        this.negotiationAmountError = error?.error?.message ?? 'No se pudo actualizar el monto.';
        this.isSavingNegotiationAmount = false;
      },
    });
  }

  acceptNegotiation(negotiation: any): void {
    if (!this.canAcceptNegotiation(negotiation)) return;

    const buyerId = this.extractId(negotiation?.buyerParticipant) ?? 0;
    const amount = Number(negotiation?.agreedAmount ?? 0);

    const buyer = this.participantById.get(buyerId);
    if (!buyer) return;

    const buyerAvailable = Number(buyer?.availableMoney ?? 0);
    if (amount >= buyerAvailable) return;

    this.apiService.acceptNegotiation(this.extractId(negotiation)!).subscribe({
      next: () => this.refreshTournamentState('negotiation'),
    });
  }

  onRivalListUpdated(): void {
    this.refreshTournamentState('negotiation');
  }

  private rollbackNegotiationAndDelete(negotiation: any): void {
    this.apiService.removeNegotiation(this.extractId(negotiation)!).subscribe({
      next: () => this.refreshTournamentState('negotiation'),
    });
  }



  private refreshTournamentState(reason: 'bid' | 'squad' | 'negotiation'): void {
    this.isLoading = true;
    this.errorMessage = '';

    if (reason === 'bid') {
      this.requestCacheService.invalidate('bids');
      this.requestCacheService.invalidate('participants');
    }

    if (reason === 'squad') {
      this.requestCacheService.invalidate('participant-squads');
    }

    if (reason === 'negotiation') {
      this.requestCacheService.invalidate('negotiations');
      this.requestCacheService.invalidate('participants');
      this.requestCacheService.invalidate('participant-squads');
    }

    this.requestCacheService.invalidate('matchday-markets');
    this.requestCacheService.invalidate('dependant-players');
    this.requestCacheService.invalidate('player-clauses');

    forkJoin({
      participants: this.requestCacheService.getOrSet('participants', () => this.apiService.searchParticipants(), 20_000),
      participantSquads: this.requestCacheService.getOrSet('participant-squads', () => this.apiService.searchParticipantSquads(), 20_000),
      dependantPlayers: this.requestCacheService.getOrSet('dependant-players', () => this.apiService.searchDependantPlayers(), 20_000),
      playerClauses: this.requestCacheService.getOrSet('player-clauses', () => this.apiService.searchPlayerClauses(), 20_000),
      matchdayMarkets: this.requestCacheService.getOrSet('matchday-markets', () => this.apiService.searchMatchdayMarkets(), 20_000),
      negotiations: this.requestCacheService.getOrSet('negotiations', () => this.apiService.searchNegotiations(), 15_000),
      bids: this.requestCacheService.getOrSet('bids', () => this.apiService.searchBids(), 15_000),
      participantMatchdayPoints: this.requestCacheService.getOrSet('participant-matchday-points', () => this.apiService.searchParticipantMatchdayPoints(), 20_000),
    }).subscribe({
      next: (response) => {
        const currentUserId = Number(localStorage.getItem('currentUserId'));
        const tournamentParticipants = response.participants.data.filter((item: any) => this.extractId(item.tournament) === this.tournamentId);

        this.participant = tournamentParticipants.find((item: any) => this.extractId(item.user) === currentUserId) ?? this.participant;
        const currentParticipantId = this.extractId(this.participant);

        this.rivals = tournamentParticipants.filter((item: any) => this.extractId(item) !== currentParticipantId);
        this.participantsOrdered = [
          ...tournamentParticipants.filter((item: any) => this.extractId(item) === currentParticipantId),
          ...tournamentParticipants.filter((item: any) => this.extractId(item) !== currentParticipantId),
        ];

        this.allParticipantSquads = response.participantSquads.data;
        this.allDependantPlayers = response.dependantPlayers?.data ?? [];
        this.allPlayerClauses = response.playerClauses?.data ?? [];
        this.allParticipantPoints = response.participantMatchdayPoints.data;

        this.existingMarketEntries = response.matchdayMarkets.data.filter((item: any) => this.extractId(item.tournament) === this.tournamentId);
        this.negotiations = response.negotiations.data.filter((item: any) =>
          this.extractId(item.tournament) === this.tournamentId
          && !this.isHiddenNegotiationStatus(item?.status)
        );

        this.bids = response.bids.data.filter((bid: any) => this.extractId(bid.tournament) === this.tournamentId);

        this.rebuildMapsAndNegotiationViews();
        this.rebuildSquadFromFormation();
        this.rebuildMarketFromDatabase();
        this.rebuildMarketReferenceData();
        this.rebuildRanking();

        this.isLoading = false;
      },
      error: (error) => {
        this.errorMessage = error?.error?.message ?? 'No se pudo refrescar el torneo.';
        this.isLoading = false;
      },
    });
  }

  private rebuildMapsAndNegotiationViews(): void {
    this.participantById = new Map<number, any>();
    for (const participant of [this.participant, ...this.rivals]) {
      const id = this.extractId(participant);
      if (id) {
        const squad = this.allParticipantSquads.find((item) => this.extractId(item.participant) === id) ?? null;
        this.participantById.set(id, { ...participant, participantSquad: squad, relatedNegotiations: [] });
      }
    }

    this.realPlayerById = new Map<number, any>();
    for (const player of this.allRealPlayers) {
      const playerId = this.extractId(player);
      if (!playerId) continue;
      const totalScore = this.allPlayerPerformances
        .filter((perf: any) => this.extractId(perf?.realPlayer) === playerId)
        .reduce((sum: number, perf: any) => sum + Number(perf?.pointsObtained ?? 0), 0);
      this.realPlayerById.set(playerId, { ...player, totalScore });
    }

    this.dependantByRealPlayerId = new Map<number, any>();
    for (const dependant of this.allDependantPlayers) {
      if (this.extractId(dependant?.tournament) !== this.tournamentId) continue;
      const realPlayerId = this.extractId(dependant?.realPlayer);
      if (realPlayerId) {
        this.dependantByRealPlayerId.set(realPlayerId, dependant);
      }
    }

    this.playerClauseByDependantId = new Map<number, any>();
    for (const clause of this.allPlayerClauses) {
      if (this.extractId(clause?.tournament) !== this.tournamentId) continue;
      const dependantId = this.extractId(clause?.dependantPlayer);
      if (dependantId) {
        this.playerClauseByDependantId.set(dependantId, clause);
      }
    }

    this.visibleNegotiations = this.negotiations.filter((item: any) => {
      const isRelatedToLoggedParticipant = this.extractId(item?.buyerParticipant) === this.loggedParticipantId
        || this.extractId(item?.sellerParticipant) === this.loggedParticipantId;

      if (!isRelatedToLoggedParticipant) {
        return false;
      }

      const isAccepted = this.isAcceptedNegotiationStatus(item?.status);
      if (this.showAcceptedNegotiations) {
        return isAccepted;
      }

      return this.isActiveNegotiationStatus(item?.status);
    });

    for (const negotiation of this.visibleNegotiations) {
      const sellerId = this.extractId(negotiation?.sellerParticipant);
      const buyerId = this.extractId(negotiation?.buyerParticipant);
      if (sellerId && this.participantById.has(sellerId)) {
        this.participantById.get(sellerId).relatedNegotiations.push(negotiation);
      }
      if (buyerId && this.participantById.has(buyerId)) {
        this.participantById.get(buyerId).relatedNegotiations.push(negotiation);
      }
    }
  }

  private getNegotiationResponderParticipantId(negotiation: any): number | null {
    const status = String(negotiation?.status ?? 'active');
    const sellerId = this.extractId(negotiation?.sellerParticipant);
    const buyerId = this.extractId(negotiation?.buyerParticipant);

    if (status === 'countered') {
      return buyerId;
    }

    if (status === 'active') {
      return sellerId;
    }

    return null;
  }

  private isAcceptedNegotiationStatus(statusRaw: unknown): boolean {
    const status = String(statusRaw ?? '').trim().toLocaleLowerCase();
    return status === 'accepted' || status === 'acepted';
  }

  private isActiveNegotiationStatus(statusRaw: unknown): boolean {
    const status = String(statusRaw ?? '').trim().toLocaleLowerCase();
    return status === 'active' || status === 'countered';
  }

  private isHiddenNegotiationStatus(statusRaw: unknown): boolean {
    const status = String(statusRaw ?? '').trim().toLocaleLowerCase();
    return status === 'rejected'
      || status === 'rejected_by_seller'
      || status === 'rejected_by_buyer'
      || status === 'cancelled'
      || status === 'canceled';
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
    }

    return null;
  }

  goToFixture(): void {
    const leagueId = this.extractId(this.tournament?.league);

    if (leagueId) {
      this.router.navigate(['/fixture'], { queryParams: { leagueId } });
      return;
    }

    this.router.navigate(['/fixture']);
  }
}
