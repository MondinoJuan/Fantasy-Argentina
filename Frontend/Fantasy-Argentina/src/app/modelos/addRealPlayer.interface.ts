export interface addRealPlayerI {
  idEnApi: number;
  name: string;
  position: string;
  realTeam: number;
  valueCurrency?: string;
  value?: number;
  active: boolean;
  lastUpdate: Date;
}
