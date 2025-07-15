import "dotenv/config";
import fetchUserReminderAmount from "./modules/fetchUserReminderAmount";

fetchUserReminderAmount("slack-U07C3SJ99RP").then(amount => {
    console.log(amount);
});