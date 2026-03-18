import { PlayerPosition } from './domain-enums.types';
export interface realPlayerPatchI {
  id: number;
  idEnApi?: number;
  name?: string;
  position?: PlayerPosition;
  realTeam?: number;
  valueCurrency?: string | null;
  value?: number | null;
  active?: boolean;
  lastUpdate?: Date;
}
