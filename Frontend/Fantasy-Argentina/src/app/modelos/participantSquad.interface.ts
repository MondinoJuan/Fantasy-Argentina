export interface participantSquadI {
  id?: number;
  participant: number;
  realPlayer: number;
  acquisitionDate: Date;
  releaseDate?: Date;
  purchasePrice: number;
  acquisitionType: string;
}
