ALTER TABLE "Telegram_Users" DROP CONSTRAINT IF EXISTS "Telegram_Users_equipped_car_id_Cars_id_fk";--> statement-breakpoint
ALTER TABLE "Telegram_Users" DROP CONSTRAINT IF EXISTS "Telegram_Users_equipped_paint_id_Paints_id_fk";--> statement-breakpoint
ALTER TABLE "Telegram_Users" DROP CONSTRAINT IF EXISTS "Telegram_Users_equipped_wheel_id_Wheels_id_fk";--> statement-breakpoint
ALTER TABLE "Telegram_Users" DROP CONSTRAINT IF EXISTS "Telegram_Users_equipped_character_id_Characters_id_fk";--> statement-breakpoint
ALTER TABLE "Telegram_Users" DROP CONSTRAINT IF EXISTS "Telegram_Users_equipped_map_id_Maps_id_fk";--> statement-breakpoint
ALTER TABLE "Telegram_Users" DROP COLUMN IF EXISTS "equipped_car_id";--> statement-breakpoint
ALTER TABLE "Telegram_Users" DROP COLUMN IF EXISTS "equipped_paint_id";--> statement-breakpoint
ALTER TABLE "Telegram_Users" DROP COLUMN IF EXISTS "equipped_wheel_id";--> statement-breakpoint
ALTER TABLE "Telegram_Users" DROP COLUMN IF EXISTS "equipped_character_id";--> statement-breakpoint
ALTER TABLE "Telegram_Users" DROP COLUMN IF EXISTS "equipped_map_id";--> statement-breakpoint
DROP TABLE IF EXISTS "Ad_Views" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "Cars" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "Characters" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "Game_Runs" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "Maps" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "Monthly_Leaderboards" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "Monthly_Rewards_Log" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "Paints" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "Payments" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "Powerups" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "Unlock_Progress" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "User_Items" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "User_Powerups" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "Wheels" CASCADE;--> statement-breakpoint
DROP TYPE IF EXISTS "public"."ad_purpose_enum";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."leaderboard_type_enum";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."payment_status_enum";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."run_status_enum";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."unlock_type_enum";