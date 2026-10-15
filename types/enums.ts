export enum UnlockType {
  FREE = "FREE",
  COINS = "COINS",
  STARS = "STARS",
  SHARES = "SHARES",
  ADS = "ADS",
}

export enum ReferralStatus {
  PENDING = "PENDING",
  QUALIFIED = "QUALIFIED",
}

export enum RunStatus {
  RUNNING = "RUNNING",
  PAUSED = "PAUSED",
  FINISHED = "FINISHED",
  ABANDONED = "ABANDONED",
}

export enum LeaderboardType {
  TOP_SCORE = "TOP_SCORE",
  MOST_LOYAL = "MOST_LOYAL",
}

export enum CoinReason {
  RUN = "RUN",
  PURCHASE = "PURCHASE",
  MONTHLY_REWARD = "MONTHLY_REWARD",
  AD = "AD",
  REFERRAL = "REFERRAL",
  REVIVE = "REVIVE",
}

export enum PaymentStatus {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

export enum AdPurpose {
  REVIVE = "REVIVE",
  UNLOCK_ITEM = "UNLOCK_ITEM",
  COIN_BONUS = "COIN_BONUS",
}
