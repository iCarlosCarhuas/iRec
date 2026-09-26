CREATE TABLE "storage_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"account_id" varchar(64) NOT NULL,
	"bucket" varchar(255) NOT NULL,
	"access_key_id_encrypted" text NOT NULL,
	"secret_access_key_encrypted" text NOT NULL,
	"last_verified_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "albums" ADD COLUMN "storage_connection_id" uuid;--> statement-breakpoint
ALTER TABLE "storage_connections" ADD CONSTRAINT "storage_connections_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "storage_connections_owner_idx" ON "storage_connections" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "storage_connections_owner_bucket_uq" ON "storage_connections" USING btree ("owner_id","account_id","bucket");--> statement-breakpoint
ALTER TABLE "albums" ADD CONSTRAINT "albums_storage_connection_id_storage_connections_id_fk" FOREIGN KEY ("storage_connection_id") REFERENCES "public"."storage_connections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "albums_storage_connection_idx" ON "albums" USING btree ("storage_connection_id");