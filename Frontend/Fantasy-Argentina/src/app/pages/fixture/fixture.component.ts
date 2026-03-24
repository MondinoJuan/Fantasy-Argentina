import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
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

function buildMatchKey(matchdayNumber: number, homeTeam: string, awayTeam: string): string {
  const normalizeTeam = (value: string) => value.trim().toLowerCase();
  return `${matchdayNumber}|${normalizeTeam(homeTeam)}|${normalizeTeam(awayTeam)}`;
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
    private readonly route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    const leagueId = Number(this.route.snapshot.queryParamMap.get('leagueId'));
    this.loadFixtureFromLocalDb(Number.isFinite(leagueId) && leagueId > 0 ? leagueId : null);
  }

  private loadFixtureFromLocalDb(leagueId: number | null): void {
    this.isLoading = true;
    this.errorMessage = '';

    if (!leagueId) {
      this.errorMessage = 'Debés indicar un League ID para ver el fixture persistido.';
      this.isLoading = false;
      return;
    }

    this.apiService.searchExternalLocalPersistedFixture({ leagueId }).subscribe({
      next: (response: any) => {
        const groups = Array.isArray(response?.data?.matchdays) ? response.data.matchdays : [];
        const scheduledMatchKeys = new Set<string>();

        for (const group of groups) {
          const matchdayNumber = Number(group?.matchdayNumber ?? 0);
          const matches = Array.isArray(group?.matches) ? group.matches : [];
          for (const match of matches) {
            const status = String(match?.status ?? '').trim().toLowerCase();
            if (status !== 'scheduled') continue;

            const homeTeam = String(match?.homeTeam ?? 'TBD');
            const awayTeam = String(match?.awayTeam ?? 'TBD');
            scheduledMatchKeys.add(buildMatchKey(matchdayNumber, homeTeam, awayTeam));
          }
        }

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
              .filter((match: MatchView) => {
                if (match.status.trim().toLowerCase() !== 'postponed') return true;

                const hasEquivalentScheduled = scheduledMatchKeys.has(
                  buildMatchKey(Number(group.matchdayNumber ?? 0), match.homeTeam, match.awayTeam),
                );
                return !hasEquivalentScheduled;
              })
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
    const parsed = typeof value === 'number' && Number.isFinite(value)
      ? Math.trunc(value)
      : typeof value === 'string'
        ? Number.parseInt(value, 10)
        : Number.NaN;

    if (!Number.isFinite(parsed) || parsed < 0) {
      return null;
    }

    return parsed;
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
