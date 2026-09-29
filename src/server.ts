import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cookieParser from "cookie-parser";
import { App } from "@slack/bolt";
import { config } from "./config.js";
import { initDb } from "./db/store.js";
import { createApiRouter } from "./routes/api.js";
import { registerCommands } from "./handlers/commands.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "../public");
const uploadsDir = path.resolve(config.uploadsPath);
fs.mkdirSync(uploadsDir, { recursive: true });

const app = express();
app.set("trust proxy", 1);
app.use(cookieParser());
app.use(express.json());
app.use("/uploads", express.static(uploadsDir));
app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});
app.use("/api", createApiRouter());
app.use(express.static(publicDir));

app.get("/review/:batchId", (_req, res) => {
  res.sendFile(path.join(publicDir, "review.html"));
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(publicDir, "admin.html"));
});

const bolt = new App({
  token: config.slackBotToken,
  appToken: config.slackAppToken,
  signingSecret: config.slackSigningSecret,
  socketMode: true,
});

registerCommands(bolt);

bolt.error(async (error) => {
  console.error("Bolt error:", error);
});

async function main() {
  await initDb();
  await bolt.start();
  app.listen(config.port, () => {
    console.log(`Web admin: ${config.publicBaseUrl}/`);
    console.log(`Database: ${config.databaseUrl ? "PostgreSQL" : "SQLite"}`);
    console.log("Slack bot running (Socket Mode)");
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
