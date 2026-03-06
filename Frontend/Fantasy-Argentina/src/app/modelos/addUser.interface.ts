export interface addUserI {
  username: string;
  mail: string;
  password: string;
  registrationDate: Date;
  type: "USER" | "SUPERADMIN";
}
