import db from "./db";
import { remindersTable } from "../db/schema";
import { eq, asc } from "drizzle-orm";

export default async function fetchReminders(
    userId: string,
    provider: string,
    limit: number = 5
) {
    return await db
        .select({
            id: remindersTable.id,
            title: remindersTable.title,
            description: remindersTable.description,
            time: remindersTable.time,
            priority: remindersTable.priority,
        })
        .from(remindersTable)
        .where(eq(remindersTable.ownerId, `${provider}-${userId}`))
        .orderBy(asc(remindersTable.time))
        .limit(limit);
}