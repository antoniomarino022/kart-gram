CREATE TABLE "Items" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"kind" varchar(20) NOT NULL,
	"name" varchar(100) NOT NULL,
	"price_coins" integer,
	"price_stars" integer,
	"model" varchar(100),
	"color" varchar(20),
	"finish" varchar(10),
	"coins" integer,
	"revives" integer,
	"grants" jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "items_kind_check" CHECK ("Items"."kind" IN ('kart', 'paint', 'wheels', 'trail', 'coin_pack', 'starter_pack')),
	CONSTRAINT "items_prices_check" CHECK (coalesce("Items"."price_coins", 0) >= 0 AND coalesce("Items"."price_stars", 1) > 0)
);
--> statement-breakpoint
CREATE TABLE "Player_Items" (
	"user_id" integer NOT NULL,
	"item_id" varchar(64) NOT NULL,
	"source" varchar(10) NOT NULL,
	"acquired_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "Player_Items_user_id_item_id_pk" PRIMARY KEY("user_id","item_id")
);
--> statement-breakpoint
CREATE TABLE "Player_Upgrades" (
	"user_id" integer NOT NULL,
	"upgrade_id" varchar(20) NOT NULL,
	"level" integer NOT NULL,
	"cost" integer NOT NULL,
	"bought_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "Player_Upgrades_user_id_upgrade_id_level_pk" PRIMARY KEY("user_id","upgrade_id","level"),
	CONSTRAINT "player_upgrades_level_check" CHECK ("Player_Upgrades"."level" BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE TABLE "Runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" integer NOT NULL,
	"seed" integer NOT NULL,
	"status" varchar(10) DEFAULT 'running' NOT NULL,
	"upgrades" jsonb NOT NULL,
	"wheels" varchar(64) NOT NULL,
	"revived" boolean DEFAULT false NOT NULL,
	"score" integer,
	"coins" integer,
	"distance" integer,
	"ticks" integer,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "Star_Payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"payload" varchar(64) NOT NULL,
	"purpose" varchar(10) NOT NULL,
	"item_id" varchar(64),
	"run_id" uuid,
	"stars" integer NOT NULL,
	"status" varchar(10) DEFAULT 'pending' NOT NULL,
	"telegram_charge_id" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone,
	CONSTRAINT "Star_Payments_payload_unique" UNIQUE("payload"),
	CONSTRAINT "Star_Payments_telegram_charge_id_unique" UNIQUE("telegram_charge_id"),
	CONSTRAINT "star_payments_stars_check" CHECK ("Star_Payments"."stars" > 0)
);
--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "role" SET DEFAULT 'user';--> statement-breakpoint
ALTER TABLE "Telegram_Users" ADD COLUMN "display_name" varchar(100);--> statement-breakpoint
ALTER TABLE "Telegram_Users" ADD COLUMN "equipped" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "Telegram_Users" ADD COLUMN "revives" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "Telegram_Users" ADD COLUMN "is_banned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "Player_Items" ADD CONSTRAINT "Player_Items_user_id_Telegram_Users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."Telegram_Users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Player_Items" ADD CONSTRAINT "Player_Items_item_id_Items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."Items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Player_Upgrades" ADD CONSTRAINT "Player_Upgrades_user_id_Telegram_Users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."Telegram_Users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Runs" ADD CONSTRAINT "Runs_user_id_Telegram_Users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."Telegram_Users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Star_Payments" ADD CONSTRAINT "Star_Payments_user_id_Telegram_Users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."Telegram_Users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Star_Payments" ADD CONSTRAINT "Star_Payments_item_id_Items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."Items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Star_Payments" ADD CONSTRAINT "Star_Payments_run_id_Runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."Runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_runs_user" ON "Runs" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE INDEX "idx_runs_finished" ON "Runs" USING btree ("finished_at","score");--> statement-breakpoint
CREATE INDEX "idx_star_payments_user" ON "Star_Payments" USING btree ("user_id","created_at");