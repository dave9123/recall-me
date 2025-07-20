import db from "./db";
import { remindersTable, notifiedTable } from "../db/schema";
import { lte, and, ne, eq, notExists } from "drizzle-orm";
import { createLogger } from "./logger";
import { notifyUser as slackNotify } from "../bots/slack"

const logger = createLogger("Notifier");

logger.info("Notifier started!")

setInterval(async () => {
    try {
        const reminders = await db.select()
            .from(remindersTable)
            .where(
                and(
                    lte(remindersTable.time, new Date(Date.now() - 60 * 1000)),
                    notExists(
                        db.select().from(notifiedTable)
                            .where(
                                and(
                                    eq(notifiedTable.reminderId, remindersTable.id),
                                    eq(notifiedTable.userId, remindersTable.ownerId)
                                )
                            )
                    )
                )
            );

        if (reminders.length > 0) {
            logger.info(`Found ${reminders.length} reminder${reminders.length > 1 ? "s" : ""} to notify`);
        }

        for (const reminder of reminders) {
            let priorityContext = [];
            if (reminder.priority) {
                priorityContext.push({
                    type: "plain_text",
                    text: `Priority: ${reminder.priority ? ["High", "Medium", "Low"][reminder.priority - 1] : "None"}`
                });
            }
            await slackNotify(reminder.ownerId.replace("slack-", ""), reminder.title, [
                {
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text: `*${reminder.title}*${reminder.description ? `\n${reminder.description}` : ""}`
                    },
                },
                {
                    type: "context",
                    elements: [
                        ...priorityContext,
                        {
                            type: "plain_text",
                            text: `Created at ${reminder.createdAt?.toUTCString()}`
                        },
                        {
                            type: "plain_text",
                            text: `Time: ${reminder.time?.toUTCString()}`
                        }
                    ]
                }
            ]);

            await db.insert(notifiedTable).values({
                reminderId: reminder.id,
                userId: reminder.ownerId,
                notified: true,
                provider: "slack",
            });
        }
    } catch (err) {
        logger.warn("An error occured while trying to notify:", err)
    }
}, 60 * 1000);