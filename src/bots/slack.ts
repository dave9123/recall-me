import { App } from "@slack/bolt";
import { createLogger } from "../modules/logger";
import db from "../modules/db";
import { eq, or, arrayContained, sql } from "drizzle-orm";
import { remindersTable, usersTable } from "../db/schema";

const logger = createLogger("Slack");

const app = new App({
    token: process.env.SLACK_OAUTH_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    socketMode: process.env.SLACK_SOCKET_MODE == "true" ? true : false,
    appToken: process.env.SLACK_APP_TOKEN,
    port: parseInt(process.env.SLACK_PORT || "3000", 10),
});

app.command("/reminder-create", async ({ ack, body, client }) => {
    try {
        await ack();

        db.insert(usersTable).values({
            uid: `slack-${body.user_id}`,
            username: body.user_name,
            provider: "slack",
        }).onConflictDoUpdate({
            target: usersTable.uid,
            set: { username: body.user_name },
            where: sql`${usersTable.username} IS DISTINCT FROM EXCLUDED.username`,
        });

        client.views.open({
            trigger_id: body.trigger_id,
            view: {
                type: "modal",
                callback_id: "create_reminder_modal",
                title: {
                    type: "plain_text",
                    text: "Create Reminder",
                },
                blocks: [
                    {
                        type: "input",
                        block_id: "reminder_title",
                        label: {
                            type: "plain_text",
                            text: "Title",
                        },
                        element: {
                            type: "plain_text_input",
                            action_id: "title_input",
                            placeholder: {
                                type: "plain_text",
                                text: "Add title",
                            },
                        },
                    },
                    {
                        type: "input",
                        block_id: "reminder_description",
                        label: {
                            type: "plain_text",
                            text: "Description",
                        },
                        optional: true,
                        element: {
                            type: "plain_text_input",
                            action_id: "description_input",
                            placeholder: {
                                type: "plain_text",
                                text: "Add description",
                            },
                            multiline: true,
                        },
                    },
                    {
                        type: "input",
                        block_id: "reminder_time",
                        element: {
                            initial_date_time: Math.floor(Date.now() / 1000),
                            type: "datetimepicker",
                            action_id: "time_input"
                        },
                        label: {
                            type: "plain_text",
                            text: "Time",
                            emoji: true
                        }
                    },
                    {
                        type: "input",
                        block_id: "reminder_priority",
                        label: {
                            type: "plain_text",
                            text: "Priority",
                        },
                        optional: true,
                        element: {
                            type: "static_select",
                            action_id: "priority_input",
                            placeholder: {
                                type: "plain_text",
                                text: "Select priority",
                                emoji: true
                            },
                            options: [
                                {
                                    text: {
                                        type: "plain_text",
                                        text: "Low",
                                        emoji: true
                                    },
                                    value: "low"
                                },
                                {
                                    text: {
                                        type: "plain_text",
                                        text: "Medium",
                                        emoji: true
                                    },
                                    value: "medium"
                                },
                                {
                                    text: {
                                        type: "plain_text",
                                        text: "High",
                                        emoji: true
                                    },
                                    value: "high"
                                }
                            ],
                        }
                    }
                ],
                submit: {
                    type: "plain_text",
                    text: "Create",
                },
            },
        });
    } catch (error) {
        logger.error("Error handling /reminder-create command:", error);
    }
});

app.view("create_reminder_modal", async ({ ack, body, view, client }) => {
    try {
        if (Date.now()/1000 >= view["state"]["values"]["reminder_time"]!["time_input"]!["selected_date_time"]!) {
            await ack({
                response_action: "errors",
                errors: {
                    reminder_time: "I can't remind you in the past unless I have access to a time machine, please pick a time in the future!"
                }
            });
            return;
        }

        /*await db.insert(remindersTable).values({
            ownerId: body.user.id,
            title: view["state"]["values"]["reminder_title"]["title_input"]["value"],
            description: view["state"]["values"]["reminder_description"]["description_input"]["value"] ?? null,
            time: new Date(view["state"]["values"]["reminder_time"]["time_input"]["selected_date_time"]),
            priority: view["state"]["values"]["reminder_priority"]["priority_input"]["selected_option"]["value"] ?? null,
        });*/
    } catch (error) {
        logger.error("Error handling reminder creation modal:", error);
    }
});

app.command("/reminder-list", async ({ ack, body, client }) => {
    try {
        await ack();

        /*const userId = Number(body.user_id);

        const reminders = await db.select().from(remindersTable)
            .where(or(
                eq(remindersTable.ownerId, userId),
                arrayContained(remindersTable.sharedWith, [userId]),
            ));*/

        await client.views.open({
            trigger_id: body.trigger_id,
            view: {
                type: "modal",
                callback_id: "list_reminders_modal",
                title: {
                    type: "plain_text",
                    text: "Reminders List",
                },
                blocks: [
                    {
                        type: "section",
                        text: {
                            type: "mrkdwn",
                            text: "Here are your reminders:",
                        },
                    },
                    {
                        type: "context",
                        elements: [
                            {
                                type: "plain_text",
                                text: "No reminders found.",
                            },
                        ],
                    },
                ],
            },
        });
    } catch (error) {
        logger.error("Error handling /reminder-list command:", error);
    }
});

export default async function startBot() {
    try {
        await app.start();
        logger.info(`Slack bot is running on port ${process.env.SLACK_PORT}`);
    } catch (error) {
        logger.error("Error starting Slack bot:", error);
        process.exit(1);
    }
}