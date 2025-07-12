import { App } from "@slack/bolt";
import { createLogger } from "../modules/logger";
import db from "../modules/db";
import { eq, sql } from "drizzle-orm";
import updateAccountInfo from "../modules/updateAccountInfo";
import { remindersTable, usersTable } from "../db/schema";
import createRandomId from "../modules/createRandomId";
import priorityNumberConversion from "../modules/priorityNumberConversion";
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

        updateAccountInfo(body.user_id, body.user_name, "slack");

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
                                    value: "Low"
                                },
                                {
                                    text: {
                                        type: "plain_text",
                                        text: "Medium",
                                        emoji: true
                                    },
                                    value: "Medium"
                                },
                                {
                                    text: {
                                        type: "plain_text",
                                        text: "High",
                                        emoji: true
                                    },
                                    value: "High"
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
        updateAccountInfo(body.user.id, body.user.name, "slack");

        if (Date.now() / 1000 >= view["state"]["values"]["reminder_time"]!["time_input"]!["selected_date_time"]!) {
            await ack({
                response_action: "errors",
                errors: {
                    reminder_time: "I can't remind you in the past unless I have access to a time machine, please pick a time in the future!"
                }
            });
            return;
        } else {
            await ack();
        }

        updateAccountInfo(body.user.id, body.user.name, "slack");

        const toInsert: {
            uid: string;
            ownerId: string;
            title: string;
            time: Date;
            description?: string | undefined;
            priority?: number | undefined;
        } = {
            uid: createRandomId(),
            ownerId: `slack-${body.user.id}`,
            title: view.state.values.reminder_title!.title_input!.value ?? "", //it should not be null but Bolt JS types being weird
            time: new Date(
                view.state.values.reminder_time!.time_input!.selected_date_time! * 1000
            ),
            description: view.state.values.reminder_description?.description_input?.value || undefined,
            priority: priorityNumberConversion(view.state.values.reminder_priority?.priority_input?.selected_option?.value as string) || undefined,
        };

        await db.insert(remindersTable).values(toInsert);
    } catch (error) {
        logger.error("Error handling reminder creation modal:", error);
    }
});

app.command("/reminder-list", async ({ ack, body, client }) => {
    try {
        await ack();

        updateAccountInfo(body.user_id, body.user_name, "slack");

        const reminders = await db.select({
            uid: remindersTable.uid,
            title: remindersTable.title,
            description: remindersTable.description,
            time: remindersTable.time,
            priority: remindersTable.priority
        }).from(remindersTable)
            .where(eq(remindersTable.ownerId, `slack-${body.user_id}`));

        let remindersList = [];
        if (reminders.length === 0) {
            remindersList.push({
                type: "context",
                elements: [
                    {
                        type: "plain_text",
                        text: "No reminders found.",
                    },
                ],
            });
        } else {
            for (const reminder of reminders) {
                remindersList.push({
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text: `*${reminder.title}*${reminder.description ? `\n${reminder.description}` : ""}`,
                    },
                },
                {
                    type: "context",
                    elements: [
                        {
                            type: "plain_text",
                            text: `Priority: ${reminder.priority ? ["High", "Medium", "Low"][reminder.priority - 1] : "None"}`,
                        },
                        {
                            type: "plain_text",
                            text: `|`,
                        },
                        {
                            type: "plain_text",
                            text: `ID: ${reminder.uid}`,
                        },
                        {
                            type: "plain_text",
                            text: `|`,
                        },
                        {
                            type: "plain_text",
                            text: `Time: ${reminder.time?.toUTCString()}`,
                        },
                    ],
                },
                {
                    type: "divider",
                });
            }
        }

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
                        type: "divider",
                    },
                    ...remindersList
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