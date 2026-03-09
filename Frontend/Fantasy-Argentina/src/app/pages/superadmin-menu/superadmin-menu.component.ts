import { CommonModule, JsonPipe } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { ApiService } from '../../servicios/api.service';

type SuperadminAction =
  | 'persistPlayers'
  | 'persistTeams'
  | 'persistSport'
  | 'persistLeague'
  | 'persistFixture'
  | 'rankingsByDate'
  | 'updateTeamSquad'
  | 'syncPlayedMatchResults';

type ActionField = 'sportId' | 'competitionId' | 'leagueId' | 'leagueIdEnApi' | 'idEnApi' | 'descripcion' | 'cupoTitular' | 'cupoSuplente' | 'teamIdEnApi';

const FIELD_LABELS: Record<ActionField, string> = {
  sportId: 'Sport ID',
  competitionId: 'Competition ID',
  leagueId: 'League ID local (BDD)',
  leagueIdEnApi: 'League ID en API',
  idEnApi: 'League idEnApi (alta liga)',
  descripcion: 'Descripción deporte',
  cupoTitular: 'Cupo titular',
  cupoSuplente: 'Cupo suplente',
  teamIdEnApi: 'Team ID en API',
};

const ACTION_CONFIG: Record<SuperadminAction, { title: string; fields: ActionField[] }> = {
  persistPlayers: {
    title: 'Persistir jugadores',
    fields: ['leagueId'],
  },
  persistTeams: {
    title: 'Persistir equipos',
    fields: ['leagueIdEnApi'],
  },
  persistSport: {
    title: 'Persistir deporte',
    fields: ['sportId', 'descripcion', 'cupoTitular', 'cupoSuplente'],
  },
  persistLeague: {
    title: 'Persistir liga',
    fields: ['sportId', 'idEnApi'],
  },
  persistFixture: {
    title: 'Persistir fixture',
    fields: ['sportId', 'competitionId'],
  },
  rankingsByDate: {
    title: 'Recuperar rankings por jugador/fecha',
    fields: ['sportId', 'competitionId'],
  },
  updateTeamSquad: {
    title: 'Actualizar plantilla de equipo',
    fields: ['teamIdEnApi'],
  },
  syncPlayedMatchResults: {
    title: 'Actualizar resultados jugados',
    fields: ['competitionId'],
  },
};

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
  readonly actionConfig = ACTION_CONFIG;
  readonly fieldLabels = FIELD_LABELS;

  constructor(
    private readonly fb: FormBuilder,
    private readonly apiService: ApiService,
    private readonly router: Router,
  ) {
    this.actionForm = this.fb.group({
      sportId: [1, [Validators.required, Validators.min(1)]],
      competitionId: [72, [Validators.required, Validators.min(1)]],
      leagueId: [1, [Validators.required, Validators.min(1)]],
      leagueIdEnApi: [72, [Validators.required, Validators.min(1)]],
      idEnApi: [72, [Validators.required, Validators.min(1)]],
      descripcion: ['Football', Validators.required],
      cupoTitular: [11, [Validators.required, Validators.min(1)]],
      cupoSuplente: [5, [Validators.required, Validators.min(0)]],
      teamIdEnApi: [0, [Validators.min(1)]],
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
    localStorage.removeItem('currentUserId');
    localStorage.removeItem('currentUsername');
    localStorage.removeItem('currentUserType');
    this.router.navigate(['/logIn']);
  }

  goToFixture(): void {
    this.router.navigate(['/fixture']);
  }

  submitAction(): void {
    if (!this.currentAction) return;
    this.errorMessage = '';
    this.successMessage = '';
    this.result = null;

    const form = this.actionForm.getRawValue();
    this.isLoading = true;

    const requests: Record<SuperadminAction, () => any> = {
      persistPlayers: () => this.apiService.syncPlayersByLeagueIdEnApi({ leagueId: Number(form.leagueId) }),
      persistTeams: () => this.apiService.syncTeamsByLeagueIdEnApi({ leagueIdEnApi: Number(form.leagueIdEnApi) }),
      persistSport: () => this.apiService.postSport({
        idEnApi: Number(form.sportId),
        descripcion: String(form.descripcion),
        cupoTitular: Number(form.cupoTitular),
        cupoSuplente: Number(form.cupoSuplente),
      }),
      persistLeague: () => this.apiService.syncLeagueByIdEnApi({ sportId: Number(form.sportId), idEnApi: Number(form.idEnApi) }),
      persistFixture: () => this.apiService.postExternalFixtureBuildCompetition({ sportId: Number(form.sportId), competitionId: Number(form.competitionId) }),
      rankingsByDate: () => this.apiService.searchExternalRankingsWithLocalPerformances(Number(form.sportId), Number(form.competitionId)),
      updateTeamSquad: () => this.apiService.syncTeamSquadByTeamIdEnApi({ teamIdEnApi: Number(form.teamIdEnApi) }),
      syncPlayedMatchResults: () => this.apiService.postExternalSyncPlayedResults({ competitionId: Number(form.competitionId) }),
    };

    requests[this.currentAction]().pipe(finalize(() => this.isLoading = false)).subscribe({
      next: (response: any) => {
        this.successMessage = 'Operación ejecutada correctamente.';
        this.result = response;
        if (this.currentAction === 'persistFixture') {
          localStorage.setItem('latestFixtureBuild', JSON.stringify(response?.data ?? response));
          this.router.navigate(['/fixture']);
        }
      },
      error: (error: any) => {
        this.errorMessage = error?.error?.message ?? 'No se pudo ejecutar la operación.';
      }
    });
  }
}
