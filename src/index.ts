import "dotenv/config";
import slackBot from "./bots/slack";
import db from "./modules/db";
import { sql } from "drizzle-orm";

(async () => {
    slackBot();
})();