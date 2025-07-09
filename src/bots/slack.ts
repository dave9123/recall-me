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



export default async function startBot() {
    try {
        await app.start();
        logger.info(`Slack bot is running on port ${process.env.SLACK_PORT}`);
    } catch (error) {
        logger.error("Error starting Slack bot:", error);
        process.exit(1);
    }
}