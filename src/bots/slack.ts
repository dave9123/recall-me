import { App } from "@slack/bolt";
import dotenv from "dotenv";
import { createLogger } from "../logger";

const logger = createLogger("Slack");

dotenv.config();

if (isNaN(Number(process.env.SLACK_PORT)) || Number(process.env.SLACK_PORT) <= 0 || Number(process.env.SLACK_PORT) > 65535) {
    logger.error("SLACK_PORT is not a valid number");
    process.exit(1);
}

const app = new App({
    token: process.env.SLACK_OAUTH_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    socketMode: process.env.SLACK_SOCKET_MODE === "true" ? true : false,
    appToken: process.env.SLACK_APP_TOKEN,
    port: parseInt(process.env.SLACK_PORT || "3000", 10),
});

(async () => {
    try {
        await app.start();
        logger.info(`Slack bot is running on port ${process.env.SLACK_PORT}`);
    } catch (error) {
        logger.error("Error starting Slack bot:", error);
        process.exit(1);
    }
})();