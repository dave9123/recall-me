import { integer, pgTable, varchar, timestamp } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    username: varchar().notNull(),
    email: varchar({ length: 320 }).notNull().unique(),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull(),
    lastUsed: timestamp().defaultNow().notNull()
});

export const userCredentialsTable = pgTable("userCredentials", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userId: integer().notNull().references(() => usersTable.id),
    authProvider: varchar().notNull(),
    authData: varchar().notNull(),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull(),
    lastUsed: timestamp().defaultNow().notNull()
});

export const remindersTable = pgTable("reminders", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    ownerId: integer().notNull().references(() => usersTable.id),
    title: varchar().notNull(),
    description: varchar(),
    time: timestamp(),
    sharedWith: integer().array().references(() => usersTable.id).notNull(),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull()
});

export const toNotifyTable = pgTable("toNotify", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    reminderId: integer().notNull().references(() => remindersTable.id),
    userId: integer().notNull().references(() => usersTable.id),
    notified: integer().notNull().default(0),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull()   
});