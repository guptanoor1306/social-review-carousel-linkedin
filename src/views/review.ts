import type { KnownBlock } from "@slack/types";
import type { AssetRow, BatchRow } from "../db/index.js";
import { slideCount } from "../models/media.js";
import type { SlideLink } from "../services/media-display.js";

export const REVIEW_MODAL_CALLBACK = "review_asset_modal";
export const COMMENT_MODAL_CALLBACK = "asset_comment_modal";

export type ReviewPrivateMetadata = {
  batchId: string;
  assetId: string;
};

export function parseReviewMetadata(raw: string | undefined): ReviewPrivateMetadata | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as ReviewPrivateMetadata;
    if (data.batchId && data.assetId) return data;
  } catch {
    /* ignore */
  }
  return null;
}

export function commentModal(
  batch: BatchRow,
  asset: AssetRow,
  existingRating: number | null,
) {
  const ratingBlock = {
    type: "input" as const,
    block_id: "rating",
    optional: !!existingRating,
    label: { type: "plain_text" as const, text: "Rating (1–5)" },
    ...(existingRating
      ? {
          hint: {
            type: "plain_text" as const,
            text: `Current rating: ${existingRating}. Change if needed.`,
          },
        }
      : {}),
    element: {
      type: "radio_buttons" as const,
      action_id: "value",
      ...(existingRating
        ? {
            initial_option: {
              text: { type: "plain_text" as const, text: String(existingRating) },
              value: String(existingRating),
            },
          }
        : {}),
      options: [1, 2, 3, 4, 5].map((n) => ({
        text: { type: "plain_text" as const, text: String(n) },
        value: String(n),
      })),
    },
  };

  return {
    type: "modal" as const,
    callback_id: COMMENT_MODAL_CALLBACK,
    private_metadata: JSON.stringify({
      batchId: batch.id,
      assetId: asset.id,
    } satisfies ReviewPrivateMetadata),
    title: { type: "plain_text" as const, text: "Feedback" },
    submit: { type: "plain_text" as const, text: "Save comment" },
    close: { type: "plain_text" as const, text: "Cancel" },
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${asset.title}*`,
        },
      },
      ratingBlock,
      {
        type: "input",
        block_id: "feedback",
        optional: true,
        label: { type: "plain_text", text: "Written feedback" },
        element: {
          type: "plain_text_input",
          action_id: "value",
          multiline: true,
          placeholder: {
            type: "plain_text",
            text: "What works? What should change?",
          },
        },
      },
    ],
  };
}

export function reviewModal(
  batch: BatchRow,
  asset: AssetRow,
  progress: { assetIndex: number; totalAssets: number },
  displayUrls: string[] = [],
  slideLinks: SlideLink[] = [],
) {
  const slides = slideCount(asset);
  const linkPart = asset.post_url
    ? `\n<${asset.post_url}|Open draft / link>`
    : "";

  const remainingAfterSave = progress.totalAssets - progress.assetIndex;
  const submitLabel =
    remainingAfterSave > 0
      ? `Save & next (${remainingAfterSave} left)`
      : "Save · last asset";

  const blocks: KnownBlock[] = [
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `*Asset ${progress.assetIndex} of ${progress.totalAssets}* · review still open for others`,
        },
      ],
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${asset.title}*${linkPart}`,
      },
    },
  ];

  if (displayUrls.length > 0) {
    for (let i = 0; i < displayUrls.length; i += 1) {
      blocks.push({
        type: "image",
        image_url: displayUrls[i]!,
        alt_text: `${asset.title} slide ${i + 1}`,
      });
    }
    if (slides > displayUrls.length) {
      blocks.push({
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `_+ ${slides - displayUrls.length} more slide(s) — use links below or the channel thread._`,
          },
        ],
      });
    }
  }

  if (slideLinks.length > 0) {
    const line = slideLinks
      .map((l) => `<${l.href}|${l.label}>`)
      .join("  ·  ");
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Slides (${slideLinks.length}):* ${line}`,
      },
    });
  } else if (slides > 0 && displayUrls.length === 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${slides} slide(s)* — open *Reply* on the kickoff message in this channel to preview while you rate.`,
      },
    });
  }

  blocks.push(
    {
      type: "input",
      block_id: "rating",
      label: { type: "plain_text", text: "Rating (1–5)" },
      element: {
        type: "radio_buttons",
        action_id: "value",
        options: [1, 2, 3, 4, 5].map((n) => ({
          text: { type: "plain_text", text: `${n} ★` },
          value: String(n),
        })),
      },
    },
    {
      type: "input",
      block_id: "feedback",
      optional: true,
      label: { type: "plain_text", text: "Feedback" },
      element: {
        type: "plain_text_input",
        action_id: "value",
        multiline: true,
        placeholder: { type: "plain_text", text: "What works? What should change?" },
      },
    },
  );

  return {
    type: "modal" as const,
    callback_id: REVIEW_MODAL_CALLBACK,
    private_metadata: JSON.stringify({
      batchId: batch.id,
      assetId: asset.id,
    } satisfies ReviewPrivateMetadata),
    title: { type: "plain_text" as const, text: `Rate ${progress.assetIndex}/${progress.totalAssets}` },
    submit: { type: "plain_text" as const, text: submitLabel },
    close: { type: "plain_text" as const, text: "Pause (finish later)" },
    blocks,
  };
}

export function reviewCompleteModal(
  batchName: string,
  ratedCount: number,
  total: number,
) {
  return {
    type: "modal" as const,
    title: { type: "plain_text" as const, text: "Your ratings saved" },
    close: { type: "plain_text" as const, text: "Close" },
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            total === ratedCount
              ? `You rated all *${total}* assets in *${batchName}*.\n\n_The review stays open until someone runs \`/social-review close\`._`
              : `You rated *${ratedCount}* of *${total}* assets in *${batchName}*.\n\nTap *Review in order* again or use ★ buttons in the thread to continue.`,
        },
      },
    ],
  };
}
