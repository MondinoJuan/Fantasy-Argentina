import { ParticipantFormation, SquadAcquisitionType } from './domain-enums.types';
export interface participantSquadPatchI {
  id: number;
  participant?: number;
  startingRealPlayersIds?: number[];
  substitutesRealPlayersIds?: number[];
  formation?: ParticipantFormation;
  acquisitionDate?: Date;
  releaseDate?: Date;
  purchasePrice?: number;
  acquisitionType?: SquadAcquisitionType;
}
