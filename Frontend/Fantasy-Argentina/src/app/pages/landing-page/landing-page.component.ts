import { Component, OnInit } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { ApiService } from '../../servicios/api.service';
import { LoadingSpinnerComponent } from '../../components/loading-spinner/loading-spinner.component';
import { tournamentI } from '../../modelos/tournament.interface';
import { leagueI } from '../../modelos/league.interface';
import { TournamentStatus } from '../../modelos/domain-enums.types';
import { AuthService } from '../../servicios/auth.service';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [DatePipe, DecimalPipe, FormsModule, ReactiveFormsModule, LoadingSpinnerComponent],
  templateUrl: './landing-page.component.html',
  styleUrl: './landing-page.component.scss'
})
export class LandingPageComponent implements OnInit {
  tournaments: tournamentI[] = [];
  leagues: leagueI[] = [];
  readonly participantIdByTournamentId = new Map<number, number>();
  searchTerm = '';
  isLoading = true;
  isCreating = false;
  isJoining = false;
  isLeaving = false;
  showCreateForm = false;
  menuOpen = false;
  showLeaveModal = false;
  selectedTournamentToLeave: tournamentI | null = null;
  errorMessage = '';
  joinErrorMessage = '';

  readonly createTournamentForm;
  readonly joinTournamentForm;

  get username(): string {
    return this.authService.getCurrentUser()?.username ?? 'DT';
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
    private readonly authService: AuthService,
    private readonly router: Router
  ) {
    this.createTournamentForm = this.fb.nonNullable.group({
      name: ['', [Validators.required, Validators.minLength(4)]],
      leagueId: [0, [Validators.required, Validators.min(1)]],
      initialBudget: [20000000, [Validators.required, Validators.min(100000)]],
      clauseWaitDays: [14, [Validators.required, Validators.min(0), Validators.max(365)]],
      status: ['active', Validators.required],
      allowSquadChangesDuringMatchday: [false],
      allowClauseExecutionDuringMatchday: [false]
    });


    this.joinTournamentForm = this.fb.nonNullable.group({
      publicCode: ['', [Validators.required, Validators.minLength(3)]],
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
      this.joinErrorMessage = '';
      this.joinTournamentForm.reset({ publicCode: '' });
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
    this.authService.clearSession();
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
    const selectedLeagueId = Number(formValue.leagueId);

    if (!Number.isFinite(selectedLeagueId) || selectedLeagueId <= 0) {
      this.errorMessage = 'Liga inválida. Elegí una liga de la lista.';
      this.isCreating = false;
      return;
    }

    const selectedLeague = this.leagues.find((league) => Number(league.id) === selectedLeagueId);
    const clauseWaitDays = Number.isFinite(Number(formValue.clauseWaitDays)) ? Number(formValue.clauseWaitDays) : 14;

    this.apiService.postTournament({
      name: formValue.name.trim(),
      league: selectedLeagueId,
      sport: String(selectedLeague?.sport ?? 'Football'),
      initialBudget: Number.isFinite(Number(formValue.initialBudget)) && Number(formValue.initialBudget) > 0 ? Number(formValue.initialBudget) : 20000000,
      squadSize: 16,
      status: formValue.status as TournamentStatus,
      clauseWaitDays: Math.max(0, clauseWaitDays),
      creatorUserId: userId,
      allowSquadChangesDuringMatchday: Boolean(formValue.allowSquadChangesDuringMatchday),
      allowClauseExecutionDuringMatchday: Boolean(formValue.allowClauseExecutionDuringMatchday),
    }).pipe(
      finalize(() => this.isCreating = false),
        ).subscribe({
      next: (response) => {
        this.showCreateForm = false;
        this.createTournamentForm.reset({
          name: '',
          leagueId: this.leagues[0]?.id ?? 0,
          initialBudget: 20000000,
          clauseWaitDays: 14,
          status: 'active',
          allowSquadChangesDuringMatchday: false,
          allowClauseExecutionDuringMatchday: false,
        });

        // Debo recuperar de la base de datos los players que perteneceran al equipo del participant.

        const createdTournamentId = response?.data?.id;
        if (createdTournamentId) {
          this.router.navigate(['/inside-tournament'], { queryParams: { tournamentId: createdTournamentId } });
          return;
        }

        this.loadTournaments(userId);
      },
      error: (error) => {
        this.errorMessage = error?.error?.message ?? 'No pudimos crear el torneo.';
      }
    });
  }


  joinTournamentByCode(): void {
    this.joinErrorMessage = '';

    if (this.joinTournamentForm.invalid) {
      this.joinTournamentForm.markAllAsTouched();
      return;
    }

    const userId = Number(localStorage.getItem('currentUserId'));
    if (!userId) {
      this.router.navigate(['/logIn']);
      return;
    }

    const publicCode = this.joinTournamentForm.getRawValue().publicCode.trim().toUpperCase();

    if (!publicCode) {
      this.joinErrorMessage = 'Ingresá un código válido.';
      return;
    }

    this.isJoining = true;

    this.apiService.searchTournamentByPublicCode(publicCode).subscribe({
      next: (tournamentResponse: any) => {
        const tournamentId = Number(tournamentResponse?.data?.id);

        this.apiService.joinParticipantByTournamentCode({ userId, tournamentCode: publicCode }).pipe(
          finalize(() => this.isJoining = false),
        ).subscribe({
          next: () => {
            this.showCreateForm = false;
            this.joinTournamentForm.reset({ publicCode: '' });
            if (Number.isFinite(tournamentId) && tournamentId > 0) {
              this.router.navigate(['/inside-tournament'], { queryParams: { tournamentId } });
              return;
            }
            this.loadTournaments(userId);
          },
          error: (error) => {
            this.joinErrorMessage = error?.error?.message ?? 'No pudimos unirte al torneo con ese código.';
          }
        });
      },
      error: (error) => {
        this.isJoining = false;
        this.joinErrorMessage = error?.error?.message ?? 'No encontramos un torneo con ese código público.';
      }
    });
  }


  openTournament(tournamentId?: number): void {
    if (!tournamentId) return;
    this.router.navigate(['/inside-tournament'], { queryParams: { tournamentId } });
  }

  openLeaveTournamentModal(tournament: tournamentI, event: Event): void {
    event.stopPropagation();
    this.selectedTournamentToLeave = tournament;
    this.showLeaveModal = true;
    this.errorMessage = '';
  }

  closeLeaveTournamentModal(): void {
    this.showLeaveModal = false;
    this.selectedTournamentToLeave = null;
  }

  confirmLeaveTournament(): void {
    if (!this.selectedTournamentToLeave?.id || this.isLeaving) return;

    const userId = Number(localStorage.getItem('currentUserId'));
    if (!userId) {
      this.router.navigate(['/logIn']);
      return;
    }

    this.isLeaving = true;
    this.apiService.leaveParticipantTournament({
      userId,
      tournamentId: this.selectedTournamentToLeave.id,
    }).pipe(finalize(() => this.isLeaving = false)).subscribe({
      next: () => {
        this.closeLeaveTournamentModal();
        this.loadTournaments(userId);
      },
      error: (error) => {
        this.errorMessage = error?.error?.message ?? 'No se pudo eliminar tu participación del torneo.';
      }
    });
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

    forkJoin({
      participants: this.apiService.searchParticipants(),
      tournaments: this.apiService.searchTournaments(),
      leagues: this.apiService.searchLeagues(),
    }).pipe(finalize(() => this.isLoading = false)).subscribe({
      next: ({ participants, tournaments, leagues }: any) => {
        this.leagues = leagues?.data ?? [];
        this.participantIdByTournamentId.clear();

        if (!this.createTournamentForm.controls.leagueId.value && this.leagues.length > 0) {
          this.createTournamentForm.patchValue({ leagueId: this.leagues[0].id ?? 0 });
        }

        for (const participant of participants.data ?? []) {
          if (this.extractEntityId(participant.user) !== userId) continue;
          const tournamentId = this.extractEntityId(participant.tournament);
          const participantId = this.extractEntityId(participant.id);
          if (!tournamentId || !participantId) continue;
          this.participantIdByTournamentId.set(tournamentId, participantId);
        }

        const joinedTournamentIds = new Set(
          this.participantIdByTournamentId.keys()
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
