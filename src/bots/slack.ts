import { App } from "@slack/bolt";
import { createLogger } from "../modules/logger";
import db from "../modules/db";
import { eq, or, arrayContained } from "drizzle-orm";
import { remindersTable } from "../db/schema";

const logger = createLogger("Slack");

const app = new App({
    token: process.env.SLACK_OAUTH_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    socketMode: process.env.SLACK_SOCKET_MODE === "true" ? true : false,
    appToken: process.env.SLACK_APP_TOKEN,
    port: parseInt(process.env.SLACK_PORT || "3000", 10),
});

app.command("/reminder-create", async ({ ack, body, client }) => {
    try {
        await ack();
        console.log(body);
        const result = await client.views.open({
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
                        element: {
                            type: "plain_text_input",
                            action_id: "description_input",
                            placeholder: {
                                type: "plain_text",
                                text: "Add description (optional)",
                            },
                            multiline: true,
                        },
                    },
                    {
                        type: "input",
                        block_id: "reminder_time",
                        element: {
                            type: "datetimepicker",
                            action_id: "reminder_input"
                        },
                        label: {
                            type: "plain_text",
                            text: "Time",
                            emoji: true
                        }
                    },
                    {
                        type: "section",
                        block_id: "reminder_priority",
                        text: {
                            type: "plain_text",
                            text: "Priority",
                        },
                        accessory: {
                            type: "static_select",
                            placeholder: {
                                type: "plain_text",
                                text: "Select priority (optional)",
                                emoji: true
                            },
                            initial_option: {
                                text: {
                                    type: "plain_text",
                                    text: "None",
                                    emoji: true
                                },
                                value: "none"
                            },
                            options: [
                                {
                                    text: {
                                        type: "plain_text",
                                        text: "None",
                                        emoji: true
                                    },
                                    value: "none"
                                },
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
        })
    } catch (error) {
        logger.error("Error handling /reminder-create command:", error);
    }
});

app.command("/reminder-list", async ({ ack, body, client }) => {
    try {
        await ack();

        const userId = Number(body.user_id);

        const reminders = await db.select().from(remindersTable)
            .where(or(
                eq(remindersTable.ownerId, userId),
                arrayContained(remindersTable.sharedWith, [userId]),
            ));

        const result = await client.views.open({
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

app.action("*", async ({ body, ack, client }) => {
    console.log("Action received:", body);
    try {
        await ack();
    } catch (error) {
        logger.error("Error handling action:", error);
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