import type { BatchRow } from "../db/index.js";
import {
  assetTypeOptions,
  formatPlatformType,
  platformOptions,
  type Platform,
} from "../models/platform.js";

export const CREATE_BATCH_CALLBACK = "create_batch_modal";
export const CREATE_ADD_ASSET_CALLBACK = "create_add_asset_modal";
export const ADD_ASSETS_CALLBACK = "add_assets_modal";
export const REVIEWERS_CALLBACK = "reviewers_modal";
export const PUBLISH_CALLBACK = "publish_modal";
export const CLOSE_CALLBACK = "close_modal";

export function createBatchModal() {
  return {
    type: "modal" as const,
    callback_id: CREATE_BATCH_CALLBACK,
    title: { type: "plain_text" as const, text: "New review batch" },
    submit: { type: "plain_text" as const, text: "Next: Add assets" },
    close: { type: "plain_text" as const, text: "Cancel" },
    blocks: [
      {
        type: "input",
        block_id: "name",
        label: { type: "plain_text", text: "Batch name" },
        element: {
          type: "plain_text_input",
          action_id: "value",
          placeholder: { type: "plain_text", text: "March IG — Carousels" },
        },
      },
      {
        type: "input",
        block_id: "platform",
        label: { type: "plain_text", text: "Platform" },
        element: {
          type: "static_select",
          action_id: "value",
          placeholder: { type: "plain_text", text: "Select platform" },
          options: platformOptions(),
        },
      },
      {
        type: "input",
        block_id: "asset_type",
        label: { type: "plain_text", text: "Asset type" },
        element: {
          type: "static_select",
          action_id: "value",
          placeholder: { type: "plain_text", text: "Select type" },
          options: assetTypeOptions("instagram"),
        },
      },
      {
        type: "input",
        block_id: "channel",
        label: { type: "plain_text", text: "Review channel" },
        hint: {
          type: "plain_text",
          text: "Kickoff and results will be posted here. Invite the bot to the channel first.",
        },
        element: {
          type: "conversations_select",
          action_id: "value",
          placeholder: { type: "plain_text", text: "Select channel" },
        },
      },
      {
        type: "input",
        block_id: "due_at",
        optional: true,
        label: { type: "plain_text", text: "Due date (optional)" },
        element: {
          type: "datepicker",
          action_id: "value",
          placeholder: { type: "plain_text", text: "Select a date" },
        },
      },
    ],
  };
}

export function addAssetsStepModal(
  batchId: string,
  batchName: string,
  assetCount: number,
  formKey: string,
) {
  return {
    type: "modal" as const,
    callback_id: CREATE_ADD_ASSET_CALLBACK,
    private_metadata: JSON.stringify({ batchId, formKey }),
    title: { type: "plain_text" as const, text: "Add assets" },
    submit: { type: "plain_text" as const, text: "Save asset" },
    close: { type: "plain_text" as const, text: "Cancel" },
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${batchName}*\n${assetCount} asset(s) saved.\nUpload *all carousel slides* at once, or paste image URLs (one per line).`,
        },
      },
      {
        type: "input",
        block_id: `title_${formKey}`,
        optional: true,
        label: { type: "plain_text", text: "Title" },
        element: {
          type: "plain_text_input",
          action_id: "value",
          placeholder: { type: "plain_text", text: "e.g. March carousel — product launch" },
        },
      },
      {
        type: "input",
        block_id: `post_url_${formKey}`,
        optional: true,
        label: { type: "plain_text", text: "Link to post or draft" },
        element: {
          type: "plain_text_input",
          action_id: "value",
          placeholder: { type: "plain_text", text: "https://..." },
        },
      },
      {
        type: "input",
        block_id: `slide_urls_${formKey}`,
        optional: true,
        label: { type: "plain_text", text: "Slide image URLs (optional)" },
        hint: {
          type: "plain_text",
          text: "One https URL per line — e.g. 5 lines for a 5-slide carousel.",
        },
        element: {
          type: "plain_text_input",
          action_id: "value",
          multiline: true,
          placeholder: { type: "plain_text", text: "https://…/slide1.jpg\nhttps://…/slide2.jpg" },
        },
      },
      {
        type: "input",
        block_id: `upload_${formKey}`,
        optional: true,
        label: { type: "plain_text", text: "Upload slides (carousel)" },
        hint: {
          type: "plain_text",
          text: "Select up to 10 images/videos for one carousel post.",
        },
        element: {
          type: "file_input",
          action_id: "value",
          filetypes: ["jpg", "jpeg", "png", "gif", "webp", "mp4", "mov"],
          max_files: 10,
        },
      },
      {
        type: "input",
        block_id: `step_${formKey}`,
        label: { type: "plain_text", text: "After saving this asset" },
        element: {
          type: "radio_buttons",
          action_id: "value",
          options: [
            {
              text: { type: "plain_text", text: "Add another asset (reel, post, etc.)" },
              value: "add_more",
            },
            {
              text: {
                type: "plain_text",
                text: "Done adding — I'll /social-review start later",
              },
              value: "done",
            },
          ],
        },
      },
    ],
  };
}

export function creationDoneModal(batchName: string, assetCount: number) {
  return {
    type: "modal" as const,
    title: { type: "plain_text" as const, text: "Review created" },
    close: { type: "plain_text" as const, text: "Close" },
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${batchName}* has *${assetCount}* asset(s) saved.\n\n*Review has NOT started yet.*\nWhen ready, run \`/social-review start\` to post previews + rating buttons in the channel.\n\nOptional: \`/social-review reviewers\` before you start.`,
        },
      },
    ],
  };
}

export function batchSelectOptions(batches: BatchRow[]) {
  if (batches.length === 0) {
    return [
      {
        text: { type: "plain_text" as const, text: "No draft batches" },
        value: "_none",
      },
    ];
  }
  return batches.map((b) => ({
    text: {
      type: "plain_text" as const,
      text: `${b.name} (${formatPlatformType(b.platform, b.asset_type)})`.slice(
        0,
        75,
      ),
    },
    value: b.id,
  }));
}

export function addAssetsModal(batches: BatchRow[]) {
  return {
    type: "modal" as const,
    callback_id: ADD_ASSETS_CALLBACK,
    title: { type: "plain_text" as const, text: "Add assets" },
    submit: { type: "plain_text" as const, text: "Add" },
    close: { type: "plain_text" as const, text: "Cancel" },
    blocks: [
      {
        type: "input",
        block_id: "batch",
        label: { type: "plain_text", text: "Batch" },
        element: {
          type: "static_select",
          action_id: "value",
          options: batchSelectOptions(batches),
        },
      },
      {
        type: "input",
        block_id: "title",
        label: { type: "plain_text", text: "Title" },
        element: {
          type: "plain_text_input",
          action_id: "value",
          placeholder: { type: "plain_text", text: "Carousel v3 — product launch" },
        },
      },
      {
        type: "input",
        block_id: "post_url",
        optional: true,
        label: { type: "plain_text", text: "Post / draft link" },
        element: {
          type: "plain_text_input",
          action_id: "value",
          placeholder: { type: "plain_text", text: "https://..." },
        },
      },
      {
        type: "input",
        block_id: "preview_url",
        optional: true,
        label: { type: "plain_text", text: "Preview image URL" },
        element: {
          type: "plain_text_input",
          action_id: "value",
          placeholder: { type: "plain_text", text: "https://..." },
        },
      },
    ],
  };
}

export function reviewersModal(batches: BatchRow[]) {
  return {
    type: "modal" as const,
    callback_id: REVIEWERS_CALLBACK,
    title: { type: "plain_text" as const, text: "Reviewers" },
    submit: { type: "plain_text" as const, text: "Save" },
    close: { type: "plain_text" as const, text: "Cancel" },
    blocks: [
      {
        type: "input",
        block_id: "batch",
        label: { type: "plain_text", text: "Batch" },
        element: {
          type: "static_select",
          action_id: "value",
          options: batchSelectOptions(batches),
        },
      },
      {
        type: "input",
        block_id: "reviewers",
        optional: true,
        label: { type: "plain_text", text: "Invite reviewers" },
        hint: {
          type: "plain_text",
          text: "Leave empty to allow anyone in the channel to review.",
        },
        element: {
          type: "multi_users_select",
          action_id: "value",
          placeholder: { type: "plain_text", text: "Select people" },
        },
      },
    ],
  };
}

export function publishModal(batches: BatchRow[]) {
  return {
    type: "modal" as const,
    callback_id: PUBLISH_CALLBACK,
    title: { type: "plain_text" as const, text: "Start review" },
    submit: { type: "plain_text" as const, text: "Post to channel" },
    close: { type: "plain_text" as const, text: "Cancel" },
    blocks: [
      {
        type: "input",
        block_id: "batch",
        label: { type: "plain_text", text: "Batch" },
        element: {
          type: "static_select",
          action_id: "value",
          options: batchSelectOptions(batches),
        },
      },
    ],
  };
}

export function closeModal(batches: BatchRow[]) {
  const open = batches.filter((b) => b.status === "open");
  const options =
    open.length > 0
      ? open.map((b) => ({
          text: {
            type: "plain_text" as const,
            text: b.name.slice(0, 75),
          },
          value: b.id,
        }))
      : [
          {
            text: { type: "plain_text" as const, text: "No open batches" },
            value: "_none",
          },
        ];

  return {
    type: "modal" as const,
    callback_id: CLOSE_CALLBACK,
    title: { type: "plain_text" as const, text: "Close batch" },
    submit: { type: "plain_text" as const, text: "Close & results" },
    close: { type: "plain_text" as const, text: "Cancel" },
    blocks: [
      {
        type: "input",
        block_id: "batch",
        label: { type: "plain_text", text: "Open batch" },
        element: {
          type: "static_select",
          action_id: "value",
          options,
        },
      },
    ],
  };
}

export function kickoffMessageBlocks(
  batch: BatchRow,
  assetCount: number,
  reviewerCount: number,
) {
  const dueLine = batch.due_at
    ? `\n*Due:* ${batch.due_at}`
    : "";
  const reviewerLine =
    reviewerCount > 0
      ? `\n*Invited reviewers:* ${reviewerCount}`
      : "\n_Open to anyone in this channel._";

  return [
    {
      type: "header",
      text: { type: "plain_text", text: "Social asset review" },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${batch.name}*\n${formatPlatformType(batch.platform, batch.asset_type)} · *${assetCount}* asset(s)${dueLine}${reviewerLine}`,
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Batch \`${batch.id.slice(0, 8)}\` · Open *Reply* on this message — each asset is numbered; slides appear under each asset.`,
        },
      ],
    },
    {
      type: "actions",
      block_id: "kickoff_actions",
      elements: [
        {
          type: "button",
          action_id: "start_review",
          text: { type: "plain_text", text: "Review in order (optional)" },
          style: "primary",
          value: batch.id,
        },
      ],
    },
  ];
}

export function assetTypeOptionsForPlatform(platform: Platform) {
  return assetTypeOptions(platform);
}
