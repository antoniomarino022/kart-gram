CREATE TABLE "Paints" (
	"id" serial PRIMARY KEY NOT NULL,
	"color" varchar(50),
	"unlock_type" "unlock_type_enum" NOT NULL,
	"unlock_value" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Powerups" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"unlock_type" "unlock_type_enum" NOT NULL,
	"unlock_value" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Telegram_Users" (
	"id" serial PRIMARY KEY NOT NULL,
	"telegram_id" bigint NOT NULL,
	"username" varchar(100),
	"profile_icon" text DEFAULT 'https://placehold.co/150',
	"coins" integer DEFAULT 0 NOT NULL,
	"all_time_high_score" integer DEFAULT 0 NOT NULL,
	"ads_watched_total" integer DEFAULT 0 NOT NULL,
	"equipped_car_id" integer,
	"equipped_paint_id" integer,
	"equipped_wheel_id" integer,
	"equipped_character_id" integer,
	"equipped_map_id" integer,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "Telegram_Users_telegram_id_unique" UNIQUE("telegram_id")
);
--> statement-breakpoint
CREATE TABLE "User_Powerups" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"powerup_id" integer NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"unlocked_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "user_powerups_user_powerup_unique" UNIQUE("user_id","powerup_id")
);
--> statement-breakpoint
CREATE TABLE "Wheels" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"capacity" integer NOT NULL,
	"unlock_type" "unlock_type_enum" NOT NULL,
	"unlock_value" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Users" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "Users" CASCADE;--> statement-breakpoint
ALTER TABLE "Ad_Views" DROP CONSTRAINT "ad_views_item_check";--> statement-breakpoint
ALTER TABLE "Payments" DROP CONSTRAINT "payments_item_check";--> statement-breakpoint
ALTER TABLE "Unlock_Progress" DROP CONSTRAINT "unlock_progress_item_check";--> statement-breakpoint
ALTER TABLE "User_Items" DROP CONSTRAINT "user_items_item_check";--> statement-breakpoint
ALTER TABLE "Ad_Views" DROP CONSTRAINT "Ad_Views_user_id_Users_id_fk";
--> statement-breakpoint
ALTER TABLE "Coin_Transactions" DROP CONSTRAINT "Coin_Transactions_user_id_Users_id_fk";
--> statement-breakpoint
ALTER TABLE "Game_Runs" DROP CONSTRAINT "Game_Runs_user_id_Users_id_fk";
--> statement-breakpoint
ALTER TABLE "Monthly_Leaderboards" DROP CONSTRAINT "Monthly_Leaderboards_user_id_Users_id_fk";
--> statement-breakpoint
ALTER TABLE "Monthly_Rewards_Log" DROP CONSTRAINT "Monthly_Rewards_Log_user_id_Users_id_fk";
--> statement-breakpoint
ALTER TABLE "Payments" DROP CONSTRAINT "Payments_user_id_Users_id_fk";
--> statement-breakpoint
ALTER TABLE "Referrals" DROP CONSTRAINT "Referrals_inviter_user_id_Users_id_fk";
--> statement-breakpoint
ALTER TABLE "Referrals" DROP CONSTRAINT "Referrals_invited_user_id_Users_id_fk";
--> statement-breakpoint
ALTER TABLE "Unlock_Progress" DROP CONSTRAINT "Unlock_Progress_user_id_Users_id_fk";
--> statement-breakpoint
ALTER TABLE "User_Items" DROP CONSTRAINT "User_Items_user_id_Users_id_fk";
--> statement-breakpoint
ALTER TABLE "Ad_Views" ADD COLUMN "paint_id" integer;--> statement-breakpoint
ALTER TABLE "Ad_Views" ADD COLUMN "wheel_id" integer;--> statement-breakpoint
ALTER TABLE "Payments" ADD COLUMN "paint_id" integer;--> statement-breakpoint
ALTER TABLE "Payments" ADD COLUMN "wheel_id" integer;--> statement-breakpoint
ALTER TABLE "Unlock_Progress" ADD COLUMN "paint_id" integer;--> statement-breakpoint
ALTER TABLE "Unlock_Progress" ADD COLUMN "wheel_id" integer;--> statement-breakpoint
ALTER TABLE "User_Items" ADD COLUMN "paint_id" integer;--> statement-breakpoint
ALTER TABLE "User_Items" ADD COLUMN "wheel_id" integer;--> statement-breakpoint
ALTER TABLE "Telegram_Users" ADD CONSTRAINT "Telegram_Users_equipped_car_id_Cars_id_fk" FOREIGN KEY ("equipped_car_id") REFERENCES "public"."Cars"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Telegram_Users" ADD CONSTRAINT "Telegram_Users_equipped_paint_id_Paints_id_fk" FOREIGN KEY ("equipped_paint_id") REFERENCES "public"."Paints"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Telegram_Users" ADD CONSTRAINT "Telegram_Users_equipped_wheel_id_Wheels_id_fk" FOREIGN KEY ("equipped_wheel_id") REFERENCES "public"."Wheels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Telegram_Users" ADD CONSTRAINT "Telegram_Users_equipped_character_id_Characters_id_fk" FOREIGN KEY ("equipped_character_id") REFERENCES "public"."Characters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Telegram_Users" ADD CONSTRAINT "Telegram_Users_equipped_map_id_Maps_id_fk" FOREIGN KEY ("equipped_map_id") REFERENCES "public"."Maps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "User_Powerups" ADD CONSTRAINT "User_Powerups_user_id_Telegram_Users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."Telegram_Users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "User_Powerups" ADD CONSTRAINT "User_Powerups_powerup_id_Powerups_id_fk" FOREIGN KEY ("powerup_id") REFERENCES "public"."Powerups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_user_powerups_user" ON "User_Powerups" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "Ad_Views" ADD CONSTRAINT "Ad_Views_user_id_Telegram_Users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."Telegram_Users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Ad_Views" ADD CONSTRAINT "Ad_Views_paint_id_Paints_id_fk" FOREIGN KEY ("paint_id") REFERENCES "public"."Paints"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Ad_Views" ADD CONSTRAINT "Ad_Views_wheel_id_Wheels_id_fk" FOREIGN KEY ("wheel_id") REFERENCES "public"."Wheels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Coin_Transactions" ADD CONSTRAINT "Coin_Transactions_user_id_Telegram_Users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."Telegram_Users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Game_Runs" ADD CONSTRAINT "Game_Runs_user_id_Telegram_Users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."Telegram_Users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Monthly_Leaderboards" ADD CONSTRAINT "Monthly_Leaderboards_user_id_Telegram_Users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."Telegram_Users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Monthly_Rewards_Log" ADD CONSTRAINT "Monthly_Rewards_Log_user_id_Telegram_Users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."Telegram_Users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Payments" ADD CONSTRAINT "Payments_user_id_Telegram_Users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."Telegram_Users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Payments" ADD CONSTRAINT "Payments_paint_id_Paints_id_fk" FOREIGN KEY ("paint_id") REFERENCES "public"."Paints"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Payments" ADD CONSTRAINT "Payments_wheel_id_Wheels_id_fk" FOREIGN KEY ("wheel_id") REFERENCES "public"."Wheels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Referrals" ADD CONSTRAINT "Referrals_inviter_user_id_Telegram_Users_id_fk" FOREIGN KEY ("inviter_user_id") REFERENCES "public"."Telegram_Users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Referrals" ADD CONSTRAINT "Referrals_invited_user_id_Telegram_Users_id_fk" FOREIGN KEY ("invited_user_id") REFERENCES "public"."Telegram_Users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Unlock_Progress" ADD CONSTRAINT "Unlock_Progress_user_id_Telegram_Users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."Telegram_Users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Unlock_Progress" ADD CONSTRAINT "Unlock_Progress_paint_id_Paints_id_fk" FOREIGN KEY ("paint_id") REFERENCES "public"."Paints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Unlock_Progress" ADD CONSTRAINT "Unlock_Progress_wheel_id_Wheels_id_fk" FOREIGN KEY ("wheel_id") REFERENCES "public"."Wheels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "User_Items" ADD CONSTRAINT "User_Items_user_id_Telegram_Users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."Telegram_Users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "User_Items" ADD CONSTRAINT "User_Items_paint_id_Paints_id_fk" FOREIGN KEY ("paint_id") REFERENCES "public"."Paints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "User_Items" ADD CONSTRAINT "User_Items_wheel_id_Wheels_id_fk" FOREIGN KEY ("wheel_id") REFERENCES "public"."Wheels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Unlock_Progress" ADD CONSTRAINT "unlock_progress_user_paint_unique" UNIQUE("user_id","paint_id");--> statement-breakpoint
ALTER TABLE "Unlock_Progress" ADD CONSTRAINT "unlock_progress_user_wheel_unique" UNIQUE("user_id","wheel_id");--> statement-breakpoint
ALTER TABLE "User_Items" ADD CONSTRAINT "user_items_user_paint_unique" UNIQUE("user_id","paint_id");--> statement-breakpoint
ALTER TABLE "User_Items" ADD CONSTRAINT "user_items_user_wheel_unique" UNIQUE("user_id","wheel_id");--> statement-breakpoint
ALTER TABLE "Ad_Views" ADD CONSTRAINT "ad_views_item_check" CHECK (num_nonnulls("Ad_Views"."car_id", "Ad_Views"."paint_id", "Ad_Views"."wheel_id", "Ad_Views"."character_id", "Ad_Views"."map_id") <= 1);--> statement-breakpoint
ALTER TABLE "Payments" ADD CONSTRAINT "payments_item_check" CHECK (num_nonnulls("Payments"."car_id", "Payments"."paint_id", "Payments"."wheel_id", "Payments"."character_id", "Payments"."map_id") = 1);--> statement-breakpoint
ALTER TABLE "Unlock_Progress" ADD CONSTRAINT "unlock_progress_item_check" CHECK (num_nonnulls("Unlock_Progress"."car_id", "Unlock_Progress"."paint_id", "Unlock_Progress"."wheel_id", "Unlock_Progress"."character_id", "Unlock_Progress"."map_id") = 1);--> statement-breakpoint
ALTER TABLE "User_Items" ADD CONSTRAINT "user_items_item_check" CHECK (num_nonnulls("User_Items"."car_id", "User_Items"."paint_id", "User_Items"."wheel_id", "User_Items"."character_id", "User_Items"."map_id") = 1);