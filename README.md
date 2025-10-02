# Recall Me

Why bother forgetting when you can remember?—am I right? This bot literally reminds you through the social media(s) you already use.

## How to use?

The commands provided are /reminder-create and /reminders.

https://github.com/user-attachments/assets/e65921b6-0add-4ade-aa12-df2a3c442092

Here's a video of me demoing the bot!

## Hosting my own instance

Although it's not necessary, you could host your own.

1. Create & configure your Slack App  
   • Visit https://api.slack.com/apps and click **Create New App** → “From scratch”  
   • Give it a name (e.g. “Recall Me”) and pick your development workspace  
   • Under **OAuth & Permissions** add scopes:  
     – commands  
     – im:write  
   • Under **Slash Commands** add two commands:  
     – `/reminder-create` → description: “Create a new reminder”  
     – `/reminders` → description: “List your reminders”  
   • (Optional) Under **Socket Mode** → Enable Socket Mode → copy **App Level Token**  
   • Install the app to your workspace and copy:  
     – **Bot User OAuth Token**  
     – **Signing Secret**  

2. Clone & install dependencies  
   ```bash
   git clone https://github.com/dave9123/recall-me.git
   cd recall-me
   pnpm install

3. Configure & install dependencies
    ```bash
    cp .env.example .env
    ```
    Open `.env` in your editor and set `SLACK_APP_TOKEN` (if using Socket Mode), `SLACK_OAUTH_TOKEN`, `SLACK_SIGNING_SECRET`, `SLACK_SOCKET_MODE` (true|false), and `SLACK_PORT` (default: 3000).
4. Start the bot
    ```bash
    pnpm start:dev
    ```

## To-do

- [ ] Support Slack
    - [ ] Optimize code
    - [ ] Account linking
    - [ ] Use message scheduler to notify instead of looking up the database every time
    - [ ] Sort by option
    - [ ] Timezone
    - [ ] Subscription
- [ ] Support Discord
- [ ] Support WhatsApp
- [ ] Support Zulip
- [ ] Support Signal
- [ ] Support Matrix
- [ ] Web version along with [ReminderAPI](https://reminderapi.dave9123.me/)

## Motivation

The motivation? I forgot something again, literally.
