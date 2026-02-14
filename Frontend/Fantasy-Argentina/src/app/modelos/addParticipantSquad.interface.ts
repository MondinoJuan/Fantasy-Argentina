export interface addParticipantSquadI {
  participant: number;
  realPlayer: number;
  formation: string;
  acquisitionDate: Date;
  releaseDate?: Date;
  purchasePrice: number;
  acquisitionType: string;
}
