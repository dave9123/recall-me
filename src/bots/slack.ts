import { App } from "@slack/bolt";
import { createLogger } from "../modules/logger";
import db from "../modules/db";
import { eq, and, asc } from "drizzle-orm";
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
                                text: "Add title (max 128 characters)",
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
                                text: "Add description (max 1024 characters)",
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

        if (view.state.values.reminder_title!.title_input!.value!.length > 128) {
            await ack({
                response_action: "errors",
                errors: {
                    reminder_title: "Title must be 128 characters or less!"
                }
            });
            return;
        }

        if (view.state.values.reminder_description?.description_input?.value && view.state.values.reminder_description?.description_input?.value?.length > 1024) {
            await ack({
                response_action: "errors",
                errors: {
                    reminder_description: "Description must be 1024 characters or less!"
                }
            });
            return;
        }

        if (Date.now() / 1000 >= view["state"]["values"]["reminder_time"]!["time_input"]!["selected_date_time"]!) {
            await ack({
                response_action: "errors",
                errors: {
                    reminder_time: "Please pick a time in the future!"
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
            description?: string | null;
            priority?: number | null;
        } = {
            uid: createRandomId(),
            ownerId: `slack-${body.user.id}`,
            title: view.state.values.reminder_title!.title_input!.value ?? "", //it should not be null but Bolt JS types being weird
            time: new Date(
                view.state.values.reminder_time!.time_input!.selected_date_time! * 1000
            ),
            description: view.state.values.reminder_description?.description_input?.value || null,
            priority: view.state.values.reminder_priority?.priority_input?.selected_option?.value
                ? priorityNumberConversion(view.state.values.reminder_priority?.priority_input?.selected_option?.value as string)
                : null,
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

        const reminders = await db
            .select({
                id: remindersTable.id,
                title: remindersTable.title,
                description: remindersTable.description,
                time: remindersTable.time,
                priority: remindersTable.priority,
                createdAt: remindersTable.createdAt,
            })
            .from(remindersTable)
            .where(eq(remindersTable.ownerId, `slack-${body.user_id}`))
            .orderBy(asc(remindersTable.time))
            .limit(5);

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
                let priorityContext = [];
                if (reminder.priority) {
                    priorityContext.push(
                        {
                            type: "plain_text",
                            text: `|`,
                        },
                        {
                            type: "plain_text",
                            text: `Priority: ${reminder.priority ? ["High", "Medium", "Low"][reminder.priority - 1] : "None"}`,
                        }
                    );
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
                                /*{
                                    type: "plain_text",
                                    text: `ID: ${reminder.uid}`,
                                },
                                {
                                    type: "plain_text",
                                    text: `|`,
                                },*/
                                {
                                    type: "plain_text",
                                    text: `Time: ${reminder.time?.toUTCString()}`,
                                },
                                ...priorityContext,
                            ],
                        },
                        {
                            type: "actions",
                            elements: [
                                /*{
                                    type: "button",
                                    text: {
                                        type: "plain_text",
                                        text: "Mark as Done",
                                    },
                                    style: "primary",
                                    action_id: "mark_reminder_as_done",
                                    value: reminder.id.toString(),
                                },
                                {
                                    type: "button",
                                    text: {
                                        type: "plain_text",
                                        text: "Details",
                                    },
                                    action_id: "reminder_details",
                                    value: reminder.id.toString(),
                                },*/
                                {
                                    type: "button",
                                    text: {
                                        type: "plain_text",
                                        text: "Edit",
                                    },
                                    action_id: "edit_reminder",
                                    value: reminder.id.toString(),
                                },
                                {
                                    type: "button",
                                    text: {
                                        type: "plain_text",
                                        text: "Delete",
                                    },
                                    style: "danger",
                                    action_id: "delete_reminder",
                                    value: reminder.id.toString(),
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
                        /*{
                            type: "section",
                            text: {
                                type: "mrkdwn",
                                text: `Sort by:`,
                            },
                            accessory: {
                                type: "static_select",
                                action_id: "sort_reminders",
                                placeholder: {
                                    type: "plain_text",
                                    text: "Select sorting option",
                                },
                                options: [
                                    {
                                        text: {
                                            type: "plain_text",
                                            text: "Time",
                                        },
                                        value: "time",
                                    },
                                    {
                                        text: {
                                            type: "plain_text",
                                            text: "Priority",
                                        },
                                        value: "priority",
                                    },
                                ],
                            },
                        },*/
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
                        ...remindersList,
                        /*{
                            type: "context",
                            elements: [
                                {
                                    type: "plain_text",
                                    text: `Page 1 of 1`,
                                },
                            ],
                        }*/
                    ],
                },
            });
        }
    } catch (error) {
        logger.error("Error handling /reminder-list command:", error);
    }
});

app.action("edit_reminder", async ({ ack, body, client }) => {
    try {
        await ack();

        updateAccountInfo(body.user.id, body.user.username, "slack");

        const reminder = await db.select().from(remindersTable)
            .where(and(
                eq(remindersTable.id, Number(body.actions![0].value)),
                eq(remindersTable.ownerId, `slack-${body.user.id}`)
            )).then(rows => rows[0]);

        if (!reminder) {
            await client.views.open({
                trigger_id: body.trigger_id,
                view: {
                    type: "modal",
                    callback_id: "error_modal",
                    title: {
                        type: "plain_text",
                        text: "Error",
                    },
                    blocks: [
                        {
                            type: "section",
                            text: {
                                type: "mrkdwn",
                                text: "The reminder you are trying to edit does not exist or you do not have permission to edit it.",
                            },
                        },
                    ],
                },
            });
            return;
        }

        await client.views.push({
            trigger_id: body.trigger_id,
            view: {
                type: "modal",
                callback_id: "edit_reminder_modal",
                title: {
                    type: "plain_text",
                    text: "Edit Reminder",
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
                            initial_value: reminder.title,
                            placeholder: {
                                type: "plain_text",
                                text: "Add title (max 128 characters)",
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
                            initial_value: reminder.description || "",
                            placeholder: {
                                type: "plain_text",
                                text: "Add description (max 1024 characters)",
                            },
                            multiline: true,
                        },
                    },
                    {
                        type: "input",
                        block_id: "reminder_time",
                        element: {
                            initial_date_time: Math.floor(reminder.time.getTime() / 1000),
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
                            initial_option: {
                                text: {
                                    type: "plain_text",
                                    text: ["Low", "Medium", "High"][reminder.priority - 1] || "None",
                                    emoji: true
                                },
                                value: ["Low", "Medium", "High"][reminder.priority - 1] || "None"
                            },
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
                    text: "Update",
                },
            },
        });
    } catch (error) {
        logger.error("Error handling edit reminder action:", error);
    }
});

app.view("edit_reminder_modal", async ({ ack, body, client }) => {
    try {
        const errors: Record<string, string> = {};

        updateAccountInfo(body.user.id, body.user.username, "slack");

        if (body.view.state.values.reminder_title!.title_input!.value!.length > 128) {
            errors.reminder_title = "Title must be 128 characters or less!";
        }

        if (body.view.state.values.reminder_description?.description_input?.value && body.view.state.values.reminder_description?.description_input?.value?.length > 1024) {
            errors.reminder_description = "Description must be 1024 characters or less!";
        }

        if (Date.now() / 1000 >= body.view.state.values.reminder_time!.time_input!.selected_date_time!) {
            errors.reminder_time = "Reminder time must be in the future!";
        }

        if (Object.keys(errors).length > 0) {
            await ack({
                response_action: "errors",
                errors
            });
            return;
        } else {
            await ack();
        }

        await db.update(remindersTable)
            .set({
                title: body.view.state.values.reminder_title!.title_input!.value as string,
                description: body.view.state.values.reminder_description?.description_input?.value || null,
                time: new Date(body.view.state.values.reminder_time!.time_input!.selected_date_time! * 1000),
                priority: body.view.state.values.reminder_priority?.priority_input?.selected_option?.value
                    ? priorityNumberConversion(body.view.state.values.reminder_priority.priority_input.selected_option.value as string)
                    : null,
            }).where(
                and(
                    eq(remindersTable.id, body.view.private_metadata.reminder_id),
                    eq(remindersTable.ownerId, `slack-${body.user.id}`)
                )
            );
    } catch (error) {
        logger.error("Error handling edit reminder action:", error);
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