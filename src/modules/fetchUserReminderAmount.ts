import { remindersTable } from "../db/schema";
import db from "./db";
import { count, eq } from "drizzle-orm";

export default async function fetchUserReminderAmount(userId: string): Promise<number> {
    return await db.select({count: count()})
        .from(remindersTable)
        .where(
            eq(remindersTable.ownerId, userId)
        ).then(result => result[0]?.count || 0);
}