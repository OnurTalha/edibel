CREATE TYPE "public"."scan_type" AS ENUM('etiket', 'menu');--> statement-breakpoint
ALTER TABLE "scans" ADD COLUMN "scan_type" "scan_type" DEFAULT 'etiket' NOT NULL;