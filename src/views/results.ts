import type { Button, KnownBlock } from "@slack/types";
import type { BatchRow } from "../db/index.js";
import { formatPlatformType } from "../models/platform.js";
import type { AssetAggregate, BatchSummary } from "../services/aggregate.js";
import type { SlideDetail } from "../models/slide-details.js";

const ASSETS_PER_PAGE = 8;

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

const SLACK_SECTION_MAX = 2900;

function splitMrkdwn(text: string, max = SLACK_SECTION_MAX): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= max) return [trimmed];
  const chunks: string[] = [];
  let rest = trimmed;
  while (rest.length > max) {
    let cut = rest.lastIndexOf("\n", max);
    if (cut < Math.floor(max * 0.35)) cut = max;
    chunks.push(rest.slice(0, cut).trimEnd());
    rest = rest.slice(cut).trimStart();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

function reviewerCommentLines(c: AssetAggregate["comments"][number]): string[] {
  const lines: string[] = [];
  const head = `• *${c.name}* — ${c.rating}/5`;
  if (c.feedback) {
    lines.push(...splitMrkdwn(`${head}: ${c.feedback}`));
  } else {
    lines.push(head);
  }
  for (const sd of c.slideDetails ?? []) {
    const slideLabel = formatSlideDetail(sd);
    if (slideLabel) lines.push(...splitMrkdwn(slideLabel));
  }
  return lines;
}

function formatSlideDetail(sd: SlideDetail): string {
  const ratingPart = sd.rating ? ` (${sd.rating}/5)` : "";
  if (sd.feedback) {
    return `    ◦ Slide ${sd.slideIndex + 1}${ratingPart}: ${sd.feedback}`;
  }
  if (sd.rating) {
    return `    ◦ Slide ${sd.slideIndex + 1}: ${sd.rating}/5`;
  }
  return "";
}

function starLine(avg: number): string {
  const full = Math.round(avg);
  return `${"★".repeat(full)}${"☆".repeat(5 - full)}`;
}

export function resultsPageBlocks(
  batch: BatchRow,
  summary: BatchSummary,
  assets: AssetAggregate[],
  page: number,
): KnownBlock[] {
  const totalPages = Math.max(1, Math.ceil(assets.length / ASSETS_PER_PAGE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const slice = assets.slice(
    safePage * ASSETS_PER_PAGE,
    safePage * ASSETS_PER_PAGE + ASSETS_PER_PAGE,
  );

  const responded = summary.distinctReviewers;
  const invited = summary.invitedReviewers;
  const participation =
    invited > 0
      ? `${responded} of ${invited} reviewers responded`
      : `${responded} reviewer${responded === 1 ? "" : "s"}`;

  const blocks: KnownBlock[] = [
    {
      type: "header",
      text: { type: "plain_text", text: "Review results" },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: [
          `*${batch.name}*`,
          `${formatPlatformType(batch.platform, batch.asset_type)} · \`${batch.status}\``,
          `${participation} · ${summary.totalResponses} rating${summary.totalResponses === 1 ? "" : "s"} submitted`,
        ].join("\n"),
      },
    },
    { type: "divider" },
  ];

  if (assets.length === 0) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: "_No assets in this batch._" },
    });
    return blocks;
  }

  for (const a of slice) {
    const title = truncate(a.title || "Untitled asset", 200);

    if (a.count === 0) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${title}*\n_No ratings yet_`,
        },
      });
      blocks.push({ type: "divider" });
      continue;
    }

    const avgLine = `*${a.avgRating.toFixed(1)}/5* ${starLine(a.avgRating)} · ${a.count} rating${a.count === 1 ? "" : "s"}`;

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${title}*\n*Average:* ${avgLine}`,
      },
    });

    const commentChunks: string[] = [];
    let buffer = "";
    for (const c of a.comments.slice(0, 20)) {
      for (const line of reviewerCommentLines(c)) {
        const next = buffer ? `${buffer}\n${line}` : line;
        if (next.length > SLACK_SECTION_MAX) {
          if (buffer) commentChunks.push(buffer);
          buffer = line.length > SLACK_SECTION_MAX ? line.slice(0, SLACK_SECTION_MAX) : line;
        } else {
          buffer = next;
        }
      }
    }
    if (buffer) commentChunks.push(buffer);
    if (commentChunks.length === 0) {
      commentChunks.push("_No written feedback_");
    }
    for (const chunk of commentChunks) {
      blocks.push({
        type: "section",
        text: { type: "mrkdwn", text: chunk },
      });
    }

    blocks.push({ type: "divider" });
  }

  if (totalPages > 1) {
    const nav: Button[] = [];
    if (safePage > 0) {
      nav.push({
        type: "button",
        action_id: "results_prev_page",
        text: { type: "plain_text", text: "Previous" },
        value: JSON.stringify({ batchId: batch.id, page: safePage - 1 }),
      });
    }
    if (safePage < totalPages - 1) {
      nav.push({
        type: "button",
        action_id: "results_next_page",
        text: { type: "plain_text", text: "Next" },
        value: JSON.stringify({ batchId: batch.id, page: safePage + 1 }),
      });
    }
    if (nav.length > 0) {
      blocks.push({
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Page ${safePage + 1} of ${totalPages}`,
          },
        ],
      });
      blocks.push({ type: "actions", elements: nav });
    }
  }

  return blocks;
}

export function resultsFallbackText(batch: BatchRow): string {
  return `Review results for ${batch.name}`;
}
