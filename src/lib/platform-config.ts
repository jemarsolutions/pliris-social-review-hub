export const platformValues = [
  "INSTAGRAM",
  "FACEBOOK",
  "LINKEDIN",
  "YOUTUBE",
  "TIKTOK",
] as const;
export const contentFormatValues = [
  "IMAGE_POST",
  "CAROUSEL",
  "SHORT_VIDEO",
  "LONG_VIDEO",
] as const;
export type PlatformValue = (typeof platformValues)[number];
export type ContentFormatValue = (typeof contentFormatValues)[number];
export const formatsByPlatform: Record<PlatformValue, ContentFormatValue[]> = {
  INSTAGRAM: ["IMAGE_POST", "CAROUSEL", "SHORT_VIDEO"],
  FACEBOOK: ["IMAGE_POST", "CAROUSEL", "SHORT_VIDEO", "LONG_VIDEO"],
  LINKEDIN: ["IMAGE_POST", "CAROUSEL", "LONG_VIDEO"],
  YOUTUBE: ["SHORT_VIDEO", "LONG_VIDEO"],
  TIKTOK: ["SHORT_VIDEO"],
};
export function isPlatformFormatAllowed(
  platform: PlatformValue,
  contentFormat: ContentFormatValue,
) {
  return formatsByPlatform[platform].includes(contentFormat);
}
