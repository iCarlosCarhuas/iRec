CREATE TYPE "public"."album_asset_status" AS ENUM('pending', 'ready', 'failed', 'deleted');--> statement-breakpoint
CREATE TABLE "album_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"album_id" uuid NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"storage_connection_id" uuid NOT NULL,
	"provider" "storage_provider" NOT NULL,
	"provider_file_id" text,
	"mime_type" text NOT NULL,
	"original_name" varchar(255) NOT NULL,
	"size_bytes" integer NOT NULL,
	"status" "album_asset_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "album_assets" ADD CONSTRAINT "album_assets_album_id_albums_id_fk" FOREIGN KEY ("album_id") REFERENCES "public"."albums"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "album_assets" ADD CONSTRAINT "album_assets_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "album_assets" ADD CONSTRAINT "album_assets_storage_connection_id_storage_connections_id_fk" FOREIGN KEY ("storage_connection_id") REFERENCES "public"."storage_connections"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "album_assets_album_idx" ON "album_assets" USING btree ("album_id");--> statement-breakpoint
CREATE INDEX "album_assets_connection_idx" ON "album_assets" USING btree ("storage_connection_id");--> statement-breakpoint
CREATE INDEX "album_assets_uploader_idx" ON "album_assets" USING btree ("uploaded_by");