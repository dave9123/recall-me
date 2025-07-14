import { AllMiddlewareArgs, App, SlackActionMiddlewareArgs, SlackAction, SlackViewAction, SlackViewMiddlewareArgs } from "@slack/bolt";
import { createLogger } from "../modules/logger";
import db from "../modules/db";
import { eq, and } from "drizzle-orm";
import updateAccountInfo from "../modules/updateAccountInfo";
import { remindersTable } from "../db/schema";
import createRandomId from "../modules/createRandomId";
import priorityNumberConversion from "../modules/priorityNumberConversion";
import fetchReminders from "../modules/fetchReminders";
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
                private_metadata: JSON.stringify({ channel_id: body.channel_id }),
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
        const errors: Record<string, string> = {};

        if (view.state.values.reminder_title!.title_input!.value!.length > 128) {
            errors.reminder_title = "Title must be 128 characters or less!";
        }

        if (view.state.values.reminder_description?.description_input?.value && view.state.values.reminder_description?.description_input?.value?.length > 1024) {
            errors.reminder_description = "Description must be 1024 characters or less!";
        }

        if (Date.now() / 1000 >= view["state"]["values"]["reminder_time"]!["time_input"]!["selected_date_time"]!) {
            errors.reminder_time = "Please pick a time in the future!";
        }

        if (Object.keys(errors).length > 0) {
            await ack({
                response_action: "errors",
                errors
            });
            return;
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
        await client.chat.postEphemeral({
            channel: JSON.parse(view.private_metadata).channel_id,
            user: body.user.id,
            text: "Reminder created successfully!",
        });
    } catch (error) {
        logger.error("Error handling reminder creation modal:", error);
        await client.chat.postEphemeral({
            channel: JSON.parse(view.private_metadata).channel_id,
            user: body.user.id,
            text: "Failed to create reminder. Please try again later.",
        });
    }
});

app.command("/reminder-list", async ({ ack, body, client }) => {
    try {
        await ack();

        updateAccountInfo(body.user_id, body.user_name, "slack");

        const reminders = await fetchReminders(body.user_id, "slack", 5);

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
                }
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
                    { type: "divider" }
                );
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
                    { type: "divider", },
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
            await client.views.push({
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
                private_metadata: JSON.stringify({
                    parent_view_id: body.view.id,
                    parent_view_hash: body.view.hash,
                    reminder_id: reminder.id
                }),
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

app.view("edit_reminder_modal", async ({ ack, body, view, client }) => {
    try {
        const errors: Record<string, string> = {};

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
        }

        await ack();

        const reminder = await db.select().from(remindersTable)
            .where(and(
                eq(remindersTable.id, JSON.parse(body.view.private_metadata).reminder_id),
                eq(remindersTable.ownerId, `slack-${body.user.id}`)
            )).then(rows => rows[0]);
        if (!reminder) {
            await client.views.push({
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

        if (!reminder) {
            await ack({
                response_action: "push",
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

        await ack();

        updateAccountInfo(body.user.id, body.user.username, "slack");

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
                    eq(remindersTable.id, JSON.parse(body.view.private_metadata).reminder_id),
                    eq(remindersTable.ownerId, `slack-${body.user.id}`)
                )
            );

        const blocks = [
            { type: "section", text: { type: "mrkdwn", text: "Here are your reminders:" } },
            { type: "divider" },
            ...(await fetchReminders(body.user.id, "slack", 5)).flatMap(r => {
                const ctx: any[] = [{ type: "plain_text", text: `Time: ${r.time.toUTCString()}` }];
                if (r.priority != null) {
                    ctx.push(
                        { type: "plain_text", text: "|" },
                        { type: "plain_text", text: `Priority: ${["High", "Medium", "Low"][r.priority - 1]}` }
                    );
                }
                return [
                    { type: "section", text: { type: "mrkdwn", text: `*${r.title}*${r.description ? `\n${r.description}` : ""}` } },
                    { type: "context", elements: ctx },
                    {
                        type: "actions", elements: [
                            { type: "button", text: { type: "plain_text", text: "Edit" }, action_id: "edit_reminder", value: r.id.toString() },
                            { type: "button", text: { type: "plain_text", text: "Delete" }, style: "danger", action_id: "delete_reminder", value: r.id.toString() }
                        ]
                    },
                    { type: "divider" }
                ];
            })
        ];
        const meta = JSON.parse(body.view.private_metadata);
        await client.views.update({
            view_id: meta.parent_view_id,
            hash: meta.parent_view_hash,
            view: {
                type: "modal",
                callback_id: "list_reminders_modal",
                title: { type: "plain_text", text: "Reminders List" },
                blocks
            }
        });
    } catch (error) {
        logger.error("Error handling edit reminder action:", error);
    }
});

app.action("delete_reminder", async ({ ack, body, client }) => {
    try {
        await ack();

        updateAccountInfo(body.user.id, body.user.username, "slack");

        const reminderId = Number(body.actions[0].value);
        const reminder = await db.select().from(remindersTable)
            .where(and(
                eq(remindersTable.id, reminderId),
                eq(remindersTable.ownerId, `slack-${body.user.id}`)
            )).then(rows => rows[0]);

        if (!reminder) {
            await client.views.push({
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
                                text: "The reminder you are trying to delete does not exist or you do not have permission to delete it.",
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
                callback_id: "delete_reminder_confirmation",
                title: {
                    type: "plain_text",
                    text: "Delete Reminder?",
                },
                blocks: [
                    {
                        type: "section",
                        text: {
                            type: "mrkdwn",
                            text: `Are you sure you want to delete the reminder *${reminder.title}*? This action cannot be undone.`,
                        },
                    },
                    {
                        type: "actions",
                        elements: [
                            {
                                type: "button",
                                text: {
                                    type: "plain_text",
                                    text: "Confirm",
                                },
                                style: "danger",
                                action_id: "confirm_delete_reminder",
                                value: reminderId.toString(),
                            },
                        ],
                    },
                ],
            },
        });
    } catch (error) {
        logger.error("Error handling delete reminder action:", error);
    }
});

app.action("confirm_delete_reminder", async ({ ack, body, client }) => {
    try {
        await ack();

        const reminderId = Number(body.actions[0].value);
        const reminder = await db.select().from(remindersTable)
            .where(and(
                eq(remindersTable.id, reminderId),
                eq(remindersTable.ownerId, `slack-${body.user.id}`)
            )).then(rows => rows[0]);
        if (!reminder) {
            await client.views.update({
                view_id: body.view.id,
                hash: body.view.hash,
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
                                text: "The reminder you are trying to delete does not exist or you do not have permission to delete it.",
                            },
                        },
                    ],
                },
            });
            return;
        }
        await db.delete(remindersTable)
            .where(and(
                eq(remindersTable.id, reminderId),
                eq(remindersTable.ownerId, `slack-${body.user.id}`)
            ));

        await client.views.update({
            view_id: body.view.id,
            hash: body.view.hash,
            view: {
                type: "modal",
                callback_id: "reminder_deleted_modal",
                title: {
                    type: "plain_text",
                    text: "Reminder Deleted",
                },
                blocks: [
                    {
                        type: "section",
                        text: {
                            type: "mrkdwn",
                            text: `The reminder *${reminder.title}* has been successfully deleted.`,
                        },
                    },
                ],
            },
        });

        updateReminderList(client, body);
    } catch (error) {
        logger.error("Error handling confirm delete reminder action:", error);
    }
});

/*async function updateReminderList(client: AllMiddlewareArgs<SlackViewAction | SlackAction>["client"], body: SlackViewMiddlewareArgs["body"] | SlackActionMiddlewareArgs["body"]) {
const blocks = [
            { type: "section", text: { type: "mrkdwn", text: "Here are your reminders:" } },
            { type: "divider" },
            ...(await fetchReminders(body.user.id, "slack", 5)).flatMap(r => {
                const ctx: any[] = [{ type: "plain_text", text: `Time: ${r.time.toUTCString()}` }];
                if (r.priority != null) {
                    ctx.push(
                        { type: "plain_text", text: "|" },
                        { type: "plain_text", text: `Priority: ${["High", "Medium", "Low"][r.priority - 1]}` }
                    );
                }
                return [
                    { type: "section", text: { type: "mrkdwn", text: `*${r.title}*${r.description ? `\n${r.description}` : ""}` } },
                    { type: "context", elements: ctx },
                    {
                        type: "actions", elements: [
                            { type: "button", text: { type: "plain_text", text: "Edit" }, action_id: "edit_reminder", value: r.id.toString() },
                            { type: "button", text: { type: "plain_text", text: "Delete" }, style: "danger", action_id: "delete_reminder", value: r.id.toString() }
                        ]
                    },
                    { type: "divider" }
                ];
            })
        ];
        const meta = JSON.parse(body.view.private_metadata);
        await client.views.update({
            view_id: meta.parent_view_id,
            hash: meta.parent_view_hash,
            view: {
                type: "modal",
                callback_id: "list_reminders_modal",
                title: { type: "plain_text", text: "Reminders List" },
                blocks
            }
        });
    const reminders = await fetchReminders(body.user.id, "slack", 5);

    const newBlocks = [
        { type: "section", text: { type: "mrkdwn", text: "Here are your reminders:" } },
        { type: "divider" },
        ...reminders.flatMap(reminder => {
            const ctx: any[] = [
                { type: "plain_text", text: `Time: ${reminder.time.toUTCString()}` }
            ];
            if (reminder.priority != null) {
                ctx.push(
                    { type: "plain_text", text: "|" },
                    { type: "plain_text", text: `Priority: ${["High", "Medium", "Low"][reminder.priority - 1]}` }
                );
            }
            return [
                { type: "section", text: { type: "mrkdwn", text: `*${reminder.title}*${reminder.description ? `\n${reminder.description}` : ""}` } },
                { type: "context", elements: ctx },
                { type: "divider" }
            ];
        })
    ];

    await client.views.update({
        view_id: body.view.root_view_id,
        hash: body.view.hash,
        view: {
            type: "modal",
            callback_id: "list_reminders_modal",
            title: { type: "plain_text", text: "Reminders List" },
            blocks: newBlocks,
        },
    });
}*/

export default async function startBot() {
    try {
        await app.start();
        logger.info(`Slack bot is running on port ${process.env.SLACK_PORT}`);
    } catch (error) {
        logger.error("Error starting Slack bot:", error);
        process.exit(1);
    }
}