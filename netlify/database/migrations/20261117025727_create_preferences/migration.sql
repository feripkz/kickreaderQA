CREATE TABLE "preferences" (
	"id" text PRIMARY KEY,
	"settings" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
