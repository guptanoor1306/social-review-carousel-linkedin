import "dotenv/config";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  slackBotToken: requireEnv("SLACK_BOT_TOKEN"),
  slackAppToken: requireEnv("SLACK_APP_TOKEN"),
  slackSigningSecret: requireEnv("SLACK_SIGNING_SECRET"),
  adminUsername: process.env.ADMIN_USERNAME ?? "admin",
  adminPassword: requireEnv("ADMIN_PASSWORD"),
  sessionSecret: process.env.SESSION_SECRET ?? requireEnv("SLACK_SIGNING_SECRET"),
  databaseUrl: process.env.DATABASE_URL ?? "",
  adminUserIds: new Set(
    (process.env.ADMIN_USER_IDS ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  ),
  databasePath: process.env.DATABASE_PATH ?? "./data/social-voting.db",
  uploadsPath: process.env.UPLOADS_PATH ?? "./data/uploads",
  publicBaseUrl: (process.env.PUBLIC_BASE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  ),
  port: Number(process.env.PORT ?? 3000),
  resultsSort: (process.env.RESULTS_SORT ?? "lowest") as "lowest" | "highest",
};

export function isAdmin(userId: string): boolean {
  if (config.adminUserIds.size === 0) return true;
  return config.adminUserIds.has(userId);
}
