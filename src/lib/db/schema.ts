import { relations, sql } from 'drizzle-orm';
import {
  pgTable,
  pgEnum,
  serial,
  integer,
  varchar,
  text,
  decimal,
  timestamp,
  date,
  json,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', ['admin', 'manager']);
export const itemStatusEnum = pgEnum('item_status', ['available', 'rented', 'maintenance']);
export const inventoryUnitStatusEnum = pgEnum('inventory_unit_status', ['available', 'rented', 'maintenance']);
export const rentalStatusEnum = pgEnum('rental_status', [
  'active',
  'completed',
  'cancelled',
  'pending',
  'created',
  'returned',
]);
export const billingStatusEnum = pgEnum('billing_status', ['pending', 'paid', 'overdue']);

const timestamps = {
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
};

export const users = pgTable('Users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  role: userRoleEnum('role').notNull().default('manager'),
  resetPasswordToken: varchar('resetPasswordToken', { length: 255 }),
  resetPasswordExpires: timestamp('resetPasswordExpires', { withTimezone: true }),
  ...timestamps,
});

export const customers = pgTable(
  'Customers',
  {
    id: serial('id').primaryKey(),
    firstName: varchar('firstName', { length: 255 }).notNull(),
    lastName: varchar('lastName', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }),
    phone: varchar('phone', { length: 255 }).notNull(),
    address: varchar('address', { length: 255 }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('customers_email_unique_when_present')
      .on(table.email)
      .where(sql`${table.email} IS NOT NULL`),
  ],
);

export const items = pgTable('Items', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 255 }),
  status: itemStatusEnum('status').notNull().default('available'),
  monthlyRate: decimal('monthlyRate', { precision: 12, scale: 2 }).notNull(),
  quantity: integer('quantity').notNull().default(1),
  ...timestamps,
});

export const inventoryUnits = pgTable(
  'InventoryUnits',
  {
    id: serial('id').primaryKey(),
    itemId: integer('itemId')
      .notNull()
      .references(() => items.id, { onDelete: 'cascade' }),
    status: inventoryUnitStatusEnum('status').notNull().default('available'),
    dateAdded: timestamp('dateAdded', { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (table) => [index('inventory_units_item_status_idx').on(table.itemId, table.status)],
);

export const rentals = pgTable(
  'Rentals',
  {
    id: serial('id').primaryKey(),
    itemId: integer('itemId').references(() => items.id, { onDelete: 'cascade' }),
    customerId: integer('customerId').references(() => customers.id, { onDelete: 'cascade' }),
    quantity: integer('quantity').notNull().default(1),
    inventoryUnitIds: json('inventoryUnitIds').$type<number[]>().notNull().default([]),
    startDate: timestamp('startDate', { withTimezone: true }).notNull(),
    endDate: timestamp('endDate', { withTimezone: true }).notNull(),
    depositAmount: decimal('depositAmount', { precision: 12, scale: 2 }).notNull(),
    labourCost: decimal('labourCost', { precision: 12, scale: 2 }).default('0'),
    transportCost: decimal('transportCost', { precision: 12, scale: 2 }).default('0'),
    returnLabourCost: decimal('returnLabourCost', { precision: 10, scale: 2 }).notNull().default('0'),
    returnTransportCost: decimal('returnTransportCost', { precision: 10, scale: 2 }).notNull().default('0'),
    damagesCost: decimal('damagesCost', { precision: 10, scale: 2 }).notNull().default('0'),
    status: rentalStatusEnum('status').notNull().default('active'),
    address: text('address'),
    ...timestamps,
  },
  (table) => [
    index('rentals_customer_idx').on(table.customerId),
    index('rentals_item_idx').on(table.itemId),
    index('rentals_status_idx').on(table.status),
  ],
);

export const rentalItems = pgTable(
  'RentalItems',
  {
    id: serial('id').primaryKey(),
    rentalId: integer('rentalId')
      .notNull()
      .references(() => rentals.id, { onDelete: 'cascade' }),
    itemId: integer('itemId')
      .notNull()
      .references(() => items.id, { onDelete: 'cascade' }),
    quantity: integer('quantity').notNull().default(1),
    returnedQuantity: integer('returnedQuantity').notNull().default(0),
    unitPrice: decimal('unitPrice', { precision: 10, scale: 2 }),
    inventoryUnitIds: json('inventoryUnitIds').$type<number[]>().notNull().default([]),
    ...timestamps,
  },
  (table) => [
    index('rental_items_rental_idx').on(table.rentalId),
    index('rental_items_item_idx').on(table.itemId),
  ],
);

export const billings = pgTable(
  'Billings',
  {
    id: serial('id').primaryKey(),
    rentalId: integer('rentalId').references(() => rentals.id, { onDelete: 'cascade' }),
    customerId: integer('customerId').references(() => customers.id, { onDelete: 'cascade' }),
    amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
    dueDate: date('dueDate', { mode: 'string' }).notNull(),
    status: billingStatusEnum('status').notNull().default('pending'),
    paymentDate: date('paymentDate', { mode: 'string' }),
    returnedQuantity: integer('returnedQuantity'),
    returnedUnitIds: json('returnedUnitIds').$type<number[] | null>(),
    totalDamages: decimal('totalDamages', { precision: 12, scale: 2 }).default('0'),
    depositUsed: decimal('depositUsed', { precision: 12, scale: 2 }).default('0'),
    availableDeposit: decimal('availableDeposit', { precision: 12, scale: 2 }).default('0'),
    labourCost: decimal('labourCost', { precision: 12, scale: 2 }).default('0'),
    transportCost: decimal('transportCost', { precision: 12, scale: 2 }).default('0'),
    returnLabourCost: decimal('returnLabourCost', { precision: 12, scale: 2 }).default('0'),
    returnTransportCost: decimal('returnTransportCost', { precision: 12, scale: 2 }).default('0'),
    damagesCost: decimal('damagesCost', { precision: 12, scale: 2 }).default('0'),
    ...timestamps,
  },
  (table) => [
    index('billings_rental_idx').on(table.rentalId),
    index('billings_customer_idx').on(table.customerId),
    index('billings_status_due_idx').on(table.status, table.dueDate),
  ],
);

export const billingItems = pgTable(
  'BillingItems',
  {
    id: serial('id').primaryKey(),
    billingId: integer('billingId')
      .notNull()
      .references(() => billings.id, { onDelete: 'cascade' }),
    itemId: integer('itemId').references(() => items.id, { onDelete: 'cascade' }),
    description: varchar('description', { length: 255 }),
    quantity: integer('quantity').notNull().default(1),
    rate: decimal('rate', { precision: 12, scale: 2 }).notNull(),
    total: decimal('total', { precision: 12, scale: 2 }).notNull(),
    ...timestamps,
  },
  (table) => [
    index('billing_items_billing_idx').on(table.billingId),
    index('billing_items_item_idx').on(table.itemId),
  ],
);

export const billingDamages = pgTable(
  'BillingDamages',
  {
    id: serial('id').primaryKey(),
    billingId: integer('billingId')
      .notNull()
      .references(() => billings.id, { onDelete: 'cascade' }),
    description: varchar('description', { length: 255 }).notNull(),
    amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
    ...timestamps,
  },
  (table) => [index('billing_damages_billing_idx').on(table.billingId)],
);

// Relations — names use PascalCase keys to mirror Sequelize include shapes
// (e.g. `Rental.RentalItems`, `Billing.BillingItems`, `RentalItem.Item`) so
// the relational query API produces the same response shapes the React/RTK
// Query frontend already consumes.

export const customersRelations = relations(customers, ({ many }) => ({
  Rentals: many(rentals),
  Billings: many(billings),
}));

export const itemsRelations = relations(items, ({ many }) => ({
  Rentals: many(rentals),
  RentalItems: many(rentalItems),
  InventoryUnits: many(inventoryUnits),
  BillingItems: many(billingItems),
}));

export const inventoryUnitsRelations = relations(inventoryUnits, ({ one }) => ({
  Item: one(items, { fields: [inventoryUnits.itemId], references: [items.id] }),
}));

export const rentalsRelations = relations(rentals, ({ one, many }) => ({
  Item: one(items, { fields: [rentals.itemId], references: [items.id] }),
  Customer: one(customers, { fields: [rentals.customerId], references: [customers.id] }),
  RentalItems: many(rentalItems),
  Billings: many(billings),
}));

export const rentalItemsRelations = relations(rentalItems, ({ one }) => ({
  Rental: one(rentals, { fields: [rentalItems.rentalId], references: [rentals.id] }),
  Item: one(items, { fields: [rentalItems.itemId], references: [items.id] }),
}));

export const billingsRelations = relations(billings, ({ one, many }) => ({
  Rental: one(rentals, { fields: [billings.rentalId], references: [rentals.id] }),
  Customer: one(customers, { fields: [billings.customerId], references: [customers.id] }),
  BillingItems: many(billingItems),
  BillingDamages: many(billingDamages),
}));

export const billingItemsRelations = relations(billingItems, ({ one }) => ({
  Billing: one(billings, { fields: [billingItems.billingId], references: [billings.id] }),
  Item: one(items, { fields: [billingItems.itemId], references: [items.id] }),
}));

export const billingDamagesRelations = relations(billingDamages, ({ one }) => ({
  Billing: one(billings, { fields: [billingDamages.billingId], references: [billings.id] }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;
export type InventoryUnit = typeof inventoryUnits.$inferSelect;
export type NewInventoryUnit = typeof inventoryUnits.$inferInsert;
export type Rental = typeof rentals.$inferSelect;
export type NewRental = typeof rentals.$inferInsert;
export type RentalItem = typeof rentalItems.$inferSelect;
export type NewRentalItem = typeof rentalItems.$inferInsert;
export type Billing = typeof billings.$inferSelect;
export type NewBilling = typeof billings.$inferInsert;
export type BillingItem = typeof billingItems.$inferSelect;
export type NewBillingItem = typeof billingItems.$inferInsert;
export type BillingDamage = typeof billingDamages.$inferSelect;
export type NewBillingDamage = typeof billingDamages.$inferInsert;
