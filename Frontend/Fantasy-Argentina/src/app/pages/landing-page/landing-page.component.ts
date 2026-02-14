import { Component, OnInit } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
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
  leagues: Array<{ id: number; name: string }> = [];
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
      league: [0, [Validators.required, Validators.min(1)]],
      initialBudget: [1000000, [Validators.required, Validators.min(100000)]],
      squadSize: [11, [Validators.required, Validators.min(5)]],
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

    this.apiService.postTournament({
      ...formValue,
      creationDate,
      clauseEnableDate
    }).pipe(finalize(() => this.isCreating = false)).subscribe({
      next: ({ data: createdTournament }) => {
        this.apiService.postParticipant({
          user: userId,
          tournament: createdTournament.id ?? 0,
          bankBudget: formValue.initialBudget,
          reservedMoney: 0,
          availableMoney: formValue.initialBudget,
          totalScore: 0,
          joinDate: new Date()
        }).subscribe({
          next: () => {
            this.showCreateForm = false;
            this.createTournamentForm.reset({
              name: '',
              league: formValue.league,
              initialBudget: 1000000,
              squadSize: 11,
              status: 'active'
            });
            this.loadTournaments(userId);
          },
          error: () => {
            this.errorMessage = 'Torneo creado, pero no se pudo unir el usuario automáticamente.';
            this.loadTournaments(userId);
          }
        });
      },
      error: () => {
        this.errorMessage = 'No pudimos crear el torneo. Intentá nuevamente.';
      }
    });
  }

  private loadTournaments(userId: number): void {
    this.isLoading = true;
    this.errorMessage = '';

    forkJoin({
      leagues: this.apiService.searchLeagues().pipe(catchError(() => of({ data: [] }))),
      participants: this.apiService.searchParticipants(),
      tournaments: this.apiService.searchTournaments()
    }).pipe(finalize(() => this.isLoading = false)).subscribe({
      next: ({ leagues, participants, tournaments }) => {
        this.leagues = leagues.data
          .filter((league) => league.id !== undefined)
          .map((league) => ({ id: league.id as number, name: league.name }));

        const selectedLeagueId = this.createTournamentForm.controls.league.value;
        if (!selectedLeagueId && this.leagues.length > 0) {
          this.createTournamentForm.patchValue({ league: this.leagues[0].id });
        }

        const joinedTournamentIds = new Set(
          participants.data
            .filter(participant => participant.user === userId)
            .map(participant => participant.tournament)
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
