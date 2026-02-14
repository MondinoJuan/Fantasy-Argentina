import { Component, OnInit } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { finalize, switchMap } from 'rxjs/operators';
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
  ];
  readonly sportOptions = ['Football', 'Basketball'];
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
      sport: ['Football', Validators.required],
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
    this.apiService.ensureLeagueByName(formValue.leagueName).pipe(
      switchMap((leagueResponse) => this.apiService.postTournament({
        name: formValue.name,
        league: leagueResponse.data.id as number,
        sport: formValue.sport,
        initialBudget: formValue.initialBudget,
        status: formValue.status,
        squadSize: 16,
        creationDate,
        clauseEnableDate,
        creatorUserId: userId,
      })),
      finalize(() => this.isCreating = false)
    ).subscribe({
      next: () => {
        this.showCreateForm = false;
        this.createTournamentForm.reset({
          name: '',
          leagueName: formValue.leagueName,
          sport: formValue.sport,
          initialBudget: 1000000,
          status: 'active'
        });
        this.loadTournaments(userId);
      },
      error: () => {
        this.errorMessage = 'No pudimos crear el torneo. Intentá nuevamente.';
      }
    });
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
