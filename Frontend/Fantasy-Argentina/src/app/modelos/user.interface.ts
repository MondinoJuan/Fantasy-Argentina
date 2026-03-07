import { UserType } from './domain-enums.types';
export interface userI {
  id?: number;
  username: string;
  mail: string;
  password: string;
  registrationDate: Date;
  type?: UserType;
}
