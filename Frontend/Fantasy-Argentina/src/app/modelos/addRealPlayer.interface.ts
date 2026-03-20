export interface addRealPlayerI {
  idEnApi: number;
  name: string;
  position: string;
  realTeam: number;
  valueCurrency?: string;
  value?: number;
  translatedValue?: number | null;
  active: boolean;
  lastUpdate: Date;
}
