import { remindersTable, notifiedTable } from "../db/schema";
import db from "./db";
import { count, eq, and, notExists } from "drizzle-orm";

export default async function fetchUserReminderAmount(provider: string, userId: string): Promise<number> {
    return await db.select({count: count()})
        .from(remindersTable)
        .where(
            and(
                eq(remindersTable.ownerId, `${provider}-${userId}`),
                notExists(
                    db.select()
                        .from(notifiedTable)
                        .where(eq(notifiedTable.reminderId, remindersTable.id))
                )
            )
        ).then(result => result[0]?.count || 0);
}