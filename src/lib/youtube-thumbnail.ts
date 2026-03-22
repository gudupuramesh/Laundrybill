/**
 * Get YouTube thumbnail URL from a video URL.
 * Supports youtube.com/watch?v=ID and youtu.be/ID.
 */

const YOUTUBE_THUMBNAIL_TEMPLATE = "https://img.youtube.com/vi/VIDEO_ID/mqdefault.jpg";

export function getYoutubeVideoId(url: string): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  const watchMatch = trimmed.match(/(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/);
  if (watchMatch) return watchMatch[1];
  const shortMatch = trimmed.match(/(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (shortMatch) return shortMatch[1];
  return null;
}

export function getYoutubeThumbnailUrl(url: string): string | null {
  const id = getYoutubeVideoId(url);
  if (!id) return null;
  return YOUTUBE_THUMBNAIL_TEMPLATE.replace("VIDEO_ID", id);
}
