import "dotenv/config";
import { startBot as slackBot } from "./bots/slack";

(async () => {
    slackBot();
})();