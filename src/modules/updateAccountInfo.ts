import db from './db';
import { usersTable } from '../db/schema';
import { sql } from 'drizzle-orm';

export default async function updateAccountInfo(uid: string, username: string, provider: string): Promise<void> {
    await db.insert(usersTable).values({
        uid: `${provider}-${uid}`,
        username,
        provider,
        lastUsed: new Date(),
    }).onConflictDoUpdate({
        target: usersTable.uid,
        set: { username, provider, lastUsed: new Date() },
        where: sql`${usersTable.username} IS DISTINCT FROM EXCLUDED.username`,
    });
}