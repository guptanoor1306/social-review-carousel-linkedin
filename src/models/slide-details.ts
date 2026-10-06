export type SlideDetail = {
  slideIndex: number;
  rating?: number | null;
  feedback?: string;
};

export function parseSlideDetails(json: string | null | undefined): SlideDetail[] {
  if (!json?.trim()) return [];
  try {
    const parsed = JSON.parse(json) as SlideDetail[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x) => Number.isInteger(x.slideIndex) && x.slideIndex >= 0)
      .map((x) => ({
        slideIndex: x.slideIndex,
        rating:
          x.rating != null && x.rating >= 1 && x.rating <= 5 ? x.rating : null,
        feedback: String(x.feedback ?? "").trim(),
      }));
  } catch {
    return [];
  }
}

export function normalizeSlideDetails(raw: unknown): SlideDetail[] {
  if (!Array.isArray(raw)) return [];
  const out: SlideDetail[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const slideIndex = Number((item as SlideDetail).slideIndex);
    if (!Number.isInteger(slideIndex) || slideIndex < 0) continue;
    const ratingRaw = (item as SlideDetail).rating;
    const rating =
      ratingRaw != null && Number.isInteger(ratingRaw) && ratingRaw >= 1 && ratingRaw <= 5
        ? ratingRaw
        : null;
    const feedback = String((item as SlideDetail).feedback ?? "").trim();
    if (!rating && !feedback) continue;
    out.push({ slideIndex, rating, feedback });
  }
  return out;
}
