import { UserType } from './domain-enums.types';
export interface addUserI {
  username: string;
  mail: string;
  password: string;
  registrationDate: Date;
  type: UserType;
}
