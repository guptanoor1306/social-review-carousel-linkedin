/** Convert admin rich-text HTML to Slack mrkdwn (best-effort). */

function decodeBasicEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

function escapeSlackText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function htmlToSlackMrkdwn(html: string): string {
  const raw = String(html ?? "").trim();
  if (!raw) return "";
  if (!/[<>]/.test(raw)) return escapeSlackText(raw);

  let s = raw;
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<\/p>/gi, "\n");
  s = s.replace(/<p[^>]*>/gi, "");
  s = s.replace(/<\/div>/gi, "\n");
  s = s.replace(/<div[^>]*>/gi, "");
  s = s.replace(/<(strong|b)[^>]*>/gi, "*");
  s = s.replace(/<\/(strong|b)>/gi, "*");
  s = s.replace(/<(em|i)[^>]*>/gi, "_");
  s = s.replace(/<\/(em|i)>/gi, "_");
  s = s.replace(/<[^>]+>/g, "");
  s = decodeBasicEntities(s);
  s = s.replace(/\r/g, "");
  s = s.replace(/[ \t]+\n/g, "\n");
  s = s.replace(/\n{3,}/g, "\n\n");
  s = s.replace(/\*(\s+)\*/g, "$1");
  return escapeSlackText(s.trim());
}

export function plainTextForSlack(text: string): string {
  const raw = String(text ?? "").trim();
  if (!raw) return "";
  if (/<[a-z][\s\S]*>/i.test(raw)) return htmlToSlackMrkdwn(raw);
  return escapeSlackText(raw);
}
