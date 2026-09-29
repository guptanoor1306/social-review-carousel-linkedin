import type { KnownBlock } from "@slack/types";
import type { AssetRow } from "../db/index.js";
import { parseAssetMedia, slideCount } from "../models/media.js";

export function assetReviewMessageBlocks(
  batchId: string,
  asset: AssetRow,
  position: { index: number; total: number },
): KnownBlock[] {
  const slides = slideCount(asset);
  const slideLine =
    slides > 0
      ? `\n_${slides} slide${slides === 1 ? "" : "s"} posted right below this message._`
      : "\n_No preview attached — use the link if provided._";

  const link = asset.post_url ? `\n<${asset.post_url}|Open draft / link>` : "";

  return [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `${position.index}/${position.total}: ${truncate(asset.title, 120)}`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${asset.title}*${link}${slideLine}\n\n*Your rating:* tap a number. Optional: *Add comment* for notes.`,
      },
    },
    {
      type: "actions",
      block_id: `rate_row_${asset.id}`,
      elements: [1, 2, 3, 4, 5].map((n) => ({
        type: "button" as const,
        action_id: "rate_asset",
        text: { type: "plain_text" as const, text: `${n} ★` },
        value: JSON.stringify({
          batchId,
          assetId: asset.id,
          rating: n,
        }),
      })),
    },
    {
      type: "actions",
      block_id: `comment_row_${asset.id}`,
      elements: [
        {
          type: "button",
          action_id: "asset_comment",
          text: { type: "plain_text", text: "Add comment" },
          value: JSON.stringify({ batchId, assetId: asset.id }),
        },
      ],
    },
    { type: "divider" },
  ];
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}
