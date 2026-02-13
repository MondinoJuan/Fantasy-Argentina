import { Component, OnInit } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { ApiService } from '../../servicios/api.service';
import { LoadingSpinnerComponent } from '../../components/loading-spinner/loading-spinner.component';
import { tournamentI } from '../../modelos/tournament.interface';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [DatePipe, DecimalPipe, ReactiveFormsModule, LoadingSpinnerComponent],
  templateUrl: './landing-page.component.html',
  styleUrl: './landing-page.component.scss'
})
export class LandingPageComponent implements OnInit {
  tournaments: tournamentI[] = [];
  isLoading = true;
  isCreating = false;
  showCreateForm = false;
  errorMessage = '';

  readonly createTournamentForm;

  get username(): string {
    return localStorage.getItem('currentUsername') ?? 'DT';
  }

  constructor(
    private readonly fb: FormBuilder,
    private readonly apiService: ApiService,
    private readonly router: Router
  ) {
    this.createTournamentForm = this.fb.nonNullable.group({
      name: ['', [Validators.required, Validators.minLength(4)]],
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

    this.apiService.searchLeagues().pipe(
      catchError(() => of({ data: [] as Array<{ id?: number }> })),
    ).subscribe({
      next: ({ data }) => {
        const fallbackLeagueId = data[0]?.id ?? 1;

        this.apiService.postTournament({
          ...this.createTournamentForm.getRawValue(),
          league: fallbackLeagueId,
          creationDate: new Date(),
          clauseEnableDate: new Date()
        }).pipe(finalize(() => this.isCreating = false)).subscribe({
          next: ({ data: createdTournament }) => {
            this.apiService.postParticipant({
              user: userId,
              tournament: createdTournament.id ?? 0,
              bankBudget: this.createTournamentForm.getRawValue().initialBudget,
              reservedMoney: 0,
              availableMoney: this.createTournamentForm.getRawValue().initialBudget,
              totalScore: 0,
              joinDate: new Date()
            }).subscribe({
              next: () => {
                this.showCreateForm = false;
                this.createTournamentForm.patchValue({ status: 'active' });
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
      },
      error: () => {
        this.isCreating = false;
        this.errorMessage = 'No se pudo consultar la liga base para crear el torneo.';
      }
    });
  }

  private loadTournaments(userId: number): void {
    this.isLoading = true;
    this.errorMessage = '';

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
