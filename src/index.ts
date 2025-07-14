import "dotenv/config";
import { startBot as slackBot } from "./bots/slack";
import "./modules/notifier";

(async () => {
    slackBot();
})();