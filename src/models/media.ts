import type { AssetRow } from "../db/index.js";

export type AssetMediaItem = {
  slackFileId?: string;
  url?: string;
  permalink?: string;
  localPath?: string;
  label?: string;
  /** Per-slide caption (admin); shown in review preview when set. */
  caption?: string;
};

export function parseAssetMedia(asset: AssetRow): AssetMediaItem[] {
  if (asset.media_json) {
    try {
      const parsed = JSON.parse(asset.media_json) as AssetMediaItem[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch {
      /* fall through */
    }
  }

  const legacy: AssetMediaItem[] = [];
  if (asset.preview_url) {
    legacy.push({ url: asset.preview_url, label: "Preview" });
  }
  return legacy;
}

export function slideCount(asset: AssetRow): number {
  return parseAssetMedia(asset).length;
}
