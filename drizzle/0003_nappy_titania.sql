CREATE TYPE "public"."bill_period_type" AS ENUM('predefined', 'custom');--> statement-breakpoint
ALTER TABLE "Billings" ADD COLUMN "billPeriodType" "bill_period_type" DEFAULT 'predefined' NOT NULL;--> statement-breakpoint
ALTER TABLE "Billings" ADD COLUMN "billingEndDate" date;