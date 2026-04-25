import { AuthProvider } from './user.interface';

export interface userPatchI {
  id: number;
  username?: string;
  mail?: string;
  password?: string;
  registrationDate?: Date;
  authProvider?: AuthProvider;
  isEmailVerified?: boolean;
  emailVerificationToken?: string | null;
  emailVerificationSentAt?: Date | null;
}
