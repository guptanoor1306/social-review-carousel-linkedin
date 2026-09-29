import type { WebClient } from "@slack/web-api";
import type { AssetRow } from "../db/index.js";
import { parseAssetMedia, type AssetMediaItem } from "../models/media.js";

export type SlideLink = { label: string; href: string };

/** Direct image URLs Slack can fetch for modal image blocks (strict). */
export function modalEmbedImageUrls(asset: AssetRow): string[] {
  const media = parseAssetMedia(asset);
  const urls: string[] = [];

  for (const item of media) {
    if (item.url && isModalEmbedImageUrl(item.url)) {
      urls.push(item.url);
    }
  }

  if (
    urls.length === 0 &&
    asset.preview_url &&
    isModalEmbedImageUrl(asset.preview_url)
  ) {
    urls.push(asset.preview_url);
  }

  return urls.slice(0, 5);
}

export async function resolveAssetSlideLinks(
  client: WebClient,
  asset: AssetRow,
): Promise<SlideLink[]> {
  const media = parseAssetMedia(asset);
  const links: SlideLink[] = [];

  for (let i = 0; i < media.length; i += 1) {
    const item = media[i]!;
    const label = item.label ?? `Slide ${i + 1}`;

    if (item.permalink) {
      links.push({ label, href: item.permalink });
      continue;
    }

    if (item.slackFileId) {
      const info = await client.files.info({ file: item.slackFileId });
      const permalink = info.file?.permalink;
      if (permalink) {
        links.push({ label, href: permalink });
        continue;
      }
    }

    if (item.url) {
      links.push({ label, href: item.url });
    }
  }

  return links;
}

/** @deprecated use modalEmbedImageUrls + resolveAssetSlideLinks */
export async function resolveAssetDisplayUrls(
  client: WebClient,
  asset: AssetRow,
): Promise<string[]> {
  const enriched = await enrichAndPersistAssetMedia(client, asset);
  return modalEmbedImageUrls(enriched);
}

export async function enrichAndPersistAssetMedia(
  client: WebClient,
  asset: AssetRow,
): Promise<AssetRow> {
  const { setAssetMediaJson } = await import("../db/index.js");
  const media = parseAssetMedia(asset);
  const enriched: AssetMediaItem[] = [];

  for (const item of media) {
    if (item.slackFileId) {
      const info = await client.files.info({ file: item.slackFileId });
      const permalink = info.file?.permalink ?? undefined;
      enriched.push({
        ...item,
        permalink,
      });
      continue;
    }
    enriched.push(item);
  }

  const mediaJson = JSON.stringify(enriched);
  setAssetMediaJson(asset.id, mediaJson);
  return { ...asset, media_json: mediaJson };
}

export function isModalEmbedImageUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;

    const host = u.hostname.toLowerCase();
    if (
      host.includes("slack.com") ||
      host.includes("slack-edge.com") ||
      host.includes("slack-files.com")
    ) {
      return false;
    }

    return /\.(png|jpe?g|gif|webp)(\?|$)/i.test(u.pathname);
  } catch {
    return false;
  }
}
