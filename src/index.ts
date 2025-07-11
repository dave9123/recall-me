import "dotenv/config";
import slackBot from "./bots/slack";

(async () => {
    slackBot();
})();