export const PLATFORMS = {
  instagram: ["reel", "carousel", "post", "story"],
  linkedin: ["post"],
} as const;

export type Platform = keyof typeof PLATFORMS;
export type AssetType = (typeof PLATFORMS)[Platform][number];

export type BatchStatus = "draft" | "open" | "closed";

export function isPlatform(value: string): value is Platform {
  return value in PLATFORMS;
}

export function isAssetTypeForPlatform(
  platform: Platform,
  assetType: string,
): assetType is AssetType {
  return (PLATFORMS[platform] as readonly string[]).includes(assetType);
}

export function platformOptions() {
  return Object.keys(PLATFORMS).map((p) => ({
    text: { type: "plain_text" as const, text: capitalize(p) },
    value: p,
  }));
}

export function assetTypeOptions(platform: Platform) {
  return PLATFORMS[platform].map((t) => ({
    text: { type: "plain_text" as const, text: capitalize(t) },
    value: t,
  }));
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatPlatformType(platform: string, assetType: string): string {
  return `${capitalize(platform)} · ${capitalize(assetType)}`;
}
