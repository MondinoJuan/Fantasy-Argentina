import { UserType } from './domain-enums.types';
import { AuthProvider } from './user.interface';

export interface addUserI {
  username: string;
  mail: string;
  password: string;
  registrationDate: Date;
  type: UserType;
  authProvider?: AuthProvider;
  superadminCode?: string;
}
