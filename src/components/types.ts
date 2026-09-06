export type Version = {
  id: string;
  platformVariantId: string;
  versionNumber: number;
  caption: string;
  ctaText: string;
  ctaUrl: string;
  media: { id: string; altText: string; sortOrder: number }[];
  createdAt: string;
  createdBy: string;
};
export type Variant = {
  id: string;
  contentItemId: string;
  platform: "INSTAGRAM" | "FACEBOOK" | "LINKEDIN";
  plannedPublishAt: string;
  reviewStatus: string;
  publishingStatus: string;
  currentVersionId: string;
  version: Version;
};
export type Item = {
  id: string;
  title: string;
  internalReference: string;
  contentDate: string;
  campaign: string;
  conceptSummary: string;
  variants: Variant[];
};
export type HubData = {
  items: Item[];
  coverage: {
    approved: number;
    total: number;
    percentage: number;
    earliestUnapproved: (Variant & { title: string }) | null;
  };
  counts: {
    review: number;
    revisions: number;
    approved: number;
    upcoming: number;
  };
};
export type History = {
  variant: Variant;
  versions: Version[];
  decisions: {
    decision: {
      id: string;
      versionId: string;
      decision: string;
      reason: string;
      createdAt: string;
    };
    reviewer: string;
  }[];
  comments: {
    comment: { id: string; versionId: string; body: string; createdAt: string };
    author: string;
  }[];
  events: {
    event: { id: string; action: string; createdAt: string };
    actor: string;
  }[];
  publishing: {
    id: string;
    versionId: string;
    status: string;
    publishedAt: string | null;
    publishedUrl: string | null;
  }[];
};
export async function api<T = unknown>(
  path: string,
  method = "GET",
  data?: unknown,
): Promise<T> {
  const r = await fetch(`/api/v1/${path}`, {
    method,
    headers:
      data instanceof FormData ? {} : { "Content-Type": "application/json" },
    body:
      data instanceof FormData ? data : data ? JSON.stringify(data) : undefined,
  });
  const json = await r.json();
  if (!r.ok)
    throw new Error(
      json.error?.details?.[0]?.message ||
        json.error?.message ||
        "Request failed.",
    );
  return json.data;
}
