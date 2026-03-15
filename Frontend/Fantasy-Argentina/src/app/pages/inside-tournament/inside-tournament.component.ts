import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../servicios/api.service';
import { FootballPitchComponent, PitchPlayer } from '../../components/football-pitch/football-pitch.component';
import { RealPlayerMarketCardComponent } from '../../components/real-player-market-card/real-player-market-card.component';

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
  imports: [CommonModule, FormsModule, FootballPitchComponent, RealPlayerMarketCardComponent],
  templateUrl: './inside-tournament.component.html',
  styleUrl: './inside-tournament.component.scss'
})
export class InsideTournamentComponent implements OnInit {
  readonly formations = ['4-4-2', '4-3-3', '3-4-3', '5-4-1'];
  selectedFormation = this.formations[0];

  tournament: any = null;
  participant: any = null;
  rivals: any[] = [];

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

  rankingMode: 'total' | 'byMatchday' = 'total';
  rankingRows: Array<{ participantName: string; points: number; }> = [];
  matchdaysForTournament: any[] = [];
  selectedMatchdayId: number | null = null;

  participantSquadId: number | null = null;

  private tournamentId: number | null = null;
  private allParticipantSquads: any[] = [];
  private allRealPlayers: any[] = [];
  private allParticipantPoints: any[] = [];
  allPlayerPerformances: any[] = [];

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

  get availableMoney(): number {
    return Number(this.participant?.availableMoney ?? this.participant?.bankBudget ?? 0);
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

        this.allParticipantSquads = response.participantSquads.data;
        this.allRealPlayers = response.realPlayers.data;
        this.allParticipantPoints = response.participantMatchdayPoints.data;
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
    this.router.navigate(['/fixture']);
  }
}
