const LOCAL_ORIGIN = "http://localhost:3000";

function origin(value: string | undefined) {
  if (!value) return null;
  try {
    return new URL(value.includes("://") ? value : `https://${value}`).origin;
  } catch {
    return null;
  }
}

export function getTrustedAppOrigins() {
  const values = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.VERCEL_BRANCH_URL,
    process.env.VERCEL_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
  ];
  const trusted = values
    .map(origin)
    .filter((value): value is string => !!value);
  return [...new Set(trusted.length ? trusted : [LOCAL_ORIGIN])];
}

export function getAppBaseUrl() {
  const previewUrl =
    process.env.VERCEL_ENV === "preview"
      ? origin(process.env.VERCEL_BRANCH_URL) || origin(process.env.VERCEL_URL)
      : null;
  return (
    previewUrl ||
    origin(process.env.NEXT_PUBLIC_APP_URL) ||
    origin(process.env.VERCEL_PROJECT_PRODUCTION_URL) ||
    origin(process.env.VERCEL_URL) ||
    LOCAL_ORIGIN
  );
}

export function isTrustedAppOrigin(value: string | null) {
  const normalized = origin(value || undefined);
  return !!normalized && getTrustedAppOrigins().includes(normalized);
}
