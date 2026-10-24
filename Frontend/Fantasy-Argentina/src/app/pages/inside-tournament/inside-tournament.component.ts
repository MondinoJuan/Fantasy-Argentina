import { CommonModule } from '@angular/common';
import { AccessibleDialogDirective } from '../../components/accessible-dialog.directive';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiService } from '../../servicios/api.service';
import { RequestCacheService } from '../../servicios/request-cache.service';
import { FootballPitchComponent, PitchPlayer, FORMATION_LAYOUTS } from '../../components/football-pitch/football-pitch.component';
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
  imports: [CommonModule, FormsModule, FootballPitchComponent, RealPlayerMarketCardComponent, RivalsRealPlayerListComponent, AccessibleDialogDirective],
  templateUrl: './inside-tournament.component.html',
  styleUrl: './inside-tournament.component.scss'
})
export class InsideTournamentComponent implements OnInit {
  activeSection = 'home';
  readonly sections = [{ id: 'home', label: 'Inicio' }, { id: 'squad', label: 'Mi equipo' }, { id: 'market', label: 'Mercado' }, { id: 'league', label: 'Liga' }, { id: 'history', label: 'Historial' }];
  loadedAt: Date | null = null;
  historyRows: any[] = [];
  historyError = '';
  historyLoading = false;
  notice = '';
  isStartingTournament = false;
  startTournamentError = '';
  automationSchedule: any[] | null = null;
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
  startingSlotsForPitch: { slotId: string; realPlayerId: number | null }[] = [];
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
  translatedValuesByRealPlayerId: Record<number, number | null> = {};

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
      this.isLoading = false; this.loadedAt = new Date();
      return;
    }

    this.tournamentId = paramId;
    this.loadTournamentPage();
  }

  get participantName(): string {
    return localStorage.getItem('currentUsername') ?? 'Participante';
  }

  selectSection(section: string): void {
    if (this.isWaitingForStart && !['home', 'history'].includes(section)) return;
    this.activeSection = section;
    if (section !== 'history') return;
    this.historyLoading = true;
    this.historyError = '';
    this.apiService.searchTransactions(this.tournamentId).subscribe({
      next: response => {
        this.historyRows = [...response.data].sort((a: any, b: any) => new Date(b.creationDate).getTime() - new Date(a.creationDate).getTime());
        this.historyLoading = false;
      },
      error: () => { this.historyError = 'No se pudo cargar el historial. Volvé a abrir esta sección para reintentar.'; this.historyLoading = false; },
    });
  }

  get isWaitingForStart(): boolean { return this.tournament?.initialDrawState === 'waiting'; }

  get canStartTournament(): boolean {
    return this.isWaitingForStart && Number(this.tournament?.creatorUserId) === Number(localStorage.getItem('currentUserId'));
  }

  refreshLobby(): void {
    if (this.isStartingTournament || this.isLoading) return;
    for (const key of ['tournaments', 'participants', 'participant-squads', 'dependant-players', 'matchday-markets', 'player-clauses', 'bids']) this.requestCacheService.invalidateByPrefix(key);
    this.loadTournamentPage();
  }

  startTournament(): void {
    if (!this.canStartTournament || this.isStartingTournament || !this.tournamentId) return;
    this.isStartingTournament = true;
    this.startTournamentError = '';
    this.apiService.startTournament(this.tournamentId).subscribe({
      next: () => {
        this.isStartingTournament = false;
        for (const key of ['tournaments', 'participants', 'participant-squads', 'dependant-players', 'matchday-markets']) this.requestCacheService.invalidateByPrefix(key);
        this.notice = 'Torneo iniciado. Se sortearon los once de cada participante y se publicó el mercado.';
        this.loadTournamentPage();
      },
      error: error => { this.isStartingTournament = false; this.startTournamentError = error?.error?.message ?? 'No se pudo iniciar el torneo. Podés reintentar.'; },
    });
  }

  get currentMatchday(): any {
    return [...this.matchdaysForTournament].sort((a, b) => a.matchdayNumber - b.matchdayNumber).find(d => !d.closureCompletedAt && d.status !== 'cancelled');
  }

  get pendingNegotiations(): number {
    return this.negotiations.filter(n => this.canRespondToNegotiation(n)).length;
  }

  get scheduledClosure(): any {
    return this.automationSchedule?.find(d => d.matchdayId === this.extractId(this.currentMatchday));
  }

  get pendingMatchCount(): number {
    return this.automationSchedule?.reduce((sum, d) => sum + d.pendingMatches.length, 0) ?? 0;
  }

  rankAt(index: number): number {
    return this.rankingRows.findIndex(row => row.points === this.rankingRows[index].points) + 1;
  }

  statusLabel(status: string): string {
    return ({ active: 'Activa', countered: 'Contraoferta', accepted: 'Aceptada', rejected: 'Rechazada', cancelled: 'Cancelada', bid_purchase: 'Compra/venta por puja', negotiation_purchase: 'Transferencia negociada', instant_sale: 'Venta rápida', clause_execution: 'Compra/venta por cláusula', shielding_investment: 'Blindaje', refund: 'Reintegro', reserve: 'Reserva', release: 'Liberación de reserva', matchday_reward: 'Premio de fecha', initial_budget: 'Presupuesto inicial', admin_adjustment: 'Ajuste administrativo' } as Record<string, string>)[status] ?? status;
  }

  async copyInvitation(): Promise<void> {
    try {
      const link = new URL('/landingPage', location.origin);
      link.searchParams.set('invite', this.tournamentCode);
      await navigator.clipboard.writeText(link.toString());
      this.notice = 'Enlace copiado. Al abrirlo, tus amigos podrán confirmar la inscripción con el código.';
    }
    catch { this.notice = 'Compartí el código de invitación que figura arriba.'; }
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
      automationSchedule: this.apiService.getTournamentMatchdayAutomationSchedule({ tournamentId: this.tournamentId! }).pipe(catchError(() => of(null))),
      tournaments: this.requestCacheService.getOrSet(`tournaments:${localStorage.getItem("currentUserId")}:${this.tournamentId}`, () => this.apiService.searchTournaments(this.tournamentId), 60_000),
      participants: this.requestCacheService.getOrSet(`participants:${localStorage.getItem("currentUserId")}:${this.tournamentId}`, () => this.apiService.searchParticipants(this.tournamentId), 20_000),
      participantSquads: this.requestCacheService.getOrSet(`participant-squads:${localStorage.getItem("currentUserId")}:${this.tournamentId}`, () => this.apiService.searchParticipantSquads(this.tournamentId), 20_000),
      realPlayers: this.requestCacheService.getOrSet('real-players', () => this.apiService.searchRealPlayers(), 120_000),
      realTeams: this.requestCacheService.getOrSet('real-teams', () => this.apiService.searchRealTeams(), 120_000),
      dependantPlayers: this.requestCacheService.getOrSet(`dependant-players:${localStorage.getItem("currentUserId")}:${this.tournamentId}`, () => this.apiService.searchDependantPlayers(this.tournamentId), 20_000),
      playerClauses: this.requestCacheService.getOrSet(`player-clauses:${localStorage.getItem("currentUserId")}:${this.tournamentId}`, () => this.apiService.searchPlayerClauses(this.tournamentId), 20_000),
      matchdayMarkets: this.requestCacheService.getOrSet(`matchday-markets:${localStorage.getItem("currentUserId")}:${this.tournamentId}`, () => this.apiService.searchMatchdayMarkets(this.tournamentId), 20_000),
      negotiations: this.requestCacheService.getOrSet(`negotiations:${localStorage.getItem("currentUserId")}:${this.tournamentId}`, () => this.apiService.searchNegotiations(this.tournamentId), 15_000),
      bids: this.requestCacheService.getOrSet(`bids:${localStorage.getItem("currentUserId")}:${this.tournamentId}`, () => this.apiService.searchBids(this.tournamentId), 15_000),
      matchdays: this.requestCacheService.getOrSet('matchdays', () => this.apiService.searchMatchdays(), 120_000),
      participantMatchdayPoints: this.requestCacheService.getOrSet(`participant-matchday-points:${localStorage.getItem("currentUserId")}:${this.tournamentId}`, () => this.apiService.searchParticipantMatchdayPoints(this.tournamentId), 20_000),
      playerPerformances: this.requestCacheService.getOrSet('player-performances', () => this.apiService.searchPlayerPerformances(), 20_000),
      serverTime: this.apiService.getServerTime().pipe(catchError(() => of(null))),
    }).subscribe({
      next: (response) => {
        this.automationSchedule = response.automationSchedule?.data ?? null;
        const serverNowMs = Number(response.serverTime?.data?.nowMs);
        if (Number.isFinite(serverNowMs) && serverNowMs > 0) {
          this.serverClockSkewMs = serverNowMs - Date.now();
        }

        const currentUserId = Number(localStorage.getItem('currentUserId'));

        this.tournament = response.tournaments.data.find((item: any) => this.extractId(item) === this.tournamentId) ?? null;
        if (!this.tournament) {
          this.errorMessage = 'No encontramos el torneo solicitado.';
          this.isLoading = false; this.loadedAt = new Date();
          return;
        }
        this.tournamentLeagueId = this.extractLeagueId(this.tournament);

        const tournamentParticipants = response.participants.data.filter((item: any) => this.extractTournamentId(item) === this.tournamentId);

        this.participant = tournamentParticipants.find((item: any) => this.extractId(item.user) === currentUserId) ?? null;
        if (!this.participant) {
          this.errorMessage = 'No estás unido a este torneo.';
          this.isLoading = false; this.loadedAt = new Date();
          return;
        }

        const currentParticipantId = this.extractId(this.participant);
        this.rivals = tournamentParticipants.filter((item: any) => this.extractId(item) !== currentParticipantId);
        this.participantsOrdered = [
          ...tournamentParticipants.filter((item: any) => this.extractId(item) === currentParticipantId),
          ...tournamentParticipants.filter((item: any) => !item.retiredAt && this.extractId(item) !== currentParticipantId),
        ];

        this.allParticipantSquads = response.participantSquads.data;
        this.allRealPlayers = response.realPlayers.data;
        this.allRealTeams = response.realTeams?.data ?? [];
        this.allDependantPlayers = response.dependantPlayers?.data ?? [];
        this.allPlayerClauses = response.playerClauses?.data ?? [];
        this.allParticipantPoints = response.participantMatchdayPoints.data;
        this.allPlayerPerformances = response.playerPerformances?.data ?? [];

        this.existingMarketEntries = response.matchdayMarkets.data.filter((item: any) => this.extractTournamentId(item) === this.tournamentId);
        this.negotiations = response.negotiations.data.filter((item: any) =>
          this.extractTournamentId(item) === this.tournamentId
          && !this.isHiddenNegotiationStatus(item?.status)
        );

        this.bids = response.bids.data.filter((bid: any) => this.extractTournamentId(bid) === this.tournamentId);

        this.matchdaysForTournament = response.matchdays.data
          .filter((matchday: any) => this.extractLeagueId(matchday) === this.extractLeagueId(this.tournament))
          .sort((left: any, right: any) => Number(left?.matchdayNumber ?? 0) - Number(right?.matchdayNumber ?? 0));

        this.selectedRankingScope = 'total';
        const leagueId = Number(this.tournamentLeagueId ?? 0);
        this.apiService.searchRealPlayerLeagueValuesByLeagueId(leagueId).pipe(
          catchError(() => of({ message: 'league values unavailable', data: [] as any[] })),
        ).subscribe({
          next: (leagueValuesResponse: any) => {
            this.translatedValuesByRealPlayerId = this.buildTranslatedValuesByRealPlayerId(leagueValuesResponse?.data ?? []);
            this.rebuildMapsAndNegotiationViews();
            this.rebuildSquadFromFormation();
            this.rebuildMarketFromDatabase();
            this.rebuildMarketReferenceData();
            this.rebuildRanking();
            this.isLoading = false; this.loadedAt = new Date();
          },
          error: () => {
            this.translatedValuesByRealPlayerId = {};
            this.rebuildMapsAndNegotiationViews();
            this.rebuildSquadFromFormation();
            this.rebuildMarketFromDatabase();
            this.rebuildMarketReferenceData();
            this.rebuildRanking();
            this.isLoading = false; this.loadedAt = new Date();
          },
        });
      },
      error: (error) => {
        this.errorMessage = error?.error?.message ?? 'No se pudo cargar el torneo.';
        this.isLoading = false; this.loadedAt = new Date();
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
          .map((item) => Number.parseInt(item.replace(/[\[\]{}\s]/g, ''), 10))
          .filter((item) => Number.isFinite(item) && item > 0);
      }
    }

    return [];
  }

  private normalizeDependantIdCollection(value: unknown): number[] {
    if (Array.isArray(value)) {
      return value
        .map((item) => this.extractId(item))
        .filter((item): item is number => Number.isFinite(item) && (item ?? 0) > 0);
    }

    const normalized = this.normalizeIdCollection(value);
    if (normalized.length > 0) return normalized;

    const single = this.extractId(value);
    return single && single > 0 ? [single] : [];
  }

  private rebuildSquadFromFormation(): void {
    const participantId = this.extractId(this.participant);
    if (!participantId) {
      this.squadPlayers = [];
      this.substitutePlayers = [];
      this.startingPlayersForPitch = [];
      this.startingSlotsForPitch = [];
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

    const rawStarting = squadEntry?.startingRealPlayersIds ?? [];
    this.startingSlotsForPitch = squadEntry?.startingSlots ?? (FORMATION_LAYOUTS[this.selectedFormation] ?? FORMATION_LAYOUTS['4-4-2'])
      .map((slot, index) => ({ slotId: slot.slotId, realPlayerId: rawStarting[index] || null }));
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
      const dependantIds = this.normalizeDependantIdCollection(
        entry.dependantPlayerIds
        ?? entry.dependant_player_ids
        ?? entry.dependantPlayersIds
        ?? entry.dependant_players_ids
        ?? entry.dependantPlayers
        ?? entry.dependant_players
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
      const realPlayerId = this.extractDependantRealPlayerId(dependant);
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
      const leftRealPlayerId = this.extractDependantRealPlayerId(leftDependant);
      const rightRealPlayerId = this.extractDependantRealPlayerId(rightDependant);
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
    const tournamentParticipants = [this.participant, ...this.rivals].filter(p => p && !p.retiredAt);

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
    const realPlayerId = this.extractDependantRealPlayerId(dependant) ?? 0;
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

    if (buyerId === this.loggedParticipantId && amount > buyerAvailable) {
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
    if (this.isSavingNegotiationAmount) return;
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
    const realPlayerId = this.extractDependantRealPlayerId(dependant) ?? 0;
    const realPlayer = this.realPlayerById.get(realPlayerId);
    const translatedValue = Number(realPlayer?.translatedValue ?? 0);
    if (nextAmount <= translatedValue) {
      this.negotiationAmountError = `El nuevo monto debe ser mayor al translatedValue ($${translatedValue.toLocaleString('es-AR')}).`;
      return;
    }

    const buyerAvailable = Number(buyer?.availableMoney ?? 0);

    if (buyerId === this.loggedParticipantId && nextAmount > buyerAvailable) {
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
        this.isSavingNegotiationAmount = false;
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
    if (buyerId === this.loggedParticipantId && amount > buyerAvailable) return;

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
      this.requestCacheService.invalidateByPrefix('bids');
      this.requestCacheService.invalidateByPrefix('participants');
    }

    if (reason === 'squad') {
      this.requestCacheService.invalidateByPrefix('participant-squads');
    }

    if (reason === 'negotiation') {
      this.requestCacheService.invalidateByPrefix('negotiations');
      this.requestCacheService.invalidateByPrefix('participants');
      this.requestCacheService.invalidateByPrefix('participant-squads');
    }

    this.requestCacheService.invalidateByPrefix('matchday-markets');
    this.requestCacheService.invalidateByPrefix('dependant-players');
    this.requestCacheService.invalidateByPrefix('player-clauses');

    forkJoin({
      participants: this.requestCacheService.getOrSet(`participants:${localStorage.getItem("currentUserId")}:${this.tournamentId}`, () => this.apiService.searchParticipants(this.tournamentId), 20_000),
      participantSquads: this.requestCacheService.getOrSet(`participant-squads:${localStorage.getItem("currentUserId")}:${this.tournamentId}`, () => this.apiService.searchParticipantSquads(this.tournamentId), 20_000),
      dependantPlayers: this.requestCacheService.getOrSet(`dependant-players:${localStorage.getItem("currentUserId")}:${this.tournamentId}`, () => this.apiService.searchDependantPlayers(this.tournamentId), 20_000),
      playerClauses: this.requestCacheService.getOrSet(`player-clauses:${localStorage.getItem("currentUserId")}:${this.tournamentId}`, () => this.apiService.searchPlayerClauses(this.tournamentId), 20_000),
      matchdayMarkets: this.requestCacheService.getOrSet(`matchday-markets:${localStorage.getItem("currentUserId")}:${this.tournamentId}`, () => this.apiService.searchMatchdayMarkets(this.tournamentId), 20_000),
      negotiations: this.requestCacheService.getOrSet(`negotiations:${localStorage.getItem("currentUserId")}:${this.tournamentId}`, () => this.apiService.searchNegotiations(this.tournamentId), 15_000),
      bids: this.requestCacheService.getOrSet(`bids:${localStorage.getItem("currentUserId")}:${this.tournamentId}`, () => this.apiService.searchBids(this.tournamentId), 15_000),
      participantMatchdayPoints: this.requestCacheService.getOrSet(`participant-matchday-points:${localStorage.getItem("currentUserId")}:${this.tournamentId}`, () => this.apiService.searchParticipantMatchdayPoints(this.tournamentId), 20_000),
      realPlayerLeagueValues: this.getLeagueValuesRequest$(),
    }).subscribe({
      next: (response) => {
        const currentUserId = Number(localStorage.getItem('currentUserId'));
        const tournamentParticipants = response.participants.data.filter((item: any) => this.extractTournamentId(item) === this.tournamentId);

        this.participant = tournamentParticipants.find((item: any) => this.extractId(item.user) === currentUserId) ?? this.participant;
        const currentParticipantId = this.extractId(this.participant);

        this.rivals = tournamentParticipants.filter((item: any) => this.extractId(item) !== currentParticipantId);
        this.participantsOrdered = [
          ...tournamentParticipants.filter((item: any) => this.extractId(item) === currentParticipantId),
          ...tournamentParticipants.filter((item: any) => !item.retiredAt && this.extractId(item) !== currentParticipantId),
        ];

        this.allParticipantSquads = response.participantSquads.data;
        this.allDependantPlayers = response.dependantPlayers?.data ?? [];
        this.allPlayerClauses = response.playerClauses?.data ?? [];
        this.allParticipantPoints = response.participantMatchdayPoints.data;
        this.translatedValuesByRealPlayerId = this.buildTranslatedValuesByRealPlayerId(response.realPlayerLeagueValues?.data ?? []);

        this.existingMarketEntries = response.matchdayMarkets.data.filter((item: any) => this.extractTournamentId(item) === this.tournamentId);
        this.negotiations = response.negotiations.data.filter((item: any) =>
          this.extractTournamentId(item) === this.tournamentId
          && !this.isHiddenNegotiationStatus(item?.status)
        );

        this.bids = response.bids.data.filter((bid: any) => this.extractTournamentId(bid) === this.tournamentId);

        this.rebuildMapsAndNegotiationViews();
        this.rebuildSquadFromFormation();
        this.rebuildMarketFromDatabase();
        this.rebuildMarketReferenceData();
        this.rebuildRanking();

        this.isLoading = false; this.loadedAt = new Date();
      },
      error: (error) => {
        this.errorMessage = error?.error?.message ?? 'No se pudo refrescar el torneo.';
        this.isLoading = false; this.loadedAt = new Date();
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
        .filter((perf: any) => this.extractId(perf?.realPlayer ?? perf?.real_player ?? perf?.realPlayerId ?? perf?.real_player_id) === playerId)
        .reduce((sum: number, perf: any) => sum + Number(perf?.pointsObtained ?? 0), 0);
      this.realPlayerById.set(playerId, { ...player, totalScore });
    }

    this.dependantByRealPlayerId = new Map<number, any>();
    for (const dependant of this.allDependantPlayers) {
      if (this.extractTournamentId(dependant) !== this.tournamentId) continue;
      const realPlayerId = this.extractDependantRealPlayerId(dependant);
      if (realPlayerId) {
        this.dependantByRealPlayerId.set(realPlayerId, dependant);
      }
    }

    this.playerClauseByDependantId = new Map<number, any>();
    for (const clause of this.allPlayerClauses) {
      if (this.extractTournamentId(clause) !== this.tournamentId) continue;
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

  private getLeagueValuesRequest$() {
    const leagueId = Number(this.tournamentLeagueId ?? this.extractLeagueId(this.tournament) ?? 0);
    if (!Number.isFinite(leagueId) || leagueId <= 0) {
      return of({ message: 'leagueId unavailable', data: [] as any[] });
    }

    return this.apiService.searchRealPlayerLeagueValuesByLeagueId(leagueId).pipe(
      catchError(() => of({ message: 'league values unavailable', data: [] as any[] })),
    );
  }

  private buildTranslatedValuesByRealPlayerId(rows: any[]): Record<number, number | null> {
    const out: Record<number, number | null> = {};
    const leagueId = Number(this.tournamentLeagueId ?? this.extractLeagueId(this.tournament) ?? 0);

    for (const row of (Array.isArray(rows) ? rows : [])) {
      const rowLeagueId = Number(row?.leagueId ?? row?.league_id ?? this.extractId(row?.league));
      if (Number.isFinite(leagueId) && leagueId > 0 && rowLeagueId !== leagueId) continue;
      const realPlayerId = Number(
        row?.realPlayerId
        ?? row?.real_player_id
        ?? this.extractId(row?.realPlayer)
        ?? this.extractId(row?.real_player),
      );
      if (!Number.isFinite(realPlayerId) || realPlayerId <= 0) continue;
      const translated = Number(row?.translatedValue ?? row?.translated_value);
      out[realPlayerId] = Number.isFinite(translated) ? translated : null;
    }

    return out;
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
        return participant.user.username + (participant.retiredAt ? ' (retirado)' : '');
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

  private extractDependantRealPlayerId(dependant: any): number | null {
    return this.extractId(
      dependant?.realPlayer
      ?? dependant?.real_player
      ?? dependant?.realPlayerId
      ?? dependant?.real_player_id
    );
  }

  private extractTournamentId(record: any): number | null {
    return this.extractId(
      record?.tournament
      ?? record?.tournament_id
      ?? record?.tournamentId
    );
  }

  private extractLeagueId(record: any): number | null {
    return this.extractId(
      record?.league
      ?? record?.league_id
      ?? record?.leagueId
    );
  }

  goToFixture(): void {
    const leagueId = this.extractLeagueId(this.tournament);

    if (leagueId) {
      this.router.navigate(['/fixture'], { queryParams: { leagueId } });
      return;
    }

    this.router.navigate(['/fixture']);
  }
}
