import { Component, OnInit } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { ApiService } from '../../servicios/api.service';
import { LoadingSpinnerComponent } from '../../components/loading-spinner/loading-spinner.component';
import { tournamentI } from '../../modelos/tournament.interface';
import { TournamentStatus } from '../../modelos/domain-enums.types';

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

    return this.tournaments.filter((tournament: any) => tournament.name.toLowerCase().includes(value));
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
    localStorage.removeItem('currentUserType');
    this.router.navigate(['/logIn']);
  }

  createTournament(): void {

  }



  openTournament(tournamentId?: number): void {
    if (!tournamentId) return;
    this.router.navigate(['/inside-tournament'], { queryParams: { tournamentId } });
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
      next: ({ participants, tournaments }: any) => {
        const joinedTournamentIds = new Set(
          participants.data
            .filter((participant: any) => this.extractEntityId(participant.user) === userId)
            .map((participant: any) => this.extractEntityId(participant.tournament))
            .filter((tournamentId: any): tournamentId is number => tournamentId !== null)
        );

        this.tournaments = tournaments.data.filter((tournament: any) =>
          tournament.id ? joinedTournamentIds.has(tournament.id) : false
        );
      },
      error: () => {
        this.errorMessage = 'No pudimos cargar tus torneos por un problema de conexión.';
      }
    });
  }
}
