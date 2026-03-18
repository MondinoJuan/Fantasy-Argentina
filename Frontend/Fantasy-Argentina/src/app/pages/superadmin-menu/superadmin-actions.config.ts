export type SuperadminAction =
  | 'persistPlayers'
  | 'persistTeams'
  | 'persistSport'
  | 'persistLeague'
  | 'persistUltSeason'
  | 'persistFixture'
  | 'getPersistedFixture'
  | 'getAllUsers'
  | 'getAllSports'
  | 'getAllLeagues'
  | 'getAllRealTeams'
  | 'getAllRealPlayers'
  | 'getAllTournaments'
  | 'getAllParticipants'
  | 'getAllParticipantSquads'
  | 'getAllMatchdays'
  | 'getAllMatches'
  | 'getAllMatchdayMarkets'
  | 'getAllBids'
  | 'getAllNegotiations'
  | 'getAllTransactions'
  | 'getAllPlayerPerformances'
  | 'getAllPlayerPointsBreakdowns'
  | 'getAllParticipantMatchdayPoints'
  | 'getLeaguesTournamentCounts'
  | 'rankingsByDate'
  | 'updateTeamSquad'
  | 'syncPlayedMatchResults'
  | 'sumEndOfMatchdayPoints'
  | 'settleMarketByLeague';

export type ActionField =
  | 'sportId'
  | 'competitionId'
  | 'leagueId'
  | 'leagueIdEnApi'
  | 'idEnApi'
  | 'country'
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
  country: 'País',
  descripcion: 'Descripción deporte',
  cupoTitular: 'Cupo titular',
  cupoSuplente: 'Cupo suplente',
  teamIdEnApi: 'Team ID en API',
  matchdayNumber: 'Nro fecha',
  matchId: 'IdMatch (opcional)',
};

export const SUPERADMIN_ACTION_CONFIG: Record<SuperadminAction, { title: string; fields: ActionField[] }> = {
  persistPlayers: { title: 'Persistir jugadores', fields: ['leagueIdEnApi'] },
  persistTeams: { title: 'Persistir equipos', fields: ['leagueIdEnApi'] },
  persistSport: { title: 'Persistir deporte', fields: ['sportId', 'descripcion', 'cupoTitular', 'cupoSuplente'] },
  persistLeague: { title: 'Persistir liga', fields: ['idEnApi', 'country'] },
  persistUltSeason: { title: 'Persistir ultSeason', fields: ['leagueIdEnApi'] },
  persistFixture: { title: 'Persistir fixture', fields: ['competitionId'] },
  getPersistedFixture: { title: 'Ver fixture persistido por League ID', fields: ['leagueId'] },

  getAllUsers: { title: 'Get all users', fields: [] },
  getAllSports: { title: 'Get all sports', fields: [] },
  getAllLeagues: { title: 'Get all leagues', fields: [] },
  getAllRealTeams: { title: 'Get all real teams', fields: [] },
  getAllRealPlayers: { title: 'Get all real players', fields: [] },
  getAllTournaments: { title: 'Get all tournaments', fields: [] },
  getAllParticipants: { title: 'Get all participants', fields: [] },
  getAllParticipantSquads: { title: 'Get all participant squads', fields: [] },
  getAllMatchdays: { title: 'Get all matchdays', fields: [] },
  getAllMatches: { title: 'Get all matches', fields: [] },
  getAllMatchdayMarkets: { title: 'Get all matchday markets', fields: [] },
  getAllBids: { title: 'Get all bids', fields: [] },
  getAllNegotiations: { title: 'Get all negotiations', fields: [] },
  getAllTransactions: { title: 'Get all transactions', fields: [] },
  getAllPlayerPerformances: { title: 'Get all player performances', fields: [] },
  getAllPlayerPointsBreakdowns: { title: 'Get all player points breakdowns', fields: [] },
  getAllParticipantMatchdayPoints: { title: 'Get all participant matchday points', fields: [] },
  getLeaguesTournamentCounts: { title: 'Leagues persistidas + cantidad de tournaments', fields: [] },

  rankingsByDate: { title: 'Recuperar rankings por jugador/fecha', fields: ['sportId', 'competitionId'] },
  updateTeamSquad: { title: 'Actualizar plantilla de equipo', fields: ['teamIdEnApi'] },
  syncPlayedMatchResults: { title: 'Actualizar resultados jugados', fields: ['competitionId'] },
  sumEndOfMatchdayPoints: { title: 'Suma puntos de fin de fecha', fields: ['leagueId', 'matchdayNumber', 'matchId'] },
  settleMarketByLeague: { title: 'Cerrar pujas y renovar market por league', fields: ['leagueId'] },
};
