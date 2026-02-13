export interface matchdayPatchI {
  id: number;
  league?: number;
  season?: string;
  matchdayNumber?: number;
  startDate?: Date;
  endDate?: Date;
  status?: string;
}
