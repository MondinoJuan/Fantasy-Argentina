import { Component, OnInit } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin, of, throwError } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { map, switchMap } from 'rxjs';
import { ApiService } from '../../servicios/api.service';
import { LoadingSpinnerComponent } from '../../components/loading-spinner/loading-spinner.component';
import { tournamentI } from '../../modelos/tournament.interface';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [DatePipe, DecimalPipe, FormsModule, ReactiveFormsModule, LoadingSpinnerComponent],
  templateUrl: './landing-page.component.html',
  styleUrl: './landing-page.component.scss'
})
export class LandingPageComponent implements OnInit {
  tournaments: tournamentI[] = [];
  readonly allowedLeagues = [
    'Liga Profesional',
    'Premier League',
    'La Liga',
    'Bundesliga',
    'Serie A',
    'Ligue 1',
  ];
  readonly sportOptions = [
    { idEnApi: 1, label: 'Football', descripcion: 'Football', cupoTitular: 11, cupoSuplente: 5 },
    { idEnApi: 2, label: 'Basket', descripcion: 'Basketball', cupoTitular: 5, cupoSuplente: 3 },
  ];
  searchTerm = '';
  isLoading = true;
  isCreating = false;
  showCreateForm = false;
  menuOpen = false;
  errorMessage = '';

  readonly createTournamentForm;

  get username(): string {
    return localStorage.getItem('currentUsername') ?? 'DT';
  }

  get filteredTournaments(): tournamentI[] {
    const value = this.searchTerm.trim().toLowerCase();
    if (!value) {
      return this.tournaments;
    }

    return this.tournaments.filter((tournament) => tournament.name.toLowerCase().includes(value));
  }

  constructor(
    private readonly fb: FormBuilder,
    private readonly apiService: ApiService,
    private readonly router: Router
  ) {
    this.createTournamentForm = this.fb.nonNullable.group({
      name: ['', [Validators.required, Validators.minLength(4)]],
      leagueName: ['', Validators.required],
      sportIdEnApi: [1, Validators.required],
      initialBudget: [1000000, [Validators.required, Validators.min(100000)]],
      status: ['active', Validators.required]
    });
  }

  ngOnInit(): void {
    const userId = Number(localStorage.getItem('currentUserId'));

    if (!userId) {
      this.router.navigate(['/logIn']);
      return;
    }

    this.loadTournaments(userId);
  }

  toggleCreateForm(): void {
    this.showCreateForm = !this.showCreateForm;

    if (!this.showCreateForm) {
      this.errorMessage = '';
    }
  }

  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
  }

  closeMenu(): void {
    this.menuOpen = false;
  }

  goToUserSettings(): void {
    this.closeMenu();
    this.router.navigate(['/user-settings']);
  }

  logout(): void {
    this.closeMenu();
    localStorage.removeItem('currentUserId');
    localStorage.removeItem('currentUsername');
    this.router.navigate(['/logIn']);
  }

  createTournament(): void {
    this.errorMessage = '';

    if (this.createTournamentForm.invalid) {
      this.createTournamentForm.markAllAsTouched();
      return;
    }

    const userId = Number(localStorage.getItem('currentUserId'));
    if (!userId) {
      this.router.navigate(['/logIn']);
      return;
    }

    this.isCreating = true;

    const formValue = this.createTournamentForm.getRawValue();
    const creationDate = new Date();
    const clauseEnableDate = new Date(creationDate);
    clauseEnableDate.setDate(clauseEnableDate.getDate() + 14);

    // API-EXTERNA: antes de crear el torneo garantizamos que exista la liga en BD local.
    // Si la liga existe la busca en la base de datos local, si no existe la busca en la API externa con el endpoint y persiste los datos de la misma
    // y de los equipos en la base de datos local.

    let idLeague_ExternalAPI = Number();

    switch (formValue.leagueName) {
      case 'Liga Profesional':
        idLeague_ExternalAPI = 72;
        break;
      case 'Premier League':
        idLeague_ExternalAPI = 7;
        break;
      case 'La Liga':
        idLeague_ExternalAPI = 11;
        break;
      case 'Bundesliga':
        idLeague_ExternalAPI = 25;
        break;
      case 'Serie A':
        idLeague_ExternalAPI = 17;
        break;
      case 'Ligue 1':
        idLeague_ExternalAPI = 35;
        break;
    }

    if (!idLeague_ExternalAPI) {
      this.errorMessage = 'Liga inválida. Elegí una liga de la lista.';
      this.isCreating = false;
      return;
    }

    // 1) Garantizar deporte local (si no existe por idEnApi, se crea).
    // 2) Consultar endpoint externo de competition-teams para validar la competencia.
    // 3) Crear torneo delegando al backend la persistencia de liga/equipos/jugadores y fixture.
    const selectedSport = this.sportOptions.find((sport) => sport.idEnApi === Number(formValue.sportIdEnApi));

    this.ensureSportInLocalDb(formValue.sportIdEnApi).pipe(
      switchMap(() => this.apiService.searchExternalCompetitionTeams(formValue.sportIdEnApi, idLeague_ExternalAPI)),
      switchMap(() => this.apiService.postTournament({
        name: formValue.name.trim(),
        league: idLeague_ExternalAPI,
        sport: selectedSport?.descripcion ?? 'Football',
        sportId: Number(formValue.sportIdEnApi),
        competitionId: idLeague_ExternalAPI,
        creationDate,
        initialBudget: Number(formValue.initialBudget),
        squadSize: 16,
        status: formValue.status,
        clauseEnableDate,
        creatorUserId: userId,
      })),
      finalize(() => this.isCreating = false),
      catchError((error) => {
        const backendMessage = error?.error?.message;
        this.errorMessage = backendMessage ?? error?.message ?? 'No pudimos crear el torneo.';
        return throwError(() => error);
      })
    ).subscribe({
      next: () => {
        this.showCreateForm = false;
        this.createTournamentForm.reset({
          name: '',
          leagueName: this.allowedLeagues[0] ?? '',
          sportIdEnApi: 1,
          initialBudget: 1000000,
          status: 'active',
        });

        // Debo recuperar de la base de datos los players que perteneceran al equipo del participant.

        this.loadTournaments(userId);
      },
      error: () => {
        // El mensaje ya se setea en catchError.
      }
    });
  }

  private ensureSportInLocalDb(sportIdEnApi: number) {
    const sportSeed = this.sportOptions.find((sport) => sport.idEnApi === Number(sportIdEnApi));

    if (!sportSeed) {
      return throwError(() => new Error('Deporte inválido. Elegí una opción del selector.'));
    }

    return this.apiService.searchSports().pipe(
      map((sportsResponse) => sportsResponse.data.find((sport) => sport.idEnApi === sportSeed.idEnApi)),
      switchMap((existingSport) => {
        if (existingSport?.id) {
          return of(existingSport.id);
        }

        return this.apiService.postSport({
          idEnApi: sportSeed.idEnApi,
          descripcion: sportSeed.descripcion,
          cupoTitular: sportSeed.cupoTitular,
          cupoSuplente: sportSeed.cupoSuplente,
        }).pipe(
          map((createResponse) => {
            if (!createResponse.data?.id) {
              throw new Error('No se pudo persistir el deporte seleccionado en la BD local.');
            }

            return createResponse.data.id;
          })
        );
      })
    );
  }


  private extractEntityId(value: number | { id?: number } | undefined | null): number | null {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }

    if (value && typeof value === 'object' && typeof value.id === 'number') {
      return value.id;
    }

    return null;
  }

  private loadTournaments(userId: number): void {
    this.isLoading = true;
    this.errorMessage = '';

    if (!this.createTournamentForm.controls.leagueName.value && this.allowedLeagues.length > 0) {
      this.createTournamentForm.patchValue({ leagueName: this.allowedLeagues[0] });
    }

    forkJoin({
      participants: this.apiService.searchParticipants(),
      tournaments: this.apiService.searchTournaments()
    }).pipe(finalize(() => this.isLoading = false)).subscribe({
      next: ({ participants, tournaments }) => {
        const joinedTournamentIds = new Set(
          participants.data
            .filter((participant) => this.extractEntityId(participant.user) === userId)
            .map((participant) => this.extractEntityId(participant.tournament))
            .filter((tournamentId): tournamentId is number => tournamentId !== null)
        );

        this.tournaments = tournaments.data.filter((tournament) =>
          tournament.id ? joinedTournamentIds.has(tournament.id) : false
        );
      },
      error: () => {
        this.errorMessage = 'No pudimos cargar tus torneos por un problema de conexión.';
      }
    });
  }
}
