CREATE TYPE "public"."album_asset_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "album_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"album_id" uuid NOT NULL,
	"storage_connection_id" uuid NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"object_key" text NOT NULL,
	"thumbnail_object_key" text,
	"original_filename" varchar(255) NOT NULL,
	"mime_type" varchar(128) NOT NULL,
	"size_bytes" bigint NOT NULL,
	"width" integer,
	"height" integer,
	"checksum" varchar(128),
	"status" "album_asset_status" DEFAULT 'pending' NOT NULL,
	"uploaded_at" timestamp with time zone,
	"moderated_by" uuid,
	"moderated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "album_assets" ADD CONSTRAINT "album_assets_album_id_albums_id_fk" FOREIGN KEY ("album_id") REFERENCES "public"."albums"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "album_assets" ADD CONSTRAINT "album_assets_storage_connection_id_storage_connections_id_fk" FOREIGN KEY ("storage_connection_id") REFERENCES "public"."storage_connections"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "album_assets" ADD CONSTRAINT "album_assets_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "album_assets" ADD CONSTRAINT "album_assets_moderated_by_users_id_fk" FOREIGN KEY ("moderated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "album_assets_album_status_idx" ON "album_assets" USING btree ("album_id","status");--> statement-breakpoint
CREATE INDEX "album_assets_uploader_idx" ON "album_assets" USING btree ("uploaded_by");--> statement-breakpoint
CREATE UNIQUE INDEX "album_assets_storage_object_uq" ON "album_assets" USING btree ("storage_connection_id","object_key");