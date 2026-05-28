CREATE TYPE "public"."billing_status" AS ENUM('pending', 'paid', 'overdue');--> statement-breakpoint
CREATE TYPE "public"."inventory_unit_status" AS ENUM('available', 'rented', 'maintenance');--> statement-breakpoint
CREATE TYPE "public"."item_status" AS ENUM('available', 'rented', 'maintenance');--> statement-breakpoint
CREATE TYPE "public"."rental_status" AS ENUM('active', 'completed', 'cancelled', 'pending', 'created', 'returned');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'manager');--> statement-breakpoint
CREATE TABLE "BillingDamages" (
	"id" serial PRIMARY KEY NOT NULL,
	"billingId" integer NOT NULL,
	"description" varchar(255) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "BillingItems" (
	"id" serial PRIMARY KEY NOT NULL,
	"billingId" integer NOT NULL,
	"itemId" integer,
	"description" varchar(255),
	"quantity" integer DEFAULT 1 NOT NULL,
	"rate" numeric(12, 2) NOT NULL,
	"total" numeric(12, 2) NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Billings" (
	"id" serial PRIMARY KEY NOT NULL,
	"rentalId" integer,
	"customerId" integer,
	"amount" numeric(12, 2) NOT NULL,
	"dueDate" date NOT NULL,
	"status" "billing_status" DEFAULT 'pending' NOT NULL,
	"paymentDate" date,
	"returnedQuantity" integer,
	"returnedUnitIds" json,
	"totalDamages" numeric(12, 2) DEFAULT '0',
	"depositUsed" numeric(12, 2) DEFAULT '0',
	"availableDeposit" numeric(12, 2) DEFAULT '0',
	"labourCost" numeric(12, 2) DEFAULT '0',
	"transportCost" numeric(12, 2) DEFAULT '0',
	"returnLabourCost" numeric(12, 2) DEFAULT '0',
	"returnTransportCost" numeric(12, 2) DEFAULT '0',
	"damagesCost" numeric(12, 2) DEFAULT '0',
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"firstName" varchar(255) NOT NULL,
	"lastName" varchar(255) NOT NULL,
	"email" varchar(255),
	"phone" varchar(255) NOT NULL,
	"address" varchar(255),
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "InventoryUnits" (
	"id" serial PRIMARY KEY NOT NULL,
	"itemId" integer NOT NULL,
	"status" "inventory_unit_status" DEFAULT 'available' NOT NULL,
	"dateAdded" timestamp with time zone DEFAULT now() NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Items" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"category" varchar(255),
	"status" "item_status" DEFAULT 'available' NOT NULL,
	"monthlyRate" numeric(12, 2) NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "RentalItems" (
	"id" serial PRIMARY KEY NOT NULL,
	"rentalId" integer NOT NULL,
	"itemId" integer NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"returnedQuantity" integer DEFAULT 0 NOT NULL,
	"unitPrice" numeric(10, 2),
	"inventoryUnitIds" json DEFAULT '[]'::json NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Rentals" (
	"id" serial PRIMARY KEY NOT NULL,
	"itemId" integer,
	"customerId" integer,
	"quantity" integer DEFAULT 1 NOT NULL,
	"inventoryUnitIds" json DEFAULT '[]'::json NOT NULL,
	"startDate" timestamp with time zone NOT NULL,
	"endDate" timestamp with time zone NOT NULL,
	"depositAmount" numeric(12, 2) NOT NULL,
	"labourCost" numeric(12, 2) DEFAULT '0',
	"transportCost" numeric(12, 2) DEFAULT '0',
	"returnLabourCost" numeric(10, 2) DEFAULT '0' NOT NULL,
	"returnTransportCost" numeric(10, 2) DEFAULT '0' NOT NULL,
	"damagesCost" numeric(10, 2) DEFAULT '0' NOT NULL,
	"status" "rental_status" DEFAULT 'active' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password" varchar(255) NOT NULL,
	"role" "user_role" DEFAULT 'manager' NOT NULL,
	"resetPasswordToken" varchar(255),
	"resetPasswordExpires" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "Users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "BillingDamages" ADD CONSTRAINT "BillingDamages_billingId_Billings_id_fk" FOREIGN KEY ("billingId") REFERENCES "public"."Billings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "BillingItems" ADD CONSTRAINT "BillingItems_billingId_Billings_id_fk" FOREIGN KEY ("billingId") REFERENCES "public"."Billings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "BillingItems" ADD CONSTRAINT "BillingItems_itemId_Items_id_fk" FOREIGN KEY ("itemId") REFERENCES "public"."Items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Billings" ADD CONSTRAINT "Billings_rentalId_Rentals_id_fk" FOREIGN KEY ("rentalId") REFERENCES "public"."Rentals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Billings" ADD CONSTRAINT "Billings_customerId_Customers_id_fk" FOREIGN KEY ("customerId") REFERENCES "public"."Customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "InventoryUnits" ADD CONSTRAINT "InventoryUnits_itemId_Items_id_fk" FOREIGN KEY ("itemId") REFERENCES "public"."Items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "RentalItems" ADD CONSTRAINT "RentalItems_rentalId_Rentals_id_fk" FOREIGN KEY ("rentalId") REFERENCES "public"."Rentals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "RentalItems" ADD CONSTRAINT "RentalItems_itemId_Items_id_fk" FOREIGN KEY ("itemId") REFERENCES "public"."Items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Rentals" ADD CONSTRAINT "Rentals_itemId_Items_id_fk" FOREIGN KEY ("itemId") REFERENCES "public"."Items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Rentals" ADD CONSTRAINT "Rentals_customerId_Customers_id_fk" FOREIGN KEY ("customerId") REFERENCES "public"."Customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "billing_damages_billing_idx" ON "BillingDamages" USING btree ("billingId");--> statement-breakpoint
CREATE INDEX "billing_items_billing_idx" ON "BillingItems" USING btree ("billingId");--> statement-breakpoint
CREATE INDEX "billing_items_item_idx" ON "BillingItems" USING btree ("itemId");--> statement-breakpoint
CREATE INDEX "billings_rental_idx" ON "Billings" USING btree ("rentalId");--> statement-breakpoint
CREATE INDEX "billings_customer_idx" ON "Billings" USING btree ("customerId");--> statement-breakpoint
CREATE INDEX "billings_status_due_idx" ON "Billings" USING btree ("status","dueDate");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_email_unique_when_present" ON "Customers" USING btree ("email") WHERE "Customers"."email" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "inventory_units_item_status_idx" ON "InventoryUnits" USING btree ("itemId","status");--> statement-breakpoint
CREATE INDEX "rental_items_rental_idx" ON "RentalItems" USING btree ("rentalId");--> statement-breakpoint
CREATE INDEX "rental_items_item_idx" ON "RentalItems" USING btree ("itemId");--> statement-breakpoint
CREATE INDEX "rentals_customer_idx" ON "Rentals" USING btree ("customerId");--> statement-breakpoint
CREATE INDEX "rentals_item_idx" ON "Rentals" USING btree ("itemId");--> statement-breakpoint
CREATE INDEX "rentals_status_idx" ON "Rentals" USING btree ("status");