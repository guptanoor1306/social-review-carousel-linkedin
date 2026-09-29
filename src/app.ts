import { App } from "@slack/bolt";
import { config } from "./config.js";
import { getDb } from "./db/index.js";
import { registerActions } from "./handlers/actions.js";
import { registerCommands } from "./handlers/commands.js";
import { registerViews } from "./handlers/views.js";

getDb();

const app = new App({
  token: config.slackBotToken,
  appToken: config.slackAppToken,
  signingSecret: config.slackSigningSecret,
  socketMode: true,
});

registerCommands(app);
registerActions(app);
registerViews(app);

app.error(async (error) => {
  console.error("Bolt error:", error);
});

(async () => {
  await app.start();
  console.log("Social voting bot is running (Socket Mode)");
})();
