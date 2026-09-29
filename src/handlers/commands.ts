import type { App } from "@slack/bolt";
import * as store from "../db/store.js";
import { postReviewSummary } from "../services/slack-notify.js";

function subcommand(text: string): string {
  return text.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
}

function restArgs(text: string): string {
  const parts = text.trim().split(/\s+/);
  parts.shift();
  return parts.join(" ").trim();
}

export function registerCommands(app: App): void {
  app.command("/social-review", async ({ command, ack, respond }) => {
    await ack();

    const cmd = subcommand(command.text);

    if (cmd === "summary" || cmd === "results") {
      let batchId = restArgs(command.text);
      const batches = await store.listAllBatches();

      if (!batchId) {
        const open = batches.filter((b) => b.status !== "draft");
        if (!open.length) {
          await respond({
            response_type: "ephemeral",
            text: "No batches. Usage: `/social-review summary <batch_id>`",
          });
          return;
        }
        batchId = open[0]!.id;
      } else if (batchId.length <= 8) {
        const match = batches.find((b) => b.id.startsWith(batchId));
        if (match) batchId = match.id;
      }

      const batch = await store.getBatch(batchId);
      if (!batch) {
        await respond({
          response_type: "ephemeral",
          text: `Batch not found: \`${batchId}\``,
        });
        return;
      }

      try {
        await postReviewSummary(batchId);
        await respond({
          response_type: "ephemeral",
          text: `Posted summary for *${batch.name}* to <#${batch.channel_id}>.`,
        });
      } catch (e) {
        await respond({
          response_type: "ephemeral",
          text: (e as Error).message,
        });
      }
      return;
    }

    await respond({
      response_type: "ephemeral",
      text: [
        "*Social review*",
        `• Admin: ${process.env.PUBLIC_BASE_URL ?? "your app URL"}/`,
        "• `/social-review summary [batch_id]` — post results when reviewers are done",
      ].join("\n"),
    });
  });
}
