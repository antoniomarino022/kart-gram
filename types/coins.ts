import { CoinReason } from "./enums";

export interface CoinTransactionResponse {
  id: number;
  userId: number;
  amount: number;
  reason: CoinReason;
  refId: number | null;
  createdAt: string | Date | null;
}

export type CoinTransactionsListResponse = CoinTransactionResponse[];
