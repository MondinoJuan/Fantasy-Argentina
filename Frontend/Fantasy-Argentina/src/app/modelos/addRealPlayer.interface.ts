export interface addRealPlayerI {
  externalApiId: string;
  name: string;
  position: string;
  realTeam: number;
  marketValue: number | null;
  active: boolean;
  lastUpdate: Date;
}
