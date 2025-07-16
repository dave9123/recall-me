import db from "./db";
import { notifiedTable, remindersTable } from "../db/schema";
import { eq, asc, and, notExists } from "drizzle-orm";

export default async function fetchReminders(
    userId: string,
    provider: string,
    limit: number = Number(process.env.REMINDER_LIMIT) || 5,
    offset: number = 0
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
        .where(and(
            eq(remindersTable.ownerId, `${provider}-${userId}`),
            notExists(
                db.select()
                    .from(notifiedTable)
                    .where(eq(notifiedTable.reminderId, remindersTable.id))
            )
        ))
        .orderBy(asc(remindersTable.time))
        .offset(offset)
        .limit(limit);
}