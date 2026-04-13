import { CommonModule, JsonPipe } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin, interval } from 'rxjs';
import { finalize, map, switchMap, takeWhile } from 'rxjs/operators';
import { ApiService, BuildCompetitionFixtureJob, SyncPlayedResultsJob, SyncPlayersByLeagueJob, TranslatePricesJob } from '../../servicios/api.service';
import { AuthService } from '../../servicios/auth.service';

import { ActionField, SuperadminAction, SUPERADMIN_ACTION_CONFIG, SUPERADMIN_FIELD_LABELS } from './superadmin-actions.config';

@Component({
  selector: 'app-superadmin-menu',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, JsonPipe],
  templateUrl: './superadmin-menu.component.html',
  styleUrl: './superadmin-menu.component.scss'
})
export class SuperadminMenuComponent {
  readonly actionForm;
  currentAction: SuperadminAction | null = null;
  isLoading = false;
  errorMessage = '';
  successMessage = '';
  result: any = null;
  readonly actionConfig = SUPERADMIN_ACTION_CONFIG;
  readonly fieldLabels = SUPERADMIN_FIELD_LABELS;

  readonly persistenceActions: SuperadminAction[] = [
    'persistPlayers', 'persistTeams', 'persistSport', 'persistLeague', 'persistUltSeason', 'persistFixture', 'persistLeagueKnockoutStage',
  ];

  readonly getAllActions: SuperadminAction[] = [
    'getAllUsers', 'getAllSports', 'getAllLeagues', 'getAllRealTeams', 'getAllRealPlayers',
    'getAllRealTeamLeagueParticipations',
    'getAllTournaments', 'getAllParticipants', 'getAllParticipantSquads', 'getAllMatchdays', 'getAllMatches',
    'getAllMatchdayMarkets', 'getAllBids', 'getAllNegotiations', 'getAllTransactions',
    'getAllPlayerPerformances', 'getAllPlayerPointsBreakdowns', 'getAllParticipantMatchdayPoints', 'getLeaguesTournamentCounts',
    'getMatchdayAutomationSchedule',
  ];

  readonly updateActions: SuperadminAction[] = [
    'rankingsByDate', 'updateTeamSquad', 'syncPlayedMatchResults', 'sumEndOfMatchdayPoints', 'settleMarketByLeague', 'translateRealPlayerPrices',
  ];

  constructor(
    private readonly fb: FormBuilder,
    private readonly apiService: ApiService,
    private readonly authService: AuthService,
    private readonly router: Router,
  ) {
    this.actionForm = this.fb.group({
      sportId: [1, [Validators.required, Validators.min(1)]],
      competitionId: [72, [Validators.required, Validators.min(1)]],
      seasonId: [0, [Validators.required, Validators.min(1)]],
      leagueId: [1, [Validators.required, Validators.min(1)]],
      leagueIdEnApi: [72, [Validators.required, Validators.min(1)]],
      idEnApi: [72, [Validators.required, Validators.min(1)]],
      country: [''],
      kncokoutStage: [false],
      competitionFormat: ['league_only', Validators.required],
      hasGroups: [false],
      hasTwoLegKnockout: [false],
      descripcion: ['Football', Validators.required],
      cupoTitular: [11, [Validators.required, Validators.min(1)]],
      cupoSuplente: [5, [Validators.required, Validators.min(0)]],
      teamIdEnApi: [0, [Validators.min(1)]],
      matchdayNumber: [1, [Validators.required, Validators.min(1)]],
      gameMatchId: [null],
      season: [''],
      limiteMin: [500000, [Validators.required]],
      limiteMax: [15000000, [Validators.required]],
    });
  }

  openAction(action: SuperadminAction): void {
    this.currentAction = action;
    this.errorMessage = '';
    this.successMessage = '';
    this.result = null;
  }

  get currentActionTitle(): string {
    if (!this.currentAction) return 'Configurar acción';
    return this.actionConfig[this.currentAction].title;
  }

  get currentFields(): ActionField[] {
    if (!this.currentAction) return [];
    return this.actionConfig[this.currentAction].fields;
  }

  closeModal(): void {
    this.currentAction = null;
  }

  logout(): void {
    this.authService.clearSession();
    this.router.navigate(['/logIn']);
  }

  submitAction(): void {
    if (!this.currentAction) return;
    this.errorMessage = '';
    this.successMessage = '';
    this.result = null;

    const form = this.actionForm.getRawValue();

    if (this.currentAction === 'syncPlayedMatchResults') {
      const competitionId = Number(form.competitionId);
      if (!Number.isFinite(competitionId) || competitionId <= 0) {
        this.errorMessage = 'Ingresá un competitionId válido (> 0).';
        return;
      }
      this.runSyncPlayedResults(competitionId);
      return;
    }

    if (this.currentAction === 'persistPlayers') {
      const leagueIdEnApi = Number(form.leagueIdEnApi);
      if (!Number.isFinite(leagueIdEnApi) || leagueIdEnApi <= 0) {
        this.errorMessage = 'Ingresá un leagueIdEnApi válido (> 0).';
        return;
      }
      this.runPersistPlayersSync(leagueIdEnApi);
      return;
    }

    if (this.currentAction === 'persistFixture') {
      const competitionId = Number(form.competitionId);
      const seasonId = Number(form.seasonId);
      if (!Number.isFinite(competitionId) || competitionId <= 0) {
        this.errorMessage = 'Ingresá un competitionId válido (> 0).';
        return;
      }
      if (!Number.isFinite(seasonId) || seasonId <= 0) {
        this.errorMessage = 'Ingresá un seasonId válido (> 0).';
        return;
      }
      this.runPersistFixtureBuild(competitionId, seasonId);
      return;
    }

    if (this.currentAction === 'getPersistedFixture') {
      const leagueId = Number(form.leagueId);

      if (!Number.isFinite(leagueId) || leagueId <= 0) {
        this.errorMessage = 'Ingresá un League ID válido.';
        return;
      }

      this.closeModal();
      this.router.navigate(['/fixture'], { queryParams: { leagueId } });
      return;
    }

    if (this.currentAction === 'translateRealPlayerPrices') {
      const leagueId = Number(form.leagueId);
      if (!Number.isFinite(leagueId) || leagueId <= 0) {
        this.errorMessage = 'Ingresá un leagueId válido (> 0).';
        return;
      }
      this.runTranslatePricesSync(leagueId);
      return;
    }

    this.isLoading = true;

    const requests: Record<SuperadminAction, () => any> = {
      persistPlayers: () => this.apiService.syncPlayersByLeagueIdEnApi({ leagueIdEnApi: Number(form.leagueIdEnApi) }),
      persistTeams: () => this.apiService.syncTeamsByLeagueIdEnApi({ leagueIdEnApi: Number(form.leagueIdEnApi) }),
      persistSport: () => this.apiService.postSport({
        idEnApi: Number(form.sportId),
        descripcion: String(form.descripcion),
        cupoTitular: Number(form.cupoTitular),
        cupoSuplente: Number(form.cupoSuplente),
      }),
      persistLeague: () => this.apiService.syncLeagueByIdEnApi({
        // Si country queda vacío, el backend usa lookup directo por tournament/idEnApi.
        country: String(form.country ?? '').trim() || null,
        kncokoutStage: Boolean(form.kncokoutStage),
        competitionFormat: String(form.competitionFormat ?? 'league_only') as 'league_only' | 'knockout_only' | 'mixed',
        hasGroups: Boolean(form.hasGroups),
        hasTwoLegKnockout: Boolean(form.hasTwoLegKnockout),
        idEnApi: Number(form.idEnApi),
        limiteMin: Number.isFinite(Number(form.limiteMin)) ? Number(form.limiteMin) : null,
        limiteMax: Number.isFinite(Number(form.limiteMax)) ? Number(form.limiteMax) : null,
      }),
      persistUltSeason: () => this.apiService.syncUltSeasonByLeagueIdEnApi({ leagueIdEnApi: Number(form.leagueIdEnApi) }),
      persistFixture: () => this.apiService.postExternalFixtureBuildCompetition({
        competitionId: Number(form.competitionId),
        seasonId: Number(form.seasonId),
      }),
      persistLeagueKnockoutStage: () => this.apiService.syncLeagueKnockoutStageByLeagueIdEnApi({
        leagueIdEnApi: Number(form.leagueIdEnApi),
      }),
      getPersistedFixture: () => this.apiService.searchExternalLocalPersistedFixture({ leagueId: Number(form.leagueId) }),
      getAllUsers: () => this.apiService.searchUsers(),
      getAllSports: () => this.apiService.searchSports(),
      getAllLeagues: () => this.apiService.searchLeagues(),
      getAllRealTeams: () => this.apiService.searchRealTeams(),
      getAllRealTeamLeagueParticipations: () => this.apiService.searchRealTeamLeagueParticipations(),
      getAllRealPlayers: () => this.apiService.searchRealPlayers(),
      getAllTournaments: () => this.apiService.searchTournaments(),
      getAllParticipants: () => this.apiService.searchParticipants(),
      getAllParticipantSquads: () => this.apiService.searchParticipantSquads(),
      getAllMatchdays: () => this.apiService.searchMatchdays(),
      getAllMatches: () => this.apiService.searchGameMatches(),
      getAllMatchdayMarkets: () => this.apiService.searchMatchdayMarkets(),
      getAllBids: () => this.apiService.searchBids(),
      getAllNegotiations: () => this.apiService.searchNegotiations(),
      getAllTransactions: () => this.apiService.searchTransactions(),
      getAllPlayerPerformances: () => this.apiService.searchPlayerPerformances(),
      getAllPlayerPointsBreakdowns: () => this.apiService.searchPlayerPointsBreakdowns(),
      getAllParticipantMatchdayPoints: () => this.apiService.searchParticipantMatchdayPoints(),
      getMatchdayAutomationSchedule: () => this.apiService.getTournamentMatchdayAutomationSchedule(),
      getLeaguesTournamentCounts: () => forkJoin({
        leaguesResponse: this.apiService.searchLeagues(),
        tournamentsResponse: this.apiService.searchTournaments(),
      }).pipe(
        map(({ leaguesResponse, tournamentsResponse }) => {
          const leagues = Array.isArray((leaguesResponse as any)?.data) ? (leaguesResponse as any).data : [];
          const tournaments = Array.isArray((tournamentsResponse as any)?.data) ? (tournamentsResponse as any).data : [];

          const tournamentCountByLeagueId = tournaments.reduce((acc: Map<number, number>, tournament: any) => {
            const leagueId = Number(tournament?.league?.id ?? tournament?.league);
            if (!Number.isFinite(leagueId) || leagueId <= 0) {
              return acc;
            }
            acc.set(leagueId, Number(acc.get(leagueId) ?? 0) + 1);
            return acc;
          }, new Map<number, number>());

          return {
            message: 'leagues persistidas con cantidad de tournaments',
            data: leagues.map((league: any) => {
              const leagueId = Number(league?.id);
              return {
                leagueId,
                leagueName: String(league?.name ?? '-'),
                idEnApi: Number(league?.idEnApi ?? 0),
                tournamentsCount: Number(tournamentCountByLeagueId.get(leagueId) ?? 0),
              };
            }),
          };
        }),
      ),
      rankingsByDate: () => this.apiService.searchExternalRankingsWithLocalPerformances(Number(form.competitionId)),
      updateTeamSquad: () => this.apiService.syncPlayersByLeagueIdEnApi({ leagueId: Number(form.leagueId) }),
      syncPlayedMatchResults: () => this.apiService.postExternalSyncPlayedResults({ competitionId: Number(form.competitionId) }),
      sumEndOfMatchdayPoints: () => this.apiService.postTournamentSumEndOfMatchdayPoints({
        leagueId: Number(form.leagueId),
        matchdayNumber: Number(form.matchdayNumber),
        season: String(form.season ?? '').trim() || undefined,
        gameMatchId: Number(form.gameMatchId) > 0 ? Number(form.gameMatchId) : undefined,
      }),
      settleMarketByLeague: () => this.apiService.postTournamentSettleMarketAndRefreshByLeague({ leagueId: Number(form.leagueId) }),
      translateRealPlayerPrices: () => this.apiService.postRealPlayerTranslatePricesByLeague({
        leagueId: Number(form.leagueId),
      }),
    };

    requests[this.currentAction]().pipe(finalize(() => this.isLoading = false)).subscribe({
      next: (response: any) => {
        this.successMessage = 'Operación ejecutada correctamente.';
        this.result = response;
      },
      error: (error: any) => {
        this.errorMessage = error?.error?.message ?? 'No se pudo ejecutar la operación.';
      }
    });
  }

  private runSyncPlayedResults(competitionId: number): void {
    this.isLoading = true;

    this.apiService.postExternalSyncPlayedResults({ competitionId }).pipe(
      switchMap((response) => {
        const job = response?.data;
        if (!job?.jobId) {
          throw new Error('No se recibió jobId de sincronización.');
        }

        this.successMessage = 'Sincronización iniciada. Consultando progreso...';
        this.result = { ...response, polling: true };

        return interval(3000).pipe(
          switchMap(() => this.apiService.getExternalSyncPlayedResultsJob(job.jobId)),
          takeWhile((jobResponse) => {
            const status = jobResponse?.data?.status;
            return status === 'queued' || status === 'running';
          }, true),
        );
      }),
      finalize(() => {
        this.isLoading = false;
      }),
    ).subscribe({
      next: (jobResponse: { message: string; data: SyncPlayedResultsJob }) => {
        this.result = jobResponse;

        if (jobResponse.data.status === 'completed') {
          this.successMessage = 'Sincronización completada correctamente.';
          return;
        }

        if (jobResponse.data.status === 'failed') {
          this.errorMessage = jobResponse.data.lastError ?? 'La sincronización falló.';
          return;
        }

        this.successMessage = 'Sincronización en progreso...';
      },
      error: (error: any) => {
        this.errorMessage = error?.error?.message ?? 'No se pudo ejecutar la sincronización.';
      },
    });
  }

  private runPersistPlayersSync(leagueIdEnApi: number): void {
    this.isLoading = true;

    this.apiService.syncPlayersByLeagueIdEnApi({ leagueIdEnApi }).pipe(
      switchMap((response) => {
        const job = response?.data;
        if (!job?.jobId) {
          throw new Error('No se recibió jobId de sincronización de jugadores.');
        }

        this.successMessage = 'Sincronización de jugadores iniciada. Consultando progreso...';
        this.result = { ...response, polling: true };

        return interval(3000).pipe(
          switchMap(() => this.apiService.getSyncPlayersByLeagueJob(job.jobId)),
          takeWhile((jobResponse) => {
            const status = jobResponse?.data?.status;
            return status === 'queued' || status === 'running';
          }, true),
        );
      }),
      finalize(() => {
        this.isLoading = false;
      }),
    ).subscribe({
      next: (jobResponse: { message: string; data: SyncPlayersByLeagueJob }) => {
        this.result = jobResponse;

        if (jobResponse.data.status === 'completed') {
          this.successMessage = 'Sincronización de jugadores completada correctamente.';
          return;
        }

        if (jobResponse.data.status === 'failed') {
          this.errorMessage = jobResponse.data.lastError ?? 'La sincronización de jugadores falló.';
          return;
        }

        this.successMessage = 'Sincronización de jugadores en progreso...';
      },
      error: (error: any) => {
        this.errorMessage = error?.error?.message ?? 'No se pudo ejecutar la sincronización de jugadores.';
      },
    });
  }

  private runPersistFixtureBuild(competitionId: number, seasonId: number): void {
    this.isLoading = true;

    this.apiService.postExternalFixtureBuildCompetition({ competitionId, seasonId }).pipe(
      switchMap((response) => {
        const job = response?.data;
        if (!job?.jobId) {
          throw new Error('No se recibió jobId de persistencia de fixture.');
        }

        this.successMessage = 'Persistencia de fixture iniciada. Consultando progreso...';
        this.result = { ...response, polling: true };

        return interval(3000).pipe(
          switchMap(() => this.apiService.getExternalFixtureBuildCompetitionJob(job.jobId)),
          takeWhile((jobResponse) => {
            const status = jobResponse?.data?.status;
            return status === 'queued' || status === 'running';
          }, true),
        );
      }),
      finalize(() => {
        this.isLoading = false;
      }),
    ).subscribe({
      next: (jobResponse: { message: string; data: BuildCompetitionFixtureJob }) => {
        this.result = jobResponse;

        if (jobResponse.data.status === 'completed') {
          this.successMessage = 'Persistencia de fixture completada correctamente.';
          return;
        }

        if (jobResponse.data.status === 'failed') {
          this.errorMessage = jobResponse.data.lastError ?? 'La persistencia de fixture falló.';
          return;
        }

        this.successMessage = 'Persistencia de fixture en progreso...';
      },
      error: (error: any) => {
        this.errorMessage = error?.error?.message ?? 'No se pudo ejecutar la persistencia de fixture.';
      },
    });
  }

  private runTranslatePricesSync(leagueId: number): void {
    this.isLoading = true;

    this.apiService.postRealPlayerTranslatePricesByLeague({ leagueId }).pipe(
      switchMap((response) => {
        const job = response?.data;
        if (!job?.jobId) {
          throw new Error('No se recibió jobId de traducción de precios.');
        }

        this.successMessage = 'Traducción de precios iniciada. Consultando progreso...';
        this.result = { ...response, polling: true };

        return interval(3000).pipe(
          switchMap(() => this.apiService.getTranslatePricesByLeagueJob(job.jobId)),
          takeWhile((jobResponse) => {
            const status = jobResponse?.data?.status;
            return status === 'queued' || status === 'running';
          }, true),
        );
      }),
      finalize(() => {
        this.isLoading = false;
      }),
    ).subscribe({
      next: (jobResponse: { message: string; data: TranslatePricesJob }) => {
        this.result = jobResponse;

        if (jobResponse.data.status === 'completed') {
          this.successMessage = 'Traducción de precios completada correctamente.';
          return;
        }

        if (jobResponse.data.status === 'failed') {
          this.errorMessage = jobResponse.data.lastError ?? 'La traducción de precios falló.';
          return;
        }

        this.successMessage = 'Traducción de precios en progreso...';
      },
      error: (error: any) => {
        this.errorMessage = error?.error?.message ?? 'No se pudo ejecutar la traducción de precios.';
      },
    });
  }
}
