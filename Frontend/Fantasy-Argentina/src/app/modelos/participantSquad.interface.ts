import { ParticipantFormation, SquadAcquisitionType } from './domain-enums.types';
export interface participantSquadI {
  id?: number;
  participant: number;
  startingRealPlayersIds: number[];
  substitutesRealPlayersIds: number[];
  captainRealPlayerId?: number | null;
  formation: ParticipantFormation;
  acquisitionDate: Date;
  releaseDate?: Date;
  purchasePrice: number;
  acquisitionType: SquadAcquisitionType;
}
