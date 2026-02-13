export interface realPlayerI {
  id?: number;
  externalApiId: string;
  name: string;
  position: string;
  realTeam: number;
  marketValue: number;
  active: boolean;
  lastUpdate: Date;
}
