export interface realPlayerI {
  id?: number;
  externalApiId: string;
  name: string;
  position: string;
  realTeam: number;
  marketValue: number | null;
  active: boolean;
  lastUpdate: Date;
}
