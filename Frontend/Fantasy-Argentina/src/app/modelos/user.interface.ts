import { UserType } from './domain-enums.types';

export type AuthProvider = 'LOCAL' | 'GOOGLE';

export interface userI {
  id?: number;
  username: string;
  mail: string;
  password: string;
  registrationDate: Date;
  type?: UserType;
  authProvider?: AuthProvider;
  isEmailVerified?: boolean;
  emailVerificationToken?: string | null;
  emailVerificationSentAt?: Date | null;
}
