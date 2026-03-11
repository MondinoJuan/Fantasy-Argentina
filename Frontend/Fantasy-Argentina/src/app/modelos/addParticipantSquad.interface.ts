import { ParticipantFormation, SquadAcquisitionType } from './domain-enums.types';
export interface addParticipantSquadI {
  participant: number;
  realPlayerIds: number[];
  formation: ParticipantFormation;
  acquisitionDate: Date;
  releaseDate?: Date;
  purchasePrice: number;
  acquisitionType: SquadAcquisitionType;
}
