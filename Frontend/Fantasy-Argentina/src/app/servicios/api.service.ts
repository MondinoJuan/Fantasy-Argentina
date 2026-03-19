import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { addBidI } from '../modelos/addBid.interface';
import { addLeagueI } from '../modelos/addLeague.interface';
import { addMatchI } from '../modelos/addMatch.interface';
import { addMatchdayI } from '../modelos/addMatchday.interface';
import { addMatchdayMarketI } from '../modelos/addMatchdayMarket.interface';
import { addNegotiationI } from '../modelos/addNegotiation.interface';
import { addParticipantI } from '../modelos/addParticipant.interface';
import { addParticipantMatchdayPointsI } from '../modelos/addParticipantMatchdayPoints.interface';
import { addParticipantSquadI } from '../modelos/addParticipantSquad.interface';
import { addPlayerClauseI } from '../modelos/addPlayerClause.interface';
import { addPlayerPerformanceI } from '../modelos/addPlayerPerformance.interface';
import { addPlayerPointsBreakdownI } from '../modelos/addPlayerPointsBreakdown.interface';
import { addRealPlayerI } from '../modelos/addRealPlayer.interface';
import { addRealTeamI } from '../modelos/addRealTeam.interface';
import { addShieldingI } from '../modelos/addShielding.interface';
import { addSportI } from '../modelos/addSport.interface';
import { addTournamentI } from '../modelos/addTournament.interface';
import { addUltSeasonI } from '../modelos/addUltSeason.interface';
import { addTransactionI } from '../modelos/addTransaction.interface';
import { addUserI } from '../modelos/addUser.interface';

import { bidI } from '../modelos/bid.interface';
import { bidPatchI } from '../modelos/bid.patch.interface';
import { bidCollectionI } from '../modelos/bid.collection.interface';
import { responseBidI } from '../modelos/responseBid.interface';
import { responseBidByTournamentRealPlayerI } from '../modelos/responseBidByTournamentRealPlayer.interface';

import { leagueI } from '../modelos/league.interface';
import { leaguePatchI } from '../modelos/league.patch.interface';
import { leagueCollectionI } from '../modelos/league.collection.interface';
import { responseLeagueI } from '../modelos/responseLeague.interface';

import { matchI } from '../modelos/match.interface';
import { matchPatchI } from '../modelos/match.patch.interface';
import { matchCollectionI } from '../modelos/match.collection.interface';
import { responseMatchI } from '../modelos/responseMatch.interface';

import { matchdayI } from '../modelos/matchday.interface';
import { matchdayPatchI } from '../modelos/matchday.patch.interface';
import { matchdayCollectionI } from '../modelos/matchday.collection.interface';
import { responseMatchdayI } from '../modelos/responseMatchday.interface';

import { matchdayMarketI } from '../modelos/matchdayMarket.interface';
import { matchdayMarketPatchI } from '../modelos/matchdayMarket.patch.interface';
import { matchdayMarketCollectionI } from '../modelos/matchdayMarket.collection.interface';
import { responseMatchdayMarketI } from '../modelos/responseMatchdayMarket.interface';

import { negotiationI } from '../modelos/negotiation.interface';
import { negotiationPatchI } from '../modelos/negotiation.patch.interface';
import { negotiationCollectionI } from '../modelos/negotiation.collection.interface';
import { responseNegotiationI } from '../modelos/responseNegotiation.interface';

import { participantI } from '../modelos/participant.interface';
import { participantPatchI } from '../modelos/participant.patch.interface';
import { participantCollectionI } from '../modelos/participant.collection.interface';
import { responseParticipantI } from '../modelos/responseParticipant.interface';

import { participantMatchdayPointsI } from '../modelos/participantMatchdayPoints.interface';
import { participantMatchdayPointsPatchI } from '../modelos/participantMatchdayPoints.patch.interface';
import { participantMatchdayPointsCollectionI } from '../modelos/participantMatchdayPoints.collection.interface';
import { responseParticipantMatchdayPointsI } from '../modelos/responseParticipantMatchdayPoints.interface';

import { participantSquadI } from '../modelos/participantSquad.interface';
import { participantSquadPatchI } from '../modelos/participantSquad.patch.interface';
import { participantSquadCollectionI } from '../modelos/participantSquad.collection.interface';
import { responseParticipantSquadI } from '../modelos/responseParticipantSquad.interface';

import { playerClauseI } from '../modelos/playerClause.interface';
import { playerClausePatchI } from '../modelos/playerClause.patch.interface';
import { playerClauseCollectionI } from '../modelos/playerClause.collection.interface';
import { responsePlayerClauseI } from '../modelos/responsePlayerClause.interface';

import { playerPerformanceI } from '../modelos/playerPerformance.interface';
import { playerPerformancePatchI } from '../modelos/playerPerformance.patch.interface';
import { playerPerformanceCollectionI } from '../modelos/playerPerformance.collection.interface';
import { responsePlayerPerformanceI } from '../modelos/responsePlayerPerformance.interface';

import { playerPointsBreakdownI } from '../modelos/playerPointsBreakdown.interface';
import { playerPointsBreakdownPatchI } from '../modelos/playerPointsBreakdown.patch.interface';
import { playerPointsBreakdownCollectionI } from '../modelos/playerPointsBreakdown.collection.interface';
import { responsePlayerPointsBreakdownI } from '../modelos/responsePlayerPointsBreakdown.interface';

import { realPlayerI } from '../modelos/realPlayer.interface';
import { realPlayerPatchI } from '../modelos/realPlayer.patch.interface';
import { realPlayerCollectionI } from '../modelos/realPlayer.collection.interface';
import { responseRealPlayerI } from '../modelos/responseRealPlayer.interface';

import { realTeamI } from '../modelos/realTeam.interface';
import { realTeamPatchI } from '../modelos/realTeam.patch.interface';
import { realTeamCollectionI } from '../modelos/realTeam.collection.interface';
import { responseRealTeamI } from '../modelos/responseRealTeam.interface';

import { sportI } from '../modelos/sport.interface';
import { sportPatchI } from '../modelos/sport.patch.interface';
import { sportCollectionI } from '../modelos/sport.collection.interface';
import { responseSportI } from '../modelos/responseSport.interface';

import { shieldingI } from '../modelos/shielding.interface';
import { shieldingPatchI } from '../modelos/shielding.patch.interface';
import { shieldingCollectionI } from '../modelos/shielding.collection.interface';
import { responseShieldingI } from '../modelos/responseShielding.interface';

import { tournamentI } from '../modelos/tournament.interface';
import { tournamentPatchI } from '../modelos/tournament.patch.interface';
import { tournamentCollectionI } from '../modelos/tournament.collection.interface';
import { responseTournamentI } from '../modelos/responseTournament.interface';

import { transactionI } from '../modelos/transaction.interface';
import { transactionPatchI } from '../modelos/transaction.patch.interface';
import { transactionCollectionI } from '../modelos/transaction.collection.interface';
import { responseTransactionI } from '../modelos/responseTransaction.interface';
import { responseUltSeasonI } from '../modelos/responseUltSeason.interface';

import { userI } from '../modelos/user.interface';
import { userPatchI } from '../modelos/user.patch.interface';
import { userCollectionI } from '../modelos/user.collection.interface';
import { responseUserI } from '../modelos/responseUser.interface';
import { ultSeasonCollectionI } from '../modelos/ultSeason.collection.interface';
import { ultSeasonI } from '../modelos/ultSeason.interface';
import { ultSeasonPatchI } from '../modelos/ultSeason.patch.interface';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly url = '/api';

  constructor(private readonly http: HttpClient) {}

  // Users
  searchUsers() { return this.http.get<userCollectionI>(`${this.url}/users`); }
  searchUserById(id: number | string) { return this.http.get<responseUserI>(`${this.url}/users/${id}`); }
  postUser(user: addUserI) { return this.http.post<responseUserI>(`${this.url}/users`, user); }
  updateUser(user: userI) { return this.http.put<responseUserI>(`${this.url}/users/${user.id}`, user); }
  patchUser(user: userPatchI) { return this.http.patch<responseUserI>(`${this.url}/users/${user.id}`, user); }
  removeUser(id: number | string) { return this.http.delete<responseUserI>(`${this.url}/users/${id}`); }

  // Tournaments
  searchTournaments() { return this.http.get<tournamentCollectionI>(`${this.url}/tournaments`); }
  searchTournamentById(id: number | string) { return this.http.get<responseTournamentI>(`${this.url}/tournaments/${id}`); }
  searchTournamentByPublicCode(publicCode: string) { return this.http.get<responseTournamentI>(`${this.url}/tournaments/by-public-code/${encodeURIComponent(publicCode)}`); }
  postTournament(tournament: addTournamentI) { return this.http.post<responseTournamentI>(`${this.url}/tournaments`, tournament); }
  updateTournament(tournament: tournamentI) { return this.http.put<responseTournamentI>(`${this.url}/tournaments/${tournament.id}`, tournament); }
  patchTournament(tournament: tournamentPatchI) { return this.http.patch<responseTournamentI>(`${this.url}/tournaments/${tournament.id}`, tournament); }
  removeTournament(id: number | string) { return this.http.delete<responseTournamentI>(`${this.url}/tournaments/${id}`); }
  syncPostponedTournamentMatches(id: number | string) {
    return this.http.post<{ message: string; pending: any[] }>(`${this.url}/tournaments/${id}/sync-postponed`, {});
  }

  // Sports
  searchSports() { return this.http.get<sportCollectionI>(`${this.url}/sports`); }
  searchSportById(id: number | string) { return this.http.get<responseSportI>(`${this.url}/sports/${id}`); }
  searchSportByIdEnApi(idEnApi: number | string) { return this.http.get<responseSportI>(`${this.url}/sports/by-id-en-api/${idEnApi}`); }
  postSport(sport: addSportI) { return this.http.post<responseSportI>(`${this.url}/sports`, sport); }
  updateSport(sport: sportI) { return this.http.put<responseSportI>(`${this.url}/sports/${sport.id}`, sport); }
  patchSport(sport: sportPatchI) { return this.http.patch<responseSportI>(`${this.url}/sports/${sport.id}`, sport); }
  removeSport(id: number | string) { return this.http.delete<responseSportI>(`${this.url}/sports/${id}`); }

  // Leagues
  searchLeagues() { return this.http.get<leagueCollectionI>(`${this.url}/leagues`); }
  searchLeagueById(id: number | string) { return this.http.get<responseLeagueI>(`${this.url}/leagues/${id}`); }
  searchLeagueByIdEnApi(idEnApi: number | string, country?: string) {
    const query = country ? `?country=${encodeURIComponent(country)}` : '';
    return this.http.get<responseLeagueI>(`${this.url}/leagues/by-id-en-api/${idEnApi}${query}`);
  }
  ensureLeagueByName(name: string) { return this.http.post<responseLeagueI>(`${this.url}/leagues/ensure/by-name`, { name }); }
  postLeague(league: addLeagueI) { return this.http.post<responseLeagueI>(`${this.url}/leagues`, league); }
  updateLeague(league: leagueI) { return this.http.put<responseLeagueI>(`${this.url}/leagues/${league.id}`, league); }
  patchLeague(league: leaguePatchI) { return this.http.patch<responseLeagueI>(`${this.url}/leagues/${league.id}`, league); }
  removeLeague(id: number | string) { return this.http.delete<responseLeagueI>(`${this.url}/leagues/${id}`); }

  // Ult Seasons
  searchUltSeasons() { return this.http.get<ultSeasonCollectionI>(`${this.url}/ult-seasons`); }
  searchUltSeasonById(id: number | string) { return this.http.get<responseUltSeasonI>(`${this.url}/ult-seasons/${id}`); }
  postUltSeason(ultSeason: addUltSeasonI) { return this.http.post<responseUltSeasonI>(`${this.url}/ult-seasons`, ultSeason); }
  updateUltSeason(ultSeason: ultSeasonI) { return this.http.put<responseUltSeasonI>(`${this.url}/ult-seasons/${ultSeason.id}`, ultSeason); }
  patchUltSeason(ultSeason: ultSeasonPatchI) { return this.http.patch<responseUltSeasonI>(`${this.url}/ult-seasons/${ultSeason.id}`, ultSeason); }
  removeUltSeason(id: number | string) { return this.http.delete<responseUltSeasonI>(`${this.url}/ult-seasons/${id}`); }
  syncUltSeasonByLeagueIdEnApi(payload: { leagueIdEnApi: number }) {
    return this.http.post<any>(`${this.url}/ult-seasons/sync/by-league-id-en-api`, payload);
  }

  // Participants
  searchParticipants() { return this.http.get<participantCollectionI>(`${this.url}/participants`); }
  searchParticipantById(id: number | string) { return this.http.get<responseParticipantI>(`${this.url}/participants/${id}`); }
  postParticipant(participant: addParticipantI) { return this.http.post<responseParticipantI>(`${this.url}/participants`, participant); }
  updateParticipant(participant: participantI) { return this.http.put<responseParticipantI>(`${this.url}/participants/${participant.id}`, participant); }
  patchParticipant(participant: participantPatchI) { return this.http.patch<responseParticipantI>(`${this.url}/participants/${participant.id}`, participant); }
  removeParticipant(id: number | string) { return this.http.delete<responseParticipantI>(`${this.url}/participants/${id}`); }
  joinParticipantByTournamentCode(payload: { userId: number; tournamentCode: string }) { return this.http.post<any>(`${this.url}/participants/join-by-code`, payload); }

  // Real Players
  searchRealPlayers() { return this.http.get<realPlayerCollectionI>(`${this.url}/real-players`); }
  searchRealPlayerById(id: number | string) { return this.http.get<responseRealPlayerI>(`${this.url}/real-players/${id}`); }
  searchRealPlayerByIdEnApi(idEnApi: number | string) { return this.http.get<responseRealPlayerI>(`${this.url}/real-players/by-id-en-api/${idEnApi}`); }
  postRealPlayer(realPlayer: addRealPlayerI) { return this.http.post<responseRealPlayerI>(`${this.url}/real-players`, realPlayer); }
  updateRealPlayer(realPlayer: realPlayerI) { return this.http.put<responseRealPlayerI>(`${this.url}/real-players/${realPlayer.id}`, realPlayer); }
  patchRealPlayer(realPlayer: realPlayerPatchI) { return this.http.patch<responseRealPlayerI>(`${this.url}/real-players/${realPlayer.id}`, realPlayer); }
  removeRealPlayer(id: number | string) { return this.http.delete<responseRealPlayerI>(`${this.url}/real-players/${id}`); }

  // Real Teams
  searchRealTeams() { return this.http.get<realTeamCollectionI>(`${this.url}/real-teams`); }
  searchRealTeamById(id: number | string) { return this.http.get<responseRealTeamI>(`${this.url}/real-teams/${id}`); }
  searchRealTeamByIdEnApi(idEnApi: number | string) { return this.http.get<responseRealTeamI>(`${this.url}/real-teams/by-id-en-api/${idEnApi}`); }
  postRealTeam(realTeam: addRealTeamI) { return this.http.post<responseRealTeamI>(`${this.url}/real-teams`, realTeam); }
  updateRealTeam(realTeam: realTeamI) { return this.http.put<responseRealTeamI>(`${this.url}/real-teams/${realTeam.id}`, realTeam); }
  patchRealTeam(realTeam: realTeamPatchI) { return this.http.patch<responseRealTeamI>(`${this.url}/real-teams/${realTeam.id}`, realTeam); }
  removeRealTeam(id: number | string) { return this.http.delete<responseRealTeamI>(`${this.url}/real-teams/${id}`); }

  // Participant Squads
  searchParticipantSquads() { return this.http.get<participantSquadCollectionI>(`${this.url}/participant-squads`); }
  searchParticipantSquadById(id: number | string) { return this.http.get<responseParticipantSquadI>(`${this.url}/participant-squads/${id}`); }
  postParticipantSquad(participantSquad: addParticipantSquadI) { return this.http.post<responseParticipantSquadI>(`${this.url}/participant-squads`, participantSquad); }
  updateParticipantSquad(participantSquad: participantSquadI) { return this.http.put<responseParticipantSquadI>(`${this.url}/participant-squads/${participantSquad.id}`, participantSquad); }
  patchParticipantSquad(participantSquad: participantSquadPatchI) { return this.http.patch<responseParticipantSquadI>(`${this.url}/participant-squads/${participantSquad.id}`, participantSquad); }
  removeParticipantSquad(id: number | string) { return this.http.delete<responseParticipantSquadI>(`${this.url}/participant-squads/${id}`); }

  // Matchdays
  searchMatchdays() { return this.http.get<matchdayCollectionI>(`${this.url}/matchdays`); }
  searchMatchdayById(id: number | string) { return this.http.get<responseMatchdayI>(`${this.url}/matchdays/${id}`); }
  postMatchday(matchday: addMatchdayI) { return this.http.post<responseMatchdayI>(`${this.url}/matchdays`, matchday); }
  updateMatchday(matchday: matchdayI) { return this.http.put<responseMatchdayI>(`${this.url}/matchdays/${matchday.id}`, matchday); }
  patchMatchday(matchday: matchdayPatchI) { return this.http.patch<responseMatchdayI>(`${this.url}/matchdays/${matchday.id}`, matchday); }
  removeMatchday(id: number | string) { return this.http.delete<responseMatchdayI>(`${this.url}/matchdays/${id}`); }

  // Matches
  searchMatches() { return this.http.get<matchCollectionI>(`${this.url}/matches`); }
  searchMatchById(id: number | string) { return this.http.get<responseMatchI>(`${this.url}/matches/${id}`); }
  postMatch(match: addMatchI) { return this.http.post<responseMatchI>(`${this.url}/matches`, match); }
  updateMatch(match: matchI) { return this.http.put<responseMatchI>(`${this.url}/matches/${match.id}`, match); }
  patchMatch(match: matchPatchI) { return this.http.patch<responseMatchI>(`${this.url}/matches/${match.id}`, match); }
  removeMatch(id: number | string) { return this.http.delete<responseMatchI>(`${this.url}/matches/${id}`); }


  // Dependant Players
  searchDependantPlayers() { return this.http.get<any>(`${this.url}/dependant-players`); }
  searchDependantPlayerById(id: number | string) { return this.http.get<any>(`${this.url}/dependant-players/${id}`); }

  // Matchday Markets
  searchMatchdayMarkets() { return this.http.get<matchdayMarketCollectionI>(`${this.url}/matchday-markets`); }
  searchMatchdayMarketById(id: number | string) { return this.http.get<responseMatchdayMarketI>(`${this.url}/matchday-markets/${id}`); }
  postMatchdayMarket(matchdayMarket: addMatchdayMarketI) { return this.http.post<responseMatchdayMarketI>(`${this.url}/matchday-markets`, matchdayMarket); }
  updateMatchdayMarket(matchdayMarket: matchdayMarketI) { return this.http.put<responseMatchdayMarketI>(`${this.url}/matchday-markets/${matchdayMarket.id}`, matchdayMarket); }
  patchMatchdayMarket(matchdayMarket: matchdayMarketPatchI) { return this.http.patch<responseMatchdayMarketI>(`${this.url}/matchday-markets/${matchdayMarket.id}`, matchdayMarket); }
  removeMatchdayMarket(id: number | string) { return this.http.delete<responseMatchdayMarketI>(`${this.url}/matchday-markets/${id}`); }

  // Bids
  searchBids() { return this.http.get<bidCollectionI>(`${this.url}/bids`); }
  searchBidById(id: number | string) { return this.http.get<responseBidI>(`${this.url}/bids/${id}`); }
  searchBidsByTournamentAndRealPlayer(tournamentId: number | string, realPlayerId: number | string) { return this.http.get<responseBidByTournamentRealPlayerI>(`${this.url}/bids/tournament/${tournamentId}/real-player/${realPlayerId}`); }
  postBid(bid: addBidI) { return this.http.post<responseBidI>(`${this.url}/bids`, bid); }
  updateBid(bid: bidI) { return this.http.put<responseBidI>(`${this.url}/bids/${bid.id}`, bid); }
  patchBid(bid: bidPatchI) { return this.http.patch<responseBidI>(`${this.url}/bids/${bid.id}`, bid); }
  removeBid(id: number | string) { return this.http.delete<responseBidI>(`${this.url}/bids/${id}`); }

  // Player Performances
  searchPlayerPerformances() { return this.http.get<playerPerformanceCollectionI>(`${this.url}/player-performances`); }
  searchPlayerPerformanceById(id: number | string) { return this.http.get<responsePlayerPerformanceI>(`${this.url}/player-performances/${id}`); }
  postPlayerPerformance(playerPerformance: addPlayerPerformanceI) { return this.http.post<responsePlayerPerformanceI>(`${this.url}/player-performances`, playerPerformance); }
  updatePlayerPerformance(playerPerformance: playerPerformanceI) { return this.http.put<responsePlayerPerformanceI>(`${this.url}/player-performances/${playerPerformance.id}`, playerPerformance); }
  patchPlayerPerformance(playerPerformance: playerPerformancePatchI) { return this.http.patch<responsePlayerPerformanceI>(`${this.url}/player-performances/${playerPerformance.id}`, playerPerformance); }
  removePlayerPerformance(id: number | string) { return this.http.delete<responsePlayerPerformanceI>(`${this.url}/player-performances/${id}`); }

  // Participant Matchday Points
  searchParticipantMatchdayPoints() { return this.http.get<participantMatchdayPointsCollectionI>(`${this.url}/participant-matchday-points`); }
  searchParticipantMatchdayPointsById(id: number | string) { return this.http.get<responseParticipantMatchdayPointsI>(`${this.url}/participant-matchday-points/${id}`); }
  postParticipantMatchdayPoints(participantMatchdayPoints: addParticipantMatchdayPointsI) { return this.http.post<responseParticipantMatchdayPointsI>(`${this.url}/participant-matchday-points`, participantMatchdayPoints); }
  updateParticipantMatchdayPoints(participantMatchdayPoints: participantMatchdayPointsI) { return this.http.put<responseParticipantMatchdayPointsI>(`${this.url}/participant-matchday-points/${participantMatchdayPoints.id}`, participantMatchdayPoints); }
  patchParticipantMatchdayPoints(participantMatchdayPoints: participantMatchdayPointsPatchI) { return this.http.patch<responseParticipantMatchdayPointsI>(`${this.url}/participant-matchday-points/${participantMatchdayPoints.id}`, participantMatchdayPoints); }
  removeParticipantMatchdayPoints(id: number | string) { return this.http.delete<responseParticipantMatchdayPointsI>(`${this.url}/participant-matchday-points/${id}`); }

  // Player Points Breakdowns
  searchPlayerPointsBreakdowns() { return this.http.get<playerPointsBreakdownCollectionI>(`${this.url}/player-points-breakdowns`); }
  searchPlayerPointsBreakdownById(id: number | string) { return this.http.get<responsePlayerPointsBreakdownI>(`${this.url}/player-points-breakdowns/${id}`); }
  postPlayerPointsBreakdown(playerPointsBreakdown: addPlayerPointsBreakdownI) { return this.http.post<responsePlayerPointsBreakdownI>(`${this.url}/player-points-breakdowns`, playerPointsBreakdown); }
  updatePlayerPointsBreakdown(playerPointsBreakdown: playerPointsBreakdownI) { return this.http.put<responsePlayerPointsBreakdownI>(`${this.url}/player-points-breakdowns/${playerPointsBreakdown.id}`, playerPointsBreakdown); }
  patchPlayerPointsBreakdown(playerPointsBreakdown: playerPointsBreakdownPatchI) { return this.http.patch<responsePlayerPointsBreakdownI>(`${this.url}/player-points-breakdowns/${playerPointsBreakdown.id}`, playerPointsBreakdown); }
  removePlayerPointsBreakdown(id: number | string) { return this.http.delete<responsePlayerPointsBreakdownI>(`${this.url}/player-points-breakdowns/${id}`); }

  // Player Clauses
  searchPlayerClauses() { return this.http.get<playerClauseCollectionI>(`${this.url}/player-clauses`); }
  searchPlayerClauseById(id: number | string) { return this.http.get<responsePlayerClauseI>(`${this.url}/player-clauses/${id}`); }
  postPlayerClause(playerClause: addPlayerClauseI) { return this.http.post<responsePlayerClauseI>(`${this.url}/player-clauses`, playerClause); }
  updatePlayerClause(playerClause: playerClauseI) { return this.http.put<responsePlayerClauseI>(`${this.url}/player-clauses/${playerClause.id}`, playerClause); }
  patchPlayerClause(playerClause: playerClausePatchI) { return this.http.patch<responsePlayerClauseI>(`${this.url}/player-clauses/${playerClause.id}`, playerClause); }
  removePlayerClause(id: number | string) { return this.http.delete<responsePlayerClauseI>(`${this.url}/player-clauses/${id}`); }

  // Shieldings
  searchShieldings() { return this.http.get<shieldingCollectionI>(`${this.url}/shieldings`); }
  searchShieldingById(id: number | string) { return this.http.get<responseShieldingI>(`${this.url}/shieldings/${id}`); }
  postShielding(shielding: addShieldingI) { return this.http.post<responseShieldingI>(`${this.url}/shieldings`, shielding); }
  updateShielding(shielding: shieldingI) { return this.http.put<responseShieldingI>(`${this.url}/shieldings/${shielding.id}`, shielding); }
  patchShielding(shielding: shieldingPatchI) { return this.http.patch<responseShieldingI>(`${this.url}/shieldings/${shielding.id}`, shielding); }
  removeShielding(id: number | string) { return this.http.delete<responseShieldingI>(`${this.url}/shieldings/${id}`); }

  // Transactions
  searchTransactions() { return this.http.get<transactionCollectionI>(`${this.url}/transactions`); }
  searchTransactionById(id: number | string) { return this.http.get<responseTransactionI>(`${this.url}/transactions/${id}`); }
  postTransaction(transaction: addTransactionI) { return this.http.post<responseTransactionI>(`${this.url}/transactions`, transaction); }
  updateTransaction(transaction: transactionI) { return this.http.put<responseTransactionI>(`${this.url}/transactions/${transaction.id}`, transaction); }
  patchTransaction(transaction: transactionPatchI) { return this.http.patch<responseTransactionI>(`${this.url}/transactions/${transaction.id}`, transaction); }
  removeTransaction(id: number | string) { return this.http.delete<responseTransactionI>(`${this.url}/transactions/${id}`); }

  // Negotiations
  searchNegotiations() { return this.http.get<negotiationCollectionI>(`${this.url}/negotiations`); }
  searchNegotiationById(id: number | string) { return this.http.get<responseNegotiationI>(`${this.url}/negotiations/${id}`); }
  postNegotiation(negotiation: addNegotiationI) { return this.http.post<responseNegotiationI>(`${this.url}/negotiations`, negotiation); }
  updateNegotiation(negotiation: negotiationI) { return this.http.put<responseNegotiationI>(`${this.url}/negotiations/${negotiation.id}`, negotiation); }
  patchNegotiation(negotiation: negotiationPatchI) { return this.http.patch<responseNegotiationI>(`${this.url}/negotiations/${negotiation.id}`, negotiation); }
  removeNegotiation(id: number | string) { return this.http.delete<responseNegotiationI>(`${this.url}/negotiations/${id}`); }

  // External API - Sports API Pro
  searchSportsApiProLeagues() { return this.http.get<responseLeagueI[]>(`${this.url}/external/sportsapipro/leagues`); }
  searchExternalCompetitionTeams(sportId: number | string, competitionId: number | string) {
    return this.http.get<any>(`${this.url}/external/sportsapipro/competition-teams?sportId=${sportId}&competitionId=${competitionId}`);
  }
  searchExternalLatestMatchdayRatings(sportId: number | string, competitionId: number | string) {
    return this.http.get<any>(`${this.url}/external/sportsapipro/latest-matchday-ratings?sportId=${sportId}&competitionId=${competitionId}`);
  }
  postExternalFixtureEventRefs(payload: { config: any; options?: any }) {
    return this.http.post<any>(`${this.url}/external/sportsapipro/fixture/event-refs`, payload);
  }
  postExternalFixtureBuild(payload: { eventRefs: any[]; options?: any }) {
    return this.http.post<any>(`${this.url}/external/sportsapipro/fixture/build`, payload);
  }

  syncLeagueByIdEnApi(payload: { idEnApi: number; country: string }) {
    return this.http.post<any>(`${this.url}/leagues/sync/by-id-en-api`, payload);
  }

  syncTeamsByLeagueIdEnApi(payload: { leagueIdEnApi: number }) {
    return this.http.post<any>(`${this.url}/real-teams/sync/by-league-id-en-api`, payload);
  }

  syncPlayersByLeagueIdEnApi(payload: { leagueId?: number; leagueIdEnApi?: number }) {
    return this.http.post<any>(`${this.url}/real-players/sync/by-league-id-en-api`, payload);
  }

  syncTeamSquadByTeamIdEnApi(payload: { teamIdEnApi: number }) {
    return this.http.post<any>(`${this.url}/real-players/sync/team-squad`, payload);
  }

  postExternalFixtureBuildCompetition(payload: { competitionId: number; seasonId: number }) {
    return this.http.post<any>(`${this.url}/external/sportsapipro/fixture/build-competition`, payload);
  }



  postExternalSyncPlayedResults(payload: { competitionId?: number }) {
    return this.http.post<any>(`${this.url}/external/sportsapipro/fixture/sync-played-results`, payload);
  }

  searchExternalRankingsWithLocalPerformances(sportId: number | string, competitionId: number | string) {
    return this.http.get<any>(`${this.url}/external/sportsapipro/rankings/player-performances?sportId=${sportId}&competitionId=${competitionId}`);
  }

  postTournamentSumEndOfMatchdayPoints(payload: { leagueId: number; matchdayNumber: number; matchId?: number }) {
    return this.http.post<any>(`${this.url}/tournaments/sum-end-of-matchday-points`, payload);
  }


  postTournamentSettleMarketAndRefreshByLeague(payload: { leagueId: number }) {
    return this.http.post<any>(`${this.url}/tournaments/settle-market-and-refresh-by-league`, payload);
  }

  searchExternalLocalPersistedFixture(filters?: { competitionId?: number | string; leagueId?: number | string }) {
    const params: string[] = [];

    if (filters?.competitionId !== undefined && filters?.competitionId !== null) {
      params.push(`competitionId=${filters.competitionId}`);
    }

    if (filters?.leagueId !== undefined && filters?.leagueId !== null) {
      params.push(`leagueId=${filters.leagueId}`);
    }

    const query = params.length > 0 ? `?${params.join('&')}` : '';

    return this.http.get<any>(`${this.url}/external/sportsapipro/fixture/local${query}`);
  }

}
