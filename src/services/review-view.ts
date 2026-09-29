import type { WebClient } from "@slack/web-api";
import type { AssetRow, BatchRow } from "../db/index.js";
import { getAsset } from "../db/index.js";
import {
  enrichAndPersistAssetMedia,
  modalEmbedImageUrls,
  resolveAssetSlideLinks,
} from "./media-display.js";
import { reviewModal } from "../views/review.js";

export async function buildReviewModalView(
  client: WebClient,
  batch: BatchRow,
  asset: AssetRow,
  progress: { assetIndex: number; totalAssets: number },
) {
  let current = getAsset(asset.id) ?? asset;
  current = await enrichAndPersistAssetMedia(client, current);

  const displayUrls = modalEmbedImageUrls(current);
  const slideLinks = await resolveAssetSlideLinks(client, current);

  return reviewModal(batch, current, progress, displayUrls, slideLinks);
}
