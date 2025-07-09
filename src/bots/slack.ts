import { App } from "@slack/bolt";
import { createLogger } from "../modules/logger";

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
                            text: "Reminder Title",
                        },
                        element: {
                            type: "plain_text_input",
                            action_id: "title_input",
                        },
                    },
                    {
                        type: "input",
                        block_id: "reminder_date",
                        label: {
                            type: "plain_text",
                            text: "Reminder Date (YYYY-MM-DD)",
                        },
                        element: {
                            type: "plain_text_input",
                            action_id: "date_input",
                            placeholder: {
                                type: "plain_text",
                                text: "2023-10-01",
                            },
                        },
                    },
                    {
                        type: "input",
                        block_id: "reminder_time",
                        label: {
                            type: "plain_text",
                            text: "Reminder Time (HH:mm)",
                        },
                        element: {
                            type: "plain_text_input",
                            action_id: "time_input",
                            placeholder: {
                                type: "plain_text",
                                text: "1 October 2024 14:30 UTC",
                            },
                        },
                    },
                ],
            },
        })
    } catch (error) {
        logger.error("Error handling /reminder-create command:", error);
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