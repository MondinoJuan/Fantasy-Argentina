import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, Observable, of } from 'rxjs';
import { ApiService } from '../../servicios/api.service';
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

  selectedRankingScope: 'total' | number = 'total';
  rankingRows: Array<{ participantName: string; points: number; }> = [];
  matchdaysForTournament: any[] = [];

  participantSquadId: number | null = null;

  private tournamentId: number | null = null;
  private allParticipantSquads: any[] = [];
  private allRealPlayers: any[] = [];
  private allParticipantPoints: any[] = [];
  allPlayerPerformances: any[] = [];
  allDependantPlayers: any[] = [];
  allPlayerClauses: any[] = [];

  participantById = new Map<number, any>();
  realPlayerById = new Map<number, any>();
  dependantByRealPlayerId = new Map<number, any>();
  playerClauseByDependantId = new Map<number, any>();
  visibleNegotiations: any[] = [];
  showNegotiationAmountModal = false;
  negotiationForAmountEdit: any = null;
  negotiationAmountInput = 0;
  negotiationAmountError = '';
  isSavingNegotiationAmount = false;

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

  onRankingScopeChange(): void {
    this.rebuildRanking();
  }

  goBack(): void {
    this.router.navigate(['/landingPage']);
  }

  onBidSaved(): void {
    this.loadTournamentPage(true);
  }

  onSquadSaved(): void {
    this.loadTournamentPage(true);
  }

  private loadTournamentPage(isReload = false): void {
    this.isLoading = true;
    this.errorMessage = '';

    forkJoin({
      tournaments: this.apiService.searchTournaments(),
      participants: this.apiService.searchParticipants(),
      participantSquads: this.apiService.searchParticipantSquads(),
      realPlayers: this.apiService.searchRealPlayers(),
      dependantPlayers: this.apiService.searchDependantPlayers(),
      playerClauses: this.apiService.searchPlayerClauses(),
      matchdayMarkets: this.apiService.searchMatchdayMarkets(),
      negotiations: this.apiService.searchNegotiations(),
      bids: this.apiService.searchBids(),
      matchdays: this.apiService.searchMatchdays(),
      participantMatchdayPoints: this.apiService.searchParticipantMatchdayPoints(),
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
        this.participantsOrdered = [
          ...tournamentParticipants.filter((item: any) => this.extractId(item) === currentParticipantId),
          ...tournamentParticipants.filter((item: any) => this.extractId(item) !== currentParticipantId),
        ];

        this.allParticipantSquads = response.participantSquads.data;
        this.allRealPlayers = response.realPlayers.data;
        this.allDependantPlayers = response.dependantPlayers?.data ?? [];
        this.allPlayerClauses = response.playerClauses?.data ?? [];
        this.allParticipantPoints = response.participantMatchdayPoints.data;
        this.allPlayerPerformances = response.playerPerformances?.data ?? [];

        this.existingMarketEntries = response.matchdayMarkets.data.filter((item: any) => this.extractId(item.tournament) === this.tournamentId);
        this.negotiations = response.negotiations.data.filter((item: any) => this.extractId(item.tournament) === this.tournamentId);

        const participantId = this.extractId(this.participant);
        this.bids = response.bids.data.filter((bid: any) => this.extractId(bid.participant) === participantId);

        this.matchdaysForTournament = response.matchdays.data
          .filter((matchday: any) => this.extractId(matchday.league) === this.extractId(this.tournament.league))
          .sort((left: any, right: any) => Number(left?.matchdayNumber ?? 0) - Number(right?.matchdayNumber ?? 0));

        this.selectedRankingScope = 'total';
        this.rebuildMapsAndNegotiationViews();

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
      return;
    }

    const squadEntry = this.allParticipantSquads.find((item) => this.extractId(item.participant) === participantId);
    this.participantSquadId = this.extractId(squadEntry);

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
      return this.normalizeIdCollection(entry.dependantPlayerIds ?? entry.dependant_player_ids).map(depId => ({
        dependantPlayerId: depId,
        marketId,
      }));
    });
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

    return clauseDate.getTime() <= Date.now();
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

  isNegotiationSeller(negotiation: any): boolean {
    return this.extractId(negotiation?.sellerParticipant) === this.loggedParticipantId;
  }

  canRespondToNegotiation(negotiation: any): boolean {
    return this.getNegotiationResponderParticipantId(negotiation) === this.loggedParticipantId;
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
    if (!this.isNegotiationBuyer(negotiation)) return;
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
    if (!Number.isFinite(nextAmount) || nextAmount <= 0) return;

    const buyerId = this.extractId(negotiation?.buyerParticipant) ?? 0;
    const sellerId = this.extractId(negotiation?.sellerParticipant) ?? 0;
    const buyer = this.participantById.get(buyerId);
    if (!buyer) return;

    const dependantId = this.extractId(negotiation?.dependantPlayer) ?? 0;
    const dependant = this.allDependantPlayers.find((item) => this.extractId(item) === dependantId);
    const realPlayerId = this.extractId(dependant?.realPlayer) ?? 0;
    const realPlayer = this.realPlayerById.get(realPlayerId);
    const translatedValue = Number(realPlayer?.translatedValue ?? 0);

    if (nextAmount <= translatedValue) return;

    const previousAmount = Number(negotiation?.agreedAmount ?? 0);
    const delta = nextAmount - previousAmount;
    const buyerAvailable = Number(buyer?.availableMoney ?? 0);
    const buyerReserved = Number(buyer?.reservedMoney ?? 0);

    if (delta > buyerAvailable) return;
    this.isSavingNegotiationAmount = true;

    this.apiService.patchNegotiation({
      id: this.extractId(negotiation)!,
      agreedAmount: nextAmount,
      status: this.loggedParticipantId === sellerId ? 'countered' : 'active',
      publicationDate: new Date(),
    }).subscribe({
      next: () => {
        this.apiService.patchParticipant({
          id: buyerId,
          availableMoney: Math.max(0, buyerAvailable - delta),
          reservedMoney: Math.max(0, buyerReserved + delta),
        }).subscribe({
          next: () => {
            this.closeCounterNegotiationModal();
            this.loadTournamentPage(true);
          },
          error: (error: any) => {
            this.negotiationAmountError = error?.error?.message ?? 'No se pudo actualizar el monto.';
            this.isSavingNegotiationAmount = false;
          }
        });
      },
      error: (error: any) => {
        this.negotiationAmountError = error?.error?.message ?? 'No se pudo actualizar el monto.';
        this.isSavingNegotiationAmount = false;
      },
    });
  }

  acceptNegotiation(negotiation: any): void {
    if (!this.canRespondToNegotiation(negotiation)) return;

    const sellerId = this.extractId(negotiation?.sellerParticipant) ?? 0;
    const buyerId = this.extractId(negotiation?.buyerParticipant) ?? 0;
    const amount = Number(negotiation?.agreedAmount ?? 0);
    const dependantId = this.extractId(negotiation?.dependantPlayer) ?? 0;
    const dependant = this.allDependantPlayers.find((item) => this.extractId(item) === dependantId);
    const realPlayerId = this.extractId(dependant?.realPlayer) ?? 0;

    const buyer = this.participantById.get(buyerId);
    const seller = this.participantById.get(sellerId);
    if (!buyer || !seller || !realPlayerId) return;

    this.transferRealPlayer(realPlayerId, sellerId, buyerId).subscribe({
      next: () => {
        forkJoin({
          negotiation: this.apiService.patchNegotiation({
            id: this.extractId(negotiation)!,
            status: 'accepted',
            effectiveDate: new Date(),
          }),
          buyer: this.apiService.patchParticipant({
            id: buyerId,
            reservedMoney: Math.max(0, Number(buyer?.reservedMoney ?? 0) - amount),
            bankBudget: Math.max(0, Number(buyer?.bankBudget ?? 0) - amount),
          }),
          seller: this.apiService.patchParticipant({
            id: sellerId,
            bankBudget: Number(seller?.bankBudget ?? 0) + amount,
            availableMoney: Number(seller?.availableMoney ?? 0) + amount,
          }),
        }).subscribe({
          next: () => this.loadTournamentPage(true),
        });
      },
    });
  }

  onRivalListUpdated(): void {
    this.loadTournamentPage(true);
  }

  private rollbackNegotiationAndDelete(negotiation: any): void {
    const buyerId = this.extractId(negotiation?.buyerParticipant) ?? 0;
    const amount = Number(negotiation?.agreedAmount ?? 0);
    const buyer = this.participantById.get(buyerId);
    if (!buyer) return;

    this.apiService.patchParticipant({
      id: buyerId,
      availableMoney: Number(buyer?.availableMoney ?? 0) + amount,
      reservedMoney: Math.max(0, Number(buyer?.reservedMoney ?? 0) - amount),
    }).subscribe({
      next: () => {
        this.apiService.removeNegotiation(this.extractId(negotiation)!).subscribe({
          next: () => this.loadTournamentPage(true),
        });
      },
    });
  }

  private transferRealPlayer(realPlayerId: number, fromParticipantId: number, toParticipantId: number): Observable<unknown> {
    const sellerSquad = this.allParticipantSquads.find((item) => this.extractId(item?.participant) === fromParticipantId);
    const buyerSquad = this.allParticipantSquads.find((item) => this.extractId(item?.participant) === toParticipantId);

    if (!sellerSquad || !buyerSquad) return of(null as unknown);

    const sellerStarting = this.normalizeIdCollection(sellerSquad?.startingRealPlayersIds ?? sellerSquad?.starting_real_players_ids)
      .filter((id) => id !== realPlayerId);
    const sellerSubs = this.normalizeIdCollection(sellerSquad?.substitutesRealPlayersIds ?? sellerSquad?.substitutes_real_players_ids)
      .filter((id) => id !== realPlayerId);

    const buyerSubs = this.normalizeIdCollection(buyerSquad?.substitutesRealPlayersIds ?? buyerSquad?.substitutes_real_players_ids);
    if (!buyerSubs.includes(realPlayerId)) {
      buyerSubs.push(realPlayerId);
    }

    return forkJoin({
      seller: this.apiService.patchParticipantSquad({
        id: this.extractId(sellerSquad)!,
        startingRealPlayersIds: sellerStarting,
        substitutesRealPlayersIds: sellerSubs,
      }),
      buyer: this.apiService.patchParticipantSquad({
        id: this.extractId(buyerSquad)!,
        substitutesRealPlayersIds: buyerSubs,
      }),
    }) as Observable<unknown>;
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

    this.visibleNegotiations = this.negotiations.filter((item: any) =>
      this.extractId(item?.buyerParticipant) === this.loggedParticipantId
      || this.extractId(item?.sellerParticipant) === this.loggedParticipantId
    );

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
