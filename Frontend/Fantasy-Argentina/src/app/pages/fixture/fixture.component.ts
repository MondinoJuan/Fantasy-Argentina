import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
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
  homeScore: number | null;
  awayScore: number | null;
}

interface MatchdayGroup {
  matchdayId?: number;
  matchdayNumber: number;
  season: string;
  startDate: Date;
  endDate: Date;
  matches: MatchView[];
}

const DEFAULT_COMPETITION_ID = 72;

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

    this.apiService.searchExternalLocalPersistedFixture(DEFAULT_COMPETITION_ID).subscribe({
      next: (response: any) => {
        const groups = Array.isArray(response?.data?.matchdays) ? response.data.matchdays : [];

        this.matchdayGroups = groups
          .map((group: any) => ({
            matchdayId: this.extractId(group.matchdayId),
            matchdayNumber: Number(group.matchdayNumber ?? 0),
            season: String(group.season ?? '-'),
            startDate: new Date(String(group.startDate ?? new Date().toISOString())),
            endDate: new Date(String(group.endDate ?? new Date().toISOString())),
            matches: (Array.isArray(group.matches) ? group.matches : [])
              .map((match: any) => ({
                id: this.extractId(match.id) ?? undefined,
                gameId: String(match.externalApiId ?? ''),
                homeTeam: String(match.homeTeam ?? 'TBD'),
                awayTeam: String(match.awayTeam ?? 'TBD'),
                startDateTime: new Date(String(match.startDateTime ?? new Date().toISOString())),
                homeScore: this.parseNullableInt(match.homeScore),
                awayScore: this.parseNullableInt(match.awayScore),
                result: this.resolveResult(match.homeScore, match.awayScore, String(match.status ?? '')),
                status: String(match.status ?? 'scheduled'),
              }))
              .sort((a: MatchView, b: MatchView) => a.startDateTime.getTime() - b.startDateTime.getTime()),
          }))
          .sort((a: MatchdayGroup, b: MatchdayGroup) => {
            const byDate = a.startDate.getTime() - b.startDate.getTime();
            if (byDate !== 0) return byDate;
            return (a.matchdayNumber ?? 0) - (b.matchdayNumber ?? 0);
          });

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

  private parseNullableInt(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
    if (typeof value === 'string') {
      const parsed = Number.parseInt(value, 10);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  private resolveResult(homeScoreRaw: unknown, awayScoreRaw: unknown, status: string): string {
    const homeScore = this.parseNullableInt(homeScoreRaw);
    const awayScore = this.parseNullableInt(awayScoreRaw);

    if (homeScore !== null && awayScore !== null) {
      return `${homeScore} - ${awayScore}`;
    }

    const normalized = String(status ?? '').trim();
    if (['finished', 'finalizado', 'final', 'ended'].includes(normalized.toLowerCase())) {
      return 'Finalizado (sin marcador cargado)';
    }

    return 'Pendiente';
  }
}

