// Only controlled messages and scalar metadata leave this boundary. Provider
// errors can contain request bodies, generated text, and credentials.
export function captionGenerationFailure(error: unknown) {
  const names: string[] = [];
  let statusCode: number | undefined;
  let providerCode: string | undefined;
  let billingVerificationRequired = false;
  let cause: unknown = error;
  const seen = new Set<unknown>();
  for (
    let depth = 0;
    depth < 6 && cause && typeof cause === "object";
    depth++
  ) {
    if (seen.has(cause)) break;
    seen.add(cause);
    const entry = cause as {
      name?: unknown;
      statusCode?: unknown;
      code?: unknown;
      message?: unknown;
      cause?: unknown;
    };
    if (typeof entry.name === "string" && /^[\w-]{1,80}$/.test(entry.name))
      names.push(entry.name);
    // Match known provider text without returning or logging the raw message.
    // GatewayInternalServerError can wrap a 403 JSON body in its cause message.
    if (
      typeof entry.message === "string" &&
      (entry.message.includes("customer_verification_required") ||
        /AI Gateway requires a valid credit card on file/i.test(entry.message))
    )
      billingVerificationRequired = true;
    if (statusCode === undefined && typeof entry.statusCode === "number")
      statusCode = entry.statusCode;
    if (
      providerCode === undefined &&
      typeof entry.code === "string" &&
      /^[\w-]{1,80}$/.test(entry.code)
    )
      providerCode = entry.code;
    cause = entry.cause;
  }
  const metadata = {
    errorNames: names,
    upstreamStatus: statusCode,
    providerCode: billingVerificationRequired
      ? "customer_verification_required"
      : providerCode,
  };
  const failure = (category: string, message: string) => ({
    category,
    message,
    ...metadata,
  });
  if (statusCode === 401 || names.includes("GatewayAuthenticationError"))
    return failure(
      "authentication",
      "The AI service rejected its API key. Check the Production AI Gateway key and redeploy.",
    );
  if (statusCode === 402)
    return failure(
      "credits",
      "AI generation is unavailable because the AI Gateway credit or spending limit was reached.",
    );
  if (billingVerificationRequired)
    return failure(
      "billing_verification",
      "AI Gateway requires billing verification. Add a valid card in your Vercel team's AI Gateway settings to unlock credits, then try again.",
    );
  if (statusCode === 403)
    return failure(
      "access",
      "The AI service denied access. Check the Gateway key's team and model permissions.",
    );
  if (statusCode === 404 || names.includes("GatewayModelNotFoundError"))
    return failure(
      "model",
      "The configured caption model is unavailable. Check PERSONAL_CAPTION_MODEL in Production.",
    );
  if (statusCode === 429)
    return failure(
      "rate_limit",
      "The AI service is busy or its request limit was reached. Please try again shortly.",
    );
  if (
    names.some((name) => /Timeout|Abort/.test(name)) ||
    statusCode === 408 ||
    statusCode === 504
  )
    return failure(
      "timeout",
      "Caption generation timed out. Please try again shortly.",
    );
  if (
    names.some((name) =>
      /NoObjectGenerated|NoOutputGenerated|TypeValidation|JSONParse|Zod/.test(
        name,
      ),
    )
  )
    return failure(
      "output",
      "The AI response could not be read as a valid caption. Please try generating again.",
    );
  if (statusCode === 400 || statusCode === 422)
    return failure(
      "request",
      "The AI service rejected the caption request. Check the caption generation runtime log for the request configuration.",
    );
  return failure(
    "unknown",
    "AI generation failed. Please check the caption generation runtime log or write the caption manually.",
  );
}
