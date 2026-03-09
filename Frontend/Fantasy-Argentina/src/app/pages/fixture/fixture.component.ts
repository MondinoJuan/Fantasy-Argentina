import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../servicios/api.service';
import { Location } from '@angular/common';

interface MatchView {
  id?: number;
  gameId?: string;
  homeTeam: string;
  awayTeam: string;
  startDateTime: Date;
  result: string;
  status: string;
}

interface MatchdayGroup {
  matchdayId?: number;
  matchdayNumber: number;
  season: string;
  startDate: Date;
  endDate: Date;
  matches: MatchView[];
}

@Component({
  selector: 'app-fixture',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './fixture.component.html',
  styleUrl: './fixture.component.scss'
})
export class FixtureComponent implements OnInit {
  matchdayGroups: MatchdayGroup[] = [];
  isLoading = true;
  errorMessage = '';

  constructor(
    private readonly apiService: ApiService,
    private readonly location: Location,
  ) {}

  ngOnInit(): void {
    this.loadFixtureFromLocalDb();
  }

  private loadFixtureFromLocalDb(): void {
    this.isLoading = true;
    this.errorMessage = '';

    forkJoin({
      matchdaysResponse: this.apiService.searchMatchdays(),
      matchesResponse: this.apiService.searchMatches(),
    }).subscribe({
      next: ({ matchdaysResponse, matchesResponse }) => {
        const matchdays = [...matchdaysResponse.data]
          .sort((a, b) => {
            const byDate = new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
            if (byDate !== 0) return byDate;
            return (a.matchdayNumber ?? 0) - (b.matchdayNumber ?? 0);
          });

        const grouped = matchdays.map((matchday) => {
          const matchdayId = matchday.id;
          const matches = matchesResponse.data
            .filter((match) => this.extractId(match.matchday) === matchdayId)
            .sort((a, b) => new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime())
            .map((match) => ({
              id: match.id,
              gameId: match.externalApiId,
              homeTeam: match.homeTeam,
              awayTeam: match.awayTeam,
              startDateTime: new Date(match.startDateTime),
              result: this.resolveResult(match.status),
              status: match.status,
            }));

          return {
            matchdayId,
            matchdayNumber: matchday.matchdayNumber,
            season: matchday.season,
            startDate: new Date(matchday.startDate),
            endDate: new Date(matchday.endDate),
            matches,
          } satisfies MatchdayGroup;
        });

        this.matchdayGroups = grouped;
        this.isLoading = false;
      },
      error: () => {
        this.errorMessage = 'No se pudo recuperar el fixture desde la base de datos local.';
        this.isLoading = false;
      }
    });
  }

  goBack(): void {
    this.location.back();
  }

  private extractId(value: number | string | { id?: number | string } | undefined | null): number | null {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'string') {
      const parsed = Number.parseInt(value, 10);
      return Number.isFinite(parsed) ? parsed : null;
    }

    if (value && typeof value === 'object') {
      const id = value.id;
      if (typeof id === 'number' && Number.isFinite(id)) return id;
      if (typeof id === 'string') {
        const parsed = Number.parseInt(id, 10);
        return Number.isFinite(parsed) ? parsed : null;
      }
    }

    return null;
  }

  private resolveResult(status: string): string {
    const normalized = String(status ?? '').trim();
    const scoreMatch = normalized.match(/(\d+)\s*[-:]\s*(\d+)/);

    if (scoreMatch) {
      return `${scoreMatch[1]} - ${scoreMatch[2]}`;
    }

    if (['finished', 'finalizado', 'final', 'ended'].includes(normalized.toLowerCase())) {
      return 'Finalizado (sin marcador cargado)';
    }

    return 'Pendiente';
  }
}
