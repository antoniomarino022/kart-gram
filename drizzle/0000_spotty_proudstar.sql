CREATE TYPE "public"."ad_purpose_enum" AS ENUM('REVIVE', 'UNLOCK_ITEM', 'COIN_BONUS');--> statement-breakpoint
CREATE TYPE "public"."coin_reason_enum" AS ENUM('RUN', 'PURCHASE', 'MONTHLY_REWARD', 'AD', 'REFERRAL', 'REVIVE');--> statement-breakpoint
CREATE TYPE "public"."leaderboard_type_enum" AS ENUM('TOP_SCORE', 'MOST_LOYAL');--> statement-breakpoint
CREATE TYPE "public"."payment_status_enum" AS ENUM('PENDING', 'COMPLETED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."referral_status_enum" AS ENUM('PENDING', 'QUALIFIED');--> statement-breakpoint
CREATE TYPE "public"."run_status_enum" AS ENUM('RUNNING', 'PAUSED', 'FINISHED', 'ABANDONED');--> statement-breakpoint
CREATE TYPE "public"."unlock_type_enum" AS ENUM('FREE', 'COINS', 'STARS', 'SHARES', 'ADS');--> statement-breakpoint
CREATE TABLE "Ad_Views" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"purpose" "ad_purpose_enum" NOT NULL,
	"car_id" integer,
	"character_id" integer,
	"map_id" integer,
	"run_id" integer,
	"provider_ref" varchar(255),
	"reward_coins" integer DEFAULT 0,
	"viewed_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "Ad_Views_provider_ref_unique" UNIQUE("provider_ref"),
	CONSTRAINT "ad_views_item_check" CHECK (num_nonnulls("Ad_Views"."car_id", "Ad_Views"."character_id", "Ad_Views"."map_id") <= 1)
);
--> statement-breakpoint
CREATE TABLE "Cars" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"car_type" varchar(50),
	"speed" integer NOT NULL,
	"base_lives" integer DEFAULT 3 NOT NULL,
	"unlock_type" "unlock_type_enum" NOT NULL,
	"unlock_value" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Characters" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"subtype" varchar(50),
	"bonus_stat" varchar(100),
	"unlock_type" "unlock_type_enum" NOT NULL,
	"unlock_value" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Coin_Transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"amount" integer NOT NULL,
	"reason" "coin_reason_enum" NOT NULL,
	"ref_id" integer,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "Game_Runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"car_id" integer NOT NULL,
	"character_id" integer NOT NULL,
	"map_id" integer NOT NULL,
	"status" "run_status_enum" DEFAULT 'RUNNING' NOT NULL,
	"starting_lives" integer NOT NULL,
	"revives_used" integer DEFAULT 0 NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"distance_meters" integer DEFAULT 0 NOT NULL,
	"coins_collected" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now(),
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "Maps" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"map_type" varchar(50),
	"unlock_type" "unlock_type_enum" NOT NULL,
	"unlock_value" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Monthly_Leaderboards" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"month" date NOT NULL,
	"best_score" integer DEFAULT 0 NOT NULL,
	"loyalty_points" integer DEFAULT 0 NOT NULL,
	"days_active" integer DEFAULT 0 NOT NULL,
	"last_active_date" date,
	"runs_played" integer DEFAULT 0 NOT NULL,
	"playtime_seconds" integer DEFAULT 0 NOT NULL,
	"ads_watched_month" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "monthly_leaderboards_user_month_unique" UNIQUE("user_id","month")
);
--> statement-breakpoint
CREATE TABLE "Monthly_Rewards_Log" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"month" date NOT NULL,
	"leaderboard_type" "leaderboard_type_enum" NOT NULL,
	"rank_position" integer NOT NULL,
	"coins_rewarded" integer NOT NULL,
	"is_claimed" boolean DEFAULT false NOT NULL,
	"claimed_at" timestamp with time zone,
	CONSTRAINT "rank_position_check" CHECK ("Monthly_Rewards_Log"."rank_position" BETWEEN 1 AND 10)
);
--> statement-breakpoint
CREATE TABLE "Payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"car_id" integer,
	"character_id" integer,
	"map_id" integer,
	"stars_amount" integer NOT NULL,
	"telegram_charge_id" varchar(255) NOT NULL,
	"status" "payment_status_enum" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "Payments_telegram_charge_id_unique" UNIQUE("telegram_charge_id"),
	CONSTRAINT "payments_item_check" CHECK (num_nonnulls("Payments"."car_id", "Payments"."character_id", "Payments"."map_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "Referrals" (
	"id" serial PRIMARY KEY NOT NULL,
	"inviter_user_id" integer NOT NULL,
	"invited_user_id" integer NOT NULL,
	"status" "referral_status_enum" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"qualified_at" timestamp with time zone,
	CONSTRAINT "Referrals_invited_user_id_unique" UNIQUE("invited_user_id")
);
--> statement-breakpoint
CREATE TABLE "Unlock_Progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"car_id" integer,
	"character_id" integer,
	"map_id" integer,
	"progress" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "unlock_progress_user_car_unique" UNIQUE("user_id","car_id"),
	CONSTRAINT "unlock_progress_user_char_unique" UNIQUE("user_id","character_id"),
	CONSTRAINT "unlock_progress_user_map_unique" UNIQUE("user_id","map_id"),
	CONSTRAINT "unlock_progress_item_check" CHECK (num_nonnulls("Unlock_Progress"."car_id", "Unlock_Progress"."character_id", "Unlock_Progress"."map_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "User_Items" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"car_id" integer,
	"character_id" integer,
	"map_id" integer,
	"unlocked_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "user_items_user_car_unique" UNIQUE("user_id","car_id"),
	CONSTRAINT "user_items_user_char_unique" UNIQUE("user_id","character_id"),
	CONSTRAINT "user_items_user_map_unique" UNIQUE("user_id","map_id"),
	CONSTRAINT "user_items_item_check" CHECK (num_nonnulls("User_Items"."car_id", "User_Items"."character_id", "User_Items"."map_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "Users" (
	"id" serial PRIMARY KEY NOT NULL,
	"telegram_id" bigint NOT NULL,
	"username" varchar(100),
	"profile_icon" text DEFAULT 'https://placehold.co/150',
	"coins" integer DEFAULT 0 NOT NULL,
	"all_time_high_score" integer DEFAULT 0 NOT NULL,
	"ads_watched_total" integer DEFAULT 0 NOT NULL,
	"equipped_car_id" integer,
	"equipped_character_id" integer,
	"equipped_map_id" integer,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "Users_telegram_id_unique" UNIQUE("telegram_id")
);
--> statement-breakpoint
ALTER TABLE "Ad_Views" ADD CONSTRAINT "Ad_Views_user_id_Users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."Users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Ad_Views" ADD CONSTRAINT "Ad_Views_car_id_Cars_id_fk" FOREIGN KEY ("car_id") REFERENCES "public"."Cars"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Ad_Views" ADD CONSTRAINT "Ad_Views_character_id_Characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."Characters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Ad_Views" ADD CONSTRAINT "Ad_Views_map_id_Maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."Maps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Ad_Views" ADD CONSTRAINT "Ad_Views_run_id_Game_Runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."Game_Runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Coin_Transactions" ADD CONSTRAINT "Coin_Transactions_user_id_Users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."Users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Game_Runs" ADD CONSTRAINT "Game_Runs_user_id_Users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."Users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Game_Runs" ADD CONSTRAINT "Game_Runs_car_id_Cars_id_fk" FOREIGN KEY ("car_id") REFERENCES "public"."Cars"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Game_Runs" ADD CONSTRAINT "Game_Runs_character_id_Characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."Characters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Game_Runs" ADD CONSTRAINT "Game_Runs_map_id_Maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."Maps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Monthly_Leaderboards" ADD CONSTRAINT "Monthly_Leaderboards_user_id_Users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."Users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Monthly_Rewards_Log" ADD CONSTRAINT "Monthly_Rewards_Log_user_id_Users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."Users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Payments" ADD CONSTRAINT "Payments_user_id_Users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."Users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Payments" ADD CONSTRAINT "Payments_car_id_Cars_id_fk" FOREIGN KEY ("car_id") REFERENCES "public"."Cars"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Payments" ADD CONSTRAINT "Payments_character_id_Characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."Characters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Payments" ADD CONSTRAINT "Payments_map_id_Maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."Maps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Referrals" ADD CONSTRAINT "Referrals_inviter_user_id_Users_id_fk" FOREIGN KEY ("inviter_user_id") REFERENCES "public"."Users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Referrals" ADD CONSTRAINT "Referrals_invited_user_id_Users_id_fk" FOREIGN KEY ("invited_user_id") REFERENCES "public"."Users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Unlock_Progress" ADD CONSTRAINT "Unlock_Progress_user_id_Users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."Users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Unlock_Progress" ADD CONSTRAINT "Unlock_Progress_car_id_Cars_id_fk" FOREIGN KEY ("car_id") REFERENCES "public"."Cars"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Unlock_Progress" ADD CONSTRAINT "Unlock_Progress_character_id_Characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."Characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Unlock_Progress" ADD CONSTRAINT "Unlock_Progress_map_id_Maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."Maps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "User_Items" ADD CONSTRAINT "User_Items_user_id_Users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."Users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "User_Items" ADD CONSTRAINT "User_Items_car_id_Cars_id_fk" FOREIGN KEY ("car_id") REFERENCES "public"."Cars"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "User_Items" ADD CONSTRAINT "User_Items_character_id_Characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."Characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "User_Items" ADD CONSTRAINT "User_Items_map_id_Maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."Maps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Users" ADD CONSTRAINT "Users_equipped_car_id_Cars_id_fk" FOREIGN KEY ("equipped_car_id") REFERENCES "public"."Cars"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Users" ADD CONSTRAINT "Users_equipped_character_id_Characters_id_fk" FOREIGN KEY ("equipped_character_id") REFERENCES "public"."Characters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Users" ADD CONSTRAINT "Users_equipped_map_id_Maps_id_fk" FOREIGN KEY ("equipped_map_id") REFERENCES "public"."Maps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_coin_transactions_user" ON "Coin_Transactions" USING btree ("user_id","created_at" DESC);--> statement-breakpoint
CREATE INDEX "idx_game_runs_user" ON "Game_Runs" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "idx_monthly_best_score" ON "Monthly_Leaderboards" USING btree ("month","best_score" DESC);--> statement-breakpoint
CREATE INDEX "idx_monthly_loyalty" ON "Monthly_Leaderboards" USING btree ("month","loyalty_points" DESC);--> statement-breakpoint
CREATE INDEX "idx_payments_user" ON "Payments" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "idx_referrals_inviter" ON "Referrals" USING btree ("inviter_user_id","status");--> statement-breakpoint
CREATE INDEX "idx_user_items_user" ON "User_Items" USING btree ("user_id");