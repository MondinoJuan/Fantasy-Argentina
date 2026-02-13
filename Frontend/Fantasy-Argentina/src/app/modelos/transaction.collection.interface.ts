import { transactionI } from "./transaction.interface";

export interface transactionCollectionI {
  data: Array<transactionI>;
  message: string;
}
