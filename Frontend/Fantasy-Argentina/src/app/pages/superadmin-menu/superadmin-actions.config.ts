export type SuperadminAction =
  | 'persistPlayers'
  | 'persistTeams'
  | 'persistSport'
  | 'persistLeague'
  | 'persistFixture'
  | 'rankingsByDate'
  | 'updateTeamSquad'
  | 'syncPlayedMatchResults'
  | 'sumEndOfMatchdayPoints';

export type ActionField =
  | 'sportId'
  | 'competitionId'
  | 'leagueId'
  | 'leagueIdEnApi'
  | 'idEnApi'
  | 'descripcion'
  | 'cupoTitular'
  | 'cupoSuplente'
  | 'teamIdEnApi'
  | 'matchdayNumber'
  | 'matchId';

export const SUPERADMIN_FIELD_LABELS: Record<ActionField, string> = {
  sportId: 'Sport ID',
  competitionId: 'Competition ID',
  leagueId: 'League ID local (BDD)',
  leagueIdEnApi: 'League ID en API',
  idEnApi: 'League idEnApi (alta liga)',
  descripcion: 'Descripción deporte',
  cupoTitular: 'Cupo titular',
  cupoSuplente: 'Cupo suplente',
  teamIdEnApi: 'Team ID en API',
  matchdayNumber: 'Nro fecha',
  matchId: 'IdMatch (opcional)',
};

export const SUPERADMIN_ACTION_CONFIG: Record<SuperadminAction, { title: string; fields: ActionField[] }> = {
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
  sumEndOfMatchdayPoints: {
    title: 'Suma puntos de fin de fecha',
    fields: ['leagueId', 'matchdayNumber', 'matchId'],
  },
};
