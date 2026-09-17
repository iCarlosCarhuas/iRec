CREATE TYPE "public"."album_member_role" AS ENUM('owner', 'member');--> statement-breakpoint
CREATE TYPE "public"."album_member_status" AS ENUM('active', 'invited', 'removed');--> statement-breakpoint
CREATE TYPE "public"."album_visibility" AS ENUM('public', 'private');--> statement-breakpoint
CREATE TABLE "album_members" (
	"album_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "album_member_role" DEFAULT 'member' NOT NULL,
	"status" "album_member_status" DEFAULT 'active' NOT NULL,
	"joined_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "album_members_album_id_user_id_pk" PRIMARY KEY("album_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "albums" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"title" varchar(160) NOT NULL,
	"description" text,
	"visibility" "album_visibility" DEFAULT 'private' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "album_members" ADD CONSTRAINT "album_members_album_id_albums_id_fk" FOREIGN KEY ("album_id") REFERENCES "public"."albums"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "album_members" ADD CONSTRAINT "album_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "albums" ADD CONSTRAINT "albums_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "album_members_user_status_idx" ON "album_members" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "album_members_album_role_idx" ON "album_members" USING btree ("album_id","role");--> statement-breakpoint
CREATE INDEX "albums_owner_idx" ON "albums" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "albums_visibility_idx" ON "albums" USING btree ("visibility");