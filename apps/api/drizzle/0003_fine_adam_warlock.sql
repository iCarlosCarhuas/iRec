CREATE TYPE "public"."storage_connection_status" AS ENUM('pending', 'ready', 'error', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."storage_provider" AS ENUM('google_drive');--> statement-breakpoint
CREATE TABLE "storage_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"provider" "storage_provider" NOT NULL,
	"provider_account_id" text NOT NULL,
	"display_name" text,
	"root_id" text,
	"credentials_encrypted" text NOT NULL,
	"status" "storage_connection_status" DEFAULT 'pending' NOT NULL,
	"last_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "storage_connections" ADD CONSTRAINT "storage_connections_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "storage_connections_owner_provider_account_uq" ON "storage_connections" USING btree ("owner_id","provider","provider_account_id");--> statement-breakpoint
CREATE INDEX "storage_connections_owner_status_idx" ON "storage_connections" USING btree ("owner_id","status");