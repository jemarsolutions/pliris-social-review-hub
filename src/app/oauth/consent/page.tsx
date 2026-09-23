import ConsentForm from "./consent-form";

export default async function OAuthConsentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const scope = typeof params.scope === "string" ? params.scope : "";
  return <ConsentForm scope={scope} />;
}
