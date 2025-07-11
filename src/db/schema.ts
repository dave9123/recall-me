import { integer, pgTable, varchar, timestamp, boolean } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    uid: varchar().notNull().unique(),
    username: varchar().notNull(),
    authData: varchar(),
    provider: varchar().notNull(),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull(),
    lastUsed: timestamp().defaultNow().notNull()
});

export const remindersTable = pgTable("reminders", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    uid: varchar().notNull().unique(),
    ownerId: varchar().notNull().references(() => usersTable.uid),
    title: varchar().notNull(),
    description: varchar(),
    time: timestamp(),
    sharedWith: varchar().array().notNull(),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull()
});

export const notifiedTable = pgTable("notified", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    reminderId: integer().notNull().references(() => remindersTable.id),
    userId: varchar().notNull().references(() => usersTable.uid),
    notified: boolean().default(false).notNull(),
    provider: varchar().notNull(),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull()
});