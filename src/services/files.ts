import type { WebClient } from "@slack/web-api";
import type { AssetMediaItem } from "../models/media.js";

export async function slackFilePreviewUrl(
  client: WebClient,
  fileId: string,
): Promise<{ previewUrl: string | null; fileName: string | null; permalink: string | null }> {
  const info = await client.files.info({ file: fileId });
  const file = info.file;
  if (!file) {
    return { previewUrl: null, fileName: null, permalink: null };
  }

  const previewUrl =
    file.thumb_720 ??
    file.thumb_480 ??
    file.thumb_360 ??
    file.thumb_160 ??
    file.permalink ??
    null;

  return {
    previewUrl,
    fileName: file.name ?? null,
    permalink: file.permalink ?? null,
  };
}

/** Re-post a Slack upload into the review thread so everyone sees inline previews. */
export async function mirrorSlackFileToThread(
  client: WebClient,
  botToken: string,
  fileId: string,
  channelId: string,
  threadTs: string,
  comment?: string,
): Promise<void> {
  const info = await client.files.info({ file: fileId });
  const file = info.file;
  if (!file?.url_private) {
    return;
  }

  const res = await fetch(file.url_private, {
    headers: { Authorization: `Bearer ${botToken}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to download Slack file (${res.status})`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  await client.files.uploadV2({
    channel_id: channelId,
    thread_ts: threadTs,
    filename: file.name ?? "asset.jpg",
    file: buffer,
    ...(comment ? { initial_comment: comment } : {}),
  });
}

export async function postUrlSlideToThread(
  client: WebClient,
  channelId: string,
  threadTs: string,
  item: AssetMediaItem,
  index: number,
): Promise<void> {
  if (!item.url) return;

  const label = item.label ?? `Slide ${index + 1}`;
  const isImage = /\.(png|jpe?g|gif|webp)(\?|$)/i.test(item.url);

  if (isImage) {
    await client.chat.postMessage({
      channel: channelId,
      thread_ts: threadTs,
      text: label,
      blocks: [
        {
          type: "context",
          elements: [{ type: "mrkdwn", text: `*${label}*` }],
        },
        {
          type: "image",
          image_url: item.url,
          alt_text: label,
        },
      ],
    });
    return;
  }

  await client.chat.postMessage({
    channel: channelId,
    thread_ts: threadTs,
    text: label,
    blocks: [
      {
        type: "section",
        text: { type: "mrkdwn", text: `*${label}*\n<${item.url}|Open>` },
      },
    ],
  });
}
